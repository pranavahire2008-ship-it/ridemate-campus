import { NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { join } from "path";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { studentVerifications, driverVerifications } from "@/db/schema";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { fail, logError } from "@/lib/api";

export const dynamic = "force-dynamic";

const STUDENT_DIR = join(process.cwd(), "private-uploads", "student-docs");
const DRIVER_DIR = join(process.cwd(), "private-uploads", "driver-docs");

/**
 * Secure document server: only the document owner or an admin can access.
 * Documents are NEVER served from a public URL.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  try {
    const { filename } = await params;
    const user = await getCurrentUser();
    if (!user) return fail("Please log in to view documents.", 401);

    // Sanitize: filename must not contain path traversal
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "");
    if (safeName !== filename || filename.includes("..")) {
      return fail("Invalid document reference.", 400);
    }

    // Determine which directory this file belongs to
    let filePath: string | null = null;
    let authorized = false;

    // Check student verification docs
    const svRows = await db
      .select()
      .from(studentVerifications)
      .where(eq(studentVerifications.documentPath, safeName))
      .limit(1);

    if (svRows[0]) {
      filePath = join(STUDENT_DIR, safeName);
      authorized = svRows[0].userId === user.id || isAdmin(user);
    }

    // Check driver verification docs
    if (!filePath) {
      const dvRows = await db
        .select()
        .from(driverVerifications)
        .where(eq(driverVerifications.licenceDocumentPath, safeName))
        .limit(1);
      if (dvRows[0]) {
        filePath = join(DRIVER_DIR, safeName);
        authorized = dvRows[0].userId === user.id || isAdmin(user);
      }
    }
    if (!filePath) {
      const dvRows2 = await db
        .select()
        .from(driverVerifications)
        .where(eq(driverVerifications.vehicleRegDocumentPath, safeName))
        .limit(1);
      if (dvRows2[0]) {
        filePath = join(DRIVER_DIR, safeName);
        authorized = dvRows2[0].userId === user.id || isAdmin(user);
      }
    }

    if (!filePath) return fail("Document not found.", 404);
    if (!authorized) return fail("You do not have permission to view this document.", 403);

    // Verify file exists on disk
    try {
      await stat(filePath);
    } catch {
      return fail("Document file not found on server.", 404);
    }

    const buffer = await readFile(filePath);
    const ext = safeName.split(".").pop()?.toLowerCase() ?? "";
    const contentType =
      ext === "pdf"
        ? "application/pdf"
        : ext === "png"
          ? "image/png"
          : "image/jpeg";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return logError("document serve", error);
  }
}
