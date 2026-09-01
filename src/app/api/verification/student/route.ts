import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { writeFile, mkdir } from "fs/promises";
import { randomBytes } from "crypto";
import { join } from "path";
import { db } from "@/db";
import { studentVerifications, users } from "@/db/schema";
import { fail, logError, requireUser, sameOriginGuard } from "@/lib/api";
import { rateLimited, RATE_LIMITS } from "@/lib/rate-limit";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

const UPLOAD_DIR = join(process.cwd(), "private-uploads", "student-docs");
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/pdf",
]);
const ALLOWED_EXTS = new Set(["jpg", "jpeg", "png", "pdf"]);

/** GET — current user's student verification status & history */
export async function GET() {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;

    const rows = await db
      .select()
      .from(studentVerifications)
      .where(eq(studentVerifications.userId, auth.user.id))
      .orderBy(desc(studentVerifications.createdAt))
      .limit(10);

    return NextResponse.json({
      verificationStatus: auth.user.verificationStatus,
      verified: auth.user.verified,
      submissions: rows.map((r) => ({
        id: r.id,
        fullName: r.fullName,
        collegeName: r.collegeName,
        studentIdText: r.studentIdText,
        status: r.status,
        rejectionReason: r.rejectionReason,
        submittedAt: r.submittedAt.toISOString(),
        reviewedAt: r.reviewedAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    return logError("student verification GET", error);
  }
}

/** POST — submit new student verification with document upload */
export async function POST(request: Request) {
  try {
    const csrf = sameOriginGuard(request);
    if (csrf) return csrf;

    const limit = rateLimited(request, "signup", RATE_LIMITS.signup);
    if (limit) return limit;

    const auth = await requireUser();
    if ("response" in auth) return auth.response;

    // Already verified (genuinely) — no need to re-submit
    if (auth.user.verificationStatus === "VERIFIED") {
      return fail("Your student identity is already verified.", 409);
    }

    // Check for an existing PENDING submission
    const pending = await db
      .select()
      .from(studentVerifications)
      .where(eq(studentVerifications.userId, auth.user.id))
      .orderBy(desc(studentVerifications.createdAt))
      .limit(1);

    if (pending[0]?.status === "PENDING") {
      return fail(
        "You already have a verification request under review. Please wait for the admin to respond.",
        409,
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const fullName = String(formData.get("fullName") ?? "").trim();
    const collegeName = String(formData.get("collegeName") ?? "").trim();
    const studentIdText = String(formData.get("studentIdText") ?? "").trim();
    const file = formData.get("document");

    if (!fullName || fullName.length < 3) return fail("Enter your full name.", 422);
    if (!collegeName || collegeName.length < 2) return fail("Enter your college name.", 422);
    if (!studentIdText || studentIdText.length < 3) return fail("Enter your student/enrollment ID.", 422);

    if (!file || !(file instanceof File)) {
      return fail("Please upload your college ID card (JPG, PNG or PDF, max 5 MB).", 422);
    }

    // Validate file type
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if (!ALLOWED_TYPES.has(file.type) && !ALLOWED_EXTS.has(ext)) {
      return fail("Only JPG, PNG or PDF files are allowed.", 422);
    }
    if (file.size > MAX_SIZE) {
      return fail("File size must be under 5 MB.", 422);
    }

    // Save file securely with a random name (no user-controlled path)
    const safeExt = ALLOWED_EXTS.has(ext) ? ext : "bin";
    const fileName = `sv_${auth.user.id}_${Date.now()}_${randomBytes(8).toString("hex")}.${safeExt}`;
    const filePath = join(UPLOAD_DIR, fileName);

    await mkdir(UPLOAD_DIR, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const docType = safeExt === "pdf" ? "pdf" : "image";

    // Create verification record
    const inserted = await db
      .insert(studentVerifications)
      .values({
        userId: auth.user.id,
        fullName,
        collegeName,
        studentIdText,
        documentPath: fileName, // relative name only, never a public URL
        documentType: docType,
        status: "PENDING",
      })
      .returning();

    // Update user status to PENDING (does NOT set verified=true)
    await db
      .update(users)
      .set({ verificationStatus: "PENDING" })
      .where(eq(users.id, auth.user.id));

    // Notify admins
    const admins = await db.select().from(users).where(eq(users.role, "ADMIN"));
    for (const admin of admins) {
      await notify(
        admin.id,
        "verification_request",
        "New student verification request",
        `${fullName} (${collegeName}) submitted their ID card for verification.`,
        null,
      );
    }

    return NextResponse.json(
      {
        ok: true,
        verificationId: inserted[0]?.id,
        status: "PENDING",
        message: "Your verification request has been submitted. An admin will review it shortly.",
      },
      { status: 201 },
    );
  } catch (error) {
    return logError("student verification POST", error);
  }
}
