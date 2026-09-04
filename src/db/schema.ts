import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ users */

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    fullName: varchar("full_name", { length: 120 }).notNull(),
    email: varchar("email", { length: 160 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    // `phone` is retained for backward compatibility with existing data.
    // New writes populate `phone_number`, the production-ready canonical field.
    phone: varchar("phone", { length: 20 }).notNull().default(""),
    phoneNumber: varchar("phone_number", { length: 20 }).notNull().default(""),
    college: varchar("college", { length: 160 }).notNull().default(""),
    studentId: varchar("student_id", { length: 60 }).notNull().default(""),
    gender: varchar("gender", { length: 20 }).notNull().default("prefer_not_say"),
    homeLocation: varchar("home_location", { length: 120 }).notNull().default(""),
    avatarColor: varchar("avatar_color", { length: 40 }).notNull().default("blue"),
    verified: boolean("verified").notNull().default(false),
    /** UNVERIFIED | PENDING | VERIFIED | REJECTED — authoritative verification state. */
    verificationStatus: varchar("verification_status", { length: 20 })
      .notNull()
      .default("UNVERIFIED"),
    /** STUDENT | ADMIN — checked server side only. */
    role: varchar("role", { length: 16 }).notNull().default("STUDENT"),
    suspended: boolean("suspended").notNull().default(false),
    ratingSum: integer("rating_sum").notNull().default(0),
    ratingCount: integer("rating_count").notNull().default(0),
    ridesCompleted: integer("rides_completed").notNull().default(0),
    driverVerified: boolean("driver_verified").notNull().default(false),
    driverVerificationStatus: varchar("driver_verification_status", { length: 20 })
      .notNull()
      .default("NOT_SUBMITTED"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("users_verification_status_idx").on(table.verificationStatus),
    index("users_role_idx").on(table.role),
  ],
);

/* ------------------------------------------------- student verifications */

export const studentVerifications = pgTable(
  "student_verifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fullName: varchar("full_name", { length: 120 }).notNull(),
    collegeName: varchar("college_name", { length: 160 }).notNull(),
    studentIdText: varchar("student_id_text", { length: 60 }).notNull(),
    documentPath: varchar("document_path", { length: 300 }).notNull(),
    documentType: varchar("document_type", { length: 10 }).notNull().default("image"),
    // NOT_SUBMITTED | PENDING | VERIFIED | REJECTED
    status: varchar("status", { length: 20 }).notNull().default("PENDING"),
    rejectionReason: varchar("rejection_reason", { length: 400 }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: integer("reviewed_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("sv_user_idx").on(table.userId),
    index("sv_status_idx").on(table.status),
  ],
);

/* -------------------------------------------------- driver verifications */

export const driverVerifications = pgTable(
  "driver_verifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    licenceDocumentPath: varchar("licence_document_path", { length: 300 }).notNull(),
    vehicleNumber: varchar("vehicle_number", { length: 30 }).notNull(),
    vehicleType: varchar("vehicle_type", { length: 30 }).notNull(),
    vehicleRegDocumentPath: varchar("vehicle_reg_document_path", { length: 300 }).notNull(),
    identityDocumentPath: varchar("identity_document_path", { length: 300 }),
    identityDocumentType: varchar("identity_document_type", { length: 20 }).default("aadhaar"),
    // NOT_SUBMITTED | PENDING | APPROVED | REJECTED
    status: varchar("status", { length: 20 }).notNull().default("PENDING"),
    rejectionReason: varchar("rejection_reason", { length: 400 }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: integer("reviewed_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("dv_user_idx").on(table.userId),
    index("dv_status_idx").on(table.status),
  ],
);

/* ------------------------------------------------------------ auth sessions */

/**
 * Durable server-side sessions. The browser receives only a random opaque
 * token; this database stores its SHA-256 hash, never the raw cookie value.
 */
export const authSessions = pgTable(
  "auth_sessions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    userAgent: varchar("user_agent", { length: 300 }).notNull().default(""),
    ipAddress: varchar("ip_address", { length: 64 }).notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("auth_sessions_user_idx").on(table.userId),
    index("auth_sessions_expiry_idx").on(table.expiresAt),
    index("auth_sessions_active_idx").on(table.userId, table.revokedAt),
  ],
);

/* ------------------------------------------------------------------ rides */

export const rides = pgTable(
  "rides",
  {
    id: serial("id").primaryKey(),
    driverId: integer("driver_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    direction: varchar("direction", { length: 30 }).notNull(), // home_to_college | college_to_home
    fromLocation: varchar("from_location", { length: 120 }).notNull(),
    toLocation: varchar("to_location", { length: 120 }).notNull(),
    routeStops: text("route_stops").notNull().default(""),
    travelDate: varchar("travel_date", { length: 20 }).notNull(), // YYYY-MM-DD
    departureTime: varchar("departure_time", { length: 10 }).notNull(), // HH:MM
    vehicleType: varchar("vehicle_type", { length: 20 }).notNull(), // bike | scooter | car
    vehicleModel: varchar("vehicle_model", { length: 80 }).notNull().default(""),
    seatsTotal: integer("seats_total").notNull().default(1),
    seatsAvailable: integer("seats_available").notNull().default(1),
    pricePerSeat: integer("price_per_seat").notNull().default(0),
    preferredGender: varchar("preferred_gender", { length: 20 }).notNull().default("any"),
    notes: text("notes").notNull().default(""),
    status: varchar("status", { length: 20 }).notNull().default("active"), // active | cancelled | completed
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("rides_driver_idx").on(table.driverId),
    index("rides_travel_date_idx").on(table.travelDate),
    index("rides_status_idx").on(table.status),
    // One identical route listing per driver/time; prevents duplicate cards.
    unique("rides_driver_route_time_uq").on(
      table.driverId,
      table.direction,
      table.fromLocation,
      table.toLocation,
      table.travelDate,
      table.departureTime,
    ),
  ],
);

/* --------------------------------------------------------------- bookings */

export const bookings = pgTable(
  "bookings",
  {
    id: serial("id").primaryKey(),
    rideId: integer("ride_id")
      .notNull()
      .references(() => rides.id, { onDelete: "cascade" }),
    riderId: integer("rider_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    seats: integer("seats").notNull().default(1),
    pickupPoint: varchar("pickup_point", { length: 160 }).notNull().default(""),
    message: text("message").notNull().default(""),
    totalPrice: integer("total_price").notNull().default(0),
    // PENDING | ACCEPTED | REJECTED | CANCELLED | COMPLETED
    status: varchar("status", { length: 20 }).notNull().default("PENDING"),
    contactUnlocked: boolean("contact_unlocked").notNull().default(false),
    // PENDING | PAYMENT_PROCESSING | PAID | FAILED | CANCELLED | REFUND_PENDING | REFUNDED
    paymentStatus: varchar("payment_status", { length: 24 }).notNull().default("pending"),
    paymentOrderId: varchar("payment_order_id", { length: 80 }),
    razorpayOrderId: varchar("razorpay_order_id", { length: 80 }),
    paymentId: varchar("payment_id", { length: 80 }),
    razorpayPaymentId: varchar("razorpay_payment_id", { length: 80 }),
    paymentAmount: integer("payment_amount").notNull().default(0),
    commissionAmount: integer("commission_amount").notNull().default(0),
    driverAmount: integer("driver_amount").notNull().default(0),
    paymentCurrency: varchar("payment_currency", { length: 8 }).notNull().default("INR"),
    paymentVerified: boolean("payment_verified").notNull().default(false),
    paymentVerifiedAt: timestamp("payment_verified_at", { withTimezone: true }),
    paymentExpiresAt: timestamp("payment_expires_at", { withTimezone: true }),
    refundId: varchar("refund_id", { length: 80 }),
    refundAmount: integer("refund_amount").notNull().default(0),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: varchar("cancelled_by", { length: 20 }), // rider | driver | system
    cancellationReason: varchar("cancellation_reason", { length: 240 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("bookings_ride_idx").on(table.rideId),
    index("bookings_rider_idx").on(table.riderId),
    index("bookings_status_idx").on(table.status),
    index("bookings_payment_status_idx").on(table.paymentStatus),
    index("bookings_order_idx").on(table.paymentOrderId),
    index("bookings_ride_rider_idx").on(table.rideId, table.riderId),
  ],
);

/* --------------------------------------------------------------- payments */

/* ----------------------------------------------------------- driver earnings */

export const driverEarnings = pgTable(
  "driver_earnings",
  {
    id: serial("id").primaryKey(),
    driverId: integer("driver_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    rideId: integer("ride_id")
      .notNull()
      .references(() => rides.id, { onDelete: "cascade" }),
    totalFare: integer("total_fare").notNull(),
    commissionAmount: integer("commission_amount").notNull(),
    driverEarning: integer("driver_earning").notNull(),
    // PENDING | AVAILABLE | RIDE_COMPLETED | PAYOUT_PROCESSING | PAID_OUT | CANCELLED | REFUNDED | FAILED
    status: varchar("status", { length: 30 }).notNull().default("PENDING"),
    payoutId: varchar("payout_id", { length: 80 }),
    razorpayTransferId: varchar("razorpay_transfer_id", { length: 80 }),
    payoutMethod: varchar("payout_method", { length: 30 }).notNull().default("RAZORPAY_ROUTE"),
    failureReason: varchar("failure_reason", { length: 240 }),
    paidOutAt: timestamp("paid_out_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("driver_earnings_driver_idx").on(table.driverId),
    index("driver_earnings_booking_idx").on(table.bookingId),
    index("driver_earnings_status_idx").on(table.status),
    unique("driver_earnings_booking_uq").on(table.bookingId),
  ],
);

/* ------------------------------------------------------ driver payout accounts */

export const driverPayoutAccounts = pgTable(
  "driver_payout_accounts",
  {
    id: serial("id").primaryKey(),
    driverId: integer("driver_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // UPI | BANK_ACCOUNT
    method: varchar("method", { length: 20 }).notNull().default("UPI"),
    upiId: varchar("upi_id", { length: 120 }),
    accountHolderName: varchar("account_holder_name", { length: 120 }),
    bankAccountNumber: varchar("bank_account_number", { length: 40 }),
    bankIfsc: varchar("bank_ifsc", { length: 20 }),
    // RazorpayX contact + fund account references, filled in once created via API
    razorpayxContactId: varchar("razorpayx_contact_id", { length: 80 }),
    razorpayxFundAccountId: varchar("razorpayx_fund_account_id", { length: 80 }),
    verified: boolean("verified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("dpa_driver_idx").on(table.driverId),
    unique("dpa_driver_uq").on(table.driverId),
  ],
);

/* -------------------------------------------------------- driver live location */

export const driverLiveLocations = pgTable(
  "driver_live_locations",
  {
    id: serial("id").primaryKey(),
    driverId: integer("driver_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rideId: integer("ride_id")
      .notNull()
      .references(() => rides.id, { onDelete: "cascade" }),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("dll_ride_idx").on(table.rideId),
    unique("dll_driver_uq").on(table.driverId),
  ],
);

/* --------------------------------------------------------------- payments */

export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 24 }).notNull().default("razorpay"),
    orderId: varchar("order_id", { length: 80 }).notNull().unique(),
    razorpayOrderId: varchar("razorpay_order_id", { length: 80 }),
    paymentId: varchar("payment_id", { length: 80 }),
    razorpayPaymentId: varchar("razorpay_payment_id", { length: 80 }),
    amount: integer("amount").notNull(),
    totalAmount: integer("total_amount").notNull().default(0),
    commissionAmount: integer("commission_amount").notNull().default(0),
    driverAmount: integer("driver_amount").notNull().default(0),
    currency: varchar("currency", { length: 8 }).notNull().default("INR"),
    status: varchar("status", { length: 24 }).notNull().default("pending"),
    paymentStatus: varchar("payment_status", { length: 24 }).notNull().default("pending"),
    verified: boolean("verified").notNull().default(false),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    refundId: varchar("refund_id", { length: 80 }),
    refundAmount: integer("refund_amount").notNull().default(0),
    refundStatus: varchar("refund_status", { length: 24 }),
    failureReason: varchar("failure_reason", { length: 200 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("payments_booking_idx").on(table.bookingId),
    index("payments_user_idx").on(table.userId),
    index("payments_order_idx").on(table.orderId),
    index("payments_payment_idx").on(table.paymentId),
    index("payments_status_idx").on(table.status),
  ],
);

/* ---------------------------------------------------------- webhook events */

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: serial("id").primaryKey(),
    eventId: varchar("event_id", { length: 120 }).notNull().unique(),
    eventType: varchar("event_type", { length: 60 }).notNull(),
    orderId: varchar("order_id", { length: 80 }),
    paymentId: varchar("payment_id", { length: 80 }),
    processed: boolean("processed").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("webhook_events_event_id_idx").on(table.eventId)],
);

/* --------------------------------------------------------------- reports */

export const reports = pgTable(
  "reports",
  {
    id: serial("id").primaryKey(),
    reporterId: integer("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reportedUserId: integer("reported_user_id"),
    rideId: integer("ride_id"),
    // fake_account | unsafe_behaviour | harassment | payment_issue | other
    reason: varchar("reason", { length: 80 }).notNull(),
    details: text("details").notNull().default(""),
    // OPEN | REVIEWING | RESOLVED
    status: varchar("status", { length: 20 }).notNull().default("OPEN"),
    reviewedBy: integer("reviewed_by"),
    resolution: text("resolution").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("reports_status_idx").on(table.status),
    index("reports_reported_user_idx").on(table.reportedUserId),
  ],
);

/* ----------------------------------------------------------------- blocks */

export const blocks = pgTable(
  "blocks",
  {
    id: serial("id").primaryKey(),
    blockerId: integer("blocker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedId: integer("blocked_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: varchar("reason", { length: 160 }).notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("blocks_pair_uq").on(table.blockerId, table.blockedId)],
);

/* --------------------------------------------------------- notifications */

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 40 }).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    body: text("body").notNull().default(""),
    rideId: integer("ride_id"),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("notifications_user_idx").on(table.userId)],
);

export const reviews = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id"),
    reviewerId: integer("reviewer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    revieweeId: integer("reviewee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull().default(5),
    comment: text("comment").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("reviews_reviewee_idx").on(table.revieweeId)],
);

export type UserRow = typeof users.$inferSelect;
export type AuthSessionRow = typeof authSessions.$inferSelect;
export type RideRow = typeof rides.$inferSelect;
export type BookingRow = typeof bookings.$inferSelect;
export type PaymentRow = typeof payments.$inferSelect;
export type DriverEarningRow = typeof driverEarnings.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;
export type ReviewRow = typeof reviews.$inferSelect;
export type ReportRow = typeof reports.$inferSelect;

/* ---------------------------------------------------------------- audit log */

export const auditLog = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    actorId: integer("actor_id")
      .notNull()
      .references(() => users.id),
    action: varchar("action", { length: 60 }).notNull(),
    targetType: varchar("target_type", { length: 30 }).notNull().default(""),
    targetId: integer("target_id"),
    details: text("details").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_log_actor_idx").on(table.actorId),
    index("audit_log_created_idx").on(table.createdAt),
  ],
);
export type StudentVerificationRow = typeof studentVerifications.$inferSelect;
export type DriverVerificationRow = typeof driverVerifications.$inferSelect;
export type BlockRow = typeof blocks.$inferSelect;
