import { NextResponse } from "next/server";
import { fail, logError, parseBody, requireVerifiedUser, sameOriginGuard } from "@/lib/api";
import { rateLimited, RATE_LIMITS } from "@/lib/rate-limit";
import { CreatePaymentSchema } from "@/lib/validation";
import { createBookingPaymentOrder, PaymentFlowError, releaseExpiredPayments } from "@/lib/payments";

export const dynamic = "force-dynamic";

/**
 * OPTION B: the passenger pays when requesting the seat.
 * Creates a booking, reserves seats atomically and returns a payment order.
 * The amount is always calculated on the server.
 */
export async function POST(request: Request) {
  try {
    const csrf = sameOriginGuard(request);
    if (csrf) return csrf;

    const limit = rateLimited(request, "payment-order", RATE_LIMITS.paymentOrder);
    if (limit) return limit;

    await releaseExpiredPayments();

    const auth = await requireVerifiedUser();
    if ("response" in auth) return auth.response;

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return fail("Invalid JSON body.", 400);
    }

    const parsed = parseBody(raw, CreatePaymentSchema);
    if ("response" in parsed) return parsed.response;

    const order = await createBookingPaymentOrder(auth.user, parsed.data);
    return NextResponse.json({ order });
  } catch (error) {
    if (error instanceof PaymentFlowError) {
      return fail(error.message, error.status, error.code);
    }
    return logError("payments/create-order", error);
  }
}
