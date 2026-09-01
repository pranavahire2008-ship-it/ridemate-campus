export type DriverSummary = {
  id: number;
  fullName: string;
  college: string;
  avatarColor: string;
  verified: boolean;
  rating: number;
  ratingCount: number;
  ridesCompleted: number;
  phone: string;
  gender: string;
};

export type Ride = {
  id: number;
  driverId: number;
  direction: string;
  fromLocation: string;
  toLocation: string;
  routeStops: string[];
  travelDate: string;
  departureTime: string;
  vehicleType: string;
  vehicleModel: string;
  seatsTotal: number;
  seatsAvailable: number;
  pricePerSeat: number;
  preferredGender: string;
  notes: string;
  status: string;
  driver: DriverSummary;
};

export type MatchInfo = {
  score: number;
  pickupKm: number;
  dropKm: number;
  minutesDiff: number;
  reason: string;
};

export type MatchedRide = Ride & { match: MatchInfo };

export type BookingRideSummary = {
  id: number;
  driverId: number;
  fromLocation: string;
  toLocation: string;
  travelDate: string;
  departureTime: string;
  vehicleType: string;
  vehicleModel: string;
  pricePerSeat: number;
  status: string;
  direction: string;
};

export type Booking = {
  id: number;
  rideId: number;
  seats: number;
  pickupPoint: string;
  message: string;
  totalPrice: number;
  status: string;
  contactUnlocked: boolean;
  paymentStatus: string;
  paymentOrderId: string | null;
  razorpayOrderId: string | null;
  paymentId: string | null;
  razorpayPaymentId: string | null;
  paymentAmount: number;
  totalAmount: number;
  commissionAmount: number;
  driverAmount: number;
  paymentVerified: boolean;
  paymentExpiresAt: string | null;
  refundId: string | null;
  refundAmount: number;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  createdAt: string;
  ride: BookingRideSummary;
  rideOwner: DriverSummary;
  isMine: boolean;
};

export type NotificationItem = {
  id: number;
  type: string;
  title: string;
  body: string;
  rideId: number | null;
  read: boolean;
  createdAt: string;
};

export type ReviewItem = {
  id: number;
  rating: number;
  comment: string;
  createdAt: string;
  reviewerName: string;
  reviewerColor: string;
};

export type PublicUserDTO = {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  college: string;
  studentId: string;
  gender: string;
  homeLocation: string;
  avatarColor: string;
  verified: boolean;
  verificationStatus: string;
  role: string;
  rating: number;
  ratingCount: number;
  ridesCompleted: number;
};

export type PublicRideSummary = {
  id: number;
  driverId: number;
  fromLocation: string;
  toLocation: string;
  travelDate: string;
  departureTime: string;
  vehicleType: string;
  vehicleModel: string;
  pricePerSeat: number;
  status: string;
  direction: string;
  driverName: string;
  driverColor: string;
  driverVerified: boolean;
};

export type PaymentOrderDTO = {
  bookingId: number;
  rideId: number;
  orderId: string;
  razorpayOrderId?: string;
  amount: number;
  totalAmount: number;
  commissionAmount: number;
  driverAmount: number;
  currency: string;
  /** Always "razorpay" — the simulator payment mode was removed. */
  mode: "razorpay";
  /** PUBLIC Razorpay Key ID only. The key secret never reaches the browser. */
  keyId: string | null;
  expiresAt: string;
  seats: number;
  pickupPoint: string;
  prefill: { name: string; email: string; contact: string };
  message: string;
};

export type PaymentHistoryItemDTO = {
  id: number;
  orderId: string;
  razorpayOrderId: string | null;
  paymentId: string | null;
  razorpayPaymentId: string | null;
  amount: number;
  totalAmount: number;
  commissionAmount: number;
  driverAmount: number;
  currency: string;
  status: string;
  verified: boolean;
  refundId: string | null;
  refundAmount: number;
  refundStatus: string | null;
  provider: string;
  createdAt: string;
  bookingId: number;
  bookingStatus: string;
  rideId: number;
  route: string;
  travelDate: string;
  departureTime: string;
  seats: number;
};

export type BlockItemDTO = {
  id: number;
  blockedUserId: number;
  blockedUserName: string;
  blockedUserColor: string;
  reason: string;
  createdAt: string;
};

export type DriverEarningItemDTO = {
  id: number;
  bookingId: number;
  rideId: number;
  driverId: number;
  driverName?: string;
  driverCollege?: string;
  route: string;
  travelDate: string;
  departureTime: string;
  riderName: string;
  seats: number;
  totalFare: number;
  commissionAmount: number;
  driverEarning: number;
  status: string; // PENDING | AVAILABLE | PAYOUT_PROCESSING | PAID_OUT | CANCELLED
  payoutId: string | null;
  payoutMethod: string;
  paidOutAt: string | null;
  createdAt: string;
};

export type DriverEarningsSummaryDTO = {
  totalEarnings: number;
  pendingEarnings: number;
  availablePayout: number;
  totalCommission: number;
  paidOutAmount: number;
  earnings: DriverEarningItemDTO[];
};
