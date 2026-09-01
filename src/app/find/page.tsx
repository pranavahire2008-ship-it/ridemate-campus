"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RideResults, type RideQuery } from "@/components/ride-results";
import { Badge, Button, Field, Input, Segmented, Select } from "@/components/ui";
import { COLLEGES, defaultTravelDate, LOCALITIES } from "@/lib/locations";
import { useSession } from "@/components/session-provider";

function FindRideContent() {
  const params = useSearchParams();
  const { user } = useSession();
  const today = useMemo(() => defaultTravelDate(), []);

  const [from, setFrom] = useState(params.get("from") ?? "Kothrud");
  const [to, setTo] = useState(params.get("to") ?? "MIT College, Kothrud");
  const [direction, setDirection] = useState<"home_to_college" | "college_to_home">(
    (params.get("direction") as "home_to_college" | "college_to_home") ?? "home_to_college",
  );
  const [date, setDate] = useState(params.get("date") ?? today);
  const [time, setTime] = useState(params.get("time") ?? "08:00");
  const [seats, setSeats] = useState(params.get("seats") ?? "1");
  const [query, setQuery] = useState<RideQuery>({
    from: params.get("from") ?? "Kothrud",
    to: params.get("to") ?? "MIT College, Kothrud",
    direction: params.get("direction") ?? "home_to_college",
    date: params.get("date") ?? today,
    time: params.get("time") ?? "08:00",
    seats: params.get("seats") ?? "1",
  });

  useEffect(() => {
    if (!user) return;
    if (!params.get("from") && user.homeLocation) setFrom(user.homeLocation);
    if (!params.get("to") && user.college) setTo(user.college);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const nearby = direction === "home_to_college" ? LOCALITIES : COLLEGES;

  const search = () => {
    setQuery({ from, to, direction, date, time, seats });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
      <div className="animate-[fade-up_0.4s_ease-out]">
        <Badge tone="brand">Find a ride</Badge>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-[40px]">
          Search rides along your college route
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-slate-600">
          Enter your home or colony and your college. We surface every verified student travelling a
          similar route at a similar time — with a match score on each card.
        </p>
      </div>

      <div className="mt-7 rounded-[28px] border border-slate-100 bg-white p-4 shadow-card sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Current / Home Location">
            <Input value={from} onChange={(e) => setFrom(e.target.value)} list="find-localities" placeholder="Kothrud" />
          </Field>
          <Field label="College Destination">
            <Input value={to} onChange={(e) => setTo(e.target.value)} list="find-colleges" placeholder="MIT College, Kothrud" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Direction">
              <Segmented
                value={direction}
                onChange={(value) => {
                  setDirection(value);
                  if (value === "home_to_college") {
                    setFrom(user?.homeLocation || "Kothrud");
                    setTo(user?.college || "MIT College, Kothrud");
                    setTime("08:00");
                  } else {
                    setFrom(user?.college || "MIT College, Kothrud");
                    setTo(user?.homeLocation || "Kothrud");
                    setTime("17:30");
                  }
                }}
                options={[
                  { value: "home_to_college", label: "Home → College", sub: "Morning" },
                  { value: "college_to_home", label: "College → Home", sub: "Evening" },
                ]}
              />
            </Field>
          </div>
          <Field label="Travel Date">
            <Input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Departure Time">
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
            <Field label="Seats">
              <Select value={seats} onChange={(e) => setSeats(e.target.value)}>
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n} seat{n === 1 ? "" : "s"}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {nearby.slice(0, 6).map((place) => (
            <button
              key={place.name}
              type="button"
              onClick={() => (direction === "home_to_college" ? setFrom(place.name) : setTo(place.name))}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
            >
              📍 {place.name}
            </button>
          ))}
        </div>

        <Button full size="lg" className="mt-5" onClick={search}>
          Search Matching Rides
        </Button>

        <datalist id="find-localities">
          {LOCALITIES.map((p) => (
            <option key={p.name} value={p.name} />
          ))}
        </datalist>
        <datalist id="find-colleges">
          {COLLEGES.map((p) => (
            <option key={p.name} value={p.name} />
          ))}
        </datalist>
      </div>

      <div className="mt-10">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
          {query.from} → {query.to}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Matching rides with filters for time, price, vehicle, route match and seats.
        </p>
        <div className="mt-5">
          <RideResults query={query} showFilters />
        </div>
      </div>
    </div>
  );
}

export default function FindRidePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl px-4 py-16 text-center text-sm font-semibold text-slate-500">
          Loading search…
        </div>
      }
    >
      <FindRideContent />
    </Suspense>
  );
}
