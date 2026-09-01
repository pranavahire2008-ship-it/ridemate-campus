"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar, Badge, Button, Field, Input, Modal, Textarea, useToast } from "@/components/ui";
import { formatDatePretty, formatTime12h, VEHICLE_TYPES } from "@/lib/locations";
import { useSession } from "@/components/session-provider";
import { PaymentFlow, PaymentStatusBadge, type VerifyResult } from "@/components/payment";
import { RideMapMini } from "@/components/ride-map";
import type { Ride } from "@/lib/types";

export function BookingModal({
  ride,
  open,
  onClose,
  onDone,
}: {
  ride: Ride | null;
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
}) {
  const { user, refresh } = useSession();
  const { push } = useToast();
  const [seats, setSeats] = useState(1);
  const [pickupPoint, setPickupPoint] = useState("");
  const [message, setMessage] = useState("");
  const [step, setStep] = useState<"details" | "payment" | "result">("details");
  const [result, setResult] = useState<VerifyResult | null>(null);

  const pickupOptions = useMemo(() => {
    if (!ride) return [];
    return ride.routeStops.length > 0 ? ride.routeStops : [ride.fromLocation, ride.toLocation];
  }, [ride]);

  if (!ride) return null;

  const maxSeats = Math.max(1, Math.min(ride.seatsAvailable, 4));
  const vehicle = VEHICLE_TYPES.find((v) => v.value === ride.vehicleType);
  const total = ride.pricePerSeat * seats;

  const close = () => {
    onClose();
    setTimeout(() => {
      setStep("details");
      setResult(null);
      setSeats(1);
      setPickupPoint("");
      setMessage("");
    }, 200);
  };

  return (
    <Modal open={open} onClose={close} title={step === "payment" ? undefined : step === "result" ? undefined : "Book & pay"}>
      {step === "details" ? (
        <>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <div className="flex items-start gap-3">
              <Avatar
                name={ride.driver.fullName}
                color={ride.driver.avatarColor}
                verified={ride.driver.verified}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">{ride.driver.fullName}</p>
                <p className="truncate text-xs text-slate-500">{ride.driver.college}</p>
              </div>
              <Badge tone="mint">⭐ Verified</Badge>
            </div>
            <dl className="mt-3.5 grid grid-cols-2 gap-3 text-[13px]">
              <div>
                <dt className="text-slate-400">Route</dt>
                <dd className="font-semibold text-slate-800">
                  {ride.fromLocation} → {ride.toLocation}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Date & Time</dt>
                <dd className="font-semibold text-slate-800">
                  {formatDatePretty(ride.travelDate)} · {formatTime12h(ride.departureTime)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Vehicle</dt>
                <dd className="font-semibold text-slate-800">
                  {vehicle?.icon} {ride.vehicleModel || vehicle?.label}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Seats / Price</dt>
                <dd className="font-semibold text-slate-800">
                  {ride.seatsAvailable} left · ₹{ride.pricePerSeat}/seat
                </dd>
              </div>
            </dl>
            <RideMapMini from={ride.fromLocation} to={ride.toLocation} />
          </div>

          {!user ? (
            <div className="mt-4 rounded-2xl border border-brand-100 bg-brand-50/70 p-4 text-center">
              <p className="text-sm font-semibold text-slate-900">Log in to book and pay</p>
              <p className="mt-1 text-xs text-slate-600">
                Only verified college students can reserve a seat — it keeps the platform safe.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Link href="/login?next=/find">
                  <Button size="sm">Login</Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm" variant="secondary">
                    Create account
                  </Button>
                </Link>
              </div>
            </div>
          ) : !user.verified ? (
            <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-center">
              <p className="text-sm font-semibold text-slate-900">Student verification required</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Add a valid college student ID in your profile to unlock booking and payments.
              </p>
              <Link href="/profile" className="mt-3 inline-block">
                <Button size="sm">Verify now</Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Number of seats" hint={`max ${maxSeats}`}>
                  <select
                    value={seats}
                    onChange={(e) => setSeats(Math.max(1, Math.min(maxSeats, Number(e.target.value))))}
                    className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[15px] font-medium text-slate-900 outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-50"
                  >
                    {Array.from({ length: maxSeats }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n} seat{n === 1 ? "" : "s"}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Pickup point">
                  <Input
                    list="pickup-options"
                    value={pickupPoint}
                    placeholder="e.g. Kothrud Depot"
                    onChange={(e) => setPickupPoint(e.target.value)}
                  />
                  <datalist id="pickup-options">
                    {pickupOptions.map((stop) => (
                      <option key={stop} value={stop} />
                    ))}
                  </datalist>
                </Field>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {pickupOptions.slice(0, 4).map((stop) => (
                  <button
                    key={stop}
                    type="button"
                    onClick={() => setPickupPoint(stop)}
                    className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
                  >
                    📍 {stop}
                  </button>
                ))}
              </div>

              <Field label="Message to the driver" hint="optional" className="mt-4">
                <Textarea
                  rows={2}
                  value={message}
                  placeholder="Hi! I study at the same college, can you pick me up near the signal?"
                  onChange={(e) => setMessage(e.target.value)}
                />
              </Field>

              <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-3.5 text-white">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Total to pay</p>
                  <p className="text-xs text-slate-300">
                    {seats} × ₹{ride.pricePerSeat} per seat
                  </p>
                </div>
                <p className="text-2xl font-extrabold">₹{total}</p>
              </div>

              <Button
                full
                size="lg"
                className="mt-4"
                onClick={() => {
                  if (!pickupPoint.trim()) {
                    push({
                      title: "Pick a pickup point",
                      body: "Choose where the driver can pick you up.",
                      tone: "error",
                    });
                    return;
                  }
                  setStep("payment");
                }}
              >
                Continue to payment →
              </Button>
              <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-400">
                🔒 Your seats are reserved for 15 minutes while you pay. If the driver rejects the
                request, the amount is refunded automatically.
              </p>
            </>
          )}
        </>
      ) : step === "payment" ? (
        <PaymentFlow
          request={{ rideId: ride.id, seats, pickupPoint, message }}
          display={{
            route: `${ride.fromLocation} → ${ride.toLocation}`,
            when: `${formatDatePretty(ride.travelDate)} · ${formatTime12h(ride.departureTime)}`,
            pricePerSeat: ride.pricePerSeat,
            driverName: ride.driver.fullName,
          }}
          onSuccess={async (res) => {
            setResult(res);
            setStep("result");
            await refresh();
            onDone?.();
          }}
          onCancel={() => setStep("details")}
        />
      ) : (
        <div className="py-2 text-center">
          <div
            className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-3xl ${
              result?.paymentStatus === "PAID" ? "bg-mint-50" : "bg-rose-50"
            }`}
          >
            {result?.paymentStatus === "PAID" ? "🎉" : "⚠️"}
          </div>
          <h3 className="mt-4 text-xl font-bold tracking-tight text-slate-900">
            {result?.paymentStatus === "PAID"
              ? "Your booking request has been sent to the ride provider."
              : "Payment could not be completed"}
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
            {result?.paymentStatus === "PAID"
              ? `${ride.driver.fullName} will review your paid request for ${ride.fromLocation} → ${ride.toLocation}. You will be notified the moment it is accepted — contact details unlock after acceptance.`
              : result?.message ?? "Please try booking again."}
          </p>
          {result ? (
            <div className="mt-4 flex justify-center">
              <PaymentStatusBadge status={result.paymentStatus} />
            </div>
          ) : null}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link href="/rides">
              <Button>Track in My Rides</Button>
            </Link>
            <Button variant="secondary" onClick={close}>
              Keep browsing
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
