"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RideCard, RideCardSkeleton } from "@/components/ride-card";
import { BookingModal } from "@/components/booking-modal";
import { Button, EmptyState, Select, useToast } from "@/components/ui";
import { useSession } from "@/components/session-provider";
import type { MatchedRide, Ride } from "@/lib/types";

export type RideQuery = {
  from: string;
  to: string;
  direction: string;
  date: string;
  time: string;
  seats: string;
};

export function useRideSearch(query: RideQuery) {
  const [rides, setRides] = useState<MatchedRide[]>([]);
  const [loading, setLoading] = useState(true);

  const key = JSON.stringify(query);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams(query);
    fetch(`/api/rides?${params.toString()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { rides?: MatchedRide[] }) => {
        if (!cancelled) setRides(data.rides ?? []);
      })
      .catch(() => {
        if (!cancelled) setRides([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { rides, loading };
}

export function RideResults({
  query,
  showFilters = false,
  limit,
  emptyAction,
}: {
  query: RideQuery;
  showFilters?: boolean;
  limit?: number;
  emptyAction?: React.ReactNode;
}) {
  const { rides, loading } = useRideSearch(query);
  const router = useRouter();
  const { user } = useSession();
  const { push } = useToast();
  const [bookingRide, setBookingRide] = useState<Ride | null>(null);
  const [maxPrice, setMaxPrice] = useState("999");
  const [vehicle, setVehicle] = useState("any");
  const [minMatch, setMinMatch] = useState("0");
  const [timeBand, setTimeBand] = useState("any");
  const [minSeats, setMinSeats] = useState("1");
  const [sortBy, setSortBy] = useState("match");

  const filtered = useMemo(() => {
    const minutes = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    const bands: Record<string, [number, number]> = {
      early: [0, 8 * 60],
      morning: [8 * 60, 11 * 60],
      afternoon: [11 * 60, 16 * 60],
      evening: [16 * 60, 24 * 60],
    };

    let list = rides.filter((ride) => {
      if (ride.pricePerSeat > Number(maxPrice)) return false;
      if (vehicle !== "any" && ride.vehicleType !== vehicle) return false;
      if (ride.match.score < Number(minMatch)) return false;
      if (ride.seatsAvailable < Number(minSeats)) return false;
      if (timeBand !== "any") {
        const band = bands[timeBand];
        const t = minutes(ride.departureTime);
        if (t < band[0] || t >= band[1]) return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sortBy === "price") return a.pricePerSeat - b.pricePerSeat;
      if (sortBy === "time") return a.departureTime.localeCompare(b.departureTime);
      if (sortBy === "seats") return b.seatsAvailable - a.seatsAvailable;
      return b.match.score - a.match.score;
    });

    return limit ? list.slice(0, limit) : list;
  }, [rides, maxPrice, vehicle, minMatch, minSeats, timeBand, sortBy, limit]);

  const bookRide = (ride: Ride) => {
    if (!user) {
      push({
        title: "Login required",
        body: "Log in as a verified student to book a seat.",
        tone: "info",
      });
      router.push("/login?next=/find");
      return;
    }
    setBookingRide(ride);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <RideCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <>
      {showFilters ? (
        <div className="mb-5 grid grid-cols-2 gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-card sm:grid-cols-3 lg:grid-cols-6">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Time
            </span>
            <Select
              className="h-10 py-0 text-[13px]"
              value={timeBand}
              onChange={(e) => setTimeBand(e.target.value)}
            >
              <option value="any">Any time</option>
              <option value="early">Before 8 AM</option>
              <option value="morning">8 AM – 11 AM</option>
              <option value="afternoon">11 AM – 4 PM</option>
              <option value="evening">After 4 PM</option>
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Max price
            </span>
            <Select
              className="h-10 py-0 text-[13px]"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            >
              <option value="999">Any price</option>
              <option value="20">Up to ₹20</option>
              <option value="30">Up to ₹30</option>
              <option value="40">Up to ₹40</option>
              <option value="60">Up to ₹60</option>
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Vehicle
            </span>
            <Select
              className="h-10 py-0 text-[13px]"
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
            >
              <option value="any">All vehicles</option>
              <option value="bike">Bike</option>
              <option value="scooter">Scooter</option>
              <option value="car">Car</option>
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Route match
            </span>
            <Select
              className="h-10 py-0 text-[13px]"
              value={minMatch}
              onChange={(e) => setMinMatch(e.target.value)}
            >
              <option value="0">Any match</option>
              <option value="60">60% +</option>
              <option value="75">75% +</option>
              <option value="90">90% +</option>
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Seats
            </span>
            <Select
              className="h-10 py-0 text-[13px]"
              value={minSeats}
              onChange={(e) => setMinSeats(e.target.value)}
            >
              <option value="1">1+ seat</option>
              <option value="2">2+ seats</option>
              <option value="3">3+ seats</option>
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Sort by
            </span>
            <Select
              className="h-10 py-0 text-[13px]"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="match">Best match</option>
              <option value="price">Lowest price</option>
              <option value="time">Earliest departure</option>
              <option value="seats">Most seats</option>
            </Select>
          </label>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="No rides matched this exact search"
          body="Try a nearby landmark, a wider time window or another date. New rides are posted every evening for the next morning."
          action={
            emptyAction ?? (
              <Button onClick={() => router.push("/offer")}>Offer this ride yourself</Button>
            )
          }
        />
      ) : (
        <div className="space-y-4">
          {!showFilters ? (
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              {filtered.length} student{filtered.length === 1 ? "" : "s"} travelling on a similar route
            </p>
          ) : null}
          {filtered.map((ride) => (
            <div key={ride.id} className="animate-[fade-up_0.4s_ease-out]">
              <RideCard
                ride={ride}
                showMatch
                onBook={bookRide}
                onView={(r) => router.push(`/rides/${r.id}`)}
              />
            </div>
          ))}
        </div>
      )}

      <BookingModal
        ride={bookingRide}
        open={Boolean(bookingRide)}
        onClose={() => setBookingRide(null)}
      />
    </>
  );
}
