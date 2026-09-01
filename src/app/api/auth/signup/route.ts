import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, hashPassword, toPublicUser } from "@/lib/auth";
import { fail, logError, parseBody, sameOriginGuard } from "@/lib/api";
import { clientIp, rateLimited, RATE_LIMITS } from "@/lib/rate-limit";
import { SignUpSchema } from "@/lib/validation";
import { AVATAR_COLORS } from "@/lib/locations";

export const dynamic = "force-dynamic";
const AUTH_RESPONSE_HEADERS = { "Cache-Control": "no-store, max-age=0", Vary: "Cookie" };

export async function POST(request: Request) {
  try {
    const csrf = sameOriginGuard(request);
    if (csrf) return csrf;

    const limit = rateLimited(request, "signup", RATE_LIMITS.signup);
    if (limit) return limit;



    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return fail("Invalid JSON body.", 400);
    }
    const parsed = parseBody(raw, SignUpSchema);
    if ("response" in parsed) return parsed.response;
    const input = parsed.data;

    const existing = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
    if (existing.length > 0) {
      return fail("An account with this email already exists. Try logging in.", 409);
    }

    // New users are NEVER auto-verified. They must submit documents for admin review.
    const inserted = await db
      .insert(users)
      .values({
        fullName: input.fullName,
        email: input.email,
        passwordHash: hashPassword(input.password),
        phone: input.phone ?? "",
        phoneNumber: input.phone ?? "",
        college: input.college,
        studentId: input.studentId,
        gender: input.gender,
        homeLocation: input.homeLocation ?? "",
        avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
        verified: false,
        verificationStatus: "NOT_SUBMITTED",
        role: "STUDENT",
      })
      .returning();

    const user = inserted[0];
    if (!user) return fail("Unable to create account. Please try again.", 500);

    await createSession(user.id, {
      userAgent: request.headers.get("user-agent"),
      ipAddress: clientIp(request),
    });
    return NextResponse.json(
      { user: toPublicUser(user), verified: false },
      { status: 201, headers: AUTH_RESPONSE_HEADERS },
    );
  } catch (error) {
    // The unique database index is the final authority for duplicate emails.
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return fail("An account with this email already exists. Try logging in.", 409);
    }
    return logError("signup failed", error);
  }
}
