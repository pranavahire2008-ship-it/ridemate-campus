import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { blocks, users } from "@/db/schema";
import { fail, logError, parseBody, requireUser, sameOriginGuard } from "@/lib/api";
import { rateLimited, RATE_LIMITS } from "@/lib/rate-limit";
import { BlockSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;

    const rows = await db
      .select({ block: blocks, blocked: users })
      .from(blocks)
      .innerJoin(users, eq(blocks.blockedId, users.id))
      .where(eq(blocks.blockerId, auth.user.id))
      .orderBy(desc(blocks.createdAt));

    return NextResponse.json({
      blocks: rows.map((row) => ({
        id: row.block.id,
        blockedUserId: row.blocked.id,
        blockedUserName: row.blocked.fullName,
        blockedUserColor: row.blocked.avatarColor,
        reason: row.block.reason,
        createdAt: row.block.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return logError("blocks list failed", error);
  }
}

export async function POST(request: Request) {
  try {
    const csrf = sameOriginGuard(request);
    if (csrf) return csrf;

    const limit = rateLimited(request, "block", RATE_LIMITS.block);
    if (limit) return limit;

    const auth = await requireUser();
    if ("response" in auth) return auth.response;

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return fail("Invalid JSON body.", 400);
    }
    const parsed = parseBody(raw, BlockSchema);
    if ("response" in parsed) return parsed.response;
    const { blockedUserId, reason, action } = parsed.data;

    if (blockedUserId === auth.user.id) return fail("You cannot block yourself.", 400);

    const target = await db.select().from(users).where(eq(users.id, blockedUserId)).limit(1);
    if (target.length === 0) return fail("Student not found.", 404);

    if (action === "unblock") {
      await db
        .delete(blocks)
        .where(and(eq(blocks.blockerId, auth.user.id), eq(blocks.blockedId, blockedUserId)));
      return NextResponse.json({ ok: true, blocked: false });
    }

    await db
      .insert(blocks)
      .values({ blockerId: auth.user.id, blockedId: blockedUserId, reason: reason ?? "" })
      .onConflictDoNothing({ target: [blocks.blockerId, blocks.blockedId] });

    return NextResponse.json({ ok: true, blocked: true });
  } catch (error) {
    return logError("block failed", error);
  }
}
