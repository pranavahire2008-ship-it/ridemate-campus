import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  createSession,
  hashPassword,
  isLegacyHash,
  toPublicUser,
  verifyPassword,
} from "@/lib/auth";
import { fail, logError, parseBody, sameOriginGuard } from "@/lib/api";
import { clientIp, rateLimited, RATE_LIMITS } from "@/lib/rate-limit";
import { LoginSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
const AUTH_RESPONSE_HEADERS = { "Cache-Control": "no-store, max-age=0", Vary: "Cookie" };

export async function POST(request: Request) {
  try {
    const csrf = sameOriginGuard(request);
    if (csrf) return csrf;

    // Rate limiting protects against credential stuffing / brute force.
    const limit = rateLimited(request, "login", RATE_LIMITS.login);
    if (limit) return limit;



    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return fail("Invalid JSON body.", 400);
    }
    const parsed = parseBody(raw, LoginSchema);
    if ("response" in parsed) return parsed.response;
    const { email, password } = parsed.data;

    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = rows[0];

    // Same generic message for unknown email and wrong password.
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return fail("Invalid email or password.", 401);
    }
    if (user.suspended) {
      return fail("Your account is suspended. Contact the campus safety desk.", 403);
    }

    // Transparently upgrade legacy scrypt hashes to bcrypt.
    if (isLegacyHash(user.passwordHash)) {
      await db
        .update(users)
        .set({ passwordHash: hashPassword(password) })
        .where(eq(users.id, user.id));
    }

    // Fresh database-backed opaque session identifier on every login.
    await createSession(user.id, {
      userAgent: request.headers.get("user-agent"),
      ipAddress: clientIp(request),
    });
    return NextResponse.json({ user: toPublicUser(user) }, { headers: AUTH_RESPONSE_HEADERS });
  } catch (error) {
    return logError("login failed", error);
  }
}
