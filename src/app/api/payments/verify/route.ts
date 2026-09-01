import { NextResponse } from "next/server";
import { fail, logError, parseBody, requireUser, sameOriginGuard } from "@/lib/api";
import { rateLimited, RATE_LIMITS } from "@/lib/rate-limit";
import { VerifyPaymentSchema } from "@/lib/validation";
import { PaymentFlowError, verifyBookingPayment } from "@/lib/payments";

export const dynamic = "force-dynamic";

/**
 * Server-side verification of a Razorpay Checkout result.
 * A payment is only marked PAID after the HMAC signature (and, when keys are
 * configured, a provider re-check) succeeds. Idempotent by design.
 */
export async function POST(request: Request) {
  try {
    const csrf = sameOriginGuard(request);
    if (csrf) return csrf;

    const limit = rateLimited(request, "payment-verify", RATE_LIMITS.paymentVerify);
    if (limit) return limit;

    const auth = await requireUser();
    if ("response" in auth) return auth.response;

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return fail("Invalid JSON body.", 400);
    }

    const parsed = parseBody(raw, VerifyPaymentSchema);
    if ("response" in parsed) return parsed.response;

    const result = await verifyBookingPayment(auth.user, parsed.data);
    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof PaymentFlowError) {
      return fail(error.message, error.status, error.code);
    }
    return logError("payments/verify", error);
  }
}
