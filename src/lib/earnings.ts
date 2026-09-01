import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, driverEarnings, payments, rides, users } from "@/db/schema";
import type { BookingRow, DriverEarningRow, RideRow, UserRow } from "@/db/schema";
import { calculateFareBreakdown } from "@/lib/payments";
import { formatDatePretty, formatTime12h } from "@/lib/locations";
import { createRazorpayTransfer, paymentMode } from "@/lib/razorpay";
import type { DriverEarningItemDTO, DriverEarningsSummaryDTO } from "@/lib/types";

/**
 * Creates or updates the driver's earnings record when a passenger pays.
 * Initial status is PENDING ("Pending Earnings") because the ride is not completed yet.
 */
export async function recordDriverEarningOnPayment(bookingId: number): Promise<void> {
  const rows = await db
    .select({ booking: bookings, ride: rides })
    .from(bookings)
    .innerJoin(rides, eq(bookings.rideId, rides.id))
    .where(eq(bookings.id, bookingId))
    .limit(1);

  const row = rows[0];
  if (!row) return;

  const { booking, ride } = row;
  const fare = calculateFareBreakdown(booking.paymentAmount || booking.totalPrice);

  const isRideDone = ride.status === "completed" || booking.status === "COMPLETED";
  const initialStatus = isRideDone ? "AVAILABLE" : "PENDING";

  const existing = await db
    .select()
    .from(driverEarnings)
    .where(eq(driverEarnings.bookingId, bookingId))
    .limit(1);

  if (existing.length > 0) {
    const current = existing[0]!;
    // Do not overwrite if already paid out or processing.
    if (current.status !== "PAID_OUT" && current.status !== "PAYOUT_PROCESSING") {
      await db
        .update(driverEarnings)
        .set({
          totalFare: fare.totalAmount,
          commissionAmount: fare.commissionAmount,
          driverEarning: fare.driverAmount,
          status: initialStatus,
          updatedAt: new Date(),
        })
        .where(eq(driverEarnings.id, current.id));
    }
  } else {
    await db.insert(driverEarnings).values({
      driverId: ride.driverId,
      bookingId: booking.id,
      rideId: ride.id,
      totalFare: fare.totalAmount,
      commissionAmount: fare.commissionAmount,
      driverEarning: fare.driverAmount,
      status: initialStatus,
      payoutMethod: "BANK_TRANSFER",
    });
  }
}

/**
 * When a ride or booking is completed, transitions driver earnings from PENDING
 * to AVAILABLE ("Available for Payout").
 */
export async function markDriverEarningsAvailableForRide(rideId: number): Promise<void> {
  const rideBookings = await db.select().from(bookings).where(eq(bookings.rideId, rideId));
  for (const b of rideBookings) {
    if (b.paymentStatus === "PAID") {
      await recordDriverEarningOnPayment(b.id);
      await db
        .update(driverEarnings)
        .set({ status: "AVAILABLE", updatedAt: new Date() })
        .where(
          and(
            eq(driverEarnings.bookingId, b.id),
            inArray(driverEarnings.status, ["PENDING", "RIDE_COMPLETED"]),
          ),
        );
    }
  }
}

/**
 * When a booking is marked completed directly.
 */
export async function markDriverEarningAvailableForBooking(bookingId: number): Promise<void> {
  await recordDriverEarningOnPayment(bookingId);
  await db
    .update(driverEarnings)
    .set({ status: "AVAILABLE", updatedAt: new Date() })
    .where(
      and(
        eq(driverEarnings.bookingId, bookingId),
        inArray(driverEarnings.status, ["PENDING", "RIDE_COMPLETED"]),
      ),
    );
}

/**
 * When a ride or booking is cancelled/refunded, reverses or cancels the driver's earning.
 */
export async function reverseDriverEarningOnRefund(bookingId: number): Promise<void> {
  await db
    .update(driverEarnings)
    .set({
      status: "CANCELLED",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(driverEarnings.bookingId, bookingId),
        inArray(driverEarnings.status, ["PENDING", "AVAILABLE", "RIDE_COMPLETED"]),
      ),
    );
}

/**
 * Retrieves full driver earnings summary metrics and history ledger for a driver.
 */
export async function getDriverEarningsSummary(driverId: number): Promise<DriverEarningsSummaryDTO> {
  // Backfill driver earnings for any existing paid bookings of this driver
  const paidBookings = await db
    .select({ booking: bookings, ride: rides })
    .from(bookings)
    .innerJoin(rides, eq(bookings.rideId, rides.id))
    .where(and(eq(rides.driverId, driverId), eq(bookings.paymentStatus, "PAID")));

  for (const item of paidBookings) {
    const existing = await db
      .select()
      .from(driverEarnings)
      .where(eq(driverEarnings.bookingId, item.booking.id))
      .limit(1);
    if (existing.length === 0) {
      await recordDriverEarningOnPayment(item.booking.id);
    }
  }

  const rows = await db
    .select({
      earning: driverEarnings,
      booking: bookings,
      ride: rides,
      rider: users,
    })
    .from(driverEarnings)
    .innerJoin(bookings, eq(driverEarnings.bookingId, bookings.id))
    .innerJoin(rides, eq(driverEarnings.rideId, rides.id))
    .innerJoin(users, eq(bookings.riderId, users.id))
    .where(eq(driverEarnings.driverId, driverId))
    .orderBy(desc(driverEarnings.createdAt));

  let totalEarnings = 0;
  let pendingEarnings = 0;
  let availablePayout = 0;
  let totalCommission = 0;
  let paidOutAmount = 0;

  const earningsList: DriverEarningItemDTO[] = rows.map((row) => {
    const e = row.earning;
    const b = row.booking;
    const r = row.ride;
    const rider = row.rider;

    if (e.status !== "CANCELLED" && e.status !== "REFUNDED") {
      totalEarnings += e.driverEarning;
      totalCommission += e.commissionAmount;

      if (e.status === "PENDING") {
        pendingEarnings += e.driverEarning;
      } else if (e.status === "AVAILABLE" || e.status === "RIDE_COMPLETED") {
        availablePayout += e.driverEarning;
      } else if (e.status === "PAID_OUT") {
        paidOutAmount += e.driverEarning;
      }
    }

    return {
      id: e.id,
      bookingId: e.bookingId,
      rideId: e.rideId,
      driverId: e.driverId,
      route: `${r.fromLocation} → ${r.toLocation}`,
      travelDate: r.travelDate,
      departureTime: r.departureTime,
      riderName: rider.fullName,
      seats: b.seats,
      totalFare: e.totalFare,
      commissionAmount: e.commissionAmount,
      driverEarning: e.driverEarning,
      status: e.status,
      payoutId: e.payoutId,
      payoutMethod: e.payoutMethod,
      paidOutAt: e.paidOutAt ? e.paidOutAt.toISOString() : null,
      createdAt: e.createdAt.toISOString(),
    };
  });

  return {
    totalEarnings,
    pendingEarnings,
    availablePayout,
    totalCommission,
    paidOutAmount,
    earnings: earningsList,
  };
}

/**
 * Driver requests payout for available earnings.
 */
export async function requestDriverPayout(driverId: number): Promise<{ count: number; amount: number; payoutId: string }> {
  const summary = await getDriverEarningsSummary(driverId);
  if (summary.availablePayout <= 0) {
    throw new Error("No earnings available for payout at this time.");
  }

  // Lock available rows by transitioning status to PAYOUT_PROCESSING in a transaction
  const rowsToProcess = await db.transaction(async (tx) => {
    const availableRows = await tx
      .select()
      .from(driverEarnings)
      .where(
        and(
          eq(driverEarnings.driverId, driverId),
          inArray(driverEarnings.status, ["AVAILABLE", "RIDE_COMPLETED", "FAILED"]),
        ),
      );

    if (availableRows.length === 0) {
      throw new Error("No earnings currently eligible for payout.");
    }

    const lockedIds = availableRows.map((r) => r.id);
    await tx
      .update(driverEarnings)
      .set({ status: "PAYOUT_PROCESSING", updatedAt: new Date() })
      .where(inArray(driverEarnings.id, lockedIds));

    return availableRows;
  });

  const now = new Date();
  const payoutBatchId = `payout_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  let paidAmount = 0;
  let successCount = 0;

  for (const row of rowsToProcess) {
    let finalStatus: "PAID_OUT" | "FAILED" = "FAILED";
    let transferId = payoutBatchId;
    let failureMsg = "Payout could not be initiated.";

    // Real Razorpay Route transfer only. There is no simulated payout path:
    // an earning can never be marked PAID_OUT without a gateway transfer id.
    const paymentRows = await db
      .select()
      .from(payments)
      .where(eq(payments.bookingId, row.bookingId))
      .limit(1);
    const payment = paymentRows[0];
    const linkedAccount = (process.env.RAZORPAY_DRIVER_ACCOUNT_ID ?? "").trim();

    if (!payment?.paymentId) {
      failureMsg = "No verified gateway payment found for this booking.";
    } else if (!linkedAccount) {
      // Razorpay Route linked account is a dashboard/KYC step the owner must complete.
      failureMsg =
        "Razorpay Route linked account is not configured yet. Payout is queued until setup is complete.";
    } else {
      try {
        const transferRes = await createRazorpayTransfer({
          paymentId: payment.paymentId,
          account: linkedAccount,
          amount: row.driverEarning,
          notes: { driverId: String(driverId), bookingId: String(row.bookingId) },
        });

        const transfer = transferRes.items?.[0];
        if (transfer) {
          transferId = transfer.id;
          finalStatus = transfer.status === "failed" ? "FAILED" : "PAID_OUT";
          failureMsg = transfer.error?.description ?? "";
        } else {
          failureMsg = "Razorpay did not return a transfer reference.";
        }
      } catch (err) {
        console.error("[earnings] Razorpay Route transfer failed:", err);
        finalStatus = "FAILED";
        failureMsg = err instanceof Error ? err.message : "Route transfer error";
      }
    }

    if (finalStatus === "PAID_OUT") {
      paidAmount += row.driverEarning;
      successCount += 1;
      await db
        .update(driverEarnings)
        .set({
          status: "PAID_OUT",
          payoutId: transferId,
          razorpayTransferId: transferId,
          payoutMethod: "RAZORPAY_ROUTE",
          paidOutAt: now,
          updatedAt: now,
          failureReason: null,
        })
        .where(eq(driverEarnings.id, row.id));
    } else {
      await db
        .update(driverEarnings)
        .set({
          status: "FAILED",
          payoutId: transferId,
          failureReason: failureMsg.slice(0, 240) || "Payout transfer failed",
          updatedAt: now,
        })
        .where(eq(driverEarnings.id, row.id));
    }
  }

  return {
    count: successCount,
    amount: paidAmount,
    payoutId: payoutBatchId,
  };
}

/**
 * Retrieves platform-wide driver earnings overview for the Admin Console.
 */
export async function getAdminDriverEarningsOverview() {
  const rows = await db
    .select({
      earning: driverEarnings,
      booking: bookings,
      ride: rides,
      driver: users,
      rider: users,
    })
    .from(driverEarnings)
    .innerJoin(bookings, eq(driverEarnings.bookingId, bookings.id))
    .innerJoin(rides, eq(driverEarnings.rideId, rides.id))
    .innerJoin(users, eq(driverEarnings.driverId, users.id))
    .orderBy(desc(driverEarnings.createdAt));

  let totalPlatformVolume = 0;
  let totalPlatformCommission = 0;
  let totalPendingDriverEarnings = 0;
  let totalAvailablePayouts = 0;
  let totalPayoutProcessing = 0;
  let totalPaidOutDrivers = 0;
  let totalRefundedAmount = 0;
  let totalFailedPayoutsCount = 0;

  const earningsList = rows.map((row) => {
    const e = row.earning;
    const r = row.ride;
    const driver = row.driver;

    if (e.status === "CANCELLED" || e.status === "REFUNDED") {
      totalRefundedAmount += e.driverEarning;
    } else {
      totalPlatformVolume += e.totalFare;
      totalPlatformCommission += e.commissionAmount;

      if (e.status === "PENDING") {
        totalPendingDriverEarnings += e.driverEarning;
      } else if (e.status === "AVAILABLE" || e.status === "RIDE_COMPLETED") {
        totalAvailablePayouts += e.driverEarning;
      } else if (e.status === "PAYOUT_PROCESSING") {
        totalPayoutProcessing += e.driverEarning;
      } else if (e.status === "PAID_OUT") {
        totalPaidOutDrivers += e.driverEarning;
      } else if (e.status === "FAILED") {
        totalFailedPayoutsCount += 1;
      }
    }

    return {
      id: e.id,
      bookingId: e.bookingId,
      rideId: e.rideId,
      driverId: e.driverId,
      driverName: driver.fullName,
      driverCollege: driver.college,
      route: `${r.fromLocation} → ${r.toLocation}`,
      travelDate: r.travelDate,
      departureTime: r.departureTime,
      totalFare: e.totalFare,
      commissionAmount: e.commissionAmount,
      driverEarning: e.driverEarning,
      status: e.status,
      payoutId: e.payoutId,
      payoutMethod: e.payoutMethod,
      paidOutAt: e.paidOutAt ? e.paidOutAt.toISOString() : null,
      createdAt: e.createdAt.toISOString(),
    };
  });

  const failedPaymentRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(payments)
    .where(eq(payments.status, "FAILED"));
  const totalFailedPaymentsCount = failedPaymentRows[0]?.count ?? 0;

  return {
    totalPlatformVolume,
    totalPlatformCommission,
    totalPendingDriverEarnings,
    totalAvailablePayouts,
    totalPayoutProcessing,
    totalPaidOutDrivers,
    totalRefundedAmount,
    totalFailedPaymentsCount,
    totalFailedPayoutsCount,
    earningsList,
  };
}
