import { and, desc, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, payments, rides, users } from "@/db/schema";
import type { BookingRow, RideRow, UserRow } from "@/db/schema";
import { env } from "@/lib/env";
import { maskPhone, userPhone } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { recordDriverEarningOnPayment, reverseDriverEarningOnRefund } from "@/lib/earnings";
import {
  createRazorpayOrder,
  createRazorpayRefund,
  fetchRazorpayPayment,
  isRazorpayConfigured,
  paymentMode,
  verifyPaymentSignature,
  RazorpayError,
} from "@/lib/razorpay";
import type { CreateBookingInput } from "@/lib/validation";

export class PaymentFlowError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly payload?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "PaymentFlowError";
  }
}

/**
 * Fails closed when Razorpay server credentials are absent.
 * Prevents any booking from being paid without the real gateway.
 */
export function requireRazorpayConfigured(): void {
  if (!isRazorpayConfigured()) {
    throw new PaymentFlowError(
      "Online payments are not available right now. Please try again later.",
      503,
      "RAZORPAY_NOT_CONFIGURED",
    );
  }
}

/** Platform commission rate — controlled server-side only. */
const COMMISSION_RATE = 0.05; // 5%

/** Calculates the 5% RideMate platform commission and driver payout. */
export function calculateFareBreakdown(amount: number) {
  const totalAmount = Math.max(0, amount);
  const commissionAmount = Math.round(totalAmount * COMMISSION_RATE);
  const driverAmount = Math.max(0, totalAmount - commissionAmount);
  return {
    totalAmount,
    commissionAmount,
    driverAmount,
  };
}

const ACTIVE_BOOKING_STATUSES = ["PENDING", "ACCEPTED"] as const;

function departureHasPassed(ride: RideRow): boolean {
  const departure = new Date(`${ride.travelDate}T${ride.departureTime}:00`);
  return !Number.isNaN(departure.getTime()) && departure.getTime() < Date.now();
}

/* ------------------------------------------------------------ helpers */

export async function blockedBetween(userA: number, userB: number): Promise<boolean> {
  const rows = await db.execute(
    sql`select 1 from blocks where (blocker_id = ${userA} and blocked_id = ${userB}) or (blocker_id = ${userB} and blocked_id = ${userA}) limit 1`,
  );
  return rows.rows.length > 0;
}

/* ---------------------------------------------------- order creation */

export type PaymentOrderResponse = {
  bookingId: number;
  rideId: number;
  orderId: string;
  razorpayOrderId?: string;
  amount: number;
  totalAmount: number;
  commissionAmount: number;
  driverAmount: number;
  currency: string;
  mode: "razorpay";
  /** PUBLIC Razorpay Key ID only — never the key secret. */
  keyId: string | null;
  expiresAt: string;
  seats: number;
  pickupPoint: string;
  prefill: { name: string; email: string; contact: string };
  message: string;
};

/**
 * Creates a gateway order and attaches it to an existing (legacy, unpaid)
 * booking so the passenger can still complete the payment flow.
 */
async function attachOrderToBooking(
  user: UserRow,
  ride: RideRow,
  booking: BookingRow,
): Promise<{ orderId: string; amount: number; expiresAt: Date }> {
  requireRazorpayConfigured();

  const amount = ride.pricePerSeat * booking.seats;
  const fare = calculateFareBreakdown(amount);
  const expiresAt = new Date(Date.now() + env.paymentWindowMinutes * 60 * 1000);

  // Real Razorpay Orders API call — no simulated order path exists.
  let orderId: string;
  try {
    const order = await createRazorpayOrder({
      amount: fare.totalAmount,
      currency: "INR",
      receipt: `ride-${ride.id}-booking-${booking.id}`,
      notes: { rideId: String(ride.id), userId: String(user.id), seats: String(booking.seats) },
    });
    orderId = order.id;
  } catch (error) {
    console.error("[payments] Razorpay order creation failed", error);
    throw new PaymentFlowError("Unable to start the payment. Please try again.", 502);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(bookings)
      .set({
        paymentOrderId: orderId,
        razorpayOrderId: orderId,
        paymentExpiresAt: expiresAt,
        paymentAmount: fare.totalAmount,
        commissionAmount: fare.commissionAmount,
        driverAmount: fare.driverAmount,
        totalPrice: fare.totalAmount,
        paymentStatus: "pending",
      })
      .where(eq(bookings.id, booking.id));

    await tx.insert(payments).values({
      bookingId: booking.id,
      userId: user.id,
      provider: "razorpay",
      orderId,
      razorpayOrderId: orderId,
      amount: fare.totalAmount,
      totalAmount: fare.totalAmount,
      commissionAmount: fare.commissionAmount,
      driverAmount: fare.driverAmount,
      currency: "INR",
      status: "pending",
      paymentStatus: "pending",
    });
  });

  return { orderId, amount: fare.totalAmount, expiresAt };
}

/**
 * Passenger pays when requesting the seat.
 *
 * 1. Server loads the ride and re-validates every rule.
 * 2. Seats are reserved atomically with a conditional UPDATE.
 * 3. The server calculates the amount (client input is never trusted).
 * 4. A REAL Razorpay order is created via the Razorpay Orders API.
 *
 * If Razorpay credentials are missing the request fails with 503 — no
 * booking is created and nothing can be marked paid.
 */
export async function createBookingPaymentOrder(
  user: UserRow,
  input: CreateBookingInput,
): Promise<PaymentOrderResponse> {
  requireRazorpayConfigured();

  if (user.verificationStatus !== "VERIFIED" || !user.verified) {
    throw new PaymentFlowError("Complete student verification before booking a seat.", 403, "UNVERIFIED");
  }

  const rideRows = await db.select().from(rides).where(eq(rides.id, input.rideId)).limit(1);
  const ride = rideRows[0];
  if (!ride) throw new PaymentFlowError("This ride is no longer available.", 404);
  if (ride.status !== "active") throw new PaymentFlowError("This ride is no longer accepting bookings.", 409);
  if (ride.driverId === user.id) throw new PaymentFlowError("You cannot book your own ride.", 400);
  if (departureHasPassed(ride)) throw new PaymentFlowError("This ride has already departed.", 409);
  if (ride.seatsAvailable < input.seats) {
    throw new PaymentFlowError(
      `Only ${ride.seatsAvailable} seat(s) left on this ride.`,
      409,
      "SEATS_UNAVAILABLE",
    );
  }
  if (await blockedBetween(user.id, ride.driverId)) {
    throw new PaymentFlowError("This ride is not available.", 404);
  }

  // Idempotency: reuse an existing unpaid order instead of creating a second one.
  const existing = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.rideId, ride.id),
        eq(bookings.riderId, user.id),
        inArray(bookings.status, [...ACTIVE_BOOKING_STATUSES]),
      ),
    )
    .limit(1);

  const existingBooking = existing[0];
  if (existingBooking) {
    if (existingBooking.paymentStatus === "PAID") {
      throw new PaymentFlowError("You already have a paid booking on this ride.", 409);
    }
    if (existingBooking.paymentOrderId) {
      const paymentRows = await db
        .select()
        .from(payments)
        .where(eq(payments.orderId, existingBooking.paymentOrderId))
        .limit(1);
      const payment = paymentRows[0];
      const expired =
        existingBooking.paymentExpiresAt !== null &&
        existingBooking.paymentExpiresAt.getTime() < Date.now();
      if (payment && !expired && payment.status === "PENDING") {
        // Legacy bookings may carry no deadline: hand out a fresh window.
        const deadline =
          existingBooking.paymentExpiresAt ??
          new Date(Date.now() + env.paymentWindowMinutes * 60 * 1000);
        if (!existingBooking.paymentExpiresAt) {
          await db
            .update(bookings)
            .set({ paymentExpiresAt: deadline })
            .where(eq(bookings.id, existingBooking.id));
        }
        return buildOrderResponse(user, existingBooking, ride, payment.orderId, payment.amount, {
          expiresAt: deadline.toISOString(),
          reused: true,
        });
      }
    }

    // Legacy booking created before the payment upgrade: attach a brand new
    // payment order to it instead of leaving the student in a dead end.
    if (existingBooking.status === "PENDING" && !existingBooking.paymentOrderId) {
      const legacyOrder = await attachOrderToBooking(user, ride, existingBooking);
      return buildOrderResponse(user, existingBooking, ride, legacyOrder.orderId, legacyOrder.amount, {
        expiresAt: legacyOrder.expiresAt.toISOString(),
      });
    }

    throw new PaymentFlowError("You already have an active booking request on this ride.", 409);
  }

  // Server-side pricing — the frontend never supplies an amount.
  const amount = ride.pricePerSeat * input.seats;
  const fare = calculateFareBreakdown(amount);
  const currency = "INR";
  const expiresAt = new Date(Date.now() + env.paymentWindowMinutes * 60 * 1000);

  // Real Razorpay Orders API call. If this throws, no booking is created.
  let orderId: string;
  try {
    const order = await createRazorpayOrder({
      amount: fare.totalAmount,
      currency,
      receipt: `ride-${ride.id}-user-${user.id}`,
      notes: { rideId: String(ride.id), userId: String(user.id), seats: String(input.seats) },
    });
    orderId = order.id;
  } catch (error) {
    console.error("[payments] Razorpay order creation failed", error);
    throw new PaymentFlowError("Unable to start the payment. Please try again.", 502);
  }

  const created = await db.transaction(async (tx) => {
    // Atomic conditional seat reservation — the database enforces availability.
    const reserved = await tx
      .update(rides)
      .set({ seatsAvailable: sql`${rides.seatsAvailable} - ${input.seats}` })
      .where(
        and(
          eq(rides.id, ride.id),
          eq(rides.status, "active"),
          sql`${rides.seatsAvailable} >= ${input.seats}`,
        ),
      )
      .returning({ seatsAvailable: rides.seatsAvailable });

    if (reserved.length === 0) {
      throw new PaymentFlowError(
        "Seats are no longer available on this ride.",
        409,
        "SEATS_UNAVAILABLE",
      );
    }

    const bookingRows = await tx
      .insert(bookings)
      .values({
        rideId: ride.id,
        riderId: user.id,
        seats: input.seats,
        pickupPoint: input.pickupPoint,
        message: input.message ?? "",
        totalPrice: fare.totalAmount,
        status: "PENDING",
        paymentStatus: "pending",
        paymentAmount: fare.totalAmount,
        commissionAmount: fare.commissionAmount,
        driverAmount: fare.driverAmount,
        paymentCurrency: currency,
        paymentOrderId: orderId,
        razorpayOrderId: orderId,
        paymentExpiresAt: expiresAt,
        contactUnlocked: false,
      })
      .returning();
    const booking = bookingRows[0]!;

    await tx.insert(payments).values({
      bookingId: booking.id,
      userId: user.id,
      provider: "razorpay",
      orderId,
      razorpayOrderId: orderId,
      amount: fare.totalAmount,
      totalAmount: fare.totalAmount,
      commissionAmount: fare.commissionAmount,
      driverAmount: fare.driverAmount,
      currency,
      status: "pending",
      paymentStatus: "pending",
    });

    return booking;
  });

  await notify(
    ride.driverId,
    "booking_request",
    "New seat request awaiting payment",
    `${user.fullName} requested ${input.seats} seat(s) on ${ride.fromLocation} → ${ride.toLocation} and is completing the payment.`,
    ride.id,
  );

  return buildOrderResponse(user, created, ride, orderId, fare.totalAmount, {
    expiresAt: expiresAt.toISOString(),
  });
}

function buildOrderResponse(
  user: UserRow,
  booking: BookingRow,
  ride: RideRow,
  orderId: string,
  amount: number,
  options: { expiresAt: string; reused?: boolean },
): PaymentOrderResponse {
  const fare = calculateFareBreakdown(amount);
  // Only the PUBLIC Razorpay Key ID is ever sent to the browser.
  // RAZORPAY_KEY_SECRET never leaves the server.
  return {
    bookingId: booking.id,
    rideId: ride.id,
    orderId,
    razorpayOrderId: orderId,
    amount: fare.totalAmount,
    totalAmount: fare.totalAmount,
    commissionAmount: booking.commissionAmount || fare.commissionAmount,
    driverAmount: booking.driverAmount || fare.driverAmount,
    currency: booking.paymentCurrency || "INR",
    mode: "razorpay",
    keyId: env.razorpay.keyId ?? null,
    expiresAt: options.expiresAt,
    seats: booking.seats,
    pickupPoint: booking.pickupPoint,
    prefill: {
      name: user.fullName,
      email: user.email,
      contact: userPhone(user),
    },
    message: options.reused
      ? "Continuing your pending payment for this ride."
      : `Seats reserved for ${env.paymentWindowMinutes} minutes — complete the payment to confirm your booking.`,
  };
}

/* ------------------------------------------------------------ verify */

export type VerifyResult = {
  paymentStatus: string;
  bookingStatus: string;
  bookingId: number;
  rideId: number;
  message: string;
  alreadyProcessed?: boolean;
};

/**
 * Server-side verification of a checkout result.
 * - Razorpay mode: HMAC signature + provider re-check of the captured amount.
 * - Simulator mode: HMAC order token (issued by the server at order creation).
 * Fully idempotent: a repeated call never duplicates a successful payment.
 */
export async function verifyBookingPayment(
  user: UserRow,
  input: {
    orderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  },
): Promise<VerifyResult> {
  requireRazorpayConfigured();

  const paymentRows = await db.select().from(payments).where(eq(payments.orderId, input.orderId)).limit(1);
  const payment = paymentRows[0];
  if (!payment || payment.userId !== user.id) {
    throw new PaymentFlowError("Payment order not found.", 404);
  }

  const bookingRows = await db.select().from(bookings).where(eq(bookings.id, payment.bookingId)).limit(1);
  const booking = bookingRows[0];
  if (!booking) throw new PaymentFlowError("Booking not found.", 404);

  // Idempotent: an already-verified payment is returned untouched.
  if (payment.verified && payment.status === "PAID") {
    return {
      paymentStatus: booking.paymentStatus,
      bookingStatus: booking.status,
      bookingId: booking.id,
      rideId: booking.rideId,
      message: "Payment already confirmed.",
      alreadyProcessed: true,
    };
  }

  if (payment.status === "REFUNDED" || payment.status === "REFUND_PENDING") {
    return {
      paymentStatus: booking.paymentStatus,
      bookingStatus: booking.status,
      bookingId: booking.id,
      rideId: booking.rideId,
      message: "This payment has been refunded.",
      alreadyProcessed: true,
    };
  }

  // A closed payment order can never be confirmed afterwards — this is what
  // stops an expired reservation from turning into a paid booking.
  if (payment.status === "CANCELLED" || payment.status === "FAILED") {
    throw new PaymentFlowError(
      "This payment request has expired or failed. Please start the booking again.",
      409,
      "PAYMENT_EXPIRED",
    );
  }

  if (booking.status !== "PENDING") {
    throw new PaymentFlowError(
      "This booking is no longer awaiting payment.",
      409,
      "PAYMENT_CLOSED",
    );
  }

  if (
    booking.paymentExpiresAt &&
    booking.paymentExpiresAt.getTime() < Date.now() &&
    payment.status === "PENDING"
  ) {
    await expirePayment(payment.orderId);
    throw new PaymentFlowError(
      "The payment window expired and the reserved seats were released.",
      409,
      "PAYMENT_EXPIRED",
    );
  }

  const rideRows = await db.select().from(rides).where(eq(rides.id, booking.rideId)).limit(1);
  const ride = rideRows[0];
  if (!ride) throw new PaymentFlowError("Ride not found.", 404);

  let success = false;
  let providerPaymentId = payment.paymentId ?? "";
  let failureReason = "";

  /*
   * REAL RAZORPAY VERIFICATION ONLY.
   * Two independent checks must both pass before a booking can become PAID:
   *   1. HMAC_SHA256(order_id | payment_id, RAZORPAY_KEY_SECRET) matches the
   *      razorpay_signature returned by Razorpay Checkout.
   *   2. A server-to-server fetch of the payment from the Razorpay API
   *      confirms the order id, the exact amount and a captured/authorized
   *      status.
   * There is no `outcome` flag or simulated token that can shortcut this.
   */
  if (!input.razorpayPaymentId || !input.razorpaySignature) {
    throw new PaymentFlowError("Payment confirmation is incomplete.", 400);
  }

  const signatureValid = verifyPaymentSignature({
    orderId: payment.orderId,
    paymentId: input.razorpayPaymentId,
    signature: input.razorpaySignature,
  });
  if (!signatureValid) {
    throw new PaymentFlowError(
      "We could not verify this payment. If money was deducted it will be auto-refunded by your bank — please contact support.",
      400,
      "SIGNATURE_INVALID",
    );
  }

  try {
    const providerPayment = await fetchRazorpayPayment(input.razorpayPaymentId);
    if (providerPayment.order_id !== payment.orderId) {
      throw new PaymentFlowError("Payment does not belong to this order.", 400, "SIGNATURE_INVALID");
    }
    if (providerPayment.amount !== payment.amount * 100) {
      throw new PaymentFlowError("Payment amount mismatch.", 400, "AMOUNT_MISMATCH");
    }
    providerPaymentId = providerPayment.id;
    success = providerPayment.status === "captured" || providerPayment.status === "authorized";
    if (!success) failureReason = `Provider status: ${providerPayment.status}`;
  } catch (error) {
    if (error instanceof PaymentFlowError) throw error;
    if (error instanceof RazorpayError) {
      throw new PaymentFlowError("Unable to verify payment with the provider.", 502);
    }
    throw error;
  }

  if (!success) {
    await markPaymentFailed(payment.orderId, providerPaymentId, failureReason);
    return {
      paymentStatus: "FAILED",
      bookingStatus: "CANCELLED",
      bookingId: booking.id,
      rideId: booking.rideId,
      message: "Payment failed. Your reserved seats have been released.",
    };
  }

  await db.transaction(async (tx) => {
    const confirmed = await tx
      .update(payments)
      .set({
        status: "PAID",
        paymentStatus: "paid",
        verified: true,
        verifiedAt: new Date(),
        paymentId: providerPaymentId,
        razorpayPaymentId: providerPaymentId,
        updatedAt: new Date(),
      })
      .where(and(eq(payments.id, payment.id), eq(payments.verified, false)))
      .returning({ id: payments.id });

    if (confirmed.length === 0) return; // concurrent verification already handled it

    await tx
      .update(bookings)
      .set({
        paymentStatus: "PAID",
        paymentVerified: true,
        paymentVerifiedAt: new Date(),
        paymentId: providerPaymentId,
        razorpayPaymentId: providerPaymentId,
        totalPrice: payment.amount,
      })
      .where(eq(bookings.id, booking.id));
  });

  // Record driver earnings ledger entry (initially PENDING until ride is completed)
  try {
    await recordDriverEarningOnPayment(booking.id);
  } catch (err) {
    console.error("[earnings] failed to record driver earning", err);
  }

  await notify(
    user.id,
    "payment_successful",
    "Payment successful 🎉",
    `₹${payment.amount} paid for ${ride.fromLocation} → ${ride.toLocation}. Waiting for the driver to accept.`,
    ride.id,
  );
  await notify(
    ride.driverId,
    "booking_request",
    "Paid seat request",
    `${user.fullName}'s payment of ₹${payment.amount} is complete. Accept the request to confirm the seat.`,
    ride.id,
  );

  return {
    paymentStatus: "PAID",
    bookingStatus: booking.status,
    bookingId: booking.id,
    rideId: booking.rideId,
    message: "Payment verified. Your booking request has been sent to the ride provider.",
  };
}

/* ------------------------------------------------------------ expiry */

/** Releases reserved seats for bookings whose payment window has lapsed. */
export async function releaseExpiredPayments(): Promise<number> {
  const expired = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.status, "PENDING"),
        eq(bookings.paymentStatus, "PENDING"),
        isNotNull(bookings.paymentOrderId),
        isNotNull(bookings.paymentExpiresAt),
        lt(bookings.paymentExpiresAt, new Date()),
      ),
    )
    .limit(50);

  let released = 0;
  for (const booking of expired) {
    const result = await expirePayment(booking.paymentOrderId!);
    if (result) released += 1;
  }
  return released;
}

async function expirePayment(orderId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const bookingRows = await tx
      .select()
      .from(bookings)
      .where(eq(bookings.paymentOrderId, orderId))
      .limit(1);
    const booking = bookingRows[0];
    if (!booking || booking.status !== "PENDING" || booking.paymentStatus !== "PENDING") return false;

    await tx
      .update(bookings)
      .set({
        status: "CANCELLED",
        paymentStatus: "CANCELLED",
        cancelledAt: new Date(),
        cancelledBy: "system",
        cancellationReason: "Payment window expired",
      })
      .where(eq(bookings.id, booking.id));

    await tx
      .update(payments)
      .set({ status: "CANCELLED", updatedAt: new Date() })
      .where(eq(payments.orderId, orderId));

    // Return the reserved seats.
    await tx
      .update(rides)
      .set({
        seatsAvailable: sql`LEAST(${rides.seatsTotal}, ${rides.seatsAvailable} + ${booking.seats})`,
      })
      .where(eq(rides.id, booking.rideId));

    return true;
  });
}

async function markPaymentFailed(orderId: string, paymentId: string, reason: string): Promise<void> {
  await db.transaction(async (tx) => {
    const bookingRows = await tx
      .select()
      .from(bookings)
      .where(eq(bookings.paymentOrderId, orderId))
      .limit(1);
    const booking = bookingRows[0];
    if (!booking || booking.paymentStatus !== "PENDING") return;

    await tx
      .update(bookings)
      .set({
        status: "CANCELLED",
        paymentStatus: "FAILED",
        paymentId: paymentId || null,
        cancelledAt: new Date(),
        cancelledBy: "system",
        cancellationReason: reason.slice(0, 240) || "Payment failed",
      })
      .where(eq(bookings.id, booking.id));

    await tx
      .update(payments)
      .set({ status: "FAILED", paymentId: paymentId || null, failureReason: reason.slice(0, 200), updatedAt: new Date() })
      .where(eq(payments.orderId, orderId));

    await tx
      .update(rides)
      .set({ seatsAvailable: sql`LEAST(${rides.seatsTotal}, ${rides.seatsAvailable} + ${booking.seats})` })
      .where(eq(rides.id, booking.rideId));
  });

  const bookingRows = await db.select().from(bookings).where(eq(bookings.paymentOrderId, orderId)).limit(1);
  const booking = bookingRows[0];
  if (booking) {
    await notify(
      booking.riderId,
      "payment_failed",
      "Payment failed",
      "Your payment could not be completed and the reserved seats were released. You can try booking again.",
      booking.rideId,
    );
  }
}

/* ------------------------------------------------------------ refunds */

export type RefundOutcome = {
  bookingId: number;
  paymentStatus: string;
  refundId: string | null;
  refundAmount: number;
  message: string;
};

/**
 * Issues a refund for an eligible paid booking. Idempotent: a booking that
 * already has a refund id is never refunded twice.
 */
export async function refundBooking(
  booking: BookingRow,
  actor: "rider" | "driver" | "system" | "admin",
  reason: string,
): Promise<RefundOutcome | null> {
  if (booking.paymentStatus !== "PAID" || !booking.paymentVerified) return null;
  if (booking.refundId) {
    return {
      bookingId: booking.id,
      paymentStatus: booking.paymentStatus,
      refundId: booking.refundId,
      refundAmount: booking.refundAmount,
      message: "Refund already requested for this booking.",
    };
  }

  const paymentRows = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, booking.paymentOrderId ?? ""))
    .limit(1);
  const payment = paymentRows[0];
  if (!payment || !payment.verified) return null;

  // Real Razorpay refund only. A refund cannot be faked locally.
  if (!payment.paymentId) {
    throw new PaymentFlowError(
      "This payment has no gateway reference and cannot be refunded automatically.",
      409,
      "REFUND_UNAVAILABLE",
    );
  }

  let refundId: string;
  const finalStatus: "REFUND_PENDING" = "REFUND_PENDING";
  try {
    const refund = await createRazorpayRefund({
      paymentId: payment.paymentId,
      amount: payment.amount,
    });
    refundId = refund.id;
  } catch (error) {
    console.error("[payments] Razorpay refund failed", error);
    throw new PaymentFlowError("Unable to process your refund right now. Please try again.", 502);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(payments)
      .set({
        refundId,
        refundAmount: payment.amount,
        refundStatus: finalStatus,
        status: finalStatus,
        updatedAt: new Date(),
      })
      .where(and(eq(payments.id, payment.id), sql`${payments.refundId} IS NULL`));

    await tx
      .update(bookings)
      .set({
        paymentStatus: finalStatus,
        refundId,
        refundAmount: payment.amount,
      })
      .where(eq(bookings.id, booking.id));
  });

  // Reconcile driver earnings ledger on refund
  try {
    await reverseDriverEarningOnRefund(booking.id);
  } catch (err) {
    console.error("[earnings] failed to reverse driver earning", err);
  }

  await notify(
    booking.riderId,
    "refund_update",
    "Refund initiated",
    `₹${payment.amount} for booking #${booking.id} is being refunded by Razorpay. Reason: ${reason || "booking cancelled"}.`,
    booking.rideId,
  );

  return {
    bookingId: booking.id,
    paymentStatus: finalStatus,
    refundId,
    refundAmount: payment.amount,
    message:
      "Refund initiated with Razorpay. It will reflect in your account within 5-7 working days.",
  };
}

/* ------------------------------------------------------------ history */

import type { PaymentHistoryItemDTO } from "@/lib/types";

export function maskPaymentId(paymentId: string | null): string | null {
  if (!paymentId) return null;
  if (paymentId.length <= 8) return paymentId;
  return `${paymentId.slice(0, 6)}••••${paymentId.slice(-4)}`;
}

export async function getPaymentHistory(userId: number): Promise<PaymentHistoryItemDTO[]> {
  await releaseExpiredPayments();

  const rows = await db
    .select({ payment: payments, booking: bookings, ride: rides })
    .from(payments)
    .innerJoin(bookings, eq(payments.bookingId, bookings.id))
    .innerJoin(rides, eq(bookings.rideId, rides.id))
    .where(eq(payments.userId, userId))
    .orderBy(desc(payments.createdAt))
    .limit(60);

  return rows.map((row) => {
    const amount = row.payment.amount;
    const fare = calculateFareBreakdown(amount);
    return {
      id: row.payment.id,
      orderId: row.payment.orderId,
      razorpayOrderId: row.payment.razorpayOrderId ?? row.payment.orderId,
      paymentId: maskPaymentId(row.payment.paymentId),
      razorpayPaymentId: maskPaymentId(row.payment.razorpayPaymentId ?? row.payment.paymentId),
      amount: row.payment.amount,
      totalAmount: row.payment.totalAmount || fare.totalAmount,
      commissionAmount: row.payment.commissionAmount || fare.commissionAmount,
      driverAmount: row.payment.driverAmount || fare.driverAmount,
      currency: row.payment.currency,
      status: row.payment.status,
      verified: row.payment.verified,
      refundId: maskPaymentId(row.payment.refundId),
      refundAmount: row.payment.refundAmount,
      refundStatus: row.payment.refundStatus,
      provider: "razorpay",
      createdAt: row.payment.createdAt.toISOString(),
      bookingId: row.booking.id,
      bookingStatus: row.booking.status,
      rideId: row.ride.id,
      route: `${row.ride.fromLocation} → ${row.ride.toLocation}`,
      travelDate: row.ride.travelDate,
      departureTime: row.ride.departureTime,
      seats: row.booking.seats,
    };
  });
}

/** Payments that still need to be completed by the current user. */
export async function pendingPaymentsForUser(userId: number) {
  const rows = await db
    .select({ payment: payments, booking: bookings, ride: rides })
    .from(payments)
    .innerJoin(bookings, eq(payments.bookingId, bookings.id))
    .innerJoin(rides, eq(bookings.rideId, rides.id))
    .where(and(eq(payments.userId, userId), eq(payments.status, "PENDING")))
    .limit(10);
  return rows;
}

export async function userRidesCompleted(userId: number): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.id, userId));
  return rows[0]?.count ?? 0;
}
