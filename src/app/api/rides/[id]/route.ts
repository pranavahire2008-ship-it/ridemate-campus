import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, rides } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { fail, logError, parseBody, requireUser, sameOriginGuard } from "@/lib/api";
import { rateLimited, RATE_LIMITS } from "@/lib/rate-limit";
import {
  blockedDriverIds,
  canRevealContact,
  fetchRideById,
  fetchRidesWithDrivers,
  notify,
  serializeRide,
} from "@/lib/rides";
import { releaseExpiredPayments } from "@/lib/payments";
import { RideActionSchema } from "@/lib/validation";
import { sortMatches } from "@/lib/locations";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await releaseExpiredPayments();

    const { id } = await params;
    const rideId = Number.parseInt(id, 10);
    if (Number.isNaN(rideId) || rideId <= 0) return fail("Ride not found.", 404);

    const row = await fetchRideById(rideId);
    if (!row) return fail("Ride not found.", 404);
    if (row.driver.suspended) return fail("Ride not found.", 404);

    const viewer = await getCurrentUser();
    if (viewer) {
      const blocked = await blockedDriverIds(viewer.id);
      if (blocked.includes(row.ride.driverId) && row.ride.driverId !== viewer.id) {
        return fail("Ride not found.", 404);
      }
    }

    // Contact details are revealed only to participants with an accepted or
    // completed booking — enforced server side, never by the client.
    let revealPhone = false;
    let revealStops = false;
    let isOwner = false;
    if (viewer) {
      isOwner = viewer.id === row.ride.driverId;
      if (isOwner) {
        revealPhone = true;
        revealStops = true;
      } else {
        const viewerBookings = await db
          .select()
          .from(bookings)
          .where(and(eq(bookings.rideId, rideId), eq(bookings.riderId, viewer.id)));
        const confirmed = viewerBookings.some((b) => canRevealContact(b));
        revealPhone = confirmed;
        revealStops = viewerBookings.some(
          (b) => b.status === "ACCEPTED" || b.status === "COMPLETED" || b.paymentStatus === "PAID",
        );
      }
    }

    const all = await fetchRidesWithDrivers();
    const blocked = viewer ? await blockedDriverIds(viewer.id) : [];
    const others = all.filter(
      (r) =>
        r.ride.id !== rideId &&
        r.ride.status === "active" &&
        !r.driver.suspended &&
        !blocked.includes(r.ride.driverId),
    );
    const similar = sortMatches(
      {
        fromLocation: row.ride.fromLocation,
        toLocation: row.ride.toLocation,
        direction: row.ride.direction,
        travelDate: row.ride.travelDate,
        departureTime: row.ride.departureTime,
      },
      others.map((r) => serializeRide(r, false, false)),
    )
      .slice(0, 3)
      .map((m) => ({
        ...m.ride,
        match: {
          score: m.score,
          pickupKm: Math.round(m.pickupKm * 10) / 10,
          dropKm: Math.round(m.dropKm * 10) / 10,
          minutesDiff: m.minutesDiff,
          reason: m.reason,
        },
      }));

    let requests: Array<Record<string, unknown>> = [];
    if (isOwner) {
      const rows = await db.select().from(bookings).where(eq(bookings.rideId, rideId));
      requests = rows.map((b) => ({
        id: b.id,
        seats: b.seats,
        pickupPoint: b.pickupPoint,
        message: b.message,
        status: b.status,
        paymentStatus: b.paymentStatus,
        totalPrice: b.totalPrice,
        createdAt: b.createdAt.toISOString(),
      }));
    }

    let myBooking: { id: number; status: string } | null = null;
    if (viewer && !isOwner) {
      const mine = await db
        .select()
        .from(bookings)
        .where(and(eq(bookings.rideId, rideId), eq(bookings.riderId, viewer.id)))
        .limit(1);
      if (mine[0]) myBooking = { id: mine[0].id, status: mine[0].status };
    }

    return NextResponse.json({
      ride: serializeRide(row, revealPhone, revealStops),
      similar,
      isOwner,
      requests,
      myBooking,
    });
  } catch (error) {
    return logError("ride detail failed", error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const csrf = sameOriginGuard(request);
    if (csrf) return csrf;

    const limit = rateLimited(request, "ride-update", RATE_LIMITS.rideCreate);
    if (limit) return limit;

    const { id } = await params;
    const rideId = Number.parseInt(id, 10);
    if (Number.isNaN(rideId)) return fail("Invalid ride id.", 400);

    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const user = auth.user;

    const row = await fetchRideById(rideId);
    if (!row) return fail("Ride not found.", 404);
    if (row.ride.driverId !== user.id) {
      return fail("You can only manage your own rides.", 403);
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return fail("Invalid JSON body.", 400);
    }
    const parsed = parseBody(raw, RideActionSchema);
    if ("response" in parsed) return parsed.response;
    const { action, seatsAvailable, pricePerSeat } = parsed.data;

    if (action === "cancel") {
      const affected = await db.select().from(bookings).where(eq(bookings.rideId, rideId));
      const { refundBooking } = await import("@/lib/payments");
      const refunds: number[] = [];

      for (const booking of affected) {
        if (booking.status === "PENDING" || booking.status === "ACCEPTED") {
          await db.update(bookings).set({ status: "CANCELLED", contactUnlocked: false }).where(eq(bookings.id, booking.id));
          if (booking.paymentStatus === "PENDING") {
            await db
              .update(bookings)
              .set({ paymentStatus: "CANCELLED", cancelledBy: "driver", cancelledAt: new Date(), cancellationReason: "Ride cancelled" })
              .where(eq(bookings.id, booking.id));
          }
          await notify(
            booking.riderId,
            "ride_cancelled",
            "Ride cancelled",
            `${user.fullName} cancelled the ride ${row.ride.fromLocation} → ${row.ride.toLocation}.`,
            rideId,
          );
          if (booking.paymentStatus === "PAID") {
            const outcome = await refundBooking(booking, "driver", "Ride cancelled by provider");
            if (outcome) refunds.push(booking.id);
          }
        }
      }

      await db
        .update(rides)
        .set({ status: "cancelled", seatsAvailable: 0 })
        .where(eq(rides.id, rideId));

      return NextResponse.json({ ok: true, status: "cancelled", refundsIssued: refunds.length });
    }

    if (action === "complete") {
      const affected = await db.select().from(bookings).where(eq(bookings.rideId, rideId));
      for (const booking of affected) {
        if (booking.status === "ACCEPTED") {
          await db.update(bookings).set({ status: "COMPLETED" }).where(eq(bookings.id, booking.id));
          await notify(
            booking.riderId,
            "ride_completed",
            "Ride completed",
            `Your ride with ${user.fullName} is complete. Leave a rating!`,
            rideId,
          );
        }
      }
      await db.update(rides).set({ status: "completed" }).where(eq(rides.id, rideId));

      // Move all driver earnings for this ride from PENDING to AVAILABLE
      const { markDriverEarningsAvailableForRide } = await import("@/lib/earnings");
      try {
        await markDriverEarningsAvailableForRide(rideId);
      } catch (err) {
        console.error("[earnings] failed to update driver earnings on ride completion", err);
      }

      return NextResponse.json({ ok: true, status: "completed" });
    }

    if (action === "addSeats" || action === "update") {
      const nextSeats =
        seatsAvailable !== undefined
          ? Math.max(0, Math.min(row.ride.seatsTotal, seatsAvailable))
          : row.ride.seatsAvailable;
      const nextPrice =
        pricePerSeat !== undefined
          ? Math.max(0, Math.min(2000, pricePerSeat))
          : row.ride.pricePerSeat;
      await db
        .update(rides)
        .set({ seatsAvailable: nextSeats, pricePerSeat: nextPrice })
        .where(eq(rides.id, rideId));
      return NextResponse.json({ ok: true, seatsAvailable: nextSeats, pricePerSeat: nextPrice });
    }

    return fail("Unknown action.", 400);
  } catch (error) {
    return logError("ride update failed", error);
  }
}
