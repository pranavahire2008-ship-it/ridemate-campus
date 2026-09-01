"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, EmptyState, Select, Spinner, useToast } from "@/components/ui";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/payment";
import { useSession } from "@/components/session-provider";

type Overview = {
  mode: string;
  totals: {
    users: number;
    rides: number;
    bookings: number;
    paid: number;
    revenue: number;
    refunded: number;
    openReports: number;
  } | null;
  driverEarningsOverview?: {
    totalPlatformVolume: number;
    totalPlatformCommission: number;
    totalPendingDriverEarnings: number;
    totalAvailablePayouts: number;
    totalPayoutProcessing: number;
    totalPaidOutDrivers: number;
    totalRefundedAmount: number;
    totalFailedPaymentsCount: number;
    totalFailedPayoutsCount: number;
    earningsList: {
      id: number;
      bookingId: number;
      rideId: number;
      driverId: number;
      driverName: string;
      driverCollege: string;
      route: string;
      travelDate: string;
      departureTime: string;
      totalFare: number;
      commissionAmount: number;
      driverEarning: number;
      status: string;
      payoutId: string | null;
      payoutMethod: string;
      paidOutAt: string | null;
      createdAt: string;
    }[];
  };
  reports: {
    id: number;
    reason: string;
    details: string;
    status: string;
    createdAt: string;
    reporterName: string;
    reportedUserId: number | null;
    rideId: number | null;
  }[];
  pendingVerification: {
    id: number;
    fullName: string;
    email: string;
    college: string;
    studentId: string;
    verificationStatus: string;
    createdAt: string;
  }[];
  payments: {
    id: number;
    orderId: string;
    paymentId: string | null;
    amount: number;
    status: string;
    verified: boolean;
    refundStatus: string | null;
    provider: string;
    createdAt: string;
    bookingStatus: string;
    route: string;
  }[];
};

export default function AdminPage() {
  const { user, loading: sessionLoading } = useSession();
  const { push } = useToast();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/overview", { cache: "no-store" });
      if (res.status === 403 || res.status === 401) {
        setDenied(true);
        setData(null);
        return;
      }
      setDenied(false);
      setData((await res.json()) as Overview);
    } catch {
      setDenied(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading) void load();
  }, [sessionLoading, load]);

  const act = async (payload: Record<string, unknown>, message: string) => {
    const res = await fetch("/api/admin/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      push({ title: message, tone: "success" });
      await load();
    } else {
      const body = (await res.json()) as { error?: string };
      push({ title: "Action failed", body: body.error, tone: "error" });
    }
  };

  if (sessionLoading || loading) return <Spinner label="Loading admin console…" />;

  if (denied || !data) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <EmptyState
          icon="🛠"
          title="Admin access required"
          body="This console is restricted to campus safety administrators. Student accounts cannot open moderation tools."
        />
      </div>
    );
  }

  const stats = [
    { k: "Students", v: data.totals?.users ?? 0 },
    { k: "Active rides", v: data.totals?.rides ?? 0 },
    { k: "Bookings", v: data.totals?.bookings ?? 0 },
    { k: "Paid bookings", v: data.totals?.paid ?? 0 },
    { k: "Collected", v: `₹${data.totals?.revenue ?? 0}` },
    { k: "Refunded", v: `₹${data.totals?.refunded ?? 0}` },
    { k: "Open reports", v: data.totals?.openReports ?? 0 },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
      <div className="animate-[fade-up_0.4s_ease-out]">
        <Badge tone="brand">Admin console</Badge>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-[40px]">
          Campus moderation
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
          Signed in as {user?.fullName}. Payment gateway mode:{" "}
          <span className="font-semibold text-slate-900">
            {data.mode === "razorpay" ? "Razorpay (live)" : "Sandbox simulator"}
          </span>
          .
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {stats.map((s) => (
          <div key={s.k} className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-card">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.k}</p>
            <p className="mt-1 text-lg font-extrabold tracking-tight text-slate-900">{s.v}</p>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
          Student verification review
        </h2>
        <p className="mt-1.5 text-sm text-slate-600">
          Only verified students can offer paid rides, complete bookings or see contact details.
        </p>
        {data.pendingVerification.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            No verification requests waiting.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {data.pendingVerification.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-card"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">{row.fullName}</p>
                  <p className="text-xs text-slate-500">
                    {row.college} · {row.studentId || "no student ID"}
                  </p>
                  <p className="text-[11px] text-slate-400">{row.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={row.verificationStatus === "PENDING" ? "amber" : "rose"}>
                    {row.verificationStatus}
                  </Badge>
                  <Button
                    size="sm"
                    variant="success"
                    onClick={() =>
                      act(
                        { type: "verification", userId: row.id, decision: "VERIFIED" },
                        `${row.fullName} verified`,
                      )
                    }
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() =>
                      act(
                        { type: "verification", userId: row.id, decision: "REJECTED" },
                        `${row.fullName} rejected`,
                      )
                    }
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">User reports</h2>
        {data.reports.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            No reports submitted yet.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {data.reports.map((report) => (
              <div key={report.id} className="rounded-3xl border border-slate-100 bg-white p-4 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold capitalize text-slate-900">
                      {report.reason.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs text-slate-500">
                      Reported by {report.reporterName}
                      {report.reportedUserId ? ` · target user #${report.reportedUserId}` : ""}
                      {report.rideId ? ` · ride #${report.rideId}` : ""}
                    </p>
                    {report.details ? (
                      <p className="mt-2 text-xs leading-relaxed text-slate-600">“{report.details}”</p>
                    ) : null}
                  </div>
                  <Badge tone={report.status === "OPEN" ? "amber" : report.status === "RESOLVED" ? "mint" : "brand"}>
                    {report.status}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Select
                    className="h-9 w-40 py-0 text-[13px]"
                    value={report.status}
                    onChange={(e) =>
                      act(
                        { type: "review_report", reportId: report.id, status: e.target.value },
                        "Report updated",
                      )
                    }
                  >
                    <option value="OPEN">Open</option>
                    <option value="REVIEWING">Reviewing</option>
                    <option value="RESOLVED">Resolved</option>
                  </Select>
                  {report.reportedUserId ? (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() =>
                        act(
                          { type: "suspend", userId: report.reportedUserId, suspended: true },
                          "Student suspended",
                        )
                      }
                    >
                      Suspend user
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Driver Earnings & Payout Oversight */}
      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Badge tone="mint">Financial Escrow &amp; Payouts</Badge>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
              Driver Earnings &amp; Payout Ledger
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              5% platform commission collected, driver pending earnings, available balances, and payout management.
            </p>
          </div>
          {data.driverEarningsOverview ? (
            <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-700">
              <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-slate-800">
                Volume: ₹{data.driverEarningsOverview.totalPlatformVolume}
              </span>
              <span className="rounded-xl bg-brand-50 px-3 py-1.5 text-brand-700">
                Commission (5%): ₹{data.driverEarningsOverview.totalPlatformCommission}
              </span>
              <span className="rounded-xl bg-amber-50 px-3 py-1.5 text-amber-700">
                Pending: ₹{data.driverEarningsOverview.totalPendingDriverEarnings}
              </span>
              <span className="rounded-xl bg-mint-50 px-3 py-1.5 text-mint-700">
                Available: ₹{data.driverEarningsOverview.totalAvailablePayouts}
              </span>
              <span className="rounded-xl bg-indigo-50 px-3 py-1.5 text-indigo-700">
                Processing: ₹{data.driverEarningsOverview.totalPayoutProcessing}
              </span>
              <span className="rounded-xl bg-emerald-50 px-3 py-1.5 text-emerald-700">
                Paid Out: ₹{data.driverEarningsOverview.totalPaidOutDrivers}
              </span>
              <span className="rounded-xl bg-rose-50 px-3 py-1.5 text-rose-700">
                Refunds: ₹{data.driverEarningsOverview.totalRefundedAmount}
              </span>
              {data.driverEarningsOverview.totalFailedPaymentsCount > 0 ? (
                <span className="rounded-xl bg-rose-100 px-3 py-1.5 text-rose-800">
                  Failed Payments: {data.driverEarningsOverview.totalFailedPaymentsCount}
                </span>
              ) : null}
              {data.driverEarningsOverview.totalFailedPayoutsCount > 0 ? (
                <span className="rounded-xl bg-rose-100 px-3 py-1.5 text-rose-800">
                  Failed Payouts: {data.driverEarningsOverview.totalFailedPayoutsCount}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {!data.driverEarningsOverview || data.driverEarningsOverview.earningsList.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            No driver earnings recorded yet. When rides are booked and paid, 95% driver earnings and 5% platform commission will be logged here.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {data.driverEarningsOverview.earningsList.map((item) => (
              <div
                key={item.id}
                className="rounded-3xl border border-slate-100 bg-white p-4 shadow-card"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-900">{item.driverName}</p>
                      <Badge tone={item.status === "PAID_OUT" ? "brand" : item.status === "AVAILABLE" || item.status === "RIDE_COMPLETED" ? "mint" : item.status === "PENDING" ? "amber" : "rose"}>
                        {item.status === "PENDING" ? "Pending (In Progress)" : item.status === "AVAILABLE" || item.status === "RIDE_COMPLETED" ? "Available for Payout" : item.status === "PAID_OUT" ? "Paid Out" : item.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500">
                      {item.driverCollege} · Route: <span className="font-semibold text-slate-800">{item.route}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-extrabold text-slate-900">
                      ₹{item.driverEarning} <span className="text-xs font-normal text-slate-400">(95%)</span>
                    </p>
                    <p className="text-[11px] text-slate-400">Total fare: ₹{item.totalFare} | Comm (5%): ₹{item.commissionAmount}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs">
                  <span className="text-slate-500">
                    Payout ID: <span className="font-mono text-slate-700">{item.payoutId || "Not issued"}</span>
                  </span>
                  {item.status === "AVAILABLE" || item.status === "RIDE_COMPLETED" || item.status === "PENDING" ? (
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() =>
                        act(
                          { type: "approve_payout", earningId: item.id, action: "approve_payout" },
                          `Marked payout for ${item.driverName} (₹${item.driverEarning}) as Paid Out`,
                        )
                      }
                    >
                      ✓ Approve &amp; Mark Paid Out
                    </Button>
                  ) : item.status === "PAID_OUT" ? (
                    <span className="font-semibold text-mint-700">✓ Paid Out Completed</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
          Payments &amp; disputes
        </h2>
        {data.payments.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            No payments recorded yet.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {data.payments.map((payment) => (
              <div
                key={payment.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-card"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">{payment.route}</p>
                  <p className="truncate font-mono text-[11px] text-slate-500">
                    {payment.orderId} · {payment.paymentId ?? "—"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-extrabold text-slate-900">₹{payment.amount}</p>
                  <PaymentStatusBadge status={payment.status} />
                  <BookingStatusBadge status={payment.bookingStatus} />
                  <Badge tone="slate">Razorpay</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
