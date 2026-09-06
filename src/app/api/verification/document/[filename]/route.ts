import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { studentVerifications, driverVerifications } from "@/db/schema";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { fail, logError } from "@/lib/api";
import { downloadVerificationDocument } from "@/lib/supabase-storage";

export const dynamic = "force-dynamic";

/**
 * Secure document server: only the document owner or an admin can access.
 * Documents are stored in a private Supabase Storage bucket, never a public URL.
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

    let found = false;
    let authorized = false;

    // Check student verification docs
    const svRows = await db
      .select()
      .from(studentVerifications)
      .where(eq(studentVerifications.documentPath, safeName))
      .limit(1);

    if (svRows[0]) {
      found = true;
      authorized = svRows[0].userId === user.id || isAdmin(user);
    }

    // Check driver verification docs (licence, RC, identity)
    if (!found) {
      const dvRows = await db
        .select()
        .from(driverVerifications)
        .where(eq(driverVerifications.licenceDocumentPath, safeName))
        .limit(1);
      if (dvRows[0]) {
        found = true;
        authorized = dvRows[0].userId === user.id || isAdmin(user);
      }
    }
    if (!found) {
      const dvRows2 = await db
        .select()
        .from(driverVerifications)
        .where(eq(driverVerifications.vehicleRegDocumentPath, safeName))
        .limit(1);
      if (dvRows2[0]) {
        found = true;
        authorized = dvRows2[0].userId === user.id || isAdmin(user);
      }
    }
    if (!found) {
      const dvRows3 = await db
        .select()
        .from(driverVerifications)
        .where(eq(driverVerifications.identityDocumentPath, safeName))
        .limit(1);
      if (dvRows3[0]) {
        found = true;
        authorized = dvRows3[0].userId === user.id || isAdmin(user);
      }
    }

    if (!found) return fail("Document not found.", 404);
    if (!authorized) return fail("You do not have permission to view this document.", 403);

    let buffer: Buffer;
    try {
      buffer = await downloadVerificationDocument(safeName);
    } catch {
      return fail("Document file not found in storage.", 404);
    }

    const ext = safeName.split(".").pop()?.toLowerCase() ?? "";
    const contentType =
      ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : "image/jpeg";

    return new NextResponse(new Uint8Array(buffer), {
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
