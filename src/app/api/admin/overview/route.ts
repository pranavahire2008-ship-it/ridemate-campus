import { NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, payments, reports, rides, users } from "@/db/schema";
import { logError, requireAdmin } from "@/lib/api";
import { releaseExpiredPayments } from "@/lib/payments";
import { paymentMode } from "@/lib/razorpay";
import { getAdminDriverEarningsOverview } from "@/lib/earnings";

export const dynamic = "force-dynamic";

/** Moderation overview — server-side ADMIN role check, never exposed to students. */
export async function GET() {
  try {
    const auth = await requireAdmin();
    if ("response" in auth) return auth.response;

    await releaseExpiredPayments();

    const reportRows = await db
      .select({ report: reports, reporter: users })
      .from(reports)
      .innerJoin(users, eq(reports.reporterId, users.id))
      .orderBy(desc(reports.createdAt))
      .limit(50);

    const pendingVerification = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        college: users.college,
        studentId: users.studentId,
        verificationStatus: users.verificationStatus,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(sql`${users.verificationStatus} in ('PENDING', 'REJECTED', 'UNVERIFIED')`)
      .orderBy(desc(users.createdAt))
      .limit(50);

    const paymentRows = await db
      .select({ payment: payments, booking: bookings, ride: rides })
      .from(payments)
      .innerJoin(bookings, eq(payments.bookingId, bookings.id))
      .innerJoin(rides, eq(bookings.rideId, rides.id))
      .orderBy(desc(payments.createdAt))
      .limit(40);

    const driverEarningsOverview = await getAdminDriverEarningsOverview();

    const totals = await db
      .select({
        users: sql<number>`(select count(*)::int from users)`,
        rides: sql<number>`(select count(*)::int from rides where status = 'active')`,
        bookings: sql<number>`(select count(*)::int from bookings)`,
        paid: sql<number>`(select count(*)::int from bookings where payment_status = 'PAID')`,
        revenue: sql<number>`(select coalesce(sum(amount), 0)::int from payments where status = 'PAID')`,
        refunded: sql<number>`(select coalesce(sum(refund_amount), 0)::int from payments where status = 'REFUNDED')`,
        openReports: sql<number>`(select count(*)::int from reports where status = 'OPEN')`,
      })
      .from(users)
      .limit(1);

    return NextResponse.json({
      mode: paymentMode(),
      driverEarningsOverview,
      totals: totals[0] ?? null,
      reports: reportRows.map((row) => ({
        id: row.report.id,
        reason: row.report.reason,
        details: row.report.details,
        status: row.report.status,
        createdAt: row.report.createdAt.toISOString(),
        reporterName: row.reporter.fullName,
        reportedUserId: row.report.reportedUserId,
        rideId: row.report.rideId,
      })),
      pendingVerification: pendingVerification.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      })),
      payments: paymentRows.map((row) => ({
        id: row.payment.id,
        orderId: row.payment.orderId,
        paymentId: row.payment.paymentId,
        amount: row.payment.amount,
        status: row.payment.status,
        verified: row.payment.verified,
        refundStatus: row.payment.refundStatus,
        provider: row.payment.provider,
        createdAt: row.payment.createdAt.toISOString(),
        bookingStatus: row.booking.status,
        route: `${row.ride.fromLocation} → ${row.ride.toLocation}`,
      })),
    });
  } catch (error) {
    return logError("admin overview failed", error);
  }
}
