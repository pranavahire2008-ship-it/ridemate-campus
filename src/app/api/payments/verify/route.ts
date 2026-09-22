import { NextResponse } from "next/server";
import {
  fail,
  logError,
  parseBody,
  requireVerifiedUser,
  sameOriginGuard,
} from "@/lib/api";
import { rateLimited, RATE_LIMITS } from "@/lib/rate-limit";
import { VerifyPaymentSchema } from "@/lib/validation";
import {
  PaymentFlowError,
  verifyBookingPayment,
} from "@/lib/payments";

export const dynamic = "force-dynamic";

/**
 * Verifies a Razorpay Checkout payment and finalizes
 * the corresponding RideMate booking.
 *
 * The client-provided payment details are NOT trusted.
 * The server verifies the Razorpay signature and checks
 * the payment against the RideMate booking/order.
 */
export async function POST(request: Request) {
  try {
    /*
     * Prevent cross-site requests.
     */
    const csrf = sameOriginGuard(request);

    if (csrf) {
      return csrf;
    }

    /*
     * Prevent repeated verification abuse.
     */
    const limit = rateLimited(
      request,
      "payment-verify",
      RATE_LIMITS.paymentVerify,
    );

    if (limit) {
      return limit;
    }

    /*
     * Only an authenticated, verified RideMate user
     * can finalize their booking payment.
     */
    const auth = await requireVerifiedUser();

    if ("response" in auth) {
      return auth.response;
    }

    /*
     * Read request body.
     */
    let raw: unknown;

    try {
      raw = await request.json();
    } catch {
      return fail(
        "Invalid JSON body.",
        400,
        "INVALID_JSON",
      );
    }

    /*
     * Validate Razorpay's response fields.
     */
    const parsed = parseBody(
      raw,
      VerifyPaymentSchema,
    );

    if ("response" in parsed) {
      return parsed.response;
    }

    /*
     * The payment service performs the security-critical work:
     *
     * - verifies the Razorpay signature
     * - confirms the order belongs to this RideMate booking
     * - confirms the amount
     * - checks the Razorpay payment
     * - prevents duplicate finalization
     * - updates the booking/payment state
     */
    const result = await verifyBookingPayment(
      auth.user,
      parsed.data,
    );

    /*
     * Return only safe payment/booking information.
     * Never expose Razorpay API credentials.
     */
    return NextResponse.json(
      {
        success: true,
        payment: result,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof PaymentFlowError) {
      return fail(
        error.message,
        error.status,
        error.code,
      );
    }

    return logError(
      "payments/verify",
      error,
    );
  }
}
