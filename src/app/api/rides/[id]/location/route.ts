import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, driverLiveLocations, rides } from "@/db/schema";
import { fail, logError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET — current driver location for a ride. Only visible to:
 *  - the driver themselves
 *  - a rider with an ACCEPTED or COMPLETED booking on this ride
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rideId = Number.parseInt(id, 10);
    if (Number.isNaN(rideId) || rideId <= 0) return fail("Ride not found.", 404);

    const viewer = await getCurrentUser();
    if (!viewer) return fail("Login required.", 401);

    const rideRows = await db.select().from(rides).where(eq(rides.id, rideId)).limit(1);
    const ride = rideRows[0];
    if (!ride) return fail("Ride not found.", 404);

    const isOwner = ride.driverId === viewer.id;
    if (!isOwner) {
      const mine = await db
        .select()
        .from(bookings)
        .where(and(eq(bookings.rideId, rideId), eq(bookings.riderId, viewer.id)))
        .limit(1);
      const authorized = mine[0] && (mine[0].status === "ACCEPTED" || mine[0].status === "COMPLETED");
      if (!authorized) return fail("Not authorized to view this ride's location.", 403);
    }

    const rows = await db
      .select()
      .from(driverLiveLocations)
      .where(eq(driverLiveLocations.rideId, rideId))
      .limit(1);

    const row = rows[0];
    if (!row) return NextResponse.json({ location: null });

    return NextResponse.json({
      location: { lat: row.lat, lng: row.lng, updatedAt: row.updatedAt.toISOString() },
    });
  } catch (error) {
    return logError("ride location GET", error);
  }
}
