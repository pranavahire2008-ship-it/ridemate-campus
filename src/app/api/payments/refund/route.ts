import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, rides } from "@/db/schema";
import { fail, logError, parseBody, requireUser, sameOriginGuard } from "@/lib/api";
import { rateLimited, RATE_LIMITS } from "@/lib/rate-limit";
import { RefundRequestSchema } from "@/lib/validation";
import { PaymentFlowError, refundBooking } from "@/lib/payments";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

/**
 * Passenger-initiated refund request for a paid booking that they cancelled
 * or that the driver rejected/cancelled. Idempotent — a booking can never be
 * refunded twice.
 */
export async function POST(request: Request) {
  try {
    const csrf = sameOriginGuard(request);
    if (csrf) return csrf;

    const limit = rateLimited(request, "refund", RATE_LIMITS.refund);
    if (limit) return limit;

    const auth = await requireUser();
    if ("response" in auth) return auth.response;

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return fail("Invalid JSON body.", 400);
    }
    const parsed = parseBody(raw, RefundRequestSchema);
    if ("response" in parsed) return parsed.response;

    const rows = await db
      .select({ booking: bookings, ride: rides })
      .from(bookings)
      .innerJoin(rides, eq(bookings.rideId, rides.id))
      .where(eq(bookings.id, parsed.data.bookingId))
      .limit(1);

    const row = rows[0];
    if (!row) return fail("Booking not found.", 404);

    // Authorization: only the passenger who paid (or the ride driver) may
    // request a refund for this booking.
    const isRider = row.booking.riderId === auth.user.id;
    const isDriver = row.ride.driverId === auth.user.id;
    if (!isRider && !isDriver) return fail("You do not have permission to do that.", 403);

    if (row.booking.status === "COMPLETED") {
      return fail("This ride is already completed, so it is not refundable.", 409);
    }

    const outcome = await refundBooking(
      row.booking,
      isRider ? "rider" : "driver",
      parsed.data.reason || "Refund requested by student",
    );

    if (!outcome) {
      return fail(
        "This booking has no completed payment to refund.",
        409,
        "NOT_REFUNDABLE",
      );
    }

    if (isRider) {
      await notify(
        row.ride.driverId,
        "refund_update",
        "Refund requested",
        `${auth.user.fullName} requested a refund for ${row.ride.fromLocation} → ${row.ride.toLocation}.`,
        row.ride.id,
      );
    }

    return NextResponse.json({ refund: outcome });
  } catch (error) {
    if (error instanceof PaymentFlowError) return fail(error.message, error.status, error.code);
    return logError("payments/refund", error);
  }
}

/** Resumes an unpaid booking's checkout (returns the pending order). */
export async function GET() {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const rows = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.riderId, auth.user.id), eq(bookings.paymentStatus, "PENDING")));
    return NextResponse.json({ pending: rows.length });
  } catch (error) {
    return logError("payments/refund:get", error);
  }
}
