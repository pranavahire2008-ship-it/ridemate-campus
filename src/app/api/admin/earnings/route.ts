import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { driverEarnings } from "@/db/schema";
import { fail, logError, parseBody, requireAdmin, sameOriginGuard } from "@/lib/api";
import { rateLimited, RATE_LIMITS } from "@/lib/rate-limit";
import { getAdminDriverEarningsOverview } from "@/lib/earnings";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireAdmin();
    if ("response" in auth) return auth.response;

    const overview = await getAdminDriverEarningsOverview();
    return NextResponse.json(overview);
  } catch (error) {
    return logError("admin earnings overview failed", error);
  }
}

const AdminPayoutActionSchema = z.object({
  earningId: z.coerce.number().int().positive(),
  action: z.enum(["approve_payout", "set_pending", "set_available"]),
});

export async function POST(request: Request) {
  try {
    const csrf = sameOriginGuard(request);
    if (csrf) return csrf;

    const limit = rateLimited(request, "admin-action", RATE_LIMITS.report);
    if (limit) return limit;

    const auth = await requireAdmin();
    if ("response" in auth) return auth.response;

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return fail("Invalid JSON body.", 400);
    }

    const parsed = parseBody(raw, AdminPayoutActionSchema);
    if ("response" in parsed) return parsed.response;
    const { earningId, action } = parsed.data;

    const rows = await db.select().from(driverEarnings).where(eq(driverEarnings.id, earningId)).limit(1);
    const earning = rows[0];
    if (!earning) return fail("Earnings record not found.", 404);

    let nextStatus = earning.status;
    let payoutId = earning.payoutId;
    let paidOutAt = earning.paidOutAt;

    if (action === "approve_payout") {
      nextStatus = "PAID_OUT";
      payoutId = payoutId || `payout_adm_${Date.now()}_${earning.id}`;
      paidOutAt = new Date();
    } else if (action === "set_pending") {
      nextStatus = "PENDING";
    } else if (action === "set_available") {
      nextStatus = "AVAILABLE";
    }

    await db
      .update(driverEarnings)
      .set({
        status: nextStatus,
        payoutId,
        paidOutAt,
        updatedAt: new Date(),
      })
      .where(eq(driverEarnings.id, earningId));

    return NextResponse.json({
      ok: true,
      message: `Driver earning status updated to ${nextStatus}.`,
      status: nextStatus,
    });
  } catch (error) {
    return logError("admin payout action failed", error);
  }
}
