import { createHmac, timingSafeEqual } from "crypto";
import { env } from "@/lib/env";

export const RAZORPAY_API = "https://api.razorpay.com/v1";

/**
 * This application uses REAL Razorpay Checkout only.
 * There is no simulator, sandbox fallback or instant-success path.
 * When credentials are missing the payment flow fails closed.
 */
export type PaymentMode = "razorpay";

export function paymentMode(): PaymentMode {
  return "razorpay";
}

/** True only when both server-side Razorpay API credentials are present. */
export function isRazorpayConfigured(): boolean {
  return env.razorpay.configured;
}

/** Test Mode keys are prefixed `rzp_test_`; live keys use `rzp_live_`. */
export function isRazorpayTestMode(): boolean {
  return (env.razorpay.keyId ?? "").startsWith("rzp_test_");
}

function authHeader(): string {
  const token = Buffer.from(`${env.razorpay.keyId}:${env.razorpay.keySecret}`).toString("base64");
  return `Basic ${token}`;
}

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  receipt?: string;
};

export type RazorpayPayment = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  order_id: string;
  method?: string;
  captured?: boolean;
  refund_status?: string | null;
  amount_refunded?: number;
};

export type RazorpayRefund = {
  id: string;
  amount: number;
  status: string;
  payment_id: string;
};

export type RazorpayTransfer = {
  id: string;
  entity: string;
  account: string;
  amount: number;
  currency: string;
  status: string;
  recipient_settlement_id?: string | null;
  error?: {
    code?: string;
    description?: string;
  } | null;
};

export type RazorpayTransferResponse = {
  object: string;
  items: RazorpayTransfer[];
};

export class RazorpayError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RazorpayError";
  }
}

async function call<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${RAZORPAY_API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await response.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!response.ok) {
    throw new RazorpayError(
      typeof data.error === "object" && data.error && "description" in data.error
        ? String((data.error as { description: string }).description)
        : "Razorpay request failed",
      response.status,
    );
  }
  return data as T;
}

/** Creates an order for ₹ `amount` (amount is always in paise for Razorpay). */
export async function createRazorpayOrder(input: {
  amount: number; // rupees
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  return call<RazorpayOrder>("/orders", {
    method: "POST",
    body: JSON.stringify({
      amount: Math.round(input.amount * 100),
      currency: input.currency ?? "INR",
      receipt: input.receipt,
      notes: input.notes ?? {},
      payment_capture: 1,
    }),
  });
}

export async function fetchRazorpayPayment(paymentId: string): Promise<RazorpayPayment> {
  return call<RazorpayPayment>(`/payments/${encodeURIComponent(paymentId)}`, { method: "GET" });
}

export async function createRazorpayRefund(input: {
  paymentId: string;
  amount?: number; // rupees
}): Promise<RazorpayRefund> {
  return call<RazorpayRefund>(`/payments/${encodeURIComponent(input.paymentId)}/refund`, {
    method: "POST",
    body: JSON.stringify(
      input.amount ? { amount: Math.round(input.amount * 100), speed: "normal" } : { speed: "normal" },
    ),
  });
}

/**
 * Creates a Razorpay Route transfer of `amount` (rupees) from a captured payment
 * to a driver's Linked Account ID (acc_...).
 */
export async function createRazorpayTransfer(input: {
  paymentId: string;
  account: string; // acc_...
  amount: number; // rupees
  currency?: string;
  notes?: Record<string, string>;
}): Promise<RazorpayTransferResponse> {
  return call<RazorpayTransferResponse>(`/payments/${encodeURIComponent(input.paymentId)}/transfers`, {
    method: "POST",
    body: JSON.stringify({
      transfers: [
        {
          account: input.account,
          amount: Math.round(input.amount * 100),
          currency: input.currency ?? "INR",
          notes: input.notes ?? {},
        },
      ],
    }),
  });
}

export async function fetchRazorpayTransfer(transferId: string): Promise<RazorpayTransfer> {
  return call<RazorpayTransfer>(`/transfers/${encodeURIComponent(transferId)}`, { method: "GET" });
}

/* ------------------------------------------------------- signatures */

/**
 * Verifies the Razorpay Checkout signature:
 * HMAC_SHA256(order_id + "|" + razorpay_payment_id, key_secret)
 */
export function verifyPaymentSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = env.razorpay.keySecret;
  if (!secret) return false;
  const expected = createHmac("sha256", secret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest("hex");
  return safeEqual(expected, input.signature);
}

/** Verifies the X-Razorpay-Signature header of a webhook request. */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = env.razorpay.webhookSecret;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqual(expected, signature);
}

function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/*
 * NOTE: The sandbox/simulator order generator, simulated signature tokens and
 * simulated refund ids were intentionally removed. Every payment must now go
 * through the official Razorpay Checkout and be verified server-side with
 * RAZORPAY_KEY_SECRET. There is no code path that can mark a payment as
 * successful without a genuine Razorpay signature.
 */
