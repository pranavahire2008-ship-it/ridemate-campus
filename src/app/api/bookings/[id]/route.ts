import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, rides, users } from "@/db/schema";
import type { BookingRow } from "@/db/schema";
import { fail, logError, parseBody, requireUser, sameOriginGuard } from "@/lib/api";
import { rateLimited, RATE_LIMITS } from "@/lib/rate-limit";
import { BookingActionSchema } from "@/lib/validation";
import { PaymentFlowError, refundBooking, blockedBetween } from "@/lib/payments";
import { notify } from "@/lib/notify";
import { markDriverEarningAvailableForBooking } from "@/lib/earnings";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const csrf = sameOriginGuard(request);
    if (csrf) return csrf;

    const limit = rateLimited(request, "booking-action", RATE_LIMITS.booking);
    if (limit) return limit;

    const { id } = await params;
    const bookingId = Number.parseInt(id, 10);
    if (Number.isNaN(bookingId) || bookingId <= 0) return fail("Invalid booking id.", 400);

    const auth = await requireUser();
    if ("response" in auth) return auth.response;

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return fail("Invalid JSON body.", 400);
    }
    const parsed = parseBody(raw, BookingActionSchema);
    if ("response" in parsed) return parsed.response;
    const { action, reason } = parsed.data;

    const rows = await db
      .select({ booking: bookings, ride: rides })
      .from(bookings)
      .innerJoin(rides, eq(bookings.rideId, rides.id))
      .where(eq(bookings.id, bookingId))
      .limit(1);
    const row = rows[0];
    if (!row) return fail("Booking not found.", 404);

    const booking = row.booking;
    const ride = row.ride;
    const isDriver = ride.driverId === auth.user.id;
    const isRider = booking.riderId === auth.user.id;
    if (!isDriver && !isRider) return fail("You do not have permission to do that.", 403);

    if (isDriver && isRider) return fail("You cannot act on your own ride booking.", 400);
    if (await blockedBetween(booking.riderId, ride.driverId)) {
      return fail("This booking is no longer available.", 403);
    }

    const driverRows = await db.select().from(users).where(eq(users.id, ride.driverId)).limit(1);
    const riderRows = await db.select().from(users).where(eq(users.id, booking.riderId)).limit(1);
    const driver = driverRows[0];
    const rider = riderRows[0];
    const driverName = driver?.fullName ?? "The ride provider";
    const riderName = rider?.fullName ?? "A student";

    /* ---------------------------------------------------------- accept */
    if (action === "accept") {
      if (!isDriver) return fail("Only the ride provider can accept a request.", 403);
      if (booking.status !== "PENDING") return fail("This request was already handled.", 409);

      // Grandfathered bookings created before the payment upgrade have no order.
      const legacyBooking = !booking.paymentOrderId;
      if (!legacyBooking && booking.paymentStatus !== "PAID") {
        return fail(
          "Payment for this request is not completed yet. Ask the student to finish the payment.",
          409,
          "PAYMENT_REQUIRED",
        );
      }

      const accepted = await db.transaction(async (tx) => {
        // Atomic guard: seats must still be free for this booking.
        const confirmedSeats = await tx
          .update(rides)
          .set({ seatsAvailable: sql`${rides.seatsAvailable} - ${booking.seats}` })
          .where(
            and(
              eq(rides.id, ride.id),
              eq(rides.status, "active"),
              sql`${rides.seatsAvailable} >= ${booking.seats}`,
            ),
          )
          .returning({ id: rides.id });

        if (confirmedSeats.length === 0) {
          throw new PaymentFlowError(
            "Seats are no longer available on this ride.",
            409,
            "SEATS_UNAVAILABLE",
          );
        }

        const updated = await tx
          .update(bookings)
          .set({ status: "ACCEPTED", contactUnlocked: true })
          .where(and(eq(bookings.id, booking.id), eq(bookings.status, "PENDING")))
          .returning();
        return updated[0] ?? null;
      });

      if (!accepted) return fail("This request was already handled.", 409);

      await notify(
        booking.riderId,
        "booking_accepted",
        "Booking accepted 🎉",
        `${driverName} accepted your paid request for ${ride.fromLocation} → ${ride.toLocation}. Contact details are unlocked.`,
        ride.id,
      );
      await notify(
        ride.driverId,
        "booking_confirmed",
        "Booking confirmed",
        `${riderName} is confirmed for ${booking.seats} seat(s). Payment received.`,
        ride.id,
      );
      return NextResponse.json({ ok: true, status: "ACCEPTED" });
    }

    /* --------------------------------------------------------- reject */
    if (action === "reject") {
      if (!isDriver) return fail("Only the ride provider can reject a request.", 403);
      if (booking.status !== "PENDING") return fail("This request was already handled.", 409);

      await db.transaction(async (tx) => {
        await tx
          .update(bookings)
          .set({
            status: "REJECTED",
            cancelledAt: new Date(),
            cancelledBy: "driver",
            cancellationReason: reason || "Rejected by ride provider",
            contactUnlocked: false,
          })
          .where(and(eq(bookings.id, booking.id), eq(bookings.status, "PENDING")));

        // Unpaid (expired) requests still hold reserved seats — release them.
        if (booking.paymentStatus === "PENDING") {
          await tx
            .update(rides)
            .set({
              seatsAvailable: sql`LEAST(${rides.seatsTotal}, ${rides.seatsAvailable} + ${booking.seats})`,
            })
            .where(eq(rides.id, ride.id));
        }
      });

      await notify(
        booking.riderId,
        "booking_rejected",
        "Booking rejected",
        `${driverName} could not accept your request for ${ride.fromLocation} → ${ride.toLocation}.`,
        ride.id,
      );

      // Option B: a rejected paid booking is refunded automatically.
      const refreshed = await db.select().from(bookings).where(eq(bookings.id, booking.id)).limit(1);
      const refund = refreshed[0] ? await refundBooking(refreshed[0], "driver", "Ride provider rejected the request") : null;

      return NextResponse.json({ ok: true, status: "REJECTED", refund });
    }

    /* --------------------------------------------------------- cancel */
    if (action === "cancel") {
      if (booking.status === "COMPLETED") return fail("This ride is already completed.", 409);
      if (booking.status === "CANCELLED" || booking.status === "REJECTED") {
        return fail("This booking is already closed.", 409);
      }

      await db.transaction(async (tx) => {
        await tx
          .update(bookings)
          .set({
            status: "CANCELLED",
            paymentStatus: booking.paymentStatus === "PAID" ? booking.paymentStatus : "CANCELLED",
            cancelledAt: new Date(),
            cancelledBy: isRider ? "rider" : "driver",
            cancellationReason: reason || (isRider ? "Cancelled by student" : "Cancelled by ride provider"),
            contactUnlocked: false,
          })
          .where(eq(bookings.id, booking.id));

        // Release the seats that were reserved/held for this booking.
        if (booking.paymentStatus === "PENDING" || booking.status === "ACCEPTED") {
          await tx
            .update(rides)
            .set({
              seatsAvailable: sql`LEAST(${rides.seatsTotal}, ${rides.seatsAvailable} + ${booking.seats})`,
            })
            .where(eq(rides.id, ride.id));
        }

        if (booking.paymentStatus === "PENDING") {
          await tx
            .update(bookings)
            .set({ paymentStatus: "CANCELLED" })
            .where(eq(bookings.id, booking.id));
        }
      });

      const targetId = isRider ? ride.driverId : booking.riderId;
      await notify(
        targetId,
        "ride_cancelled",
        "Booking cancelled",
        `${isRider ? riderName : driverName} cancelled a booking on ${ride.fromLocation} → ${ride.toLocation}.`,
        ride.id,
      );

      const refreshed = await db.select().from(bookings).where(eq(bookings.id, booking.id)).limit(1);
      const refund = refreshed[0]
        ? await refundBooking(refreshed[0], isRider ? "rider" : "driver", reason || "Booking cancelled")
        : null;

      return NextResponse.json({ ok: true, status: "CANCELLED", refund });
    }

    /* ------------------------------------------------------- complete */
    if (action === "complete") {
      if (booking.status !== "ACCEPTED") {
        return fail("Only accepted bookings can be marked completed.", 409);
      }

      await db.transaction(async (tx) => {
        await tx
          .update(bookings)
          .set({ status: "COMPLETED" })
          .where(and(eq(bookings.id, booking.id), eq(bookings.status, "ACCEPTED")));

        if (ride.status !== "completed") {
          await tx.update(rides).set({ status: "completed" }).where(eq(rides.id, ride.id));
        }
        if (driver) {
          await tx
            .update(users)
            .set({ ridesCompleted: driver.ridesCompleted + 1 })
            .where(eq(users.id, driver.id));
        }
        if (rider) {
          await tx
            .update(users)
            .set({ ridesCompleted: rider.ridesCompleted + 1 })
            .where(eq(users.id, rider.id));
        }
      });

      // Move driver earning from PENDING to AVAILABLE for payout
      try {
        await markDriverEarningAvailableForBooking(booking.id);
      } catch (err) {
        console.error("[earnings] failed to mark driver earning available", err);
      }

      const targetId = isRider ? ride.driverId : booking.riderId;
      await notify(
        targetId,
        "ride_completed",
        "Ride completed",
        `Your ride ${ride.fromLocation} → ${ride.toLocation} is complete. Leave a rating!`,
        ride.id,
      );
      return NextResponse.json({ ok: true, status: "COMPLETED" });
    }

    return fail("Unknown action.", 400);
  } catch (error) {
    if (error instanceof PaymentFlowError) return fail(error.message, error.status, error.code);
    return logError("booking update failed", error);
  }
}
