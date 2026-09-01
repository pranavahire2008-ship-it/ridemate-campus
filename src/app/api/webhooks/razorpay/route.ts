import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, payments, webhookEvents } from "@/db/schema";
import { fail, logError } from "@/lib/api";
import { rateLimited, RATE_LIMITS } from "@/lib/rate-limit";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { notify } from "@/lib/notify";
import { recordDriverEarningOnPayment } from "@/lib/earnings";

export const dynamic = "force-dynamic";

type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        amount?: number;
        status?: string;
        error_description?: string;
      };
    };
    refund?: {
      entity?: {
        id?: string;
        payment_id?: string;
        amount?: number;
        status?: string;
      };
    };
    transfer?: {
      entity?: {
        id?: string;
        account?: string;
        payment_id?: string;
        amount?: number;
        status?: string;
        error?: { description?: string };
      };
    };
    payout?: {
      entity?: {
        id?: string;
        amount?: number;
        status?: string;
        failure_reason?: string;
      };
    };
  };
};

/**
 * Razorpay webhook receiver.
 * - Reads the raw body (required for signature verification).
 * - Rejects any request whose X-Razorpay-Signature does not verify.
 * - Stores each event id so retries never process the same event twice.
 */
export async function POST(request: Request) {
  const limit = rateLimited(request, "webhook", RATE_LIMITS.webhook);
  if (limit) return limit;

  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return fail("Invalid webhook signature.", 401, "WEBHOOK_SIGNATURE_INVALID");
  }

  let payload: RazorpayWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as RazorpayWebhookPayload;
  } catch {
    return fail("Invalid webhook payload.", 400);
  }

  const event = payload.event ?? "unknown";
  const paymentEntity = payload.payload?.payment?.entity;
  const refundEntity = payload.payload?.refund?.entity;
  const transferEntity = payload.payload?.transfer?.entity;
  const payoutEntity = payload.payload?.payout?.entity;

  // Razorpay events carry a unique id in `payload.entity.id` plus the header
  // `X-Razorpay-Event-Id`; we build a stable key from the event + entity ids.
  const eventId =
    request.headers.get("x-razorpay-event-id") ??
    `${event}:${refundEntity?.id ?? transferEntity?.id ?? payoutEntity?.id ?? paymentEntity?.id ?? rawBody.length}:${paymentEntity?.order_id ?? ""}`;

  try {
    const inserted = await db
      .insert(webhookEvents)
      .values({
        eventId,
        eventType: event,
        orderId: paymentEntity?.order_id ?? null,
        paymentId: paymentEntity?.id ?? refundEntity?.payment_id ?? transferEntity?.payment_id ?? null,
      })
      .onConflictDoNothing({ target: webhookEvents.eventId })
      .returning({ id: webhookEvents.id });

    if (inserted.length === 0) {
      // Duplicate delivery — already handled, acknowledge without reprocessing.
      return NextResponse.json({ ok: true, duplicate: true });
    }

    if (event === "payment.captured" && paymentEntity?.order_id) {
      await handlePaymentCaptured(paymentEntity.order_id, paymentEntity.id ?? "");
    } else if (event === "payment.failed" && paymentEntity?.order_id) {
      await handlePaymentFailed(
        paymentEntity.order_id,
        paymentEntity.id ?? "",
        paymentEntity.error_description ?? "Payment failed",
      );
    } else if (event === "refund.processed" && refundEntity?.id) {
      await handleRefundProcessed(refundEntity.id, refundEntity.payment_id ?? "");
    } else if ((event === "transfer.processed" || event === "payout.processed") && (transferEntity?.id || payoutEntity?.id)) {
      await handlePayoutProcessed(transferEntity?.id ?? payoutEntity?.id ?? "");
    } else if ((event === "transfer.failed" || event === "payout.failed" || event === "payout.reversed") && (transferEntity?.id || payoutEntity?.id)) {
      const reason = transferEntity?.error?.description ?? payoutEntity?.failure_reason ?? "Transfer failed";
      await handlePayoutFailed(transferEntity?.id ?? payoutEntity?.id ?? "", reason);
    }

    return NextResponse.json({ ok: true, event });
  } catch (error) {
    return logError("webhooks/razorpay", error);
  }
}

async function handlePaymentCaptured(orderId: string, paymentId: string): Promise<void> {
  const rows = await db.select().from(payments).where(eq(payments.orderId, orderId)).limit(1);
  const payment = rows[0];
  if (!payment || payment.verified) return; // already verified via checkout

  await db.transaction(async (tx) => {
    await tx
      .update(payments)
      .set({ status: "PAID", verified: true, verifiedAt: new Date(), paymentId, updatedAt: new Date() })
      .where(and(eq(payments.id, payment.id), eq(payments.verified, false)));

    await tx
      .update(bookings)
      .set({
        paymentStatus: "PAID",
        paymentVerified: true,
        paymentVerifiedAt: new Date(),
        paymentId,
      })
      .where(eq(bookings.id, payment.bookingId));
  });

  const bookingRows = await db.select().from(bookings).where(eq(bookings.id, payment.bookingId)).limit(1);
  const booking = bookingRows[0];
  if (booking) {
    try {
      await recordDriverEarningOnPayment(booking.id);
    } catch (e) {
      console.error("[webhooks] failed to record driver earning", e);
    }
    await notify(
      booking.riderId,
      "payment_successful",
      "Payment confirmed",
      `Your payment of ₹${payment.amount} was confirmed by the payment gateway.`,
      booking.rideId,
    );
  }
}

async function handlePaymentFailed(orderId: string, paymentId: string, reason: string): Promise<void> {
  const rows = await db.select().from(payments).where(eq(payments.orderId, orderId)).limit(1);
  const payment = rows[0];
  if (!payment || payment.verified) return;

  await db.transaction(async (tx) => {
    await tx
      .update(payments)
      .set({ status: "FAILED", paymentId, failureReason: reason.slice(0, 200), updatedAt: new Date() })
      .where(and(eq(payments.id, payment.id), eq(payments.verified, false)));

    const bookingRows = await tx
      .select()
      .from(bookings)
      .where(eq(bookings.id, payment.bookingId))
      .limit(1);
    const booking = bookingRows[0];
    if (!booking || booking.paymentStatus === "PAID") return;

    await tx
      .update(bookings)
      .set({
        status: "CANCELLED",
        paymentStatus: "FAILED",
        cancelledAt: new Date(),
        cancelledBy: "system",
        cancellationReason: reason.slice(0, 240) || "Payment failed",
      })
      .where(eq(bookings.id, booking.id));
  });
}

async function handleRefundProcessed(refundId: string, paymentId: string): Promise<void> {
  const rows = await db
    .select()
    .from(payments)
    .where(eq(payments.paymentId, paymentId))
    .limit(1);
  const payment = rows[0];
  if (!payment) return;

  await db.transaction(async (tx) => {
    await tx
      .update(payments)
      .set({ status: "REFUNDED", refundStatus: "REFUNDED", updatedAt: new Date() })
      .where(and(eq(payments.id, payment.id), eq(payments.status, "REFUND_PENDING")));

    await tx
      .update(bookings)
      .set({ paymentStatus: "REFUNDED", refundId })
      .where(and(eq(bookings.id, payment.bookingId), eq(bookings.paymentStatus, "REFUND_PENDING")));
  });

  await notify(
    payment.userId,
    "refund_update",
    "Refund completed",
    `₹${payment.amount} has been refunded to your original payment method.`,
    null,
  );
}

async function handlePayoutProcessed(payoutId: string): Promise<void> {
  const { driverEarnings } = await import("@/db/schema");
  const rows = await db
    .select()
    .from(driverEarnings)
    .where(
      and(
        eq(driverEarnings.payoutId, payoutId),
        eq(driverEarnings.status, "PAYOUT_PROCESSING"),
      ),
    )
    .limit(1);

  const earning = rows[0];
  if (!earning) return;

  const now = new Date();
  await db
    .update(driverEarnings)
    .set({
      status: "PAID_OUT",
      paidOutAt: now,
      updatedAt: now,
    })
    .where(eq(driverEarnings.id, earning.id));

  await notify(
    earning.driverId,
    "payout_completed",
    "Driver Payout Completed 🎉",
    `Your payout of ₹${earning.driverEarning} has been confirmed by Razorpay.`,
    earning.rideId,
  );
}

async function handlePayoutFailed(payoutId: string, reason: string): Promise<void> {
  const { driverEarnings } = await import("@/db/schema");
  const rows = await db
    .select()
    .from(driverEarnings)
    .where(
      and(
        eq(driverEarnings.payoutId, payoutId),
        eq(driverEarnings.status, "PAYOUT_PROCESSING"),
      ),
    )
    .limit(1);

  const earning = rows[0];
  if (!earning) return;

  await db
    .update(driverEarnings)
    .set({
      status: "FAILED",
      failureReason: reason.slice(0, 240),
      updatedAt: new Date(),
    })
    .where(eq(driverEarnings.id, earning.id));

  await notify(
    earning.driverId,
    "payout_failed",
    "Driver Payout Failed",
    `Your payout of ₹${earning.driverEarning} failed (${reason}). You can retry from your Earnings page.`,
    earning.rideId,
  );
}


