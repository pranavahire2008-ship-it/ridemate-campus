"use client";

import Link from "next/link";
import { useMemo } from "react";
import { SearchPanel } from "@/components/search-panel";
import { RideResults, type RideQuery } from "@/components/ride-results";
import { RouteVisual } from "@/components/route-visual";
import { RideMap } from "@/components/ride-map";
import { Badge, Button } from "@/components/ui";
import { useSession } from "@/components/session-provider";
import { defaultTravelDate } from "@/lib/locations";

const STEPS = [
  {
    title: "Enter your route",
    body: "Add your colony, college, travel date and time. No exact address needed.",
    icon: "📝",
  },
  {
    title: "We match travellers",
    body: "RideMate scores every ride on pickup distance, destination and timing.",
    icon: "🧭",
  },
  {
    title: "View available rides",
    body: "See verified students, vehicle, seats and price per seat before you commit.",
    icon: "👀",
  },
  {
    title: "Book a seat",
    body: "Pick your seats and pickup point, then send a booking request in one tap.",
    icon: "🎫",
  },
  {
    title: "Provider accepts",
    body: "The student offering the ride accepts — phone numbers unlock instantly.",
    icon: "🤝",
  },
  {
    title: "Ride together",
    body: "Coordinate the pickup, travel together and rate each other after the ride.",
    icon: "🛡",
  },
];

const SAFETY = [
  {
    icon: "🛡",
    title: "Verified Students",
    body: "Only students with a valid college student ID can join and offer rides.",
  },
  {
    icon: "📍",
    title: "Route Visibility",
    body: "Full pickup and destination details are visible before you book anything.",
  },
  {
    icon: "⭐",
    title: "Ratings",
    body: "Rate your ride partner after every trip so the community stays trustworthy.",
  },
  {
    icon: "🚫",
    title: "Report User",
    body: "Report suspicious behaviour in one tap. Every report is reviewed.",
  },
  {
    icon: "🔒",
    title: "Privacy",
    body: "Phone numbers are never public — they unlock only after a booking is accepted.",
  },
];

const POPULAR_ROUTES = [
  { from: "Kothrud", to: "MIT College, Kothrud", time: "08:00" },
  { from: "Warje", to: "MIT College, Kothrud", time: "08:15" },
  { from: "Baner", to: "Indira College, Wakad", time: "08:05" },
  { from: "Katraj", to: "PICT, Katraj", time: "08:20" },
  { from: "Hinjewadi", to: "MIT WPU, Kothrud", time: "07:45" },
  { from: "Kharadi", to: "Symbiosis, Viman Nagar", time: "08:35" },
];

export default function HomePage() {
  const { user } = useSession();

  const today = useMemo(() => defaultTravelDate(), []);

  const defaultQuery: RideQuery = useMemo(() => {
    return {
      from: user?.homeLocation || "Kothrud",
      to: user?.college || "MIT College, Kothrud",
      direction: "home_to_college",
      date: today,
      time: "08:00",
      seats: "1",
    };
  }, [user, today]);

  return (
    <div className="overflow-x-clip">
      {/* Hero */}
      <section className="relative bg-gradient-to-b from-brand-50/70 via-white to-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(60rem 30rem at 15% -10%, rgba(36,81,230,0.12), transparent), radial-gradient(50rem 25rem at 100% 0%, rgba(16,185,129,0.12), transparent)",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pb-6 pt-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12 lg:pt-16">
          <div className="animate-[fade-up_0.5s_ease-out]">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">🎓 Built only for college students</Badge>
              <Badge tone="mint">🛡 Verified campus network</Badge>
            </div>
            <h1 className="mt-5 text-[38px] font-extrabold leading-[1.05] tracking-[-0.03em] text-slate-900 sm:text-5xl lg:text-[56px]">
              Your College Route.
              <br />
              <span className="bg-gradient-to-r from-brand-600 to-mint-600 bg-clip-text text-transparent">
                Your Ride. Your People.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-slate-600 sm:text-lg">
              Find students travelling on the same route and share rides safely between your home
              and college. Split the cost, skip the crowded bus, travel with people from your own
              campus.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/find">
                <Button size="lg" className="w-full sm:w-auto">
                  🔍 Find a Ride
                </Button>
              </Link>
              <Link href="/offer">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  🚗 Offer a Ride
                </Button>
              </Link>
            </div>

            <dl className="mt-9 grid max-w-lg grid-cols-3 gap-3">
              {[
                { k: "2,400+", v: "Verified students" },
                { k: "18", v: "Colleges covered" },
                { k: "₹18", v: "Avg. cost per seat" },
              ].map((item) => (
                <div key={item.v} className="rounded-2xl border border-slate-100 bg-white/80 p-3.5 shadow-card">
                  <dt className="text-xl font-extrabold tracking-tight text-slate-900">{item.k}</dt>
                  <dd className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {item.v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative animate-[fade-up_0.6s_ease-out]">
            <div className="relative overflow-hidden rounded-[32px] border border-white bg-white shadow-lift">
              <div className="relative h-[260px] overflow-hidden bg-gradient-to-br from-brand-50 via-white to-mint-50 sm:h-[320px] lg:h-[360px]">
                <div className="absolute -left-10 top-10 h-40 w-40 rounded-full bg-brand-200/55 blur-3xl" />
                <div className="absolute -right-8 bottom-2 h-48 w-48 rounded-full bg-mint-200/60 blur-3xl" />
                <div className="absolute inset-x-7 top-7 rounded-[24px] border border-slate-100 bg-white/90 p-4 shadow-card backdrop-blur sm:inset-x-10 sm:top-10 sm:p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Today&apos;s commute</p>
                      <p className="mt-1 text-base font-extrabold text-slate-900">Kothrud to MIT College</p>
                    </div>
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint-100 text-lg">🚗</span>
                  </div>
                  <div className="relative mt-7 px-2">
                    <div className="h-1 rounded-full bg-gradient-to-r from-brand-500 via-brand-300 to-mint-500" />
                    <span className="absolute -left-0.5 -top-2.5 h-6 w-6 rounded-full border-[5px] border-white bg-brand-600 shadow-sm" />
                    <span className="absolute left-[52%] -top-1.5 h-4 w-4 rounded-full border-4 border-white bg-amber-400 shadow-sm" />
                    <span className="absolute -right-0.5 -top-2.5 h-6 w-6 rounded-full border-[5px] border-white bg-mint-500 shadow-sm" />
                  </div>
                  <div className="mt-4 flex justify-between text-[11px] font-bold text-slate-500">
                    <span>Home</span><span>Pickup</span><span>Campus</span>
                  </div>
                </div>
                <div className="absolute bottom-7 left-7 flex items-center gap-3 rounded-2xl border border-white/80 bg-white/90 px-3 py-2.5 shadow-card backdrop-blur sm:bottom-10 sm:left-10">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50">🎓</span>
                  <div><p className="text-xs font-bold text-slate-900">Campus verified</p><p className="text-[11px] text-slate-500">Students only</p></div>
                </div>
              </div>
              <div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 rounded-2xl bg-white/95 px-4 py-3 shadow-card backdrop-blur">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    Live match
                  </p>
                  <p className="truncate text-sm font-bold text-slate-900">
                    Kothrud → MIT College · 8:00 AM
                  </p>
                </div>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-mint-500 text-xs font-bold text-white">
                  92%
                </span>
              </div>
            </div>
            <div className="absolute -left-2 top-6 hidden animate-[pop_0.6s_ease-out] rounded-2xl border border-slate-100 bg-white px-3.5 py-2.5 shadow-lift sm:block">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Seat booked</p>
              <p className="text-sm font-bold text-slate-900">₹25 · 1 seat</p>
            </div>
            <div className="absolute -right-1 bottom-24 hidden animate-[pop_0.7s_ease-out] rounded-2xl border border-slate-100 bg-white px-3.5 py-2.5 shadow-lift sm:block">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Contact unlocked</p>
              <p className="text-sm font-bold text-mint-600">✓ Ride accepted</p>
            </div>
          </div>
        </div>
      </section>

      {/* Search card */}
      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:py-14" id="search">
        <SearchPanel />
      </section>

      {/* Matching rides */}
      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Badge tone="brand">Live rides</Badge>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Matching Rides Near You
            </h2>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-slate-600">
              {user
                ? `Rides scored against ${user.homeLocation || "your area"} → ${user.college || "your college"} for today.`
                : "Rides scored against Kothrud → MIT College, Kothrud for today. Log in to personalise."}
            </p>
          </div>
          <Link href="/find">
            <Button variant="secondary">See all rides →</Button>
          </Link>
        </div>
        <div className="mt-6">
          <RideResults query={defaultQuery} limit={4} />
        </div>
      </section>

      {/* Route matching visual */}
      <section className="bg-slate-50/80 py-14">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
          <div>
            <Badge tone="mint">Smart matching</Badge>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              We match routes, not exact addresses
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
              RideMate looks at how close two pickups are, whether the destination is the same or
              nearby, and how similar the departure times are. A student 1 km away leaving 15
              minutes later is still a great match.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Pickup locations within a few km are treated as on-the-way",
                "Same college or a college within 1.5 km counts as the same drop",
                "Departure windows up to 75 minutes apart still match",
                "Every card shows the match percentage before you book",
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
          <div className="space-y-4">
            <RouteVisual
              from="Kothrud"
              to="MIT College, Kothrud"
              pickup="Paud Road Signal"
              direction="home_to_college"
              matchScore={85}
              matchName="Aditya Sharma"
            />
            <RideMap
              from="Kothrud"
              to="MIT College, Kothrud"
              stops={["Paud Road Signal"]}
              height="220px"
            />
            <div className="grid grid-cols-3 gap-3">
              {[
                { k: "Pickup", v: "0.8 km away" },
                { k: "Drop", v: "Same college" },
                { k: "Timing", v: "+12 minutes" },
              ].map((s) => (
                <div key={s.k} className="rounded-2xl border border-slate-100 bg-white p-3 text-center shadow-card">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.k}</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">{s.v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="text-center">
          <Badge tone="brand">How it works</Badge>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Six taps from search to a shared ride
          </h2>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((step, index) => (
            <div
              key={step.title}
              className="group rounded-3xl border border-slate-100 bg-white p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-xl">
                  {step.icon}
                </span>
                <span className="text-3xl font-extrabold text-slate-100 transition group-hover:text-brand-100">
                  0{index + 1}
                </span>
              </div>
              <h3 className="mt-4 text-base font-bold tracking-tight text-slate-900">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Popular routes */}
      <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
          Popular campus routes
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Tap a route to instantly see today&apos;s matching rides.
        </p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          {POPULAR_ROUTES.map((route) => (
            <Link
              key={`${route.from}-${route.to}`}
              href={`/find?from=${encodeURIComponent(route.from)}&to=${encodeURIComponent(
                route.to,
              )}&direction=home_to_college&time=${route.time}&seats=1`}
              className="group flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lift"
            >
              <span className="text-sm font-semibold text-slate-800">
                {route.from} → {route.to}
              </span>
              <span className="text-xs font-semibold text-slate-400 group-hover:text-brand-600">
                {route.time}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Safety */}
      <section className="bg-slate-900 py-14 text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-mint-300">
                Safety first
              </span>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Built to keep students safe
              </h2>
              <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-slate-300">
                Every feature is designed around campus trust — verification, transparency and
                control over your privacy.
              </p>
            </div>
            <Link href="/safety">
              <button className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-100">
                Visit Safety Centre
              </button>
            </Link>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SAFETY.map((item) => (
              <div
                key={item.title}
                className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur transition hover:bg-white/[0.1]"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-xl">
                  {item.icon}
                </span>
                <h3 className="mt-4 text-base font-bold tracking-tight">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-brand-600 via-brand-500 to-mint-500 px-6 py-12 text-center shadow-lift sm:px-12">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-white/10" />
          <h2 className="relative text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Share your ride tomorrow morning
          </h2>
          <p className="relative mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-white/90">
            Join thousands of students already carpooling between home and college. It takes less
            than a minute to publish your first ride.
          </p>
          <div className="relative mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/signup">
              <button className="w-full rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-slate-900 transition hover:bg-slate-100 sm:w-auto">
                Create your student account
              </button>
            </Link>
            <Link href="/find">
              <button className="w-full rounded-xl border border-white/40 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white/10 sm:w-auto">
                Browse today&apos;s rides
              </button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
