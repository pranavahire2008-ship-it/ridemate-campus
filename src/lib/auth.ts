import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { and, eq, gt, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { authSessions, users } from "@/db/schema";
import type { UserRow } from "@/db/schema";
import { env } from "@/lib/env";

const COOKIE_NAME = "ridemate_session";
const BCRYPT_ROUNDS = 11;

function sessionTtlMs(): number {
  return 1000 * 60 * 60 * 24 * env.sessionDays;
}

export type SessionMetadata = {
  userAgent?: string | null;
  ipAddress?: string | null;
};

/* ----------------------------------------------------------- passwords */

/** New passwords are hashed using bcrypt with a production-safe cost factor. */
export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

/**
 * Verifies a password against a stored hash.
 * Legacy scrypt hashes from the original prototype remain supported and are
 * upgraded to bcrypt on the next successful login.
 */
export function verifyPassword(password: string, stored: string): boolean {
  try {
    if (stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$")) {
      return bcrypt.compareSync(password, stored);
    }
    const [salt, key] = stored.split(":");
    if (!salt || !key) return false;
    const derived = scryptSync(password, salt, 32).toString("hex");
    const candidate = Buffer.from(derived, "hex");
    const expected = Buffer.from(key, "hex");
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

export function isLegacyHash(stored: string): boolean {
  return !stored.startsWith("$2");
}

/* -------------------------------------------------------------- session */

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function newSessionToken(): string {
  // 256 bits of entropy, URL-safe and never stored in plaintext.
  return randomBytes(32).toString("base64url");
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.floor(sessionTtlMs() / 1000),
  };
}

/**
 * Creates a durable server-side session and stores only the token hash in
 * PostgreSQL. This means refreshing the browser or restarting Next.js does
 * not log the student out.
 */
export async function createSession(
  userId: number,
  metadata: SessionMetadata = {},
): Promise<void> {
  const jar = await cookies();
  const previousToken = jar.get(COOKIE_NAME)?.value;

  // Rotate a pre-existing session token to prevent session fixation.
  if (previousToken) {
    await db
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(authSessions.tokenHash, tokenHash(previousToken)), isNull(authSessions.revokedAt)));
  }

  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + sessionTtlMs());
  await db.insert(authSessions).values({
    userId,
    tokenHash: tokenHash(token),
    expiresAt,
    userAgent: (metadata.userAgent ?? "").slice(0, 300),
    ipAddress: (metadata.ipAddress ?? "").slice(0, 64),
  });

  jar.set(COOKIE_NAME, token, sessionCookieOptions());
}

/** Explicit session rotation without changing the signed-in student. */
export async function rotateSession(userId: number, metadata: SessionMetadata = {}): Promise<void> {
  await createSession(userId, metadata);
}

/** Secure logout: revoke the server record and expire the browser cookie. */
export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) {
    await db
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(authSessions.tokenHash, tokenHash(token)), isNull(authSessions.revokedAt)));
  }
  jar.set(COOKIE_NAME, "", { ...sessionCookieOptions(), maxAge: 0 });
}

/** Revoke all active sessions for a student (available for account recovery). */
export async function revokeAllSessions(userId: number): Promise<void> {
  await db
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));
}

/**
 * Resolves the authenticated account entirely on the server. A client cannot
 * choose an account id, alter a session expiry, or access a revoked session.
 */
export async function getCurrentUser(): Promise<UserRow | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const now = new Date();
  const rows = await db
    .select({ session: authSessions, user: users })
    .from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .where(
      and(
        eq(authSessions.tokenHash, tokenHash(token)),
        isNull(authSessions.revokedAt),
        gt(authSessions.expiresAt, now),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row || row.user.suspended) return null;

  // Lightweight audit trail for active sessions. Failed updates never affect auth.
  void db
    .update(authSessions)
    .set({ lastSeenAt: now })
    .where(eq(authSessions.id, row.session.id));

  return row.user;
}

/** The canonical phone accessor during the zero-downtime phone column migration. */
export function userPhone(user: Pick<UserRow, "phone" | "phoneNumber">): string {
  return user.phoneNumber || user.phone || "";
}

export type PublicUser = {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  college: string;
  studentId: string;
  gender: string;
  homeLocation: string;
  avatarColor: string;
  verified: boolean;
  verificationStatus: string;
  role: string;
  rating: number;
  ratingCount: number;
  ridesCompleted: number;
};

/** Never includes password_hash, session tokens, or server-only attributes. */
export function toPublicUser(user: UserRow): PublicUser {
  const rating =
    user.ratingCount > 0
      ? Math.round((user.ratingSum / user.ratingCount) * 10) / 10
      : 0;
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: userPhone(user),
    college: user.college,
    studentId: user.studentId,
    gender: user.gender,
    homeLocation: user.homeLocation,
    avatarColor: user.avatarColor,
    verified: user.verified,
    verificationStatus: user.verificationStatus,
    role: user.role,
    rating,
    ratingCount: user.ratingCount,
    ridesCompleted: user.ridesCompleted,
  };
}

/** Phone numbers stay private until a booking is accepted. */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return "Not shared yet";
  return `${"•".repeat(Math.max(0, phone.length - 4))}${phone.slice(-4)}`;
}

export function isVerifiedStudent(user: UserRow | null): boolean {
  return Boolean(
    user &&
      user.verified &&
      (user.verificationStatus === "VERIFIED" || user.verificationStatus === "LEGACY_AUTO"),
  );
}

export function isAdmin(user: UserRow | null): boolean {
  return Boolean(
    user &&
      (user.role === "ADMIN" || user.role === "SUPER_ADMIN" || env.adminEmails.includes(user.email.toLowerCase())) &&
      !user.suspended,
  );
}

export function isSuperAdmin(user: UserRow | null): boolean {
  return Boolean(user && user.role === "SUPER_ADMIN" && !user.suspended);
}
