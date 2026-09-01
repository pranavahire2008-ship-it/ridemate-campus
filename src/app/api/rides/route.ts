import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { rides, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { fail, logError, parseBody, requireVerifiedUser, sameOriginGuard } from "@/lib/api";
import { rateLimited, RATE_LIMITS } from "@/lib/rate-limit";
import { blockedDriverIds, fetchRidesWithDrivers, notify, serializeRide } from "@/lib/rides";
import { releaseExpiredPayments } from "@/lib/payments";
import { CreateRideSchema, RideSearchSchema } from "@/lib/validation";
import { defaultTravelDate, distanceKm, resolvePlace, sortMatches } from "@/lib/locations";

export const dynamic = "force-dynamic";

const MAX_SEATS: Record<string, number> = { bike: 1, scooter: 1, car: 4 };

export async function GET(request: Request) {
  try {
    await releaseExpiredPayments();

    const url = new URL(request.url);
    const rawQuery = {
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      direction: (url.searchParams.get("direction") ?? undefined) as "home_to_college" | "college_to_home" | undefined,
      date: url.searchParams.get("date") ?? undefined,
      time: url.searchParams.get("time") ?? undefined,
      seats: url.searchParams.get("seats") ?? undefined,
    };
    const parsed = parseBody(rawQuery, RideSearchSchema.partial());
    if ("response" in parsed) return parsed.response;
    const query = parsed.data;

    const rows = await fetchRidesWithDrivers();
    const user = await getCurrentUser();
    const blocked = user ? await blockedDriverIds(user.id) : [];

    const activeRides = rows.filter(
      (row) =>
        row.ride.status === "active" &&
        !row.driver.suspended &&
        !blocked.includes(row.ride.driverId),
    );

    const from = query.from ?? user?.homeLocation ?? "Kothrud";
    const to = query.to ?? (user?.college ? user.college : "MIT College, Kothrud");
    const direction = query.direction ?? "home_to_college";
    const date = query.date ?? defaultTravelDate();
    const time = query.time ?? "08:00";
    const seatsRequired = query.seats ?? 1;

    const candidates = activeRides
      .filter((row) => row.ride.seatsAvailable >= seatsRequired)
      .map((row) => serializeRide(row, false, false));

    const matches = sortMatches(
      { fromLocation: from, toLocation: to, direction, travelDate: date, departureTime: time },
      candidates,
    );

    return NextResponse.json({
      query: { from, to, direction, date, time, seats: seatsRequired },
      rides: matches.map((m) => ({
        ...m.ride,
        match: {
          score: m.score,
          pickupKm: Math.round(m.pickupKm * 10) / 10,
          dropKm: Math.round(m.dropKm * 10) / 10,
          minutesDiff: m.minutesDiff,
          reason: m.reason,
        },
      })),
    });
  } catch (error) {
    return logError("rides search failed", error);
  }
}

export async function POST(request: Request) {
  try {
    const csrf = sameOriginGuard(request);
    if (csrf) return csrf;

    const limit = rateLimited(request, "ride-create", RATE_LIMITS.rideCreate);
    if (limit) return limit;

    const auth = await requireVerifiedUser();
    if ("response" in auth) return auth.response;
    const user = auth.user;

    // Driver must have approved driver verification to publish rides
    if (!user.driverVerified && user.driverVerificationStatus !== "APPROVED") {
      return fail(
        "You need approved driver verification before offering rides. Go to Profile → Driver Verification to submit your driving licence and vehicle documents.",
        403,
        "DRIVER_NOT_VERIFIED",
      );
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return fail("Invalid JSON body.", 400);
    }
    const parsed = parseBody(raw, CreateRideSchema);
    if ("response" in parsed) return parsed.response;
    const input = parsed.data;

    // Server-side cap on seats per vehicle type.
    const seatsTotal = Math.min(input.seatsTotal, MAX_SEATS[input.vehicleType] ?? 1);
    if (seatsTotal < 1) return fail("Invalid seat count for this vehicle type.", 422);

    const departure = new Date(`${input.travelDate}T${input.departureTime}:00`);
    if (!Number.isNaN(departure.getTime()) && departure.getTime() < Date.now() - 15 * 60 * 1000) {
      return fail("You cannot publish a ride that has already departed.", 422);
    }

    const inserted = await db
      .insert(rides)
      .values({
        driverId: user.id,
        direction: input.direction,
        fromLocation: input.fromLocation,
        toLocation: input.toLocation,
        routeStops: input.routeStops ?? "",
        travelDate: input.travelDate,
        departureTime: input.departureTime,
        vehicleType: input.vehicleType,
        vehicleModel: input.vehicleModel ?? "",
        seatsTotal,
        seatsAvailable: seatsTotal,
        pricePerSeat: input.pricePerSeat,
        preferredGender: input.preferredGender,
        notes: input.notes ?? "",
        status: "active",
      })
      .returning();

    const ride = inserted[0];
    if (!ride) return fail("Unable to publish ride. Please try again.", 500);

    // Automatic route-match alerts to nearby verified students.
    const allUsers = await db.select().from(users);
    const rideFrom = resolvePlace(input.fromLocation);
    const rideTo = resolvePlace(input.toLocation);
    let notified = 0;
    for (const candidate of allUsers) {
      if (candidate.id === user.id || candidate.suspended) continue;
      if (candidate.verificationStatus !== "VERIFIED") continue;
      const home = resolvePlace(candidate.homeLocation);
      const college = resolvePlace(candidate.college);
      const nearPickup = rideFrom && home ? distanceKm(rideFrom, home) <= 2.5 : false;
      const sameCollege =
        rideTo && college ? distanceKm(rideTo, college) <= 1.5 : candidate.college === input.toLocation;
      if (nearPickup || sameCollege) {
        await notify(
          candidate.id,
          "route_match",
          "New matching route found",
          `${user.fullName} just posted a ride ${input.fromLocation} → ${input.toLocation} at ${input.departureTime}.`,
          ride.id,
        );
        notified += 1;
      }
    }

    return NextResponse.json({ ride, notified });
  } catch (error) {
    return logError("publish ride failed", error);
  }
}
