import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { driverLiveLocations, rides } from "@/db/schema";
import { fail, logError, parseBody, requireUser, sameOriginGuard } from "@/lib/api";

export const dynamic = "force-dynamic";

const LocationSchema = z.object({
  rideId: z.number().int().positive(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/** POST — driver pushes their current GPS position for an active ride they own. */
export async function POST(request: Request) {
  try {
    const csrf = sameOriginGuard(request);
    if (csrf) return csrf;

    const auth = await requireUser();
    if ("response" in auth) return auth.response;

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return fail("Invalid JSON body.", 400);
    }
    const parsed = parseBody(raw, LocationSchema);
    if ("response" in parsed) return parsed.response;
    const { rideId, lat, lng } = parsed.data;

    const rideRows = await db.select().from(rides).where(eq(rides.id, rideId)).limit(1);
    const ride = rideRows[0];
    if (!ride) return fail("Ride not found.", 404);
    if (ride.driverId !== auth.user.id) {
      return fail("You can only share location for your own ride.", 403);
    }
    if (ride.status !== "active") {
      return fail("This ride is not active anymore.", 409);
    }

    const existing = await db
      .select()
      .from(driverLiveLocations)
      .where(eq(driverLiveLocations.driverId, auth.user.id))
      .limit(1);

    if (existing[0]) {
      await db
        .update(driverLiveLocations)
        .set({ rideId, lat, lng, updatedAt: new Date() })
        .where(eq(driverLiveLocations.driverId, auth.user.id));
    } else {
      await db.insert(driverLiveLocations).values({ driverId: auth.user.id, rideId, lat, lng });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return logError("driver location POST", error);
  }
}

/** DELETE — driver stops sharing location (e.g. ride completed or toggled off). */
export async function DELETE(request: Request) {
  try {
    const csrf = sameOriginGuard(request);
    if (csrf) return csrf;

    const auth = await requireUser();
    if ("response" in auth) return auth.response;

    await db.delete(driverLiveLocations).where(eq(driverLiveLocations.driverId, auth.user.id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return logError("driver location DELETE", error);
  }
}
