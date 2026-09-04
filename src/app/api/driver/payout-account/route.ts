import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { driverPayoutAccounts } from "@/db/schema";
import { fail, logError, parseBody, requireUser, sameOriginGuard } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET — current driver's saved payout account (masked) */
export async function GET() {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;

    const rows = await db
      .select()
      .from(driverPayoutAccounts)
      .where(eq(driverPayoutAccounts.driverId, auth.user.id))
      .limit(1);

    const row = rows[0];
    if (!row) return NextResponse.json({ account: null });

    return NextResponse.json({
      account: {
        method: row.method,
        upiId: row.upiId,
        accountHolderName: row.accountHolderName,
        bankAccountLast4: row.bankAccountNumber ? row.bankAccountNumber.slice(-4) : null,
        bankIfsc: row.bankIfsc,
        verified: row.verified,
      },
    });
  } catch (error) {
    return logError("driver payout-account GET", error);
  }
}

const PayoutAccountSchema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("UPI"),
    upiId: z.string().trim().min(3).max(120),
    accountHolderName: z.string().trim().min(2).max(120),
  }),
  z.object({
    method: z.literal("BANK_ACCOUNT"),
    accountHolderName: z.string().trim().min(2).max(120),
    bankAccountNumber: z.string().trim().min(6).max(40),
    bankIfsc: z.string().trim().min(6).max(20),
  }),
]);

/** POST — driver adds/updates their UPI or bank account for payouts */
export async function POST(request: Request) {
  try {
    const csrf = sameOriginGuard(request);
    if (csrf) return csrf;

    const auth = await requireUser();
    if ("response" in auth) return auth.response;

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return fail("Invalid JSON body.", 400);
    }
    const parsed = parseBody(raw, PayoutAccountSchema);
    if ("response" in parsed) return parsed.response;
    const input = parsed.data;

    const existing = await db
      .select()
      .from(driverPayoutAccounts)
      .where(eq(driverPayoutAccounts.driverId, auth.user.id))
      .limit(1);

    const values =
      input.method === "UPI"
        ? {
            method: "UPI" as const,
            upiId: input.upiId,
            accountHolderName: input.accountHolderName,
            bankAccountNumber: null,
            bankIfsc: null,
          }
        : {
            method: "BANK_ACCOUNT" as const,
            upiId: null,
            accountHolderName: input.accountHolderName,
            bankAccountNumber: input.bankAccountNumber,
            bankIfsc: input.bankIfsc.toUpperCase(),
          };

    if (existing[0]) {
      // Any change to payout details resets verification and RazorpayX linkage.
      await db
        .update(driverPayoutAccounts)
        .set({
          ...values,
          verified: false,
          razorpayxContactId: null,
          razorpayxFundAccountId: null,
          updatedAt: new Date(),
        })
        .where(eq(driverPayoutAccounts.driverId, auth.user.id));
    } else {
      await db.insert(driverPayoutAccounts).values({
        driverId: auth.user.id,
        ...values,
      });
    }

    return NextResponse.json({ ok: true, message: "Payout details saved." });
  } catch (error) {
    return logError("driver payout-account POST", error);
  }
}
