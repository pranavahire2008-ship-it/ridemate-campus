import { NextResponse } from "next/server";

/**
 * Simple in-process sliding-window rate limiter.
 *
 * Good enough for a single-node deployment. For horizontally scaled
 * production deployments swap `hit()` for a Redis/Upstash backed counter —
 * the call sites stay unchanged.
 */

type Bucket = { hits: number[] };

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    bucket.hits = bucket.hits.filter((t) => now - t < 600_000);
    if (bucket.hits.length === 0) buckets.delete(key);
  }
}

export type RateLimitRule = { limit: number; windowMs: number };

export const RATE_LIMITS = {
  login: { limit: 8, windowMs: 60_000 },
  signup: { limit: 5, windowMs: 60_000 },
  booking: { limit: 20, windowMs: 60_000 },
  paymentOrder: { limit: 15, windowMs: 60_000 },
  paymentVerify: { limit: 30, windowMs: 60_000 },
  refund: { limit: 10, windowMs: 60_000 },
  report: { limit: 6, windowMs: 60_000 },
  block: { limit: 20, windowMs: 60_000 },
  review: { limit: 15, windowMs: 60_000 },
  rideCreate: { limit: 12, windowMs: 60_000 },
  webhook: { limit: 240, windowMs: 60_000 },
  read: { limit: 300, windowMs: 60_000 },
} satisfies Record<string, RateLimitRule>;

export function clientIp(request: Request): string {
  const headers = request.headers;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfter: number };

export function hit(key: string, rule: RateLimitRule): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < rule.windowMs);
  if (bucket.hits.length >= rule.limit) {
    buckets.set(key, bucket);
    const retryAfter = Math.ceil((rule.windowMs - (now - bucket.hits[0]!)) / 1000);
    return { allowed: false, remaining: 0, retryAfter: Math.max(1, retryAfter) };
  }
  bucket.hits.push(now);
  buckets.set(key, bucket);
  return {
    allowed: true,
    remaining: Math.max(0, rule.limit - bucket.hits.length),
    retryAfter: 0,
  };
}

export function rateLimited(request: Request, scope: string, rule: RateLimitRule): NextResponse | null {
  const result = hit(`${scope}:${clientIp(request)}`, rule);
  if (result.allowed) return null;
  return NextResponse.json(
    { error: "Too many requests. Please slow down and try again shortly." },
    { status: 429, headers: { "Retry-After": String(result.retryAfter) } },
  );
}
