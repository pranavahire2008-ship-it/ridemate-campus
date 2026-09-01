"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Field, Input, Segmented, Select } from "@/components/ui";
import { COLLEGES, defaultTravelDate, LOCALITIES } from "@/lib/locations";
import { useSession } from "@/components/session-provider";

type Mode = "find" | "offer";

export function SearchPanel({ initialMode = "find" }: { initialMode?: Mode }) {
  const router = useRouter();
  const { user } = useSession();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [direction, setDirection] = useState<"home_to_college" | "college_to_home">("home_to_college");
  const today = useMemo(() => defaultTravelDate(), []);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("08:00");
  const [seats, setSeats] = useState("1");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setFrom((prev) => prev || user.homeLocation || "");
      setTo((prev) => prev || user.college || "");
    }
  }, [user]);

  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (direction === "home_to_college") {
      setFrom(user?.homeLocation || "Kothrud");
      setTo(user?.college || "MIT College, Kothrud");
    } else {
      setFrom(user?.college || "MIT College, Kothrud");
      setTo(user?.homeLocation || "Kothrud");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction]);

  const suggestions = useMemo(() => {
    const list = direction === "home_to_college" ? LOCALITIES : COLLEGES;
    const query = (direction === "home_to_college" ? from : to).toLowerCase().trim();
    if (!query) return list.slice(0, 5);
    return list.filter((p) => p.name.toLowerCase().includes(query)).slice(0, 5);
  }, [direction, from, to]);

  const submit = () => {
    setSubmitting(true);
    const params = new URLSearchParams({
      from,
      to,
      direction,
      date,
      time,
      seats,
    });
    if (mode === "find") {
      router.push(`/find?${params.toString()}`);
    } else {
      router.push(`/offer?${params.toString()}`);
    }
    setTimeout(() => setSubmitting(false), 800);
  };

  return (
    <div className="rounded-[28px] border border-slate-100 bg-white p-4 shadow-lift sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid flex-1 grid-cols-2 gap-1.5 rounded-2xl bg-slate-100 p-1.5">
          {(["find", "offer"] as Mode[]).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all active:scale-[0.98] ${
                  active
                    ? m === "find"
                      ? "bg-brand-600 text-white shadow-[0_8px_20px_-8px_rgba(36,81,230,0.7)]"
                      : "bg-mint-600 text-white shadow-[0_8px_20px_-8px_rgba(5,150,105,0.7)]"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <span>{m === "find" ? "🔍" : "🚗"}</span>
                {m === "find" ? "Find a Ride" : "Offer a Ride"}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        <Segmented
          value={direction}
          onChange={setDirection}
          options={[
            { value: "home_to_college", label: "Home → College", sub: "Morning travel" },
            { value: "college_to_home", label: "College → Home", sub: "Evening return" },
          ]}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Pickup Location">
          <Input
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="Kothrud"
            list="rm-localities"
          />
        </Field>
        <Field label="College / Destination">
          <Input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="MIT College, Kothrud"
            list="rm-colleges"
          />
        </Field>
        <Field label="Travel Date">
          <Input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Travel Time">
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
        {suggestions.map((place) => (
          <button
            key={place.name}
            type="button"
            onClick={() =>
              direction === "home_to_college" ? setFrom(place.name) : setTo(place.name)
            }
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
          >
            📍 {place.name}
          </button>
        ))}
      </div>

      <datalist id="rm-localities">
        {LOCALITIES.map((p) => (
          <option key={p.name} value={p.name} />
        ))}
      </datalist>
      <datalist id="rm-colleges">
        {COLLEGES.map((p) => (
          <option key={p.name} value={p.name} />
        ))}
      </datalist>

      <Button
        full
        size="lg"
        loading={submitting}
        onClick={submit}
        className="mt-5 text-[17px]"
        variant={mode === "find" ? "primary" : "success"}
      >
        {mode === "find" ? "Find Matching Rides" : "Continue to Publish Ride"}
      </Button>
      <p className="mt-3 text-center text-[11px] font-medium text-slate-400">
        Nearby pickups, same college drop and similar timings are matched automatically — exact
        location match not required.
      </p>
    </div>
  );
}
