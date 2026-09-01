import { db } from "@/db";
import { notifications } from "@/db/schema";

/** Creates an in-app notification (never throws into the caller's transaction). */
export async function notify(
  userId: number,
  type: string,
  title: string,
  body: string,
  rideId?: number | null,
): Promise<void> {
  try {
    await db.insert(notifications).values({
      userId,
      type,
      title,
      body,
      rideId: rideId ?? null,
    });
  } catch (error) {
    console.error("[notify] failed", error instanceof Error ? error.message : error);
  }
}
