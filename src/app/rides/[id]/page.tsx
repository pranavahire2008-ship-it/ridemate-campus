"use client";
 
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, Badge, Button, EmptyState, Modal, Select, Spinner, Textarea, useToast } from "@/components/ui";
import { RideCard } from "@/components/ride-card";
import { BookingModal } from "@/components/booking-modal";
import { RouteVisual } from "@/components/route-visual";
import { RideMap } from "@/components/ride-map";
import { formatDatePretty, formatTime12h, VEHICLE_TYPES } from "@/lib/locations";
import { useSession } from "@/components/session-provider";
import type { MatchedRide, Ride } from "@/lib/types";
 
type Detail = {
  ride: Ride;
  similar: MatchedRide[];
  isOwner: boolean;
  myBooking: { id: number; status: string } | null;
  requests: {
    id: number;
    seats: number;
    pickupPoint: string;
    message: string;
    status: string;
    totalPrice: number;
  }[];
};
 
export default function RideDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const rideId = params?.id;
  const { user, refresh } = useSession();
  const { push } = useToast();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("unsafe_behaviour");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [liveDriverPos, setLiveDriverPos] = useState<{ lat: number; lng: number } | null>(null);
  const watchIdRef = useRef<number | null>(null);
 
  const load = useCallback(async () => {
    if (!rideId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/rides/${rideId}`, { cache: "no-store" });
      if (!res.ok) {
        setData(null);
        return;
      }
      setData((await res.json()) as Detail);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [rideId]);
 
  useEffect(() => {
    void load();
  }, [load]);
 
  // Driver: start/stop broadcasting GPS position while sharing is on.
  const toggleSharing = useCallback(() => {
    if (!data) return;
 
    if (sharingLocation) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setSharingLocation(false);
      void fetch("/api/driver/location", { method: "DELETE" });
      return;
    }
 
    if (!("geolocation" in navigator)) {
      push({ title: "Location not supported", body: "Your browser can't share GPS location.", tone: "error" });
      return;
    }
 
    const rideIdNum = data.ride.id;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        void fetch("/api/driver/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rideId: rideIdNum,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        });
      },
      () => {
        push({ title: "Could not get location", body: "Check location permission for this site.", tone: "error" });
        setSharingLocation(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    setSharingLocation(true);
  }, [data, sharingLocation, push]);
 
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);
 
  // Rider (or driver's own view): poll for current driver position while ride is active.
  const canSeeLiveLocation =
    !!data &&
    data.ride.status === "active" &&
    (data.isOwner || data.myBooking?.status === "ACCEPTED" || data.myBooking?.status === "COMPLETED");
 
  useEffect(() => {
    if (!canSeeLiveLocation || !data) {
      setLiveDriverPos(null);
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/rides/${data.ride.id}/location`, { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { location: { lat: number; lng: number } | null };
        if (!cancelled) setLiveDriverPos(body.location ? { lat: body.location.lat, lng: body.location.lng } : null);
      } catch {
        /* ignore transient errors */
      }
    };
    void poll();
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [canSeeLiveLocation, data]);
 
  const rideAction = async (action: string) => {
    if (!data) return;
    const res = await fetch(`/api/rides/${data.ride.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      if (action === "complete" || action === "cancel") {
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
        setSharingLocation(false);
        void fetch("/api/driver/location", { method: "DELETE" });
      }
      push({ title: action === "cancel" ? "Ride cancelled" : "Ride completed", tone: "success" });
      await load();
      await refresh();
    } else {
      const payload = (await res.json()) as { error?: string };
      push({ title: "Action failed", body: payload.error, tone: "error" });
    }
  };
 
  const blockDriver = async () => {
    if (!data) return;
    const res = await fetch("/api/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blockedUserId: data.ride.driver.id,
        action: "block",
        reason: "Blocked from ride page",
      }),
    });
    if (res.ok) {
      push({
        title: "Student blocked",
        body: "They can no longer see or book your rides.",
        tone: "success",
      });
      router.push("/find");
    } else {
      const body = (await res.json()) as { error?: string };
      push({ title: "Could not block", body: body.error, tone: "error" });
    }
  };
 
  const report = async () => {
    if (!data) return;
    setSending(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportedUserId: data.ride.driver.id,
          rideId: data.ride.id,
          reason,
          details,
        }),
      });
      if (res.ok) {
        push({
          title: "Report submitted",
          body: "Our campus safety team will review this within 24 hours.",
          tone: "success",
        });
        setReportOpen(false);
        setDetails("");
      } else {
        push({ title: "Could not submit report", tone: "error" });
      }
    } finally {
      setSending(false);
    }
  };
 
  if (loading) return <Spinner label="Loading ride…" />;
 
  if (!data) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <EmptyState
          icon="🧭"
          title="Ride not found"
          body="This ride may have been cancelled or removed by the student."
          action={
            <Link href="/find">
              <Button>Find other rides</Button>
            </Link>
          }
        />
      </div>
    );
  }
 
  const { ride, similar, isOwner } = data;
  const vehicle = VEHICLE_TYPES.find((v) => v.value === ride.vehicleType);
 
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
      <Link
        href="/find"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-800"
      >
        ← Back to rides
      </Link>
 
      <div className="mt-5 grid gap-6 lg:grid-cols-[1.35fr_0.65fr] lg:items-start">
        <div className="space-y-5">
          <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-card sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={ride.status === "active" ? "brand" : "slate"}>{ride.status}</Badge>
              <Badge tone="mint">
                {vehicle?.icon} {vehicle?.label}
              </Badge>
              {ride.seatsAvailable > 0 ? (
                <Badge tone="amber">💺 {ride.seatsAvailable} seat(s) left</Badge>
              ) : (
                <Badge tone="rose">Fully booked</Badge>
              )}
            </div>
            <h1 className="mt-3.5 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              {ride.fromLocation} → {ride.toLocation}
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              {formatDatePretty(ride.travelDate)} · departs {formatTime12h(ride.departureTime)} ·{" "}
              {ride.vehicleModel || vehicle?.label}
            </p>
 
            <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { k: "Price / seat", v: `₹${ride.pricePerSeat}` },
                { k: "Seats free", v: `${ride.seatsAvailable}/${ride.seatsTotal}` },
                { k: "Direction", v: ride.direction === "home_to_college" ? "Home → College" : "College → Home" },
                { k: "Preferred", v: ride.preferredGender === "any" ? "Anyone" : ride.preferredGender === "female" ? "Female" : "Male" },
              ].map((item) => (
                <div key={item.k} className="rounded-2xl bg-slate-50 p-3.5">
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{item.k}</dt>
                  <dd className="mt-1 text-sm font-bold capitalize text-slate-900">{item.v}</dd>
                </div>
              ))}
            </dl>
 
            {ride.notes ? (
              <p className="mt-4 rounded-2xl bg-brand-50/70 px-4 py-3 text-sm leading-relaxed text-slate-700">
                “{ride.notes}”
              </p>
            ) : null}
 
            <div className="mt-5 flex flex-wrap gap-2">
              {isOwner ? (
                <>
                  <Link href="/rides">
                    <Button variant="secondary">Manage in dashboard</Button>
                  </Link>
                  {ride.status === "active" ? (
                    <>
                      <Button variant="secondary" onClick={() => rideAction("complete")}>
                        Mark completed
                      </Button>
                      <Button variant="danger" onClick={() => rideAction("cancel")}>
                        Cancel ride
                      </Button>
                    </>
                  ) : null}
                </>
              ) : (
                <Button
                  size="lg"
                  disabled={ride.seatsAvailable <= 0}
                  onClick={() => {
                    if (!user) {
                      push({ title: "Login required", body: "Log in to book this seat.", tone: "info" });
                    }
                    setBookingOpen(true);
                  }}
                >
                  {ride.seatsAvailable <= 0 ? "Fully booked" : "Book Seat"}
                </Button>
              )}
              <Button variant="secondary" onClick={() => setReportOpen(true)}>
                🚫 Report user
              </Button>
              <Button variant="secondary" onClick={blockDriver}>
                ⛔ Block student
              </Button>
            </div>
          </div>
 
          <RouteVisual
            from={ride.fromLocation}
            to={ride.toLocation}
            pickup={ride.routeStops[1] ?? ride.routeStops[0]}
            direction={ride.direction}
            matchScore={similar[0]?.match.score}
            matchName={similar[0]?.driver.fullName}
          />
 
          {/* Interactive Map */}
          <div className="mt-4">
            {data.isOwner && ride.status === "active" ? (
              <div className="mb-2 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">Live location sharing</p>
                  <p className="text-xs text-slate-500">
                    {sharingLocation ? "Riders can see your live position." : "Turn on so riders can track you."}
                  </p>
                </div>
                <Button size="sm" variant={sharingLocation ? "danger" : "secondary"} onClick={toggleSharing}>
                  {sharingLocation ? "Stop sharing" : "Start sharing"}
                </Button>
              </div>
            ) : null}
            {!data.isOwner && canSeeLiveLocation ? (
              <p className="mb-2 text-xs font-semibold text-slate-500">
                {liveDriverPos ? "🟢 Driver's live location is updating" : "Waiting for driver to start sharing location…"}
              </p>
            ) : null}
            <RideMap
              from={ride.fromLocation}
              to={ride.toLocation}
              stops={ride.routeStops}
              height="300px"
              liveDriver={canSeeLiveLocation ? liveDriverPos : null}
            />
          </div>
 
          {isOwner && data.requests.length > 0 ? (
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-card">
              <h2 className="text-lg font-bold tracking-tight text-slate-900">
                Seat requests on this ride
              </h2>
              <div className="mt-4 space-y-3">
                {data.requests.map((request) => (
                  <div key={request.id} className="rounded-2xl border border-slate-100 p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold text-slate-900">
                        {request.seats} seat(s) · ₹{request.totalPrice}
                      </p>
                      <Badge tone={request.status === "pending" ? "amber" : request.status === "accepted" ? "mint" : "slate"}>
                        {request.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">📍 Pickup: {request.pickupPoint}</p>
                    {request.message ? (
                      <p className="mt-2 text-xs italic text-slate-600">“{request.message}”</p>
                    ) : null}
                    <Link href="/rides" className="mt-3 inline-block">
                      <Button size="sm" variant="secondary">
                        Accept / reject in dashboard
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
 
          {similar.length > 0 ? (
            <div>
              <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
                Similar rides on this route
              </h2>
              <div className="mt-4 space-y-4">
                {similar.map((item) => (
                  <RideCard
                    key={item.id}
                    ride={item}
                    showMatch
                    onBook={(r) => {
                      if (!user) {
                        push({ title: "Login required", body: "Log in to book a seat.", tone: "info" });
                      }
                      router.push(`/rides/${r.id}`);
                    }}
                    onView={(r) => router.push(`/rides/${r.id}`)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
 
        <aside className="space-y-4 lg:sticky lg:top-24">
          <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-card">
            <div className="flex items-start gap-3.5">
              <Avatar
                name={ride.driver.fullName}
                color={ride.driver.avatarColor}
                verified={ride.driver.verified}
                size="lg"
              />
              <div className="min-w-0">
                <h2 className="text-lg font-bold tracking-tight text-slate-900">
                  {ride.driver.fullName}
                </h2>
                <p className="text-xs text-slate-500">{ride.driver.college}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {ride.driver.verified ? <Badge tone="mint">⭐ Verified Student</Badge> : null}
                  <Badge tone="slate">{ride.driver.ridesCompleted} rides</Badge>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-700">
                  ⭐ {ride.driver.rating > 0 ? ride.driver.rating.toFixed(1) : "New"}{" "}
                  <span className="font-normal text-slate-400">
                    ({ride.driver.ratingCount} reviews)
                  </span>
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl bg-slate-50 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Contact number
              </p>
              <p className="mt-1 text-base font-extrabold text-slate-900">{ride.driver.phone}</p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                🔒 Full number is shared only after a booking request is accepted.
              </p>
            </div>
          </div>
 
          <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
            <h3 className="text-sm font-bold text-slate-900">Before you book</h3>
            <ul className="mt-3 space-y-2.5 text-[13px] leading-relaxed text-slate-600">
              {[
                "Confirm the pickup point and time in the booking message.",
                "Carry your college ID — verified students only.",
                "Wear a helmet on two-wheelers, no exceptions.",
                "Share your ride plan with a friend or parent.",
              ].map((tip) => (
                <li key={tip} className="flex gap-2">
                  <span className="text-mint-600">✓</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
 
      <BookingModal ride={ride} open={bookingOpen} onClose={() => setBookingOpen(false)} />
 
      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Report this student">
        <p className="text-sm text-slate-600">
          Reporting is anonymous. Our safety team reviews every report within 24 hours.
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">Reason</span>
            <Select value={reason} onChange={(e) => setReason(e.target.value)}>
              {[
                { value: "fake_account", label: "Fake account / not a student" },
                { value: "unsafe_behaviour", label: "Unsafe riding or driving" },
                { value: "harassment", label: "Harassment or rude behaviour" },
                { value: "payment_issue", label: "Payment or refund issue" },
                { value: "other", label: "Other" },
              ].map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">
              What happened? (optional)
            </span>
            <Textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} />
          </div>
          <Button full loading={sending} onClick={report} variant="danger">
            Submit report
          </Button>
        </div>
      </Modal>
    </div>
  );
}
 
