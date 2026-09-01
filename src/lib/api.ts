import { NextResponse } from "next/server";
import type { z } from "zod";
import { getCurrentUser, isVerifiedStudent, isAdmin } from "@/lib/auth";
import type { UserRow } from "@/db/schema";
import { firstIssue } from "@/lib/validation";

/* ----------------------------------------------------------- responses */

export function ok<T extends object>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/** Safe error response — never leaks stack traces, SQL or secrets. */
export function fail(message: string, status = 400, code?: string): NextResponse {
  return NextResponse.json({ error: message, ...(code ? { code } : {}) }, { status });
}

export const Errors = {
  unauthorized: () => fail("Please log in to continue.", 401),
  forbidden: () => fail("You do not have permission to perform this action.", 403),
  suspended: () => fail("Your account is suspended. Contact the campus safety desk.", 403),
  unverified: () =>
    fail("Complete student verification before using this feature.", 403, "UNVERIFIED"),
  notFound: (what = "Resource") => fail(`${what} not found.`, 404),
  gone: (message: string) => fail(message, 409),
  server: () => fail("Something went wrong. Please try again.", 500),
};

/* ------------------------------------------------------- CSRF / origin */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defence for cookie-based sessions: mutating requests must originate
 * from this app (SameSite=Lax already blocks most cross-site POSTs; this
 * adds an explicit Origin check for defence in depth).
 */
export function sameOriginGuard(request: Request): NextResponse | null {
  if (SAFE_METHODS.has(request.method)) return null;
  const origin = request.headers.get("origin");
  if (!origin) return null; // same-origin fetches from server/SSR may omit Origin
  try {
    const originHost = new URL(origin).host;
    const requestHost = request.headers.get("host") ?? new URL(request.url).host;

    // Allow same host
    if (originHost === requestHost) return null;

    // Allow Vercel preview deployments (*.vercel.app)
    if (originHost.endsWith(".vercel.app") && requestHost.endsWith(".vercel.app")) return null;

    // Allow custom domain matching (e.g. ridematecampus.com)
    const originBase = originHost.replace(/^www\./, "");
    const requestBase = requestHost.replace(/^www\./, "");
    if (originBase === requestBase) return null;

    return fail("Request blocked: cross-site request detected.", 403, "CSRF");
  } catch {
    return fail("Request blocked: invalid origin.", 403, "CSRF");
  }
  return null;
}

export function readJson<T>(request: Request, schema: z.ZodType<T>): { data: T } | { response: NextResponse } {
  return (async () => {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return { response: fail("Invalid JSON body.", 400) };
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return { response: fail(firstIssue(parsed.error), 422) };
    }
    return { data: parsed.data };
  })() as unknown as { data: T } | { response: NextResponse };
}

/** Synchronous variant used after the body has already been parsed. */
export function parseBody<T>(raw: unknown, schema: z.ZodType<T>): { data: T } | { response: NextResponse } {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { response: fail(firstIssue(parsed.error), 422) };
  }
  return { data: parsed.data };
}

/* -------------------------------------------------------- auth guards */

export async function requireUser(): Promise<{ user: UserRow } | { response: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) return { response: Errors.unauthorized() };
  if (user.suspended) return { response: Errors.suspended() };
  return { user };
}

export async function requireVerifiedUser(): Promise<{ user: UserRow } | { response: NextResponse }> {
  const result = await requireUser();
  if ("response" in result) return result;
  if (!isVerifiedStudent(result.user)) return { response: Errors.unverified() };
  return { user: result.user };
}

export async function requireAdmin(): Promise<{ user: UserRow } | { response: NextResponse }> {
  const result = await requireUser();
  if ("response" in result) return result;
  if (!isAdmin(result.user)) return { response: Errors.forbidden() };
  return { user: result.user };
}

export function isResponse(value: unknown): value is { response: NextResponse } {
  return typeof value === "object" && value !== null && "response" in value;
}

/** Logs the real error server-side, returns a safe message to the client. */
export function logError(scope: string, error: unknown): NextResponse {
  // Always log the full error on the server so Vercel logs show it
  console.error(
    `[${scope}]`,
    error instanceof Error ? `${error.name}: ${error.message}\n${error.stack}` : error,
  );
  return Errors.server();
}
