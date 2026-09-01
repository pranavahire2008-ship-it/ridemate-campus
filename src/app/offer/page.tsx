"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Badge, Button, Field, Input, Segmented, Select, Textarea, useToast } from "@/components/ui";
import { RouteVisual } from "@/components/route-visual";
import { RideMap } from "@/components/ride-map";
import { COLLEGES, defaultTravelDate, LOCALITIES, VEHICLE_TYPES } from "@/lib/locations";
import { useSession } from "@/components/session-provider";

function OfferRideContent() {
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useSession();
  const { push } = useToast();
  const today = useMemo(() => defaultTravelDate(), []);

  const [fullName, setFullName] = useState("");
  const [college, setCollege] = useState("");
  const [studentId, setStudentId] = useState("");
  const [phone, setPhone] = useState("");
  const [fromLocation, setFromLocation] = useState(params.get("from") ?? "");
  const [toLocation, setToLocation] = useState(params.get("to") ?? "");
  const [direction, setDirection] = useState<"home_to_college" | "college_to_home">(
    (params.get("direction") as "home_to_college" | "college_to_home") ?? "home_to_college",
  );
  const [date, setDate] = useState(params.get("date") ?? today);
  const [time, setTime] = useState(params.get("time") ?? "08:00");
  const [vehicleType, setVehicleType] = useState("scooter");
  const [vehicleModel, setVehicleModel] = useState("");
  const [seatsTotal, setSeatsTotal] = useState(1);
  const [pricePerSeat, setPricePerSeat] = useState(25);
  const [preferredGender, setPreferredGender] = useState("any");
  const [routeStops, setRouteStops] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishedId, setPublishedId] = useState<number | null>(null);
  const [notifiedCount, setNotifiedCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    setFullName((prev) => prev || user.fullName);
    setCollege((prev) => prev || user.college);
    setStudentId((prev) => prev || user.studentId);
    setPhone((prev) => prev || user.phone);
    setFromLocation((prev) => prev || (direction === "home_to_college" ? user.homeLocation : user.college));
    setToLocation(
      (prev) => prev || (direction === "home_to_college" ? user.college : user.homeLocation),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    const max = VEHICLE_TYPES.find((v) => v.value === vehicleType)?.seats ?? 1;
    setSeatsTotal((prev) => Math.min(prev, max));
  }, [vehicleType]);

  const maxSeats = VEHICLE_TYPES.find((v) => v.value === vehicleType)?.seats ?? 1;
  const suggestedPrice = vehicleType === "car" ? 40 : 25;

  const publish = async () => {
    if (!user) {
      push({
        title: "Login required",
        body: "Create your verified student account to publish a ride.",
        tone: "info",
      });
      router.push("/login?next=/offer");
      return;
    }
    if (!fromLocation.trim() || !toLocation.trim()) {
      push({ title: "Route incomplete", body: "Add your starting location and destination.", tone: "error" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction,
          fromLocation,
          toLocation,
          routeStops,
          travelDate: date,
          departureTime: time,
          vehicleType,
          vehicleModel,
          seatsTotal,
          pricePerSeat,
          preferredGender,
          notes,
        }),
      });
      const data = (await res.json()) as { error?: string; ride?: { id: number }; notified?: number };
      if (!res.ok || !data.ride) {
        push({ title: "Could not publish ride", body: data.error ?? "Please try again.", tone: "error" });
        return;
      }
      setPublishedId(data.ride.id);
      setNotifiedCount(data.notified ?? 0);
      push({
        title: "Ride published 🎉",
        body: "Your ride is now visible to students travelling on a similar route.",
        tone: "success",
      });
    } catch {
      push({ title: "Network error", body: "Please check your connection.", tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (publishedId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <div className="animate-[pop_0.3s_ease-out] rounded-[32px] border border-mint-100 bg-gradient-to-b from-mint-50 to-white p-8 text-center shadow-lift">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-mint-500 text-4xl text-white shadow-[0_12px_28px_-12px_rgba(5,150,105,0.8)]">
            ✓
          </div>
          <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Your ride is now visible to students travelling on a similar route.
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600">
            {notifiedCount > 0
              ? `${notifiedCount} student${notifiedCount === 1 ? "" : "s"} on a matching route already got a notification. `
              : ""}
            You will get a notification as soon as someone requests a seat.
          </p>
          <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link href={`/rides/${publishedId}`}>
              <Button>View my ride listing</Button>
            </Link>
            <Link href="/rides">
              <Button variant="secondary">Go to My Rides</Button>
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setPublishedId(null)}
            className="mt-5 text-sm font-semibold text-slate-500 underline-offset-4 hover:underline"
          >
            Publish another ride
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
      <div className="animate-[fade-up_0.4s_ease-out]">
        <Badge tone="mint">Offer a ride</Badge>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-[40px]">
          Share your daily college ride
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-slate-600">
          “I leave from Kothrud at 8:00 AM and can pick students travelling towards MIT College.” —
          fill the form once and students on your route will find you instantly.
        </p>
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-[1.4fr_0.6fr] lg:items-start">
        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-card sm:p-6">
            <h2 className="text-lg font-bold tracking-tight text-slate-900">Basic details</h2>
            <p className="mt-1 text-xs text-slate-500">
              Your student ID is what unlocks the verified badge on your rides.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Full Name">
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Aditya Sharma" />
              </Field>
              <Field label="College">
                <Input value={college} onChange={(e) => setCollege(e.target.value)} list="offer-colleges" placeholder="MIT College, Kothrud" />
              </Field>
              <Field label="Student ID">
                <Input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="MIT2022CS1042" />
              </Field>
              <Field label="Phone Number" hint="hidden until accepted">
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98220 11234" />
              </Field>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-card sm:p-6">
            <h2 className="text-lg font-bold tracking-tight text-slate-900">Ride details</h2>
            <div className="mt-5 space-y-4">
              <Field label="Direction">
                <Segmented
                  value={direction}
                  onChange={(value) => {
                    setDirection(value);
                    if (user) {
                      if (value === "home_to_college") {
                        setFromLocation(user.homeLocation);
                        setToLocation(user.college);
                      } else {
                        setFromLocation(user.college);
                        setToLocation(user.homeLocation);
                      }
                    }
                  }}
                  options={[
                    { value: "home_to_college", label: "Home → College", sub: "Morning travel" },
                    { value: "college_to_home", label: "College → Home", sub: "Evening return" },
                  ]}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Starting Location">
                  <Input
                    value={fromLocation}
                    onChange={(e) => setFromLocation(e.target.value)}
                    list="offer-localities"
                    placeholder="Kothrud"
                  />
                </Field>
                <Field label="Destination">
                  <Input
                    value={toLocation}
                    onChange={(e) => setToLocation(e.target.value)}
                    list="offer-colleges"
                    placeholder="MIT College, Kothrud"
                  />
                </Field>
                <Field label="Date">
                  <Input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
                </Field>
                <Field label="Departure Time">
                  <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                </Field>
              </div>

              <Field label="Vehicle Type">
                <div className="grid grid-cols-3 gap-2">
                  {VEHICLE_TYPES.map((v) => {
                    const active = vehicleType === v.value;
                    return (
                      <button
                        key={v.value}
                        type="button"
                        onClick={() => setVehicleType(v.value)}
                        className={`flex flex-col items-center gap-1 rounded-2xl border-2 px-3 py-3 transition active:scale-[0.98] ${
                          active
                            ? "border-brand-500 bg-brand-50 text-brand-700"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        <span className="text-2xl">{v.icon}</span>
                        <span className="text-sm font-bold">{v.label}</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                          max {v.seats} pillion
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Vehicle Model" hint="optional">
                  <Input
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    placeholder="Honda Activa 6G"
                  />
                </Field>
                <Field label="Route via" hint="comma separated stops">
                  <Input
                    value={routeStops}
                    onChange={(e) => setRouteStops(e.target.value)}
                    placeholder="Kothrud Depot, Paud Road, MIT College"
                  />
                </Field>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-card sm:p-6">
            <h2 className="text-lg font-bold tracking-tight text-slate-900">Availability & pricing</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Number of Available Seats" hint={`max ${maxSeats}`}>
                <Select
                  value={String(seatsTotal)}
                  onChange={(e) => setSeatsTotal(Math.max(1, Math.min(maxSeats, Number(e.target.value))))}
                >
                  {Array.from({ length: maxSeats }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n} seat{n === 1 ? "" : "s"}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Price Per Seat" hint={`suggested ₹${suggestedPrice}`}>
                <Input
                  type="number"
                  min={0}
                  max={999}
                  value={pricePerSeat}
                  onChange={(e) => setPricePerSeat(Number(e.target.value))}
                />
              </Field>
              <Field label="Preferred passenger gender" hint="optional">
                <Select value={preferredGender} onChange={(e) => setPreferredGender(e.target.value)}>
                  <option value="any">No preference</option>
                  <option value="female">Female students only</option>
                  <option value="male">Male students only</option>
                </Select>
              </Field>
              <Field label="Additional notes" hint="optional" className="sm:col-span-2">
                <Textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="I leave from Kothrud at 8:00 AM and can pick students travelling towards MIT College."
                />
              </Field>
            </div>
          </section>

          <div className="sticky bottom-24 z-10 lg:bottom-4">
            <Button full size="lg" variant="success" loading={saving} onClick={publish}>
              🚗 Publish My Ride
            </Button>
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <RouteVisual
            from={fromLocation || "Your colony"}
            to={toLocation || "Your college"}
            pickup={routeStops.split(",")[0]?.trim() || undefined}
            direction={direction}
            matchScore={92}
            matchName="Students near your route"
          />
          {fromLocation && toLocation ? (
            <RideMap
              from={fromLocation}
              to={toLocation}
              stops={routeStops.split(",").map(s => s.trim()).filter(Boolean)}
              height="220px"
            />
          ) : null}
          <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
            <h3 className="text-sm font-bold text-slate-900">Tips for a full car</h3>
            <ul className="mt-3 space-y-2.5 text-[13px] leading-relaxed text-slate-600">
              {[
                "Add 2–3 via stops so students nearby know you pass their lane.",
                "Keep the price between ₹20–₹50 — cheaper rides get booked fastest.",
                "Mention your exact pickup landmark in the notes.",
                "Reply to requests quickly; seats unlock only on acceptance.",
              ].map((tip) => (
                <li key={tip} className="flex gap-2">
                  <span className="text-mint-600">✓</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
          {!user ? (
            <div className="rounded-3xl border border-brand-100 bg-brand-50 p-5">
              <p className="text-sm font-bold text-slate-900">You are not logged in</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Publish requires a verified student account. Login or sign up — it takes 30 seconds.
              </p>
              <div className="mt-3 flex gap-2">
                <Link href="/login?next=/offer" className="flex-1">
                  <Button size="sm" full>
                    Login
                  </Button>
                </Link>
                <Link href="/signup" className="flex-1">
                  <Button size="sm" variant="secondary" full>
                    Sign up
                  </Button>
                </Link>
              </div>
            </div>
          ) : null}
        </aside>
      </div>

      <datalist id="offer-localities">
        {LOCALITIES.map((p) => (
          <option key={p.name} value={p.name} />
        ))}
      </datalist>
      <datalist id="offer-colleges">
        {COLLEGES.map((p) => (
          <option key={p.name} value={p.name} />
        ))}
      </datalist>
    </div>
  );
}

export default function OfferRidePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl px-4 py-16 text-center text-sm font-semibold text-slate-500">
          Loading form…
        </div>
      }
    >
      <OfferRideContent />
    </Suspense>
  );
}
