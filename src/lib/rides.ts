import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, notifications, reviews, rides, users } from "@/db/schema";
import type { BookingRow, UserRow } from "@/db/schema";
import { maskPhone, userPhone } from "@/lib/auth";
import { notify } from "@/lib/notify";
import type {
  Booking,
  DriverSummary,
  NotificationItem,
  PublicRideSummary,
  ReviewItem,
  Ride,
} from "@/lib/types";

export { notify };

type RideWithDriverRow = {
  ride: typeof rides.$inferSelect;
  driver: UserRow;
};

export function driverSummary(driver: UserRow, revealPhone: boolean): DriverSummary {
  return {
    id: driver.id,
    fullName: driver.fullName,
    college: driver.college,
    avatarColor: driver.avatarColor,
    verified: driver.verified,
    rating:
      driver.ratingCount > 0
        ? Math.round((driver.ratingSum / driver.ratingCount) * 10) / 10
        : 0,
    ratingCount: driver.ratingCount,
    ridesCompleted: driver.ridesCompleted,
    phone: revealPhone ? driver.phone : maskPhone(driver.phone),
    gender: driver.gender,
  };
}

/**
 * Serialises a ride for public listing.
 * Privacy: exact via-stops are only shared once a booking is confirmed —
 * before that students only see the pickup area and destination.
 */
export function serializeRide(row: RideWithDriverRow, revealPhone = false, revealStops = false): Ride {
  const { ride, driver } = row;
  const stops = ride.routeStops
    ? ride.routeStops.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  return {
    id: ride.id,
    driverId: ride.driverId,
    direction: ride.direction,
    fromLocation: ride.fromLocation,
    toLocation: ride.toLocation,
    routeStops: revealStops ? stops : stops.slice(0, 1),
    travelDate: ride.travelDate,
    departureTime: ride.departureTime,
    vehicleType: ride.vehicleType,
    vehicleModel: ride.vehicleModel,
    seatsTotal: ride.seatsTotal,
    seatsAvailable: ride.seatsAvailable,
    pricePerSeat: ride.pricePerSeat,
    preferredGender: ride.preferredGender,
    notes: ride.notes,
    status: ride.status,
    driver: driverSummary(driver, revealPhone),
  };
}

export function serializePublicRide(ride: typeof rides.$inferSelect, driver: UserRow): PublicRideSummary {
  return {
    id: ride.id,
    driverId: ride.driverId,
    fromLocation: ride.fromLocation,
    toLocation: ride.toLocation,
    travelDate: ride.travelDate,
    departureTime: ride.departureTime,
    vehicleType: ride.vehicleType,
    vehicleModel: ride.vehicleModel,
    pricePerSeat: ride.pricePerSeat,
    status: ride.status,
    direction: ride.direction,
    driverName: driver.fullName,
    driverColor: driver.avatarColor,
    driverVerified: driver.verified,
  };
}

export async function fetchRidesWithDrivers(): Promise<RideWithDriverRow[]> {
  return db
    .select({ ride: rides, driver: users })
    .from(rides)
    .innerJoin(users, eq(rides.driverId, users.id))
    .orderBy(desc(rides.departureTime));
}

export async function fetchRideById(id: number): Promise<RideWithDriverRow | null> {
  const rows = await db
    .select({ ride: rides, driver: users })
    .from(rides)
    .innerJoin(users, eq(rides.driverId, users.id))
    .where(eq(rides.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/** Riders must not be able to unlock contact details they are not entitled to. */
export function canRevealContact(booking: BookingRow): boolean {
  return booking.contactUnlocked && (booking.status === "ACCEPTED" || booking.status === "COMPLETED");
}

export function serializeNotification(row: typeof notifications.$inferSelect): NotificationItem {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    rideId: row.rideId,
    read: row.read,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function serializeBookings(userId: number): Promise<Booking[]> {
  const rows = await db
    .select({ booking: bookings, ride: rides })
    .from(bookings)
    .innerJoin(rides, eq(bookings.rideId, rides.id))
    .orderBy(desc(bookings.createdAt));

  const relevant = rows.filter((r) => r.ride.driverId === userId || r.booking.riderId === userId);
  if (relevant.length === 0) return [];

  const userIds = Array.from(
    new Set(relevant.flatMap((r) => [r.ride.driverId, r.booking.riderId])),
  );
  const userRows = userIds.length
    ? await db.select().from(users).where(inArray(users.id, userIds))
    : [];
  const userById = new Map(userRows.map((u) => [u.id, u]));

  const blockedRows = await db.execute(
    sql`select blocker_id, blocked_id from blocks where blocker_id = ${userId} or blocked_id = ${userId}`,
  );
  const blockedSet = new Set<string>();
  for (const row of blockedRows.rows as Array<{ blocker_id: number; blocked_id: number }>) {
    blockedSet.add(`${row.blocker_id}-${row.blocked_id}`);
  }

  return relevant.map((row) => {
    const isMine = row.ride.driverId === userId;
    const otherId = isMine ? row.booking.riderId : row.ride.driverId;
    const other = userById.get(otherId);
    const blocked =
      blockedSet.has(`${userId}-${otherId}`) || blockedSet.has(`${otherId}-${userId}`);
    const reveal = canRevealContact(row.booking) && !blocked;
    return {
      id: row.booking.id,
      rideId: row.booking.rideId,
      seats: row.booking.seats,
      pickupPoint: row.booking.pickupPoint,
      message: row.booking.message,
      totalPrice: row.booking.totalPrice,
      status: row.booking.status,
      contactUnlocked: reveal,
      paymentStatus: row.booking.paymentStatus,
      paymentOrderId: row.booking.paymentOrderId,
      razorpayOrderId: row.booking.razorpayOrderId ?? row.booking.paymentOrderId,
      paymentId: row.booking.paymentId,
      razorpayPaymentId: row.booking.razorpayPaymentId ?? row.booking.paymentId,
      paymentAmount: row.booking.paymentAmount,
      totalAmount: row.booking.paymentAmount || row.booking.totalPrice,
      commissionAmount: row.booking.commissionAmount ?? Math.round((row.booking.paymentAmount || row.booking.totalPrice) * 0.03),
      driverAmount: row.booking.driverAmount ?? ((row.booking.paymentAmount || row.booking.totalPrice) - Math.round((row.booking.paymentAmount || row.booking.totalPrice) * 0.03)),
      paymentVerified: row.booking.paymentVerified,
      paymentExpiresAt: row.booking.paymentExpiresAt
        ? row.booking.paymentExpiresAt.toISOString()
        : null,
      refundId: row.booking.refundId,
      refundAmount: row.booking.refundAmount,
      cancelledAt: row.booking.cancelledAt ? row.booking.cancelledAt.toISOString() : null,
      cancelledBy: row.booking.cancelledBy,
      cancellationReason: row.booking.cancellationReason,
      createdAt: row.booking.createdAt.toISOString(),
      ride: {
        id: row.ride.id,
        driverId: row.ride.driverId,
        fromLocation: row.ride.fromLocation,
        toLocation: row.ride.toLocation,
        travelDate: row.ride.travelDate,
        departureTime: row.ride.departureTime,
        vehicleType: row.ride.vehicleType,
        vehicleModel: row.ride.vehicleModel,
        pricePerSeat: row.ride.pricePerSeat,
        status: row.ride.status,
        direction: row.ride.direction,
      },
      rideOwner: other
        ? driverSummary(other, reveal)
        : {
            id: otherId,
            fullName: blocked ? "Unavailable student" : "Student",
            college: "",
            avatarColor: "blue",
            verified: false,
            rating: 0,
            ratingCount: 0,
            ridesCompleted: 0,
            phone: "Not shared yet",
            gender: "prefer_not_say",
          },
      isMine,
    };
  });
}

export async function fetchReviewsFor(userId: number): Promise<ReviewItem[]> {
  const rows = await db
    .select({ review: reviews, reviewer: users })
    .from(reviews)
    .innerJoin(users, eq(reviews.reviewerId, users.id))
    .where(eq(reviews.revieweeId, userId))
    .orderBy(desc(reviews.createdAt))
    .limit(20);

  return rows.map((row) => ({
    id: row.review.id,
    rating: row.review.rating,
    comment: row.review.comment,
    createdAt: row.review.createdAt.toISOString(),
    reviewerName: row.reviewer.fullName,
    reviewerColor: row.reviewer.avatarColor,
  }));
}

/** Rides from drivers the viewer has blocked (or who blocked the viewer). */
export async function blockedDriverIds(userId: number): Promise<number[]> {
  const rows = await db.execute(
    sql`select blocker_id, blocked_id from blocks where blocker_id = ${userId} or blocked_id = ${userId}`,
  );
  const ids: number[] = [];
  for (const row of rows.rows as Array<{ blocker_id: number; blocked_id: number }>) {
    ids.push(row.blocker_id === userId ? row.blocked_id : row.blocker_id);
  }
  return Array.from(new Set(ids));
}
