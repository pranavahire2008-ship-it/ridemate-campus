"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button, Field, Input, useToast } from "@/components/ui";
import { useSession } from "@/components/session-provider";

const DEMO = { email: "aarav@mitcollege.edu", password: "ridemate123" };

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/rides";
  const { refresh } = useSession();
  const { push } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (creds?: { email: string; password: string }) => {
    const payload = creds ?? { email, password };
    if (!payload.email || !payload.password) {
      push({ title: "Missing details", body: "Enter your email and password.", tone: "error" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        push({ title: "Login failed", body: data.error ?? "Try again.", tone: "error" });
        return;
      }
      await refresh();
      push({ title: "Welcome back 👋", body: "You are logged in as a verified student.", tone: "success" });
      router.push(next);
    } catch {
      push({ title: "Network error", tone: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-16">
      <div className="animate-[fade-up_0.4s_ease-out]">
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-700">
          Student login
        </span>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-[42px]">
          Welcome back to your campus ride network
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
          Log in to see today&apos;s matching rides, manage your requests and coordinate pickups with
          students from your college.
        </p>
        <ul className="mt-7 space-y-3">
          {[
            "Verified students only — no strangers, ever",
            "Phone numbers stay private until a ride is accepted",
            "Ratings and reviews after every completed trip",
          ].map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm font-medium text-slate-700">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mint-100 text-[11px] font-bold text-mint-700">
                ✓
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="animate-[pop_0.35s_ease-out] rounded-[28px] border border-slate-100 bg-white p-5 shadow-lift sm:p-7">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Log in</h2>
        <p className="mt-1 text-sm text-slate-500">Use your college email and password.</p>

        <div className="mt-6 space-y-4">
          <Field label="College email">
            <Input
              type="email"
              value={email}
              autoComplete="email"
              placeholder="aarav@mitcollege.edu"
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              value={password}
              autoComplete="current-password"
              placeholder="••••••••"
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
            />
          </Field>
          <Button full size="lg" loading={loading} onClick={() => submit()}>
            Login
          </Button>
          <div className="relative py-1 text-center">
            <span className="relative z-10 bg-white px-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              or try the demo student
            </span>
            <span className="absolute inset-x-0 top-1/2 h-px bg-slate-200" />
          </div>
          <Button
            full
            variant="secondary"
            loading={loading}
            onClick={() => {
              setEmail(DEMO.email);
              setPassword(DEMO.password);
              void submit(DEMO);
            }}
          >
            🎓 Continue as demo student
          </Button>
          <p className="text-center text-[11px] leading-relaxed text-slate-400">
            Demo account: {DEMO.email} · {DEMO.password}
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-slate-600">
          New to RideMate?{" "}
          <Link href="/signup" className="font-bold text-brand-700 underline-offset-4 hover:underline">
            Create a student account
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-sm font-semibold text-slate-500">Loading…</div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
