"use client";

import { Badge } from "@/components/ui";

export function RouteVisual({
  from,
  to,
  pickup,
  direction = "home_to_college",
  matchScore,
  matchName,
  compact = false,
}: {
  from: string;
  to: string;
  pickup?: string;
  direction?: string;
  matchScore?: number;
  matchName?: string;
  compact?: boolean;
}) {
  const isHomeToCollege = direction === "home_to_college";
  const originLabel = isHomeToCollege ? "🏠 Home / Colony" : "🏫 College";
  const destLabel = isHomeToCollege ? "🏫 College" : "🏠 Home / Colony";
  const origin = isHomeToCollege ? from : to;
  const dest = isHomeToCollege ? to : from;

  const stops = pickup ? [origin, pickup, dest] : [origin, dest];

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-slate-100 bg-gradient-to-br from-slate-50 to-white ${
        compact ? "p-4" : "p-5"
      }`}
    >
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.5]" aria-hidden>
        <defs>
          <linearGradient id="routeFade" x1="0" x2="1">
            <stop offset="0%" stopColor="#2451e6" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.14" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#routeFade)" />
      </svg>

      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Route overview
          </p>
          {typeof matchScore === "number" ? (
            <Badge tone={matchScore >= 80 ? "mint" : "brand"}>
              {matchScore}% overlap
            </Badge>
          ) : null}
        </div>

        <ol className="mt-3.5 space-y-0">
          {stops.map((stop, index) => {
            const isStart = index === 0;
            const isEnd = index === stops.length - 1;
            const isMiddle = !isStart && !isEnd;
            return (
              <li key={`${stop}-${index}`} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] ring-4 ring-white ${
                      isStart
                        ? "bg-mint-100 text-mint-700"
                        : isEnd
                          ? "bg-brand-100 text-brand-700"
                          : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {isStart ? "🏠" : isEnd ? "🏫" : "📍"}
                  </span>
                  {!isEnd ? (
                    <span className="relative my-1 w-0.5 flex-1 rounded bg-slate-200">
                      {matchScore !== undefined ? (
                        <span
                          className="absolute inset-x-0 top-0 rounded bg-gradient-to-b from-brand-500 to-mint-500"
                          style={{ height: `${Math.max(30, Math.min(100, matchScore))}%` }}
                        />
                      ) : null}
                    </span>
                  ) : null}
                </div>
                <div className={`min-w-0 ${isEnd ? "" : "pb-4"}`}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {isStart ? originLabel : isEnd ? destLabel : "Pickup Point"}
                  </p>
                  <p className="truncate text-sm font-bold text-slate-900">{stop}</p>
                  {isMiddle ? (
                    <p className="mt-0.5 text-[11px] font-medium text-amber-600">
                      Shared pickup · confirmed after booking
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>

        {typeof matchScore === "number" && matchName ? (
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-mint-100 bg-mint-50 px-3.5 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint-500 text-sm text-white">
              ✓
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-mint-700">
                Matching Route Found — {matchScore}% Match
              </p>
              <p className="truncate text-xs text-mint-700/80">
                {matchName} travels this overlapping path
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
