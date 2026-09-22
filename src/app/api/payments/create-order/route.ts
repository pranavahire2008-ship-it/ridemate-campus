import { NextResponse } from "next/server";
import {
  fail,
  logError,
  parseBody,
  requireVerifiedUser,
  sameOriginGuard,
} from "@/lib/api";
import {
  rateLimited,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { CreatePaymentSchema } from "@/lib/validation";
import {
  createBookingPaymentOrder,
  PaymentFlowError,
  releaseExpiredPayments,
} from "@/lib/payments";

export const dynamic = "force-dynamic";

/**
 * Creates a real Razorpay payment order for a RideMate booking.
 *
 * Important:
 * - Only authenticated and verified users can create orders.
 * - The payment amount is calculated on the server.
 * - The client cannot choose or modify the final amount.
 * - Razorpay order creation happens server-side.
 * - No fake/simulated payment is used.
 */
export async function POST(request: Request) {
  try {
    /*
     * Protect the endpoint from cross-site requests.
     */
    const csrf = sameOriginGuard(request);

    if (csrf) {
      return csrf;
    }

    /*
     * Rate-limit payment order creation.
     */
    const limit = rateLimited(
      request,
      "payment-order",
      RATE_LIMITS.paymentOrder,
    );

    if (limit) {
      return limit;
    }

    /*
     * Release any old/expired payment reservations
     * before creating a new payment order.
     */
    await releaseExpiredPayments();

    /*
     * Only verified RideMate users can create a booking
     * and start the payment process.
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
     * Validate the incoming booking/payment request.
     */
    const parsed = parseBody(
      raw,
      CreatePaymentSchema,
    );

    if ("response" in parsed) {
      return parsed.response;
    }

    /*
     * This function:
     *
     * 1. Validates the ride.
     * 2. Validates the requested seats.
     * 3. Calculates the amount on the server.
     * 4. Creates the booking/payment record.
     * 5. Creates the Razorpay order.
     *
     * The browser never gets to decide the final amount.
     */
    const order = await createBookingPaymentOrder(
      auth.user,
      parsed.data,
    );

    /*
     * Return only the order information needed
     * by the frontend to open Razorpay Checkout.
     *
     * The Razorpay secret is NEVER returned.
     */
    return NextResponse.json(
      {
        order,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    /*
     * Expected payment-flow errors.
     */
    if (error instanceof PaymentFlowError) {
      return fail(
        error.message,
        error.status,
        error.code,
      );
    }

    /*
     * Unexpected errors are logged server-side.
     * The client receives a safe generic response.
     */
    return logError(
      "payments/create-order",
      error,
    );
  }
}
