"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar, Badge, Button, EmptyState, Modal, Spinner, Textarea, useToast } from "@/components/ui";
import { RouteVisual } from "@/components/route-visual";
import {
  BookingStatusBadge,
  PaymentFlow,
  PaymentStatusBadge,
  PAYMENT_STATUS_LABELS,
} from "@/components/payment";
import { formatDatePretty, formatTime12h, VEHICLE_TYPES } from "@/lib/locations";
import { useSession } from "@/components/session-provider";
import type { Booking, PaymentHistoryItemDTO } from "@/lib/types";

type Tab = "upcoming" | "requests" | "offered" | "completed" | "payments";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "upcoming", label: "Upcoming Rides", icon: "🗓" },
  { id: "requests", label: "My Ride Requests", icon: "📩" },
  { id: "offered", label: "Rides I Offered", icon: "🚗" },
  { id: "completed", label: "Completed Rides", icon: "✅" },
  { id: "payments", label: "Payment History", icon: "💳" },
];

export default function MyRidesPage() {
  const { user, refresh } = useSession();
  const { push } = useToast();
  const [tab, setTab] = useState<Tab>("upcoming");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<PaymentHistoryItemDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [contact, setContact] = useState<Booking | null>(null);
  const [payBooking, setPayBooking] = useState<Booking | null>(null);
  const [ratingTarget, setRatingTarget] = useState<Booking | null>(null);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bookingRes, paymentRes] = await Promise.all([
        fetch("/api/bookings", { cache: "no-store" }),
        fetch("/api/payments/history", { cache: "no-store" }),
      ]);
      const bookingData = (await bookingRes.json()) as { bookings?: Booking[] };
      const paymentData = (await paymentRes.json()) as { payments?: PaymentHistoryItemDTO[] };
      setBookings(bookingData.bookings ?? []);
      setPayments(paymentData.payments ?? []);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void load();
    else setLoading(false);
  }, [user, load]);

  const bookingAction = async (booking: Booking, action: string) => {
    setBusy(`${action}-${booking.id}`);
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json()) as { error?: string; refund?: { message?: string } | null };
      if (!res.ok) {
        push({ title: "Action failed", body: data.error ?? "Please try again.", tone: "error" });
        return;
      }
      const labels: Record<string, string> = {
        accept: "Request accepted — contact details unlocked for both of you.",
        reject: "Request rejected. The paid amount will be refunded automatically.",
        cancel: "Booking cancelled.",
        complete: "Ride marked as completed.",
      };
      push({
        title: labels[action] ?? "Updated",
        body: data.refund?.message,
        tone: "success",
      });
      await load();
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const rideAction = async (rideId: number, action: string) => {
    setBusy(`${action}-ride-${rideId}`);
    try {
      const res = await fetch(`/api/rides/${rideId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json()) as { error?: string; refundsIssued?: number };
      if (!res.ok) {
        push({ title: "Action failed", body: data.error ?? "Please try again.", tone: "error" });
        return;
      }
      push({
        title: action === "cancel" ? "Ride cancelled" : "Ride completed",
        body:
          action === "cancel" && data.refundsIssued
            ? `${data.refundsIssued} paid booking(s) are being refunded.`
            : undefined,
        tone: "success",
      });
      await load();
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const submitRating = async () => {
    if (!ratingTarget) return;
    setBusy(`rate-${ratingTarget.id}`);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revieweeId: ratingTarget.rideOwner.id,
          rating: stars,
          comment,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        push({ title: "Could not save rating", body: data.error, tone: "error" });
        return;
      }
      push({ title: "Thanks for rating!", body: "Your feedback keeps the campus network safe.", tone: "success" });
      setRatingTarget(null);
      setComment("");
      setStars(5);
    } finally {
      setBusy(null);
    }
  };

  const grouped = useMemo(() => {
    const upcoming = bookings.filter((b) => b.status === "ACCEPTED" || b.status === "PENDING");
    const requests = bookings.filter((b) => b.status === "PENDING");
    const completed = bookings.filter((b) => b.status === "COMPLETED");
    return { upcoming, requests, completed };
  }, [bookings]);

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <EmptyState
          icon="🔐"
          title="Log in to see your rides"
          body="Your upcoming rides, requests, payments, refunds and completed trips all live here."
          action={
            <Link href="/login?next=/rides">
              <Button>Login as a student</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const activeTabList =
    tab === "upcoming" ? grouped.upcoming : tab === "requests" ? grouped.requests : grouped.completed;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
      <div className="animate-[fade-up_0.4s_ease-out] flex flex-wrap items-end justify-between gap-4">
        <div>
          <Badge tone="brand">Dashboard</Badge>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-[40px]">
            Hi {user.fullName.split(" ")[0]}, here are your rides
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
            Manage requests, payments, refunds and your daily college commute in one place.
          </p>
        </div>
        <Link href="/earnings">
          <Button variant="success">
            💰 Driver Earnings &amp; Payouts →
          </Button>
        </Link>
      </div>

      <div className="no-scrollbar mt-7 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const active = tab === t.id;
          const count =
            t.id === "upcoming"
              ? grouped.upcoming.length
              : t.id === "requests"
                ? grouped.requests.length
                : t.id === "offered"
                  ? bookings.filter((b) => b.isMine).length
                  : t.id === "completed"
                    ? grouped.completed.length
                    : payments.length;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition ${
                active
                  ? "bg-slate-900 text-white shadow-card"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {loading ? (
          <Spinner label="Loading your rides…" />
        ) : tab === "payments" ? (
          <PaymentHistory payments={payments} />
        ) : tab === "offered" ? (
          <OfferedRides
            bookings={bookings}
            busy={busy}
            onRideAction={rideAction}
            onBookingAction={bookingAction}
            onContact={(b) => setContact(b)}
          />
        ) : activeTabList.length === 0 ? (
          <EmptyState
            icon={tab === "requests" ? "📩" : tab === "completed" ? "✅" : "🗓"}
            title={
              tab === "requests"
                ? "No pending requests"
                : tab === "completed"
                  ? "No completed rides yet"
                  : "No upcoming rides"
            }
            body={
              tab === "requests"
                ? "Requests you send, and requests students send to your rides, appear here."
                : tab === "completed"
                  ? "Complete a ride to unlock ratings and build your campus trust score."
                  : "Book and pay for a seat on a matching ride to get started."
            }
            action={
              <Link href="/find">
                <Button>Find a ride</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            {activeTabList.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                busy={busy}
                onAction={bookingAction}
                onContact={() => setContact(booking)}
                onRate={() => setRatingTarget(booking)}
                onPay={() => setPayBooking(booking)}
                showRate={tab === "completed"}
              />
            ))}
          </div>
        )}
      </div>

      {/* Contact modal */}
      <Modal open={Boolean(contact)} onClose={() => setContact(null)} title="Contact student">
        {contact ? (
          <div>
            <div className="flex items-center gap-3.5">
              <Avatar
                name={contact.rideOwner.fullName}
                color={contact.rideOwner.avatarColor}
                verified={contact.rideOwner.verified}
                size="lg"
              />
              <div className="min-w-0">
                <p className="text-lg font-bold tracking-tight text-slate-900">
                  {contact.rideOwner.fullName}
                </p>
                <p className="truncate text-sm text-slate-500">{contact.rideOwner.college}</p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl bg-slate-50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                {contact.contactUnlocked ? "Phone number unlocked" : "Phone number hidden"}
              </p>
              <p className="mt-1 text-xl font-extrabold tracking-tight text-slate-900">
                {contact.contactUnlocked ? contact.rideOwner.phone : "••••••••"}
              </p>
              {!contact.contactUnlocked ? (
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  🔒 Contact details unlock automatically once the ride provider accepts your paid
                  request.
                </p>
              ) : null}
            </div>
            <div className="mt-4">
              <RouteVisual
                from={contact.ride.fromLocation}
                to={contact.ride.toLocation}
                pickup={contact.pickupPoint}
                direction={contact.ride.direction}
                compact
              />
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Link href={`/rides/${contact.rideId}`}>
                <Button full variant="secondary">
                  View ride details
                </Button>
              </Link>
              <a href={`tel:${contact.rideOwner.phone.replace(/\D/g, "")}`}>
                <Button full>Call student</Button>
              </a>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Resume payment modal */}
      <Modal open={Boolean(payBooking)} onClose={() => setPayBooking(null)} title="Complete your payment">
        {payBooking ? (
          <PaymentFlow
            request={{
              rideId: payBooking.rideId,
              seats: payBooking.seats,
              pickupPoint: payBooking.pickupPoint,
            }}
            display={{
              route: `${payBooking.ride.fromLocation} → ${payBooking.ride.toLocation}`,
              when: `${formatDatePretty(payBooking.ride.travelDate)} · ${formatTime12h(payBooking.ride.departureTime)}`,
              pricePerSeat: payBooking.ride.pricePerSeat,
              driverName: payBooking.rideOwner.fullName,
            }}
            onSuccess={async () => {
              setPayBooking(null);
              await load();
              await refresh();
            }}
            onCancel={() => setPayBooking(null)}
          />
        ) : null}
      </Modal>

      {/* Rating modal */}
      <Modal open={Boolean(ratingTarget)} onClose={() => setRatingTarget(null)} title="Rate your ride">
        {ratingTarget ? (
          <div>
            <p className="text-sm text-slate-600">
              How was travelling with {ratingTarget.rideOwner.fullName} from{" "}
              {ratingTarget.ride.fromLocation} to {ratingTarget.ride.toLocation}?
            </p>
            <div className="mt-4 flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setStars(n)}
                  className={`text-3xl transition active:scale-90 ${
                    n <= stars ? "text-amber-500" : "text-slate-200"
                  }`}
                  aria-label={`${n} star`}
                >
                  ★
                </button>
              ))}
            </div>
            <Textarea
              className="mt-4"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Punctual, safe rider — reached college in 15 minutes."
            />
            <Button full className="mt-4" loading={busy === `rate-${ratingTarget.id}`} onClick={submitRating}>
              Submit rating
            </Button>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

/* --------------------------------------------------------- payment history */

function PaymentHistory({ payments }: { payments: PaymentHistoryItemDTO[] }) {
  if (payments.length === 0) {
    return (
      <EmptyState
        icon="💳"
        title="No payments yet"
        body="When you book and pay for a seat, every transaction and refund appears here with its full status trail."
        action={
          <Link href="/find">
            <Button>Find a ride</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-100 bg-white p-4 text-[11px] leading-relaxed text-slate-500 shadow-card">
        🔒 Card numbers, CVV and UPI PINs are never stored by RideMate. Payments are processed
        securely through Razorpay; only gateway references are kept for your history.
      </div>
      {payments.map((payment) => (
        <article key={payment.id} className="rounded-3xl border border-slate-100 bg-white p-4 shadow-card sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900">{payment.route}</p>
              <p className="text-xs text-slate-500">
                {formatDatePretty(payment.travelDate)} · {formatTime12h(payment.departureTime)} ·{" "}
                {payment.seats} seat(s)
              </p>
            </div>
            <p className="text-xl font-extrabold tracking-tight text-slate-900">₹{payment.amount}</p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <PaymentStatusBadge status={payment.status} />
            <BookingStatusBadge status={payment.bookingStatus} />
            {payment.refundAmount > 0 ? (
              <Badge tone="brand">Refund ₹{payment.refundAmount}</Badge>
            ) : null}
            <Badge tone="slate">
              Razorpay
            </Badge>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-[12px] sm:grid-cols-4">
            <div>
              <dt className="text-slate-400">Total Fare Paid</dt>
              <dd className="font-semibold text-slate-800">
                ₹{payment.amount}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Commission (5%)</dt>
              <dd className="font-semibold text-slate-800">
                ₹{payment.commissionAmount ?? Math.round(payment.amount * 0.03)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Driver Payout (95%)</dt>
              <dd className="font-semibold text-slate-800">
                ₹{payment.driverAmount ?? (payment.amount - Math.round(payment.amount * 0.03))}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Razorpay Order ID</dt>
              <dd className="truncate font-mono text-[11px] font-semibold text-slate-700">
                {payment.razorpayOrderId || payment.orderId}
              </dd>
            </div>
          </dl>
          {payment.refundStatus ? (
            <p className="mt-3 rounded-xl bg-brand-50/70 px-3 py-2 text-[11px] font-semibold text-brand-700">
              {PAYMENT_STATUS_LABELS[payment.refundStatus] ?? payment.refundStatus} · refunds reach
              your original payment method in 5-7 working days.
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

/* --------------------------------------------------------- offered rides */

function OfferedRides({
  bookings,
  busy,
  onRideAction,
  onBookingAction,
  onContact,
}: {
  bookings: Booking[];
  busy: string | null;
  onRideAction: (rideId: number, action: string) => void;
  onBookingAction: (booking: Booking, action: string) => void;
  onContact: (booking: Booking) => void;
}) {
  const offered = Array.from(new Map(bookings.filter((b) => b.isMine).map((b) => [b.rideId, b])).values());

  if (offered.length === 0) {
    return (
      <EmptyState
        icon="🚗"
        title="You have not offered a ride yet"
        body="Publish your daily route once and students travelling the same way will find you instantly."
        action={
          <Link href="/offer">
            <Button variant="success">Offer a ride</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {offered.map((head) => {
        const rideRequests = bookings.filter(
          (b) => b.rideId === head.rideId && b.isMine && b.status === "PENDING",
        );
        const accepted = bookings.filter(
          (b) => b.rideId === head.rideId && b.isMine && b.status === "ACCEPTED",
        );
        return (
          <article key={head.rideId} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <BookingStatusBadge status={head.ride.status === "active" ? "PENDING" : head.ride.status} />
                  <Badge tone="slate">
                    {VEHICLE_TYPES.find((v) => v.value === head.ride.vehicleType)?.icon}{" "}
                    {head.ride.vehicleModel || head.ride.vehicleType}
                  </Badge>
                  <Badge tone="brand">₹{head.ride.pricePerSeat}/seat</Badge>
                </div>
                <h3 className="mt-2.5 text-lg font-bold tracking-tight text-slate-900">
                  {head.ride.fromLocation} → {head.ride.toLocation}
                </h3>
                <p className="text-sm text-slate-500">
                  {formatDatePretty(head.ride.travelDate)} · {formatTime12h(head.ride.departureTime)}
                </p>
              </div>
              <Link href={`/rides/${head.rideId}`}>
                <Button size="sm" variant="secondary">
                  View listing
                </Button>
              </Link>
            </div>

            {rideRequests.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">
                  {rideRequests.length} paid seat request{rideRequests.length === 1 ? "" : "s"}
                </p>
                <div className="mt-3 space-y-3">
                  {rideRequests.map((request) => (
                    <div key={request.id} className="rounded-xl bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar
                            name={request.rideOwner.fullName}
                            color={request.rideOwner.avatarColor}
                            verified={request.rideOwner.verified}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-900">
                              {request.rideOwner.fullName}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {request.seats} seat(s) · {request.pickupPoint} · ₹{request.totalPrice}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <PaymentStatusBadge status={request.paymentStatus} />
                          <Button
                            size="sm"
                            variant="success"
                            loading={busy === `accept-${request.id}`}
                            onClick={() => onBookingAction(request, "accept")}
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            loading={busy === `reject-${request.id}`}
                            onClick={() => onBookingAction(request, "reject")}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                      {request.paymentStatus !== "PAID" ? (
                        <p className="mt-2 text-[11px] font-semibold text-amber-700">
                          ⚠️ Payment not completed yet — accepting requires a paid request.
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {accepted.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {accepted.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onContact(a)}
                    className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
                  >
                    <Avatar name={a.rideOwner.fullName} color={a.rideOwner.avatarColor} size="sm" />
                    Contact {a.rideOwner.fullName.split(" ")[0]}
                  </button>
                ))}
              </div>
            ) : null}

            {head.ride.status === "active" ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  loading={busy === `complete-ride-${head.rideId}`}
                  onClick={() => onRideAction(head.rideId, "complete")}
                >
                  Mark completed
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  loading={busy === `cancel-ride-${head.rideId}`}
                  onClick={() => onRideAction(head.rideId, "cancel")}
                >
                  Cancel ride & refund
                </Button>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------- booking card */

function BookingCard({
  booking,
  busy,
  onAction,
  onContact,
  onRate,
  onPay,
  showRate,
}: {
  booking: Booking;
  busy: string | null;
  onAction: (booking: Booking, action: string) => void;
  onContact: () => void;
  onRate: () => void;
  onPay: () => void;
  showRate?: boolean;
}) {
  return (
    <article className="rounded-3xl border border-slate-100 bg-white p-5 shadow-card">
      <div className="flex items-start gap-3.5">
        <Avatar
          name={booking.rideOwner.fullName}
          color={booking.rideOwner.avatarColor}
          verified={booking.rideOwner.verified}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[15px] font-bold text-slate-900">
              {booking.rideOwner.fullName}
            </h3>
            <BookingStatusBadge status={booking.status} />
            {booking.isMine ? <Badge tone="brand">Incoming request</Badge> : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {booking.rideOwner.college} ·{" "}
            {booking.rideOwner.verified ? "Verified student" : "Pending verification"}
          </p>
          <p className="mt-2 text-sm font-bold text-slate-900">
            {booking.ride.fromLocation} → {booking.ride.toLocation}
          </p>
          <p className="text-xs text-slate-500">
            {formatDatePretty(booking.ride.travelDate)} · {formatTime12h(booking.ride.departureTime)} ·{" "}
            {booking.ride.vehicleModel || booking.ride.vehicleType}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone="slate">💺 {booking.seats} seat(s)</Badge>
            <Badge tone="slate">📍 {booking.pickupPoint}</Badge>
            <Badge tone="brand">₹{booking.totalPrice}</Badge>
          </div>
          {booking.message ? (
            <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs italic leading-relaxed text-slate-600">
              “{booking.message}”
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 p-3.5">
        <PaymentStatusBadge status={booking.paymentStatus} />
        {booking.paymentId ? (
          <span className="font-mono text-[11px] text-slate-500">{booking.paymentId}</span>
        ) : null}
        {booking.refundAmount > 0 ? (
          <Badge tone="brand">Refunded ₹{booking.refundAmount}</Badge>
        ) : null}
        {booking.cancellationReason ? (
          <span className="text-[11px] text-slate-500">
            Cancelled by {booking.cancelledBy ?? "system"} · {booking.cancellationReason}
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {!booking.isMine && booking.status === "PENDING" && booking.paymentStatus === "PENDING" ? (
          <Button size="sm" onClick={onPay}>
            💳 Complete payment
          </Button>
        ) : null}
        {booking.isMine && booking.status === "PENDING" ? (
          <>
            <Button
              size="sm"
              variant="success"
              loading={busy === `accept-${booking.id}`}
              onClick={() => onAction(booking, "accept")}
            >
              Accept request
            </Button>
            <Button
              size="sm"
              variant="danger"
              loading={busy === `reject-${booking.id}`}
              onClick={() => onAction(booking, "reject")}
            >
              Reject & refund
            </Button>
          </>
        ) : null}
        {!booking.isMine && (booking.status === "PENDING" || booking.status === "ACCEPTED") ? (
          <Button
            size="sm"
            variant="secondary"
            loading={busy === `cancel-${booking.id}`}
            onClick={() => onAction(booking, "cancel")}
          >
            {booking.paymentStatus === "PAID" ? "Cancel & request refund" : "Cancel booking"}
          </Button>
        ) : null}
        {booking.status === "ACCEPTED" ? (
          <>
            <Button size="sm" variant="secondary" onClick={onContact}>
              📞 Contact student
            </Button>
            <Button
              size="sm"
              variant="secondary"
              loading={busy === `complete-${booking.id}`}
              onClick={() => onAction(booking, "complete")}
            >
              Mark completed
            </Button>
          </>
        ) : null}
        {showRate && booking.status === "COMPLETED" ? (
          <Button size="sm" variant="secondary" onClick={onRate}>
            ⭐ Rate ride
          </Button>
        ) : null}
      </div>
    </article>
  );
}
