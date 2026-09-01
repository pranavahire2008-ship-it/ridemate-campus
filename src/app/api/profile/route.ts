import { NextResponse } from "next/server";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { bookings, reviews, rides, users } from "@/db/schema";
import { getCurrentUser, toPublicUser } from "@/lib/auth";
import { fail, logError, parseBody, requireUser, sameOriginGuard } from "@/lib/api";
import { rateLimited, RATE_LIMITS } from "@/lib/rate-limit";
import { fetchReviewsFor, notify } from "@/lib/rides";
import { ProfileUpdateSchema, ReviewSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedId = Number.parseInt(url.searchParams.get("id") ?? "", 10);
    const me = await getCurrentUser();
    const targetId = Number.isNaN(requestedId) ? me?.id : requestedId;
    if (!targetId) return NextResponse.json({ user: null, reviews: [] }, { status: 401 });

    const rows = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
    const user = rows[0];
    if (!user) return NextResponse.json({ user: null, reviews: [] }, { status: 404 });

    const isSelf = me ? me.id === user.id : false;
    // Profiles of other students expose nothing sensitive — email and phone stay private.
    const publicProfile = isSelf
      ? toPublicUser(user)
      : {
          ...toPublicUser(user),
          email: "",
          phone: user.verificationStatus ? "" : "",
          studentId: "",
        };

    return NextResponse.json({
      user: publicProfile,
      reviews: await fetchReviewsFor(user.id),
      isSelf,
    });
  } catch (error) {
    return logError("profile failed", error);
  }
}

/** Submit a review after a completed ride. */
export async function POST(request: Request) {
  try {
    const csrf = sameOriginGuard(request);
    if (csrf) return csrf;

    const limit = rateLimited(request, "review", RATE_LIMITS.review);
    if (limit) return limit;

    const auth = await requireUser();
    if ("response" in auth) return auth.response;

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return fail("Invalid JSON body.", 400);
    }
    const parsed = parseBody(raw, ReviewSchema);
    if ("response" in parsed) return parsed.response;
    const { revieweeId, rating, comment } = parsed.data;

    if (revieweeId === auth.user.id) return fail("You cannot review yourself.", 400);

    const targetRows = await db.select().from(users).where(eq(users.id, revieweeId)).limit(1);
    const target = targetRows[0];
    if (!target) return fail("Student not found.", 404);

    // Verify a completed booking exists between reviewer and reviewee
    const completedBooking = await db
      .select({ booking: bookings })
      .from(bookings)
      .innerJoin(rides, eq(bookings.rideId, rides.id))
      .where(
        and(
          eq(bookings.status, "COMPLETED"),
          or(
            // Reviewer was the rider and reviewee was the driver
            and(eq(bookings.riderId, auth.user.id), eq(rides.driverId, revieweeId)),
            // Reviewer was the driver and reviewee was the rider
            and(eq(rides.driverId, auth.user.id), eq(bookings.riderId, revieweeId)),
          ),
        ),
      )
      .limit(1);

    if (completedBooking.length === 0) {
      return fail("You can only review someone after completing a ride together.", 403);
    }

    await db.insert(reviews).values({
      reviewerId: auth.user.id,
      revieweeId,
      bookingId: completedBooking[0]!.booking.id,
      rating,
      comment,
    });
    await db
      .update(users)
      .set({ ratingSum: target.ratingSum + rating, ratingCount: target.ratingCount + 1 })
      .where(eq(users.id, revieweeId));

    await notify(
      revieweeId,
      "new_review",
      "New rating received",
      `${auth.user.fullName} rated you ${rating}★ after your ride.`,
      null,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return logError("review failed", error);
  }
}

export async function PATCH(request: Request) {
  try {
    const csrf = sameOriginGuard(request);
    if (csrf) return csrf;

    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const user = auth.user;

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return fail("Invalid JSON body.", 400);
    }
    const parsed = parseBody(raw, ProfileUpdateSchema.partial());
    if ("response" in parsed) return parsed.response;
    const input = parsed.data;

    // Profile update NEVER changes verification status.
    // Verification is handled exclusively through the document submission + admin review flow.
    await db
      .update(users)
      .set({
        fullName: input.fullName ?? user.fullName,
        phone: input.phone ?? user.phone,
        phoneNumber: input.phone ?? user.phoneNumber ?? user.phone,
        college: input.college ?? user.college,
        homeLocation: input.homeLocation ?? user.homeLocation,
        studentId: input.studentId ?? user.studentId,
        gender: input.gender ?? user.gender,
        // verified and verificationStatus are intentionally NOT updated here
      })
      .where(eq(users.id, user.id));

    const rows = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    return NextResponse.json({ user: rows[0] ? toPublicUser(rows[0]) : null });
  } catch (error) {
    return logError("profile update failed", error);
  }
}
