import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { studentVerifications, driverVerifications, users } from "@/db/schema";
import { fail, logError, parseBody, requireAdmin, sameOriginGuard } from "@/lib/api";
import { rateLimited, RATE_LIMITS } from "@/lib/rate-limit";
import { notify } from "@/lib/notify";
import { z } from "zod";

export const dynamic = "force-dynamic";

/** GET — list all verification requests for admin review */
export async function GET() {
  try {
    const auth = await requireAdmin();
    if ("response" in auth) return auth.response;

    // Student verifications
    const svRows = await db
      .select({ sv: studentVerifications, user: users })
      .from(studentVerifications)
      .innerJoin(users, eq(studentVerifications.userId, users.id))
      .orderBy(desc(studentVerifications.createdAt))
      .limit(100);

    // Driver verifications
    const dvRows = await db
      .select({ dv: driverVerifications, user: users })
      .from(driverVerifications)
      .innerJoin(users, eq(driverVerifications.userId, users.id))
      .orderBy(desc(driverVerifications.createdAt))
      .limit(100);

    // Legacy auto-verified users
    const legacyRows = await db
      .select()
      .from(users)
      .where(eq(users.verificationStatus, "LEGACY_AUTO"));

    return NextResponse.json({
      studentVerifications: svRows.map((r) => ({
        id: r.sv.id,
        userId: r.sv.userId,
        userName: r.user.fullName,
        userEmail: r.user.email,
        fullName: r.sv.fullName,
        collegeName: r.sv.collegeName,
        studentIdText: r.sv.studentIdText,
        documentPath: r.sv.documentPath,
        documentType: r.sv.documentType,
        status: r.sv.status,
        rejectionReason: r.sv.rejectionReason,
        submittedAt: r.sv.submittedAt.toISOString(),
        reviewedAt: r.sv.reviewedAt?.toISOString() ?? null,
      })),
      driverVerifications: dvRows.map((r) => ({
        id: r.dv.id,
        userId: r.dv.userId,
        userName: r.user.fullName,
        userEmail: r.user.email,
        vehicleNumber: r.dv.vehicleNumber,
        vehicleType: r.dv.vehicleType,
        licenceDocumentPath: r.dv.licenceDocumentPath,
        vehicleRegDocumentPath: r.dv.vehicleRegDocumentPath,
        identityDocumentPath: r.dv.identityDocumentPath,
        status: r.dv.status,
        rejectionReason: r.dv.rejectionReason,
        submittedAt: r.dv.submittedAt.toISOString(),
        reviewedAt: r.dv.reviewedAt?.toISOString() ?? null,
      })),
      legacyAutoVerified: legacyRows.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        college: u.college,
        studentId: u.studentId,
      })),
    });
  } catch (error) {
    return logError("admin verification GET", error);
  }
}

const StudentActionSchema = z.object({
  type: z.literal("student"),
  verificationId: z.coerce.number().int().positive(),
  action: z.enum(["APPROVE", "REJECT", "REQUEST_REUPLOAD"]),
  rejectionReason: z.string().trim().max(400).optional().default(""),
});

const DriverActionSchema = z.object({
  type: z.literal("driver"),
  verificationId: z.coerce.number().int().positive(),
  action: z.enum(["APPROVE", "REJECT", "REQUEST_REUPLOAD"]),
  rejectionReason: z.string().trim().max(400).optional().default(""),
});

const LegacyActionSchema = z.object({
  type: z.literal("legacy"),
  userId: z.coerce.number().int().positive(),
  action: z.enum(["APPROVE", "REJECT"]),
});

const AdminVerificationSchema = z.discriminatedUnion("type", [
  StudentActionSchema,
  DriverActionSchema,
  LegacyActionSchema,
]);

/** POST — admin approve/reject verification */
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
    const parsed = parseBody(raw, AdminVerificationSchema);
    if ("response" in parsed) return parsed.response;
    const input = parsed.data;
    const now = new Date();

    // ---- Student verification ----
    if (input.type === "student") {
      const rows = await db
        .select()
        .from(studentVerifications)
        .where(eq(studentVerifications.id, input.verificationId))
        .limit(1);
      const sv = rows[0];
      if (!sv) return fail("Verification request not found.", 404);

      if (input.action === "APPROVE") {
        await db.transaction(async (tx) => {
          await tx
            .update(studentVerifications)
            .set({ status: "VERIFIED", reviewedAt: now, reviewedBy: auth.user.id, updatedAt: now })
            .where(eq(studentVerifications.id, sv.id));
          await tx
            .update(users)
            .set({ verified: true, verificationStatus: "VERIFIED" })
            .where(eq(users.id, sv.userId));
        });
        await notify(sv.userId, "verification_approved", "Student verification approved ✅", "Your college ID has been verified. You can now book and offer rides.", null);
      } else if (input.action === "REJECT") {
        if (!input.rejectionReason) return fail("Rejection reason is required.", 422);
        await db.transaction(async (tx) => {
          await tx
            .update(studentVerifications)
            .set({ status: "REJECTED", rejectionReason: input.rejectionReason, reviewedAt: now, reviewedBy: auth.user.id, updatedAt: now })
            .where(eq(studentVerifications.id, sv.id));
          await tx
            .update(users)
            .set({ verified: false, verificationStatus: "REJECTED" })
            .where(eq(users.id, sv.userId));
        });
        await notify(sv.userId, "verification_rejected", "Student verification rejected", `Reason: ${input.rejectionReason}. You can upload a corrected document and resubmit.`, null);
      } else {
        // REQUEST_REUPLOAD
        await db
          .update(studentVerifications)
          .set({ status: "REJECTED", rejectionReason: input.rejectionReason || "Please upload a clearer document.", reviewedAt: now, reviewedBy: auth.user.id, updatedAt: now })
          .where(eq(studentVerifications.id, sv.id));
        await db
          .update(users)
          .set({ verificationStatus: "REJECTED" })
          .where(eq(users.id, sv.userId));
        await notify(sv.userId, "verification_reupload", "Re-upload your ID card", `${input.rejectionReason || "Your document was not clear enough. Please upload again."}`, null);
      }

      return NextResponse.json({ ok: true, action: input.action });
    }

    // ---- Driver verification ----
    if (input.type === "driver") {
      const rows = await db
        .select()
        .from(driverVerifications)
        .where(eq(driverVerifications.id, input.verificationId))
        .limit(1);
      const dv = rows[0];
      if (!dv) return fail("Driver verification request not found.", 404);

      // Check student is verified
      const userRows = await db.select().from(users).where(eq(users.id, dv.userId)).limit(1);
      const targetUser = userRows[0];
      if (!targetUser) return fail("User not found.", 404);
      const studentOk = targetUser.verified && (targetUser.verificationStatus === "VERIFIED" || targetUser.verificationStatus === "LEGACY_AUTO");
      if (!studentOk) return fail("This user must have verified student status first.", 409);

      if (input.action === "APPROVE") {
        await db.transaction(async (tx) => {
          await tx
            .update(driverVerifications)
            .set({ status: "APPROVED", reviewedAt: now, reviewedBy: auth.user.id, updatedAt: now })
            .where(eq(driverVerifications.id, dv.id));
          await tx
            .update(users)
            .set({ driverVerified: true, driverVerificationStatus: "APPROVED" })
            .where(eq(users.id, dv.userId));
        });
        await notify(dv.userId, "driver_approved", "Driver verification approved 🚗", "You can now offer rides on RideMate.", null);
      } else if (input.action === "REJECT") {
        if (!input.rejectionReason) return fail("Rejection reason is required.", 422);
        await db.transaction(async (tx) => {
          await tx
            .update(driverVerifications)
            .set({ status: "REJECTED", rejectionReason: input.rejectionReason, reviewedAt: now, reviewedBy: auth.user.id, updatedAt: now })
            .where(eq(driverVerifications.id, dv.id));
          await tx
            .update(users)
            .set({ driverVerified: false, driverVerificationStatus: "REJECTED" })
            .where(eq(users.id, dv.userId));
        });
        await notify(dv.userId, "driver_rejected", "Driver verification rejected", `Reason: ${input.rejectionReason}`, null);
      } else {
        await db
          .update(driverVerifications)
          .set({ status: "REJECTED", rejectionReason: input.rejectionReason || "Please re-upload clearer documents.", reviewedAt: now, reviewedBy: auth.user.id, updatedAt: now })
          .where(eq(driverVerifications.id, dv.id));
        await db
          .update(users)
          .set({ driverVerificationStatus: "REJECTED" })
          .where(eq(users.id, dv.userId));
        await notify(dv.userId, "driver_reupload", "Re-upload driving documents", `${input.rejectionReason || "Documents were unclear. Please upload again."}`, null);
      }

      return NextResponse.json({ ok: true, action: input.action });
    }

    // ---- Legacy auto-verified ----
    if (input.type === "legacy") {
      const userRows = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
      const targetUser = userRows[0];
      if (!targetUser) return fail("User not found.", 404);
      if (targetUser.verificationStatus !== "LEGACY_AUTO") return fail("User is not in legacy auto-verified state.", 409);

      if (input.action === "APPROVE") {
        await db
          .update(users)
          .set({ verified: true, verificationStatus: "VERIFIED" })
          .where(eq(users.id, input.userId));
        await notify(input.userId, "verification_approved", "Verification confirmed ✅", "Your student identity has been confirmed by the admin team.", null);
      } else {
        await db
          .update(users)
          .set({ verified: false, verificationStatus: "NOT_SUBMITTED" })
          .where(eq(users.id, input.userId));
        await notify(input.userId, "verification_rejected", "Verification revoked", "Please submit your college ID card for proper verification.", null);
      }

      return NextResponse.json({ ok: true, action: input.action });
    }

    return fail("Unknown verification type.", 400);
  } catch (error) {
    return logError("admin verification POST", error);
  }
}
