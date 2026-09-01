/** Central, typed access to environment configuration. Server-side only. */

function optional(key: string): string | undefined {
  const value = process.env[key];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

export const env = {
  get authSecret(): string {
    const secret = optional("AUTH_SECRET") ?? optional("SESSION_SECRET");
    if (!secret && process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET must be configured in production.");
    }
    return secret ?? "ridemate-campus-dev-secret-change-me";
  },
  get isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  },
  get appUrl(): string {
    return optional("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000";
  },
  get sessionDays(): number {
    const raw = Number.parseInt(optional("SESSION_DAYS") ?? "14", 10);
    return Number.isFinite(raw) && raw >= 1 && raw <= 30 ? raw : 14;
  },
  razorpay: {
    get keyId(): string | undefined {
      return optional("RAZORPAY_KEY_ID");
    },
    get keySecret(): string | undefined {
      return optional("RAZORPAY_KEY_SECRET");
    },
    /**
     * Webhook shared secret. Falls back to AUTH_SECRET so that signature
     * verification is always enforced, even before the Razorpay dashboard
     * secret has been configured in a deployment environment.
     */
    get webhookSecret(): string {
      return optional("RAZORPAY_WEBHOOK_SECRET") ?? env.authSecret;
    },
    /** Real Razorpay is only used when both API credentials are present. */
    get configured(): boolean {
      return Boolean(optional("RAZORPAY_KEY_ID") && optional("RAZORPAY_KEY_SECRET"));
    },
  },
  /** How long a passenger has to complete payment after reserving seats. */
  get paymentWindowMinutes(): number {
    const raw = Number.parseInt(optional("PAYMENT_WINDOW_MINUTES") ?? "15", 10);
    return Number.isFinite(raw) && raw > 0 && raw <= 240 ? raw : 15;
  },
  get adminEmails(): string[] {
    const raw = optional("ADMIN_EMAILS") ?? "";
    return raw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
  },
};

export const PAYMENT_STATUSES = [
  "PENDING",
  "PAYMENT_PROCESSING",
  "PAID",
  "FAILED",
  "CANCELLED",
  "REFUND_PENDING",
  "REFUNDED",
] as const;

export const BOOKING_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "CANCELLED",
  "COMPLETED",
] as const;
