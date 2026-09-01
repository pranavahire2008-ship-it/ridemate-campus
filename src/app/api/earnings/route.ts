import { NextResponse } from "next/server";
import { fail, logError, parseBody, requireUser, sameOriginGuard } from "@/lib/api";
import { rateLimited, RATE_LIMITS } from "@/lib/rate-limit";
import {
  getDriverEarningsSummary,
  requestDriverPayout,
} from "@/lib/earnings";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;

    const summary = await getDriverEarningsSummary(auth.user.id);
    return NextResponse.json(summary);
  } catch (error) {
    return logError("earnings summary failed", error);
  }
}

const PayoutActionSchema = z.object({
  action: z.enum(["request_payout"]),
});

export async function POST(request: Request) {
  try {
    const csrf = sameOriginGuard(request);
    if (csrf) return csrf;

    const limit = rateLimited(request, "paymentOrder", RATE_LIMITS.paymentOrder);
    if (limit) return limit;

    const auth = await requireUser();
    if ("response" in auth) return auth.response;

    let raw: unknown = {};
    try {
      raw = await request.json();
    } catch {
      raw = {};
    }

    const parsed = parseBody(raw, PayoutActionSchema);
    if ("response" in parsed) return parsed.response;

    const result = await requestDriverPayout(auth.user.id);
    return NextResponse.json({
      ok: true,
      message: `Payout request processed successfully! ₹${result.amount} marked as Paid Out.`,
      result,
    });
  } catch (error) {
    if (error instanceof Error) {
      return fail(error.message, 400);
    }
    return logError("request payout failed", error);
  }
}
