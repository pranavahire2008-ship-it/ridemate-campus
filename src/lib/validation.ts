import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5, "Enter a valid email")
  .max(160)
  .email("Enter a valid email");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long");

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[0-9+\-\s]{6,20}$/, "Enter a valid phone number");

export const SignUpSchema = z.object({
  fullName: z.string().trim().min(3, "Enter your full name").max(120),
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema.optional().or(z.literal("")),
  college: z.string().trim().min(2, "Select your college").max(160),
  studentId: z.string().trim().min(4, "Student ID is required").max(60),
  homeLocation: z.string().trim().max(120).optional().or(z.literal("")),
  gender: z.enum(["prefer_not_say", "female", "male"]).default("prefer_not_say"),
});

export const LoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(128),
});

export const VEHICLE_TYPES = ["bike", "scooter", "car"] as const;
export const DIRECTIONS = ["home_to_college", "college_to_home"] as const;
export const GENDERS = ["any", "female", "male"] as const;

export const CreateRideSchema = z.object({
  direction: z.enum(DIRECTIONS),
  fromLocation: z.string().trim().min(2, "Starting location is required").max(120),
  toLocation: z.string().trim().min(2, "Destination is required").max(120),
  routeStops: z.string().trim().max(400).optional().default(""),
  travelDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  departureTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid time"),
  vehicleType: z.enum(VEHICLE_TYPES),
  vehicleModel: z.string().trim().max(80).optional().default(""),
  seatsTotal: z.coerce.number().int().min(1).max(4),
  pricePerSeat: z.coerce.number().int().min(0).max(2000),
  preferredGender: z.enum(GENDERS).default("any"),
  notes: z.string().trim().max(500).optional().default(""),
});

/** Booking request — note that no price or amount is accepted from the client. */
export const CreateBookingSchema = z.object({
  rideId: z.coerce.number().int().positive(),
  seats: z.coerce.number().int().min(1).max(4),
  pickupPoint: z.string().trim().min(2, "Choose a pickup point").max(160),
  message: z.string().trim().max(400).optional().default(""),
});

export const CreatePaymentSchema = CreateBookingSchema;

/**
 * Only a genuine Razorpay Checkout response is accepted.
 * `outcome` / `simToken` style fields were removed so no client can assert
 * a successful payment without a real razorpay_signature.
 */
export const VerifyPaymentSchema = z.object({
  orderId: z.string().trim().min(6).max(80),
  razorpayPaymentId: z.string().trim().min(6).max(80),
  razorpayOrderId: z.string().trim().max(80).optional(),
  razorpaySignature: z.string().trim().min(16).max(256),
});

export const BookingActionSchema = z.object({
  action: z.enum(["accept", "reject", "cancel", "complete"]),
  reason: z.string().trim().max(240).optional(),
});

export const RideActionSchema = z.object({
  action: z.enum(["cancel", "complete", "addSeats", "update"]),
  seatsAvailable: z.coerce.number().int().min(0).max(4).optional(),
  pricePerSeat: z.coerce.number().int().min(0).max(2000).optional(),
});

export const CancelBookingSchema = z.object({
  reason: z.string().trim().max(240).optional().default(""),
});

export const RefundRequestSchema = z.object({
  bookingId: z.coerce.number().int().positive(),
  reason: z.string().trim().max(240).optional().default(""),
});

export const ProfileUpdateSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  phone: phoneSchema.optional().or(z.literal("")),
  college: z.string().trim().min(2).max(160),
  homeLocation: z.string().trim().max(120).optional().or(z.literal("")),
  studentId: z.string().trim().max(60).optional().or(z.literal("")),
  gender: z.enum(["prefer_not_say", "female", "male"]).default("prefer_not_say"),
});

export const ReviewSchema = z.object({
  revieweeId: z.coerce.number().int().positive(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(400).optional().default(""),
});

export const REPORT_REASONS = [
  "fake_account",
  "unsafe_behaviour",
  "harassment",
  "payment_issue",
  "other",
] as const;

export const ReportSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(600).optional().default(""),
  reportedUserId: z.coerce.number().int().positive().optional(),
  rideId: z.coerce.number().int().positive().optional(),
});

export const BlockSchema = z.object({
  blockedUserId: z.coerce.number().int().positive(),
  reason: z.string().trim().max(160).optional().default(""),
  action: z.enum(["block", "unblock"]).default("block"),
});

export const RideSearchSchema = z.object({
  from: z.string().trim().max(120).optional(),
  to: z.string().trim().max(120).optional(),
  direction: z.enum(DIRECTIONS).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
  seats: z.coerce.number().int().min(1).max(4).optional(),
});

export type SignUpInput = z.infer<typeof SignUpSchema>;
export type CreateRideInput = z.infer<typeof CreateRideSchema>;
export type CreateBookingInput = z.infer<typeof CreateBookingSchema>;

/** Formats a ZodError into a single safe, user-facing message. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid request.";
}
