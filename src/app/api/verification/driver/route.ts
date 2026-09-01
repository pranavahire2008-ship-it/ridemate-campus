import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { writeFile, mkdir } from "fs/promises";
import { randomBytes } from "crypto";
import { join } from "path";
import { db } from "@/db";
import { driverVerifications, users } from "@/db/schema";
import { fail, logError, requireUser, sameOriginGuard } from "@/lib/api";
import { rateLimited, RATE_LIMITS } from "@/lib/rate-limit";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

const UPLOAD_DIR = join(process.cwd(), "private-uploads", "driver-docs");
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTS = new Set(["jpg", "jpeg", "png", "pdf"]);

/** GET — current user's driver verification status */
export async function GET() {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;

    const rows = await db
      .select()
      .from(driverVerifications)
      .where(eq(driverVerifications.userId, auth.user.id))
      .orderBy(desc(driverVerifications.createdAt))
      .limit(10);

    return NextResponse.json({
      driverVerificationStatus: auth.user.driverVerificationStatus,
      driverVerified: auth.user.driverVerified,
      studentVerified: auth.user.verified && (auth.user.verificationStatus === "VERIFIED" || auth.user.verificationStatus === "LEGACY_AUTO"),
      submissions: rows.map((r) => ({
        id: r.id,
        vehicleNumber: r.vehicleNumber,
        vehicleType: r.vehicleType,
        status: r.status,
        rejectionReason: r.rejectionReason,
        submittedAt: r.submittedAt.toISOString(),
        reviewedAt: r.reviewedAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    return logError("driver verification GET", error);
  }
}

/** POST — submit driver verification documents */
export async function POST(request: Request) {
  try {
    const csrf = sameOriginGuard(request);
    if (csrf) return csrf;

    const limit = rateLimited(request, "signup", RATE_LIMITS.signup);
    if (limit) return limit;

    const auth = await requireUser();
    if ("response" in auth) return auth.response;

    // Must have student verification first
    const isStudentVerified =
      auth.user.verified &&
      (auth.user.verificationStatus === "VERIFIED" || auth.user.verificationStatus === "LEGACY_AUTO");
    if (!isStudentVerified) {
      return fail("You must complete student verification before applying for driver verification.", 403);
    }

    if (auth.user.driverVerificationStatus === "APPROVED") {
      return fail("You are already an approved driver.", 409);
    }

    const pendingRows = await db
      .select()
      .from(driverVerifications)
      .where(eq(driverVerifications.userId, auth.user.id))
      .orderBy(desc(driverVerifications.createdAt))
      .limit(1);

    if (pendingRows[0]?.status === "PENDING") {
      return fail("You already have a pending driver verification request.", 409);
    }

    const formData = await request.formData();
    const vehicleNumber = String(formData.get("vehicleNumber") ?? "").trim().toUpperCase();
    const vehicleType = String(formData.get("vehicleType") ?? "").trim();
    const licenceFile = formData.get("licenceDocument");
    const regFile = formData.get("vehicleRegDocument");

    if (!vehicleNumber || vehicleNumber.length < 4) return fail("Enter your vehicle number.", 422);
    if (!vehicleType) return fail("Select your vehicle type.", 422);

    const user = auth.user;
    async function saveFile(file: unknown, prefix: string): Promise<string> {
      if (!file || !(file instanceof File)) {
        throw new Error("File required");
      }
      const ext = (file.name.split(".").pop() ?? "").toLowerCase();
      if (!ALLOWED_EXTS.has(ext)) throw new Error("Only JPG, PNG or PDF files are allowed.");
      if (file.size > MAX_SIZE) throw new Error("File must be under 5 MB.");
      const name = `${prefix}_${user.id}_${Date.now()}_${randomBytes(8).toString("hex")}.${ext}`;
      await mkdir(UPLOAD_DIR, { recursive: true });
      await writeFile(join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
      return name;
    }

    let licencePath: string;
    let regPath: string;
    try {
      licencePath = await saveFile(licenceFile, "dl");
      regPath = await saveFile(regFile, "rc");
    } catch (err) {
      return fail(err instanceof Error ? err.message : "File upload failed.", 422);
    }

    await db.insert(driverVerifications).values({
      userId: auth.user.id,
      licenceDocumentPath: licencePath,
      vehicleNumber,
      vehicleType,
      vehicleRegDocumentPath: regPath,
      status: "PENDING",
    });

    await db
      .update(users)
      .set({ driverVerificationStatus: "PENDING" })
      .where(eq(users.id, auth.user.id));

    const admins = await db.select().from(users).where(eq(users.role, "ADMIN"));
    for (const admin of admins) {
      await notify(
        admin.id,
        "driver_verification_request",
        "New driver verification request",
        `${auth.user.fullName} submitted driving licence and vehicle documents for driver approval.`,
        null,
      );
    }

    return NextResponse.json(
      {
        ok: true,
        status: "PENDING",
        message: "Your driver verification has been submitted for admin review.",
      },
      { status: 201 },
    );
  } catch (error) {
    return logError("driver verification POST", error);
  }
}
