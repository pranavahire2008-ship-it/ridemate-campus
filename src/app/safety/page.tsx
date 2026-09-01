"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Avatar, Badge, Button, Field, Select, Textarea, useToast } from "@/components/ui";
import { useSession } from "@/components/session-provider";
import type { BlockItemDTO } from "@/lib/types";

const FEATURES = [
  {
    icon: "🛡",
    title: "Verified Students",
    body: "Every account is checked against a college student ID before rides can be offered or booked. Unverified accounts can browse but never travel.",
    points: ["Student ID validation at signup", "Verified badge on every profile", "Admin review queue for edge cases"],
  },
  {
    icon: "📍",
    title: "Route Visibility",
    body: "Pickup area, destination and departure time are visible before you pay. Exact via-stops and contact details unlock only after confirmation.",
    points: ["Public route info vs private pickup details", "Vehicle type and model", "Match percentage explained"],
  },
  {
    icon: "🔒",
    title: "Secure Payments",
    body: "Payments run through Razorpay Checkout. Card numbers, CVV and UPI PINs never touch our servers — only gateway references are stored.",
    points: ["Server-verified payment signatures", "Webhook signature validation", "Automatic refunds on rejection"],
  },
  {
    icon: "⭐",
    title: "Ratings",
    body: "Both students rate each other after a completed ride. Repeated reports and low ratings remove someone from the network.",
    points: ["Two-way ratings after every ride", "Public rating on each profile", "Reviews visible to everyone"],
  },
  {
    icon: "🚫",
    title: "Report & Block",
    body: "Report suspicious behaviour in one tap and block any student. Blocked students can never see, book or contact you again.",
    points: ["Anonymous reporting", "Blocking enforced server-side", "Reports reviewed within 24 hours"],
  },
  {
    icon: "🔐",
    title: "Privacy",
    body: "Phone numbers and emails are never public. Contact details unlock only after a booking is accepted by the provider.",
    points: ["Masked numbers everywhere", "Contact unlocked on acceptance", "No data sold, ever"],
  },
];

const REPORT_REASONS = [
  { value: "fake_account", label: "Fake account / not a student" },
  { value: "unsafe_behaviour", label: "Unsafe riding or driving" },
  { value: "harassment", label: "Harassment or rude behaviour" },
  { value: "payment_issue", label: "Payment or refund issue" },
  { value: "other", label: "Other" },
];

export default function SafetyPage() {
  const { user } = useSession();
  const { push } = useToast();
  const [reason, setReason] = useState("unsafe_behaviour");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [blocks, setBlocks] = useState<BlockItemDTO[]>([]);
  const [blockUserId, setBlockUserId] = useState("");

  const loadBlocks = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/blocks", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { blocks?: BlockItemDTO[] };
      setBlocks(data.blocks ?? []);
    } catch {
      /* ignore */
    }
  }, [user]);

  useEffect(() => {
    void loadBlocks();
  }, [loadBlocks]);

  const submit = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, details }),
      });
      if (res.ok) {
        push({
          title: "Report submitted",
          body: "The campus safety desk will review this within 24 hours.",
          tone: "success",
        });
        setDetails("");
      } else {
        const data = (await res.json()) as { error?: string };
        push({ title: "Could not submit report", body: data.error, tone: "error" });
      }
    } finally {
      setSending(false);
    }
  };

  const block = async () => {
    const blockedUserId = Number.parseInt(blockUserId, 10);
    if (Number.isNaN(blockedUserId)) {
      push({ title: "Enter a valid student ID number", tone: "error" });
      return;
    }
    const res = await fetch("/api/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockedUserId, action: "block", reason: "Blocked from safety centre" }),
    });
    if (res.ok) {
      push({ title: "Student blocked", body: "They can no longer book or contact you.", tone: "success" });
      setBlockUserId("");
      await loadBlocks();
    } else {
      const data = (await res.json()) as { error?: string };
      push({ title: "Could not block", body: data.error, tone: "error" });
    }
  };

  const unblock = async (id: number) => {
    const res = await fetch("/api/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockedUserId: id, action: "unblock" }),
    });
    if (res.ok) {
      push({ title: "Student unblocked", tone: "success" });
      await loadBlocks();
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
      <div className="animate-[fade-up_0.4s_ease-out] rounded-[32px] bg-gradient-to-br from-slate-900 via-slate-900 to-brand-900 px-6 py-12 text-white sm:px-10">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-mint-300">
          Safety centre
        </span>
        <h1 className="mt-4 max-w-2xl text-3xl font-extrabold leading-tight tracking-tight sm:text-[42px]">
          Safety is the reason RideMate exists
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-slate-300">
          Students travel with students they can verify. Every feature below is designed so you know
          exactly who you are riding with, where the ride goes, how your money is protected, and what
          to do if something feels wrong.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            { k: "100%", v: "Rides from verified students" },
            { k: "< 24h", v: "Report review time" },
            { k: "Auto", v: "Refunds on rejection" },
          ].map((s) => (
            <div key={s.v} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
              <p className="text-2xl font-extrabold">{s.k}</p>
              <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-slate-300">{s.v}</p>
            </div>
          ))}
        </div>
      </div>

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="rounded-3xl border border-slate-100 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-2xl">
              {feature.icon}
            </span>
            <h2 className="mt-4 text-lg font-bold tracking-tight text-slate-900">{feature.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{feature.body}</p>
            <ul className="mt-3.5 space-y-2">
              {feature.points.map((point) => (
                <li key={point} className="flex items-start gap-2 text-[13px] font-medium text-slate-700">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mint-100 text-[10px] font-bold text-mint-700">
                    ✓
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-start">
        <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-card sm:p-6">
          <Badge tone="rose">Report user</Badge>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900">
            Something felt wrong? Tell us.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {user
              ? "Reports are linked to your account so our safety team can follow up with you privately."
              : "You can report without logging in — the report is still reviewed within 24 hours."}
          </p>
          <div className="mt-5 space-y-4">
            <Field label="Reason">
              <Select value={reason} onChange={(e) => setReason(e.target.value)}>
                {REPORT_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="What happened?" hint="optional">
              <Textarea
                rows={4}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Share the ride details, time and what went wrong."
              />
            </Field>
            <Button full variant="danger" loading={sending} onClick={submit}>
              🚫 Submit report
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-card sm:p-6">
            <Badge tone="brand">Block user</Badge>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900">
              Stop someone from contacting you
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {user
                ? "Blocked students cannot see your rides, book your seats or reach you on RideMate. Enforced on the server."
                : "Log in to manage your block list."}
            </p>
            {user ? (
              <div className="mt-5 space-y-4">
                <Field label="Student ID number" hint="found on any profile URL">
                  <input
                    value={blockUserId}
                    onChange={(e) => setBlockUserId(e.target.value)}
                    placeholder="e.g. 5"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[15px] font-medium text-slate-900 outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-50"
                  />
                </Field>
                <Button full onClick={block}>
                  Block student
                </Button>
                {blocks.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      Blocked students
                    </p>
                    {blocks.map((b) => (
                      <div
                        key={b.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 p-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar name={b.blockedUserName} color={b.blockedUserColor} size="sm" />
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {b.blockedUserName}
                          </p>
                        </div>
                        <Button size="sm" variant="secondary" onClick={() => unblock(b.blockedUserId)}>
                          Unblock
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">You have not blocked anyone.</p>
                )}
              </div>
            ) : (
              <Link href="/login?next=/safety" className="mt-4 inline-block">
                <Button>Login to manage blocks</Button>
              </Link>
            )}
          </div>

          <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5 sm:p-6">
            <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
              Student safety checklist
            </h2>
            <ul className="mt-4 space-y-3">
              {[
                "Check the verified badge and rating before paying for a seat.",
                "Share the ride details with a parent or friend before you leave.",
                "Always wear a helmet on a bike or scooter.",
                "Meet at a public pickup point, not inside a building or lane.",
                "Pay only inside RideMate — pricing is fixed per seat.",
                "Trust your instinct: cancel anytime, refunds are automatic.",
              ].map((tip) => (
                <li key={tip} className="flex items-start gap-3 text-[14px] font-medium text-slate-700">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
                    ✓
                  </span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-brand-100 bg-brand-50 p-5 sm:p-6">
            <h3 className="text-lg font-bold tracking-tight text-slate-900">Emergency contacts</h3>
            <div className="mt-3 grid gap-2 text-sm font-semibold text-slate-800">
              <p>Campus security · 020 2550 0000</p>
              <p>Pune Police · 100</p>
              <p>Women&apos;s helpline · 1091</p>
              <p>Ambulance · 108</p>
            </div>
            <Link href="/find" className="mt-5 inline-block">
              <Button variant="secondary">Back to safe rides</Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
