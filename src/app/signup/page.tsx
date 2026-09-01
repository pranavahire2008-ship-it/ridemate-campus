"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Badge, Button, Field, Input, Select, useToast } from "@/components/ui";
import { COLLEGES, LOCALITIES } from "@/lib/locations";
import { useSession } from "@/components/session-provider";

function SignupContent() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/rides";
  const { refresh } = useSession();
  const { push } = useToast();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
    college: "",
    studentId: "",
    homeLocation: "",
    gender: "prefer_not_say",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { error?: string; verified?: boolean };
      if (!res.ok) {
        setError(data.error ?? "Could not create account.");
        push({ title: "Sign up failed", body: data.error, tone: "error" });
        return;
      }
      await refresh();
      push({
        title: data.verified ? "Account verified 🎉" : "Account created",
        body: data.verified
          ? "Your student ID is verified — you can book and offer rides now."
          : "Add a valid student ID in your profile to unlock booking.",
        tone: "success",
      });
      router.push(next);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const verified = form.studentId.length >= 5 && /[0-9]/.test(form.studentId);

  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:items-start lg:py-16">
      <div className="animate-[fade-up_0.4s_ease-out] lg:sticky lg:top-24">
        <span className="inline-flex items-center gap-2 rounded-full bg-mint-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-mint-700">
          Create account
        </span>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-[42px]">
          Join your campus ride network in 30 seconds
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
          RideMate is only for college students. Enter your college details and student ID — we verify
          you instantly so every ride on the platform is with a real student.
        </p>

        <div className="mt-7 space-y-3">
          {[
            { icon: "🛡", title: "Instant verification", body: "A valid student ID unlocks the verified badge." },
            { icon: "🔒", title: "Private by default", body: "Your number is shared only after a booking is accepted." },
            { icon: "💰", title: "Split the daily cost", body: "Average seat on a shared campus route costs ₹18–₹40." },
          ].map((item) => (
            <div key={item.title} className="flex gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-lg">
                {item.icon}
              </span>
              <div>
                <p className="text-sm font-bold text-slate-900">{item.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="animate-[pop_0.35s_ease-out] rounded-[28px] border border-slate-100 bg-white p-5 shadow-lift sm:p-7">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Student sign up</h2>
        <p className="mt-1 text-sm text-slate-500">
          Only students with a college ID can join the network.
        </p>

        <div className="mt-6 space-y-4">
          <Field label="Full name">
            <Input value={form.fullName} placeholder="Aditya Sharma" onChange={(e) => update("fullName")(e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="College email">
              <Input
                type="email"
                value={form.email}
                placeholder="aditya@mitcollege.edu"
                onChange={(e) => update("email")(e.target.value)}
              />
            </Field>
            <Field label="Phone number">
              <Input value={form.phone} placeholder="98220 11234" onChange={(e) => update("phone")(e.target.value)} />
            </Field>
            <Field label="College">
              <Input
                value={form.college}
                placeholder="MIT College, Kothrud"
                list="signup-colleges"
                onChange={(e) => update("college")(e.target.value)}
              />
            </Field>
            <Field label="Home / colony">
              <Input
                value={form.homeLocation}
                placeholder="Kothrud"
                list="signup-localities"
                onChange={(e) => update("homeLocation")(e.target.value)}
              />
            </Field>
            <Field label="Student ID">
              <Input
                value={form.studentId}
                placeholder="MIT2022CS1042"
                onChange={(e) => update("studentId")(e.target.value)}
              />
            </Field>
            <Field label="Gender">
              <Select value={form.gender} onChange={(e) => update("gender")(e.target.value)}>
                <option value="prefer_not_say">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
              </Select>
            </Field>
          </div>
          <Field label="Password" hint="min 6 characters">
            <Input
              type="password"
              value={form.password}
              placeholder="••••••••"
              onChange={(e) => update("password")(e.target.value)}
            />
          </Field>

          <div
            className={`rounded-2xl border px-4 py-3 text-xs font-semibold leading-relaxed ${
              verified
                ? "border-mint-100 bg-mint-50 text-mint-700"
                : "border-amber-100 bg-amber-50 text-amber-700"
            }`}
          >
            {verified ? (
              <>✓ This student ID will be verified instantly — you can book and offer rides right away.</>
            ) : (
              <>Enter a student ID with at least 5 characters and a digit to get the verified badge.</>
            )}
          </div>

          {error ? (
            <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-600">{error}</p>
          ) : null}

          <Button full size="lg" loading={loading} onClick={submit}>
            Create verified student account
          </Button>

          <p className="text-center text-[11px] leading-relaxed text-slate-400">
            By signing up you agree to travel respectfully and follow the{" "}
            <Link href="/safety" className="font-semibold text-slate-600 underline-offset-2 hover:underline">
              campus safety guidelines
            </Link>
            .
          </p>
        </div>

        <p className="mt-5 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-brand-700 underline-offset-4 hover:underline">
            Log in
          </Link>
        </p>

        <datalist id="signup-colleges">
          {COLLEGES.map((c) => (
            <option key={c.name} value={c.name} />
          ))}
        </datalist>
        <datalist id="signup-localities">
          {LOCALITIES.map((l) => (
            <option key={l.name} value={l.name} />
          ))}
        </datalist>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={<div className="py-20 text-center text-sm font-semibold text-slate-500">Loading…</div>}
    >
      <SignupContent />
    </Suspense>
  );
}
