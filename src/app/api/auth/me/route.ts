import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getCurrentUser, toPublicUser } from "@/lib/auth";
import { serializeNotification } from "@/lib/rides";
import { paymentMode } from "@/lib/razorpay";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
const AUTH_RESPONSE_HEADERS = { "Cache-Control": "no-store, max-age=0", Vary: "Cookie" };

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        {
          user: null,
          notifications: [],
          
          paymentMode: paymentMode(),
        },
        { headers: AUTH_RESPONSE_HEADERS },
      );
    }
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(25);

    return NextResponse.json(
      {
        user: toPublicUser(user),
        notifications: rows.map(serializeNotification),
        
        paymentMode: paymentMode(),
        paymentWindowMinutes: env.paymentWindowMinutes,
      },
      { headers: AUTH_RESPONSE_HEADERS },
    );
  } catch (error) {
    console.error("[auth/me]", error instanceof Error ? error.message : error);
    return NextResponse.json(
      {
        user: null,
        notifications: [],
        
        paymentMode: paymentMode(),
      },
      { headers: AUTH_RESPONSE_HEADERS },
    );
  }
}
