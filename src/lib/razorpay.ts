import { createHmac, timingSafeEqual } from "crypto";
import { env } from "@/lib/env";

export const RAZORPAY_API = "https://api.razorpay.com/v1";

export type PaymentMode = "razorpay";

export function paymentMode(): PaymentMode {
  return "razorpay";
}

export function isRazorpayConfigured(): boolean {
  return Boolean(
    env.razorpay.keyId &&
      env.razorpay.keySecret,
  );
}

export function isRazorpayTestMode(): boolean {
  return (env.razorpay.keyId ?? "").startsWith("rzp_test_");
}

function getAuthHeader(): string {
  const credentials = `${env.razorpay.keyId}:${env.razorpay.keySecret}`;

  return `Basic ${Buffer.from(credentials).toString("base64")}`;
}

export type RazorpayOrder = {
  id: string;
  entity?: string;
  amount: number;
  amount_paid?: number;
  amount_due?: number;
  currency: string;
  receipt?: string;
  status: string;
  attempts?: number;
  notes?: Record<string, string>;
  created_at?: number;
};

export type RazorpayPayment = {
  id: string;
  entity?: string;
  amount: number;
  currency: string;
  status: string;
  order_id?: string;
  invoice_id?: string | null;
  international?: boolean;
  method?: string;
  amount_refunded?: number;
  refund_status?: string | null;
  captured?: boolean;
  description?: string;
  email?: string;
  contact?: string;
  notes?: Record<string, string>;
  created_at?: number;
};

export type RazorpayRefund = {
  id: string;
  entity?: string;
  amount: number;
  currency?: string;
  payment_id?: string;
  status: string;
  created_at?: number;
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
  entity?: string;
  count?: number;
  items: RazorpayTransfer[];
};

export class RazorpayError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "RazorpayError";
  }
}

async function razorpayRequest<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  if (!isRazorpayConfigured()) {
    throw new RazorpayError(
      "Razorpay is not configured on the server.",
      500,
    );
  }

  const response = await fetch(`${RAZORPAY_API}${path}`, {
    ...init,
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const responseText = await response.text();

  let data: unknown = {};

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      data = {
        raw: responseText,
      };
    }
  }

  if (!response.ok) {
    let message = "Razorpay request failed.";

    if (
      typeof data === "object" &&
      data !== null &&
      "error" in data
    ) {
      const error = (
        data as {
          error?: {
            description?: string;
            code?: string;
          };
        }
      ).error;

      if (error?.description) {
        message = error.description;
      } else if (error?.code) {
        message = error.code;
      }
    }

    throw new RazorpayError(
      message,
      response.status,
      data,
    );
  }

  return data as T;
}

/**
 * Creates a Razorpay order.
 *
 * RideMate passes the amount in INR.
 * Razorpay expects the amount in paise.
 */
export async function createRazorpayOrder(input: {
  amount: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new RazorpayError(
      "Invalid Razorpay order amount.",
      400,
    );
  }

  return razorpayRequest<RazorpayOrder>("/orders", {
    method: "POST",
    body: JSON.stringify({
      amount: Math.round(input.amount * 100),
      currency: input.currency ?? "INR",
      receipt: input.receipt,
      notes: input.notes ?? {},
    }),
  });
}

/**
 * Fetches a payment directly from Razorpay.
 */
export async function fetchRazorpayPayment(
  paymentId: string,
): Promise<RazorpayPayment> {
  if (!paymentId) {
    throw new RazorpayError(
      "Razorpay payment ID is required.",
      400,
    );
  }

  return razorpayRequest<RazorpayPayment>(
    `/payments/${encodeURIComponent(paymentId)}`,
    {
      method: "GET",
    },
  );
}

/**
 * Creates a refund.
 *
 * If amount is omitted, Razorpay will refund the full payment.
 */
export async function createRazorpayRefund(input: {
  paymentId: string;
  amount?: number;
}): Promise<RazorpayRefund> {
  if (!input.paymentId) {
    throw new RazorpayError(
      "Razorpay payment ID is required.",
      400,
    );
  }

  const body: Record<string, unknown> = {
    speed: "normal",
  };

  if (
    input.amount !== undefined &&
    Number.isFinite(input.amount) &&
    input.amount > 0
  ) {
    body.amount = Math.round(input.amount * 100);
  }

  return razorpayRequest<RazorpayRefund>(
    `/payments/${encodeURIComponent(input.paymentId)}/refund`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

/**
 * Creates a Razorpay Route transfer.
 *
 * IMPORTANT:
 * The destination account must already be configured
 * and approved in the Razorpay account.
 */
export async function createRazorpayTransfer(input: {
  paymentId: string;
  account: string;
  amount: number;
  currency?: string;
  notes?: Record<string, string>;
}): Promise<RazorpayTransferResponse> {
  if (!input.paymentId) {
    throw new RazorpayError(
      "Payment ID is required for a transfer.",
      400,
    );
  }

  if (!input.account) {
    throw new RazorpayError(
      "Razorpay linked account is required.",
      400,
    );
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new RazorpayError(
      "Invalid transfer amount.",
      400,
    );
  }

  return razorpayRequest<RazorpayTransferResponse>(
    `/payments/${encodeURIComponent(input.paymentId)}/transfers`,
    {
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
    },
  );
}

/**
 * Fetches a Route transfer.
 */
export async function fetchRazorpayTransfer(
  transferId: string,
): Promise<RazorpayTransfer> {
  if (!transferId) {
    throw new RazorpayError(
      "Razorpay transfer ID is required.",
      400,
    );
  }

  return razorpayRequest<RazorpayTransfer>(
    `/transfers/${encodeURIComponent(transferId)}`,
    {
      method: "GET",
    },
  );
}

/**
 * Verifies the Razorpay Checkout signature.
 *
 * Formula:
 *
 * HMAC_SHA256(
 *   razorpay_order_id + "|" + razorpay_payment_id,
 *   RAZORPAY_KEY_SECRET
 * )
 */
export function verifyPaymentSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = env.razorpay.keySecret;

  if (!secret) {
    return false;
  }

  if (
    !input.orderId ||
    !input.paymentId ||
    !input.signature
  ) {
    return false;
  }

  const expectedSignature = createHmac(
    "sha256",
    secret,
  )
    .update(`${input.orderId}|${input.paymentId}`)
    .digest("hex");

  return safeCompare(
    expectedSignature,
    input.signature,
  );
}

/**
 * Verifies the X-Razorpay-Signature webhook header.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
): boolean {
  const secret = env.razorpay.webhookSecret;

  if (!secret || !signature) {
    return false;
  }

  const expectedSignature = createHmac(
    "sha256",
    secret,
  )
    .update(rawBody)
    .digest("hex");

  return safeCompare(
    expectedSignature,
    signature,
  );
}

function safeCompare(
  expected: string,
  actual: string,
): boolean {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);

  if (
    expectedBuffer.length !==
    actualBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    expectedBuffer,
    actualBuffer,
  );
}
