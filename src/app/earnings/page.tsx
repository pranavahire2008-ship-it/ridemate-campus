"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, EmptyState, Spinner, useToast } from "@/components/ui";
import { formatDatePretty, formatTime12h } from "@/lib/locations";
import { useSession } from "@/components/session-provider";
import type { DriverEarningItemDTO, DriverEarningsSummaryDTO } from "@/lib/types";

const EARNING_STATUS_TONE: Record<string, "amber" | "mint" | "brand" | "rose" | "slate"> = {
  PENDING: "amber",
  RIDE_COMPLETED: "mint",
  AVAILABLE: "mint",
  PAYOUT_PROCESSING: "brand",
  PAID_OUT: "brand",
  CANCELLED: "rose",
  REFUNDED: "rose",
};

const EARNING_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending Earnings",
  RIDE_COMPLETED: "Available for Payout",
  AVAILABLE: "Available for Payout",
  PAYOUT_PROCESSING: "Payout Processing",
  PAID_OUT: "Paid Out",
  CANCELLED: "Cancelled / Refunded",
  REFUNDED: "Refunded",
};

export default function DriverEarningsPage() {
  const { user } = useSession();
  const { push } = useToast();
  const [data, setData] = useState<DriverEarningsSummaryDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/earnings", { cache: "no-store" });
      if (!res.ok) {
        setData(null);
        return;
      }
      const summary = (await res.json()) as DriverEarningsSummaryDTO;
      setData(summary);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void load();
    else setLoading(false);
  }, [user, load]);

  const handleRequestPayout = async () => {
    if (!data || data.availablePayout <= 0) return;
    setRequesting(true);
    try {
      const res = await fetch("/api/earnings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_payout" }),
      });
      const resData = (await res.json()) as { message?: string; error?: string };
      if (res.ok) {
        push({
          title: "Payout Requested 🎉",
          body: resData.message ?? `₹${data.availablePayout} processed for payout.`,
          tone: "success",
        });
        await load();
      } else {
        push({ title: "Payout Request Failed", body: resData.error, tone: "error" });
      }
    } catch {
      push({ title: "Network Error", body: "Could not submit payout request.", tone: "error" });
    } finally {
      setRequesting(false);
    }
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <EmptyState
          icon="💰"
          title="Login to view Driver Earnings"
          body="Your platform earnings, pending balance, available payouts, 5% commission breakdown and complete ride ledger appear here."
          action={
            <Link href="/login?next=/earnings">
              <Button>Login as Driver</Button>
            </Link>
          }
        />
      </div>
    );
  }

  if (loading) return <Spinner label="Loading driver earnings ledger…" />;

  const summary = data ?? {
    totalEarnings: 0,
    pendingEarnings: 0,
    availablePayout: 0,
    totalCommission: 0,
    paidOutAmount: 0,
    earnings: [],
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
      {/* Header Banner */}
      <div className="animate-[fade-up_0.4s_ease-out] rounded-[32px] bg-gradient-to-br from-slate-900 via-brand-950 to-slate-900 px-6 py-8 text-white sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-mint-300">
              ⚡ Uber-Style Driver Escrow Ledger
            </span>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-4xl">
              Driver Earnings &amp; Payouts
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">
              Welcome back, {user.fullName.split(" ")[0]}! Track your ride earnings, pending balances,
              5% platform commissions, and available payout funds.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-right backdrop-blur">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Available for Payout
              </p>
              <p className="mt-1 text-3xl font-black text-mint-400">₹{summary.availablePayout}</p>
            </div>
            {summary.availablePayout > 0 ? (
              <Button variant="success" loading={requesting} onClick={handleRequestPayout}>
                💸 Request Payout (₹{summary.availablePayout})
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Total Earnings</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">₹{summary.totalEarnings}</p>
          <p className="mt-1 text-[10px] text-slate-400">Lifetime 95% fare earnings</p>
        </div>

        <div className="rounded-3xl border border-amber-100 bg-amber-50/60 p-4 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-600">Pending Earnings</p>
          <p className="mt-1 text-2xl font-extrabold text-amber-700">₹{summary.pendingEarnings}</p>
          <p className="mt-1 text-[10px] text-amber-600/80">Rides in progress (paid by rider)</p>
        </div>

        <div className="rounded-3xl border border-mint-200 bg-mint-50/70 p-4 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-mint-700">Available Payout</p>
          <p className="mt-1 text-2xl font-extrabold text-mint-700">₹{summary.availablePayout}</p>
          <p className="mt-1 text-[10px] text-mint-600">Rides completed (ready for payout)</p>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Platform Fees (5%)</p>
          <p className="mt-1 text-2xl font-extrabold text-brand-600">₹{summary.totalCommission}</p>
          <p className="mt-1 text-[10px] text-slate-400">5% service fee deducted</p>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-card col-span-2 sm:col-span-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Paid Out Amount</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">₹{summary.paidOutAmount}</p>
          <p className="mt-1 text-[10px] text-slate-400">Transferred payouts</p>
        </div>
      </div>

      {/* How Payouts Work Callout */}
      <div className="mt-6 rounded-3xl border border-brand-100 bg-brand-50/70 p-5">
        <h3 className="text-sm font-bold text-slate-900">💡 How RideMate Driver Payouts Work</h3>
        <ol className="mt-2.5 grid gap-3 text-xs leading-relaxed text-slate-700 sm:grid-cols-3">
          <li className="flex gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 font-bold text-white text-[11px]">
              1
            </span>
            <div>
              <p className="font-bold text-slate-900">Rider Pays Upfront</p>
              <p className="text-slate-600">Passenger pays ₹100 via Razorpay. Your 97% (₹95) enters <strong>Pending Earnings</strong>.</p>
            </div>
          </li>
          <li className="flex gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 font-bold text-white text-[11px]">
              2
            </span>
            <div>
              <p className="font-bold text-slate-900">Ride Completed</p>
              <p className="text-slate-600">Once the ride finishes, status changes to <strong>Available for Payout</strong>.</p>
            </div>
          </li>
          <li className="flex gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 font-bold text-white text-[11px]">
              3
            </span>
            <div>
              <p className="font-bold text-slate-900">Payout Transfer</p>
              <p className="text-slate-600">Request your balance anytime to transfer funds to your bank account / UPI.</p>
            </div>
          </li>
        </ol>
      </div>

      {/* Complete Ride and Payment History Table */}
      <section className="mt-8">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
            Ride Earnings &amp; Payment Ledger
          </h2>
          <Badge tone="slate">{summary.earnings.length} rides recorded</Badge>
        </div>

        {summary.earnings.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon="🚗"
              title="No ride earnings recorded yet"
              body="Offer a ride on RideMate. When passengers book and pay, your 95% fare earnings will show up here automatically."
              action={
                <Link href="/offer">
                  <Button variant="success">Offer a Ride</Button>
                </Link>
              }
            />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {summary.earnings.map((item) => (
              <EarningsLedgerItem key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function EarningsLedgerItem({ item }: { item: DriverEarningItemDTO }) {
  const tone = EARNING_STATUS_TONE[item.status] ?? "slate";
  const label = EARNING_STATUS_LABEL[item.status] ?? item.status;

  return (
    <article className="rounded-3xl border border-slate-100 bg-white p-5 shadow-card transition hover:shadow-lift">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-slate-900">{item.route}</h3>
            <Badge tone={tone}>{label}</Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {formatDatePretty(item.travelDate)} · {formatTime12h(item.departureTime)} · Passenger:{" "}
            <span className="font-semibold text-slate-700">{item.riderName}</span> ({item.seats} seat{item.seats === 1 ? "" : "s"})
          </p>
        </div>
        <div className="text-right">
          <p className="text-xl font-extrabold text-slate-900">
            ₹{item.driverEarning} <span className="text-xs font-normal text-slate-400">(95%)</span>
          </p>
          <p className="text-[11px] text-slate-400">Total fare paid: ₹{item.totalFare}</p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-3.5 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-slate-400">Total Fare Paid</dt>
          <dd className="font-bold text-slate-900">₹{item.totalFare}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Platform Fee (5%)</dt>
          <dd className="font-bold text-brand-600">₹{item.commissionAmount}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Driver Earning (95%)</dt>
          <dd className="font-bold text-mint-700">₹{item.driverEarning}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Payout Reference</dt>
          <dd className="truncate font-mono font-semibold text-slate-700">
            {item.payoutId || "Pending completion"}
          </dd>
        </div>
      </dl>

      {item.paidOutAt ? (
        <p className="mt-3 text-[11px] font-semibold text-mint-700">
          ✓ Paid out on {formatDatePretty(item.paidOutAt.slice(0, 10))} via {item.payoutMethod}
        </p>
      ) : null}
    </article>
  );
}
