import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { reports, users } from "@/db/schema";
import { fail, logError, parseBody, requireAdmin, sameOriginGuard } from "@/lib/api";
import { rateLimited, RATE_LIMITS } from "@/lib/rate-limit";
import { notify } from "@/lib/notify";
import { z } from "zod";

export const dynamic = "force-dynamic";

const AdminActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("review_report"),
    reportId: z.coerce.number().int().positive(),
    status: z.enum(["OPEN", "REVIEWING", "RESOLVED"]),
    resolution: z.string().trim().max(400).optional().default(""),
  }),
  z.object({
    type: z.literal("verification"),
    userId: z.coerce.number().int().positive(),
    decision: z.enum(["VERIFIED", "REJECTED", "PENDING"]),
  }),
  z.object({
    type: z.literal("suspend"),
    userId: z.coerce.number().int().positive(),
    suspended: z.boolean(),
  }),
  z.object({
    type: z.literal("approve_payout"),
    earningId: z.coerce.number().int().positive(),
  }),
]);

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
    const parsed = parseBody(raw, AdminActionSchema);
    if ("response" in parsed) return parsed.response;
    const action = parsed.data;

    if (action.type === "review_report") {
      await db
        .update(reports)
        .set({
          status: action.status,
          resolution: action.resolution,
          reviewedBy: auth.user.id,
        })
        .where(eq(reports.id, action.reportId));
      return NextResponse.json({ ok: true });
    }

    if (action.type === "verification") {
      const rows = await db.select().from(users).where(eq(users.id, action.userId)).limit(1);
      const target = rows[0];
      if (!target) return fail("Student not found.", 404);
      if (target.role === "ADMIN") return fail("Admin accounts cannot be modified here.", 403);

      await db
        .update(users)
        .set({
          verificationStatus: action.decision,
          verified: action.decision === "VERIFIED",
        })
        .where(eq(users.id, action.userId));

      await notify(
        action.userId,
        "verification_update",
        action.decision === "VERIFIED" ? "Student verification approved" : "Verification update",
        action.decision === "VERIFIED"
          ? "Your student ID has been approved. You can now offer and book rides."
          : "Your verification status was updated. Please check your student ID details.",
        null,
      );
      return NextResponse.json({ ok: true });
    }

    if (action.type === "suspend") {
      const rows = await db.select().from(users).where(eq(users.id, action.userId)).limit(1);
      const target = rows[0];
      if (!target) return fail("Student not found.", 404);
      if (target.role === "ADMIN") return fail("Admin accounts cannot be suspended.", 403);

      await db.update(users).set({ suspended: action.suspended }).where(eq(users.id, action.userId));
      return NextResponse.json({ ok: true });
    }

    if (action.type === "approve_payout") {
      const { driverEarnings } = await import("@/db/schema");
      const earningRows = await db.select().from(driverEarnings).where(eq(driverEarnings.id, action.earningId)).limit(1);
      const earning = earningRows[0];
      if (!earning) return fail("Earning record not found.", 404);

      const payoutId = earning.payoutId || `payout_adm_${Date.now()}_${earning.id}`;
      await db
        .update(driverEarnings)
        .set({
          status: "PAID_OUT",
          payoutId,
          paidOutAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(driverEarnings.id, action.earningId));

      await notify(
        earning.driverId,
        "payout_completed",
        "Driver Payout Completed 🎉",
        `₹${earning.driverEarning} has been marked as Paid Out to your bank account.`,
        null,
      );

      return NextResponse.json({ ok: true, payoutId });
    }

    return fail("Unknown action.", 400);
  } catch (error) {
    return logError("admin action failed", error);
  }
}
