"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, Spinner, useToast } from "@/components/ui";
import type { PaymentOrderDTO } from "@/lib/types";

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Payment Pending",
  PENDING: "Payment Pending",
  payment_processing: "Payment Processing",
  PAYMENT_PROCESSING: "Payment Processing",
  paid: "Payment Successful",
  PAID: "Payment Successful",
  failed: "Payment Failed",
  FAILED: "Payment Failed",
  cancelled: "Payment Cancelled",
  CANCELLED: "Payment Cancelled",
  refund_pending: "Refund Processing",
  REFUND_PENDING: "Refund Processing",
  refunded: "Refunded",
  REFUNDED: "Refunded",
  expired: "Payment Expired",
  EXPIRED: "Payment Expired",
};

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending: "Request Sent",
  PENDING: "Request Sent",
  accepted: "Accepted",
  ACCEPTED: "Accepted",
  rejected: "Rejected",
  REJECTED: "Rejected",
  cancelled: "Cancelled",
  CANCELLED: "Cancelled",
  completed: "Completed",
  COMPLETED: "Completed",
};

export function PaymentStatusBadge({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  const tone =
    s === "paid"
      ? "mint"
      : s === "refunded" || s === "refund_pending"
        ? "brand"
        : s === "failed" || s === "cancelled" || s === "expired"
          ? "rose"
          : "amber";
  return <Badge tone={tone}>{PAYMENT_STATUS_LABELS[status] ?? status}</Badge>;
}

export function BookingStatusBadge({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  const tone =
    s === "accepted"
      ? "mint"
      : s === "completed"
        ? "brand"
        : s === "pending"
          ? "amber"
          : "rose";
  return <Badge tone={tone}>{BOOKING_STATUS_LABELS[status] ?? status}</Badge>;
}

/* --------------------------------------------------- Razorpay Checkout */

type RazorpayInstance = { open: () => void; on: (event: string, cb: (payload: unknown) => void) => void };

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

let scriptPromise: Promise<boolean> | null = null;

function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
  return scriptPromise;
}

export type VerifyResult = {
  paymentStatus: string;
  bookingStatus: string;
  bookingId: number;
  rideId: number;
  message: string;
  alreadyProcessed?: boolean;
};

export type PaymentRequestInput = {
  rideId: number;
  seats: number;
  pickupPoint: string;
  message?: string;
};

export type PaymentDisplay = {
  route: string;
  when: string;
  pricePerSeat: number;
  driverName: string;
};

/**
 * Full Option-B payment flow: create order on the server (server-calculated
 * amount), collect payment via Razorpay Checkout (or the labelled sandbox
 * simulator when keys are absent), then verify on the server.
 */
export function PaymentFlow({
  request,
  display,
  onSuccess,
  onCancel,
}: {
  request: PaymentRequestInput;
  display: PaymentDisplay;
  onSuccess: (result: VerifyResult) => void;
  onCancel: () => void;
}) {
  const { push } = useToast();
  const [order, setOrder] = useState<PaymentOrderDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const startedRef = useRef(false);

  const createOrder = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rideId: request.rideId,
          seats: request.seats,
          pickupPoint: request.pickupPoint,
          message: request.message ?? "",
        }),
      });
      const data = (await res.json()) as { order?: PaymentOrderDTO; error?: string };
      if (!res.ok || !data.order) {
        setError(data.error ?? "Unable to create your payment. Please try again.");
        return;
      }
      setOrder(data.order);
    } catch {
      setError("Network error while starting the payment.");
    } finally {
      setLoading(false);
    }
  }, [request.rideId, request.seats, request.pickupPoint, request.message]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void createOrder();
  }, [createOrder]);

  // Countdown is cosmetic only — the server enforces the real deadline.
  useEffect(() => {
    if (!order) return;
    const tick = () => {
      const ms = new Date(order.expiresAt).getTime() - Date.now();
      setSecondsLeft(ms > 0 ? Math.floor(ms / 1000) : 0);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [order]);

  const verify = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!order) return;
      setVerifying(true);
      try {
        const res = await fetch("/api/payments/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: order.orderId, ...payload }),
        });
        const data = (await res.json()) as { result?: VerifyResult; error?: string };
        if (!res.ok || !data.result) {
          push({
            title: "Payment not completed",
            body: data.error ?? "Unable to process payment. Please try again.",
            tone: "error",
          });
          if (data.error?.includes("expired")) {
            setError(data.error);
            setOrder(null);
            startedRef.current = false;
          }
          return;
        }
        const result = data.result;
        if (result.paymentStatus === "PAID") {
          push({ title: "Payment successful", body: result.message, tone: "success" });
          onSuccess(result);
        } else {
          push({ title: "Payment failed", body: result.message, tone: "error" });
          onSuccess(result);
        }
      } catch {
        push({ title: "Network error", body: "Please check your connection.", tone: "error" });
      } finally {
        setVerifying(false);
      }
    },
    [order, push, onSuccess],
  );

  const payWithRazorpay = useCallback(async () => {
    if (!order) return;
    setVerifying(true);
    const loaded = await loadRazorpayScript();
    if (!loaded || !window.Razorpay) {
      setVerifying(false);
      push({
        title: "Checkout unavailable",
        body: "We could not load the payment gateway. Please check your connection.",
        tone: "error",
      });
      return;
    }
    const checkout = new window.Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount * 100,
      currency: order.currency,
      name: "RideMate Campus",
      description: `${display.route} · ${order.seats} seat(s)`,
      prefill: { name: order.prefill.name, email: order.prefill.email, contact: order.prefill.contact },
      notes: { rideId: String(order.rideId), bookingId: String(order.bookingId) },
      theme: { color: "#2451e6" },
      handler: (response: {
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
      }) => {
        void verify({
          razorpayPaymentId: response.razorpay_payment_id,
          razorpayOrderId: response.razorpay_order_id,
          razorpaySignature: response.razorpay_signature,
        });
      },
      modal: {
        ondismiss: () => {
          setVerifying(false);
          push({
            title: "Payment cancelled",
            body: "You can pay later from My Rides before the window expires.",
            tone: "info",
          });
        },
      },
    });
    checkout.on("payment.failed", () => {
      setVerifying(false);
      push({ title: "Payment failed", body: "No amount was deducted. Please try again.", tone: "error" });
    });
    checkout.open();
  }, [order, display.route, push, verify]);

  if (loading) return <Spinner label="Reserving your seats…" />;

  if (error && !order) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-2xl">
          ⚠️
        </div>
        <h3 className="mt-4 text-lg font-bold text-slate-900">We could not start this payment</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{error}</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            onClick={() => {
              startedRef.current = false;
              void createOrder();
            }}
          >
            Try again
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  if (!order) return null;

  return (
    <div>
      <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Ride payment</p>
        <p className="mt-1.5 text-base font-bold tracking-tight text-slate-900">{display.route}</p>
        <p className="text-xs text-slate-500">
          {display.when} · with {display.driverName}
        </p>
        <dl className="mt-3.5 space-y-2 text-[13px]">
          <div className="flex justify-between">
            <dt className="text-slate-500">Pickup point</dt>
            <dd className="font-semibold text-slate-800">{order.pickupPoint}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Seats</dt>
            <dd className="font-semibold text-slate-800">{order.seats}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Price per seat</dt>
            <dd className="font-semibold text-slate-800">₹{display.pricePerSeat}</dd>
          </div>
          <div className="flex justify-between border-t border-slate-200/80 pt-2 text-xs text-slate-500">
            <dt>Platform commission (5%)</dt>
            <dd className="font-semibold">₹{order.commissionAmount ?? Math.round(order.amount * 0.03)}</dd>
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <dt>Payable to ride provider</dt>
            <dd className="font-semibold">₹{order.driverAmount ?? (order.amount - Math.round(order.amount * 0.03))}</dd>
          </div>
          <div className="flex justify-between border-t border-slate-200/80 pt-2">
            <dt className="text-slate-500">Payment status</dt>
            <dd>
              <PaymentStatusBadge status={verifying ? "PAYMENT_PROCESSING" : "PENDING"} />
            </dd>
          </div>
        </dl>
        <div className="mt-3.5 flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3 text-white">
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Total amount</p>
            <p className="text-xs text-slate-300">Calculated securely on our server</p>
          </div>
          <p className="text-2xl font-extrabold">₹{order.amount}</p>
        </div>
        {secondsLeft !== null ? (
          <p className="mt-2.5 text-center text-[11px] font-semibold text-amber-600">
            ⏳ Seats reserved for {Math.floor(secondsLeft / 60)}:
            {String(secondsLeft % 60).padStart(2, "0")}
          </p>
        ) : null}
      </div>

      {/* Only the official Razorpay Checkout can complete this payment. */}
      <Button full size="lg" className="mt-5" loading={verifying} onClick={payWithRazorpay}>
        🔒 Pay Securely ₹{order.amount}
      </Button>

      <p className="mt-2.5 text-center text-[11px] font-medium text-slate-500">
        You will be redirected to the official Razorpay Checkout, where UPI, cards, net banking and
        wallets are available.
      </p>

      <Button full variant="secondary" className="mt-3" onClick={onCancel}>
        Cancel
      </Button>

      <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-400">
        Payments are processed securely through Razorpay. RideMate never stores your card, CVV or
        UPI PIN, and your booking is confirmed only after Razorpay verification succeeds.
      </p>
    </div>
  );
}
