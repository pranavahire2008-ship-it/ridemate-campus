import { NextResponse } from "next/server";
import { logError, requireUser } from "@/lib/api";
import { getPaymentHistory } from "@/lib/payments";
import { paymentMode } from "@/lib/razorpay";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;

    const history = await getPaymentHistory(auth.user.id);
    return NextResponse.json({
      payments: history,
      mode: paymentMode(),
      paymentWindowMinutes: 15,
    });
  } catch (error) {
    return logError("payments/history", error);
  }
}
