import { NextResponse } from "next/server";
import { fail, logError, requireUser, sameOriginGuard } from "@/lib/api";
import { serializeBookings } from "@/lib/rides";
import { releaseExpiredPayments } from "@/lib/payments";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;

    // Backend-enforced payment expiry: reserved seats are released even if the
    // passenger never comes back to the app.
    await releaseExpiredPayments();

    return NextResponse.json({ bookings: await serializeBookings(auth.user.id) });
  } catch (error) {
    return logError("bookings list failed", error);
  }
}

/**
 * Booking creation moved behind the payment flow (Option B):
 * seats are reserved and paid for through POST /api/payments/create-order.
 */
export async function POST(request: Request) {
  const csrf = sameOriginGuard(request);
  if (csrf) return csrf;
  return fail(
    "Bookings are created through the secure payment flow. Use POST /api/payments/create-order.",
    405,
    "USE_PAYMENT_FLOW",
  );
}
