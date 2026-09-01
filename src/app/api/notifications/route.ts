import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { parseBody } from "@/lib/api";
import { fail, logError, requireUser, sameOriginGuard } from "@/lib/api";
import { serializeNotification } from "@/lib/rides";
import { z } from "zod";

export const dynamic = "force-dynamic";

const MarkReadSchema = z.object({ id: z.coerce.number().int().positive().optional() });

export async function GET() {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, auth.user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(25);
    return NextResponse.json({ notifications: rows.map(serializeNotification) });
  } catch (error) {
    return logError("notifications failed", error);
  }
}

export async function PATCH(request: Request) {
  try {
    const csrf = sameOriginGuard(request);
    if (csrf) return csrf;

    const auth = await requireUser();
    if ("response" in auth) return auth.response;

    let raw: unknown = {};
    try {
      raw = await request.json();
    } catch {
      raw = {};
    }
    const parsed = parseBody(raw, MarkReadSchema);
    if ("response" in parsed) return parsed.response;
    const { id } = parsed.data;

    if (id) {
      await db
        .update(notifications)
        .set({ read: true })
        .where(and(eq(notifications.id, id), eq(notifications.userId, auth.user.id)));
    } else {
      await db
        .update(notifications)
        .set({ read: true })
        .where(eq(notifications.userId, auth.user.id));
    }

    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, auth.user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(25);
    return NextResponse.json({ notifications: rows.map(serializeNotification) });
  } catch (error) {
    return logError("notification update failed", error);
  }
}

export async function DELETE() {
  return fail("Method not allowed.", 405);
}
