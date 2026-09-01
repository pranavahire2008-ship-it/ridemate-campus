import { NextResponse } from "next/server";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { fail, logError, parseBody, requireUser, sameOriginGuard } from "@/lib/api";
import { rateLimited, RATE_LIMITS } from "@/lib/rate-limit";
import { ReportSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const csrf = sameOriginGuard(request);
    if (csrf) return csrf;

    const limit = rateLimited(request, "report", RATE_LIMITS.report);
    if (limit) return limit;

    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const user = auth.user;

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return fail("Invalid JSON body.", 400);
    }
    const parsed = parseBody(raw, ReportSchema);
    if ("response" in parsed) return parsed.response;
    const input = parsed.data;

    await db.insert(reports).values({
      reporterId: user.id,
      reportedUserId: input.reportedUserId ?? null,
      rideId: input.rideId ?? null,
      reason: input.reason,
      details: input.details ?? "",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return logError("report failed", error);
  }
}
