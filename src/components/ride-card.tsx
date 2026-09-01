"use client";

import { formatDatePretty, formatTime12h, VEHICLE_TYPES } from "@/lib/locations";
import { Avatar, Badge, MatchRing, Stars } from "@/components/ui";
import type { MatchedRide, Ride } from "@/lib/types";

function vehicleLabel(type: string) {
  return VEHICLE_TYPES.find((v) => v.value === type)?.label ?? type;
}

function vehicleIcon(type: string) {
  return VEHICLE_TYPES.find((v) => v.value === type)?.icon ?? "🚗";
}

export function RideCard({
  ride,
  onBook,
  onView,
  showMatch = true,
  highlight = false,
}: {
  ride: Ride | MatchedRide;
  onBook?: (ride: Ride) => void;
  onView?: (ride: Ride) => void;
  showMatch?: boolean;
  highlight?: boolean;
}) {
  const match = "match" in ride ? ride.match : undefined;
  const seats = ride.seatsAvailable;

  return (
    <article
      className={`group relative overflow-hidden rounded-3xl border bg-white p-4 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift sm:p-5 ${
        highlight ? "border-brand-200 ring-2 ring-brand-50" : "border-slate-100"
      }`}
    >
      <div className="flex items-start gap-3.5">
        <Avatar
          name={ride.driver.fullName}
          color={ride.driver.avatarColor}
          verified={ride.driver.verified}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[15px] font-bold tracking-tight text-slate-900">
              {ride.driver.fullName}
            </h3>
            {ride.driver.verified ? (
              <Badge tone="mint">⭐ Verified Student</Badge>
            ) : (
              <Badge tone="amber">Verification pending</Badge>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs font-medium text-slate-500">{ride.driver.college}</p>
          <div className="mt-1.5">
            <Stars rating={ride.driver.rating} count={ride.driver.ratingCount} />
          </div>
        </div>
        {showMatch && match ? <MatchRing score={match.score} /> : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50/80 p-3.5">
        <div className="col-span-2 flex items-start gap-2.5">
          <span className="mt-0.5 flex flex-col items-center pt-1">
            <span className="h-2 w-2 rounded-full bg-mint-500" />
            <span className="my-0.5 h-4 w-0.5 rounded bg-slate-300" />
            <span className="h-2 w-2 rounded-full border-2 border-brand-600 bg-white" />
          </span>
          <div className="min-w-0 text-[13px]">
            <p className="truncate font-semibold text-slate-900">{ride.fromLocation}</p>
            <p className="mt-1.5 truncate font-semibold text-slate-900">{ride.toLocation}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[13px] font-medium text-slate-600">
          <span>🕗</span>
          <span className="truncate">
            {formatTime12h(ride.departureTime)}
            <span className="block text-[11px] font-normal text-slate-400">
              {formatDatePretty(ride.travelDate)}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2 text-[13px] font-medium text-slate-600">
          <span>{vehicleIcon(ride.vehicleType)}</span>
          <span className="truncate">
            {ride.vehicleModel || vehicleLabel(ride.vehicleType)}
            <span className="block text-[11px] font-normal text-slate-400">
              {vehicleLabel(ride.vehicleType)}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2 text-[13px] font-medium text-slate-600">
          <span>💺</span>
          <span>
            {seats} Seat{seats === 1 ? "" : "s"} Available
            <span className="block text-[11px] font-normal text-slate-400">
              of {ride.seatsTotal} total
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-900">
          <span>💰</span>
          <span>
            ₹{ride.pricePerSeat}
            <span className="block text-[11px] font-normal text-slate-400">per seat</span>
          </span>
        </div>
      </div>

      {match ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone={match.score >= 80 ? "mint" : match.score >= 60 ? "brand" : "amber"}>
            {match.score}% Route Match
          </Badge>
          <span className="text-[11px] font-medium text-slate-500">
            {match.reason} · pickup {match.pickupKm} km away · {match.minutesDiff} min difference
          </span>
        </div>
      ) : null}

      {ride.notes ? (
        <p className="mt-3 line-clamp-2 rounded-xl bg-brand-50/60 px-3 py-2 text-xs leading-relaxed text-slate-600">
          “{ride.notes}”
        </p>
      ) : null}

      <div className="mt-4 flex gap-2">
        {onView ? (
          <button
            type="button"
            onClick={() => onView(ride)}
            className="h-11 flex-1 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
          >
            View Ride
          </button>
        ) : null}
        {onBook ? (
          <button
            type="button"
            disabled={seats <= 0}
            onClick={() => onBook(ride)}
            className="h-11 flex-1 rounded-xl bg-brand-600 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(36,81,230,0.7)] transition hover:bg-brand-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:shadow-none disabled:text-slate-500"
          >
            {seats <= 0 ? "Fully booked" : "Book & Pay"}
          </button>
        ) : null}
      </div>
    </article>
  );
}

export function RideCardSkeleton() {
  return (
    <div className="animate-pulse rounded-3xl border border-slate-100 bg-white p-5 shadow-card">
      <div className="flex gap-3.5">
        <div className="h-12 w-12 rounded-2xl bg-slate-200" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-32 rounded bg-slate-200" />
          <div className="h-3 w-24 rounded bg-slate-100" />
        </div>
        <div className="h-12 w-12 rounded-full bg-slate-100" />
      </div>
      <div className="mt-4 h-24 rounded-2xl bg-slate-100" />
      <div className="mt-4 flex gap-2">
        <div className="h-11 flex-1 rounded-xl bg-slate-100" />
        <div className="h-11 flex-1 rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}
