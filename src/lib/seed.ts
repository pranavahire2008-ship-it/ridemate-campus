import { sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, notifications, payments, reviews, rides, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";

function dayOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Demo rides must never look stale: a morning ride listed "today" is only
 * seeded for today when it has not departed yet, otherwise it rolls to
 * tomorrow so the marketplace always has bookable rides.
 */
function dayForTime(time: string): string {
  const today = dayOffset(0);
  const departure = new Date(`${today}T${time}:00`);
  if (!Number.isNaN(departure.getTime()) && departure.getTime() > Date.now() + 30 * 60 * 1000) {
    return today;
  }
  return dayOffset(1);
}

type SeedUser = {
  role?: "STUDENT" | "ADMIN";
  fullName: string;
  email: string;
  phone: string;
  college: string;
  studentId: string;
  gender: string;
  homeLocation: string;
  avatarColor: string;
  ratingSum: number;
  ratingCount: number;
  ridesCompleted: number;
};

const DEMO_EMAIL = "aarav@mitcollege.edu";
const DEMO_PASSWORD = "ridemate123";

const seedUsers: SeedUser[] = [
  {
    role: "ADMIN",
    fullName: "Campus Safety Admin",
    email: "admin@ridematecampus.in",
    phone: "9822000000",
    college: "RideMate Campus Safety Desk",
    studentId: "ADMIN0001",
    gender: "prefer_not_say",
    homeLocation: "Shivajinagar",
    avatarColor: "blue",
    ratingSum: 0,
    ratingCount: 0,
    ridesCompleted: 0,
  },
  {
    fullName: "Aarav Kulkarni",
    email: DEMO_EMAIL,
    phone: "9822011234",
    college: "MIT College, Kothrud",
    studentId: "MIT2022CS1042",
    gender: "male",
    homeLocation: "Kothrud",
    avatarColor: "blue",
    ratingSum: 48,
    ratingCount: 10,
    ridesCompleted: 14,
  },
  {
    fullName: "Aditya Sharma",
    email: "aditya.sharma@mitcollege.edu",
    phone: "9822034567",
    college: "MIT College, Kothrud",
    studentId: "MIT2021ME2210",
    gender: "male",
    homeLocation: "Kothrud",
    avatarColor: "green",
    ratingSum: 57,
    ratingCount: 12,
    ridesCompleted: 22,
  },
  {
    fullName: "Priya Deshmukh",
    email: "priya.d@mitcollege.edu",
    phone: "9822098765",
    college: "MIT College, Kothrud",
    studentId: "MIT2022IT1177",
    gender: "female",
    homeLocation: "Warje",
    avatarColor: "violet",
    ratingSum: 44,
    ratingCount: 9,
    ridesCompleted: 11,
  },
  {
    fullName: "Rohan Patil",
    email: "rohan.p@cummins.edu",
    phone: "9822044556",
    college: "Cummins College, Karve Nagar",
    studentId: "CUM2023EC3311",
    gender: "male",
    homeLocation: "Karve Nagar",
    avatarColor: "amber",
    ratingSum: 39,
    ratingCount: 8,
    ridesCompleted: 9,
  },
  {
    fullName: "Sneha Joshi",
    email: "sneha.j@pict.edu",
    phone: "9822066778",
    college: "PICT, Katraj",
    studentId: "PICT2022CS0091",
    gender: "female",
    homeLocation: "Katraj",
    avatarColor: "rose",
    ratingSum: 50,
    ratingCount: 10,
    ridesCompleted: 16,
  },
  {
    fullName: "Kabir Shaikh",
    email: "kabir.s@indira.edu",
    phone: "9822011456",
    college: "Indira College, Wakad",
    studentId: "ICEM2021MKT554",
    gender: "male",
    homeLocation: "Baner",
    avatarColor: "teal",
    ratingSum: 42,
    ratingCount: 9,
    ridesCompleted: 12,
  },
  {
    fullName: "Ishita Rao",
    email: "ishita.rao@symbiosis.edu",
    phone: "9822088990",
    college: "Symbiosis, Viman Nagar",
    studentId: "SCAC2022BA013",
    gender: "female",
    homeLocation: "Kalyani Nagar",
    avatarColor: "violet",
    ratingSum: 33,
    ratingCount: 7,
    ridesCompleted: 7,
  },
  {
    fullName: "Vikram Nair",
    email: "vikram.n@mitwpu.edu",
    phone: "9822077331",
    college: "MIT WPU, Kothrud",
    studentId: "WPU2020EN4412",
    gender: "male",
    homeLocation: "Hinjewadi",
    avatarColor: "blue",
    ratingSum: 46,
    ratingCount: 10,
    ridesCompleted: 18,
  },
  {
    fullName: "Sameer Gaikwad",
    email: "sameer.g@coep.tech",
    phone: "9822055221",
    college: "COEP Tech University",
    studentId: "COEP2021CV2204",
    gender: "male",
    homeLocation: "Shivajinagar",
    avatarColor: "green",
    ratingSum: 36,
    ratingCount: 8,
    ridesCompleted: 10,
  },
  {
    fullName: "Neha Bhosale",
    email: "neha.b@dypatil.edu",
    phone: "9822033221",
    college: "DY Patil, Pimpri",
    studentId: "DYP2022CS8890",
    gender: "female",
    homeLocation: "Pimpri",
    avatarColor: "amber",
    ratingSum: 28,
    ratingCount: 6,
    ridesCompleted: 6,
  },
  {
    fullName: "Diya Kapoor",
    email: "diya.k@symbiosis.edu",
    phone: "9822099112",
    college: "Symbiosis, Viman Nagar",
    studentId: "SCAC2023BA771",
    gender: "female",
    homeLocation: "Kharadi",
    avatarColor: "rose",
    ratingSum: 25,
    ratingCount: 5,
    ridesCompleted: 5,
  },
  {
    fullName: "Mihir Deshpande",
    email: "mihir.d@indira.edu",
    phone: "9822011239",
    college: "Indira College, Wakad",
    studentId: "ICEM2023FIN112",
    gender: "male",
    homeLocation: "Wakad",
    avatarColor: "teal",
    ratingSum: 30,
    ratingCount: 6,
    ridesCompleted: 8,
  },
];

type SeedRide = {
  email: string;
  direction: string;
  fromLocation: string;
  toLocation: string;
  routeStops: string;
  departureTime: string;
  vehicleType: string;
  vehicleModel: string;
  seatsTotal: number;
  seatsAvailable: number;
  pricePerSeat: number;
  preferredGender: string;
  notes: string;
};

function ridesFor(yesterday: string): SeedRide[] {
  return [
    {
      email: "aditya.sharma@mitcollege.edu",
      direction: "home_to_college",
      fromLocation: "Kothrud",
      toLocation: "MIT College, Kothrud",
      routeStops: "Kothrud Depot,Paud Road,Damle Path,MIT College",
      departureTime: "08:00",
      vehicleType: "scooter",
      vehicleModel: "Honda Activa 6G",
      seatsTotal: 1,
      seatsAvailable: 1,
      pricePerSeat: 25,
      preferredGender: "any",
      notes: "I leave from Kothrud at 8:00 AM sharp and can pick students travelling towards MIT College.",
    },
    {
      email: "priya.d@mitcollege.edu",
      direction: "home_to_college",
      fromLocation: "Warje",
      toLocation: "MIT College, Kothrud",
      routeStops: "Warje Bridge,Karve Road,Nal Stop,MIT College",
      departureTime: "08:15",
      vehicleType: "car",
      vehicleModel: "Maruti Swift",
      seatsTotal: 3,
      seatsAvailable: 3,
      pricePerSeat: 40,
      preferredGender: "any",
      notes: "Daily college-goer via Karve Road. Music friendly, AC on request.",
    },
    {
      email: "rohan.p@cummins.edu",
      direction: "college_to_home",
      fromLocation: "MIT College, Kothrud",
      toLocation: "Kothrud",
      routeStops: "MIT College,Paud Road,Mayur Colony,Kothrud",
      departureTime: "17:30",
      vehicleType: "car",
      vehicleModel: "Hyundai i20",
      seatsTotal: 2,
      seatsAvailable: 2,
      pricePerSeat: 30,
      preferredGender: "any",
      notes: "Leaving right after the last lecture. Can drop anywhere on Paud Road.",
    },
    {
      email: "vikram.n@mitwpu.edu",
      direction: "home_to_college",
      fromLocation: "Hinjewadi",
      toLocation: "MIT WPU, Kothrud",
      routeStops: "Hinjewadi Phase 1,Balewadi,Baner,Paud Road,MIT WPU",
      departureTime: "07:45",
      vehicleType: "car",
      vehicleModel: "Tata Nexon",
      seatsTotal: 2,
      seatsAvailable: 2,
      pricePerSeat: 60,
      preferredGender: "any",
      notes: "IT professional by day, student by evening. Comfortable sedan.",
    },
    {
      email: "sneha.j@pict.edu",
      direction: "home_to_college",
      fromLocation: "Katraj",
      toLocation: "PICT, Katraj",
      routeStops: "Katraj Chowk,Bharati Vidyapeeth,PICT Gate",
      departureTime: "08:20",
      vehicleType: "scooter",
      vehicleModel: "TVS Jupiter",
      seatsTotal: 1,
      seatsAvailable: 1,
      pricePerSeat: 15,
      preferredGender: "female",
      notes: "Short ride but saves a 20 minute walk. Helmet compulsory.",
    },
    {
      email: "kabir.s@indira.edu",
      direction: "home_to_college",
      fromLocation: "Baner",
      toLocation: "Indira College, Wakad",
      routeStops: "Baner Road,Balewadi Phata,Wakad Bridge,Indira College",
      departureTime: "08:05",
      vehicleType: "car",
      vehicleModel: "Maruti Baleno",
      seatsTotal: 3,
      seatsAvailable: 3,
      pricePerSeat: 50,
      preferredGender: "any",
      notes: "Punctual departure. Pick up near Baner Road signal.",
    },
    {
      email: "ishita.rao@symbiosis.edu",
      direction: "home_to_college",
      fromLocation: "Kalyani Nagar",
      toLocation: "Symbiosis, Viman Nagar",
      routeStops: "Kalyani Nagar Junction,Yerawada,Viman Nagar,Symbiosis",
      departureTime: "09:00",
      vehicleType: "scooter",
      vehicleModel: "Honda Dio",
      seatsTotal: 1,
      seatsAvailable: 1,
      pricePerSeat: 20,
      preferredGender: "female",
      notes: "Late morning batch, so a relaxed 9 AM start.",
    },
    {
      email: "sameer.g@coep.tech",
      direction: "home_to_college",
      fromLocation: "Shivajinagar",
      toLocation: "COEP Tech University",
      routeStops: "Shivajinagar Stand,Modern College,COEP Boat Club Road",
      departureTime: "08:50",
      vehicleType: "car",
      vehicleModel: "Toyota Etios",
      seatsTotal: 3,
      seatsAvailable: 2,
      pricePerSeat: 25,
      preferredGender: "any",
      notes: "Drive via Jangli Maharaj Road, quick 10 minute run.",
    },
    {
      email: "neha.b@dypatil.edu",
      direction: "home_to_college",
      fromLocation: "Pimpri",
      toLocation: "DY Patil, Pimpri",
      routeStops: "Pimpri Market,Morwadi,DY Patil Campus",
      departureTime: "09:10",
      vehicleType: "scooter",
      vehicleModel: "Suzuki Access",
      seatsTotal: 1,
      seatsAvailable: 1,
      pricePerSeat: 20,
      preferredGender: "any",
      notes: "Second shift student. Very short hop, super cheap.",
    },
    {
      email: "diya.k@symbiosis.edu",
      direction: "home_to_college",
      fromLocation: "Kharadi",
      toLocation: "Symbiosis, Viman Nagar",
      routeStops: "Kharadi Bypass,Chandan Nagar,Viman Nagar,Symbiosis",
      departureTime: "08:35",
      vehicleType: "car",
      vehicleModel: "Hyundai i10",
      seatsTotal: 2,
      seatsAvailable: 2,
      pricePerSeat: 30,
      preferredGender: "any",
      notes: "Car pool from Kharadi every weekday. Two seats free.",
    },
    {
      email: "mihir.d@indira.edu",
      direction: "home_to_college",
      fromLocation: "Wakad",
      toLocation: "Indira College, Wakad",
      routeStops: "Wakad Bridge,Kalewadi Phata,Indira College",
      departureTime: "08:00",
      vehicleType: "bike",
      vehicleModel: "Bajaj Pulsar 150",
      seatsTotal: 1,
      seatsAvailable: 1,
      pricePerSeat: 20,
      preferredGender: "male",
      notes: "Fast rider but very safe. Only one pillion seat.",
    },
    {
      email: "rohan.p@cummins.edu",
      direction: "home_to_college",
      fromLocation: "Karve Nagar",
      toLocation: "MIT College, Kothrud",
      routeStops: "Karve Nagar,Anand Nagar,Paud Road,MIT College",
      departureTime: "08:10",
      vehicleType: "car",
      vehicleModel: "Hyundai i20",
      seatsTotal: 3,
      seatsAvailable: 1,
      pricePerSeat: 35,
      preferredGender: "any",
      notes: "Two seats already booked by classmates, one left.",
    },
    {
      email: "aditya.sharma@mitcollege.edu",
      direction: "college_to_home",
      fromLocation: "MIT College, Kothrud",
      toLocation: "Warje",
      routeStops: "MIT College,Nal Stop,Karve Road,Warje",
      departureTime: "17:15",
      vehicleType: "scooter",
      vehicleModel: "Honda Activa 6G",
      seatsTotal: 1,
      seatsAvailable: 1,
      pricePerSeat: 25,
      preferredGender: "any",
      notes: "Evening return trip after the lab session.",
    },
    {
      email: "sameer.g@coep.tech",
      direction: "college_to_home",
      fromLocation: "COEP Tech University",
      toLocation: "Shivajinagar",
      routeStops: "COEP,Boat Club Road,Modern College,Shivajinagar",
      departureTime: "18:00",
      vehicleType: "car",
      vehicleModel: "Toyota Etios",
      seatsTotal: 3,
      seatsAvailable: 3,
      pricePerSeat: 25,
      preferredGender: "any",
      notes: "Evening drop to Shivajinagar after project work.",
    },
  ];
}

let seedPromise: Promise<void> | null = null;

async function runSeed(): Promise<void> {
  // Marketplace freshness: any active ride whose departure moment has passed
  // rolls to the next day so students always see bookable rides.
  await db.execute(
    sql`update rides
        set travel_date = to_char((now() + interval '1 day')::date, 'YYYY-MM-DD')
        where status = 'active'
          and (travel_date || ' ' || departure_time)::timestamp < now()`,
  );

  const existing = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  const userCount = existing[0]?.count ?? 0;
  if (userCount === 0) {
    const password = hashPassword(DEMO_PASSWORD);
    await db
      .insert(users)
      .values(
        seedUsers.map((u) => ({
          fullName: u.fullName,
          email: u.email,
          passwordHash: password,
          phone: u.phone,
          phoneNumber: u.phone,
          college: u.college,
          studentId: u.studentId,
          gender: u.gender,
          homeLocation: u.homeLocation,
          avatarColor: u.avatarColor,
          verified: u.role !== "ADMIN",
          verificationStatus: u.role === "ADMIN" ? "VERIFIED" : "VERIFIED",
          role: u.role ?? "STUDENT",
          ratingSum: u.ratingSum,
          ratingCount: u.ratingCount,
          ridesCompleted: u.ridesCompleted,
        })),
      )
      .onConflictDoNothing();
  }

  const rideCountRows = await db.select({ count: sql<number>`count(*)::int` }).from(rides);
  const rideCount = rideCountRows[0]?.count ?? 0;
  if (rideCount > 0) return;

  const userRows = await db.select().from(users);
  const byEmail = new Map(userRows.map((u) => [u.email, u]));
  const yesterday = dayOffset(-1);

  const seedRides = ridesFor(yesterday);
  const rideValues = seedRides
    .map((r) => {
      const driver = byEmail.get(r.email);
      if (!driver) return null;
      return {
        driverId: driver.id,
        direction: r.direction,
        fromLocation: r.fromLocation,
        toLocation: r.toLocation,
        travelDate: dayForTime(r.departureTime),
        routeStops: r.routeStops,
        departureTime: r.departureTime,
        vehicleType: r.vehicleType,
        vehicleModel: r.vehicleModel,
        seatsTotal: r.seatsTotal,
        seatsAvailable: r.seatsAvailable,
        pricePerSeat: r.pricePerSeat,
        preferredGender: r.preferredGender,
        notes: r.notes,
        status: "active",
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  const insertedRides = await db.insert(rides).values(rideValues).returning();
  const insertedByDriver = new Map<string, number>();
  insertedRides.forEach((ride) => {
    const driver = userRows.find((u) => u.id === ride.driverId);
    if (driver) insertedByDriver.set(`${driver.email}-${ride.travelDate}-${ride.departureTime}`, ride.id);
  });

  const demo = byEmail.get(DEMO_EMAIL);
  const aditya = byEmail.get("aditya.sharma@mitcollege.edu");
  const priya = byEmail.get("priya.d@mitcollege.edu");
  const rohan = byEmail.get("rohan.p@cummins.edu");

  if (demo) {
    // Ride offered by the demo student.
    const myRide = await db
      .insert(rides)
      .values({
        driverId: demo.id,
        direction: "home_to_college",
        fromLocation: "Kothrud",
        toLocation: "MIT College, Kothrud",
        routeStops: "Kothrud Depot,Paud Road,Damle Path,MIT College",
        travelDate: dayForTime("07:50"),
        departureTime: "07:50",
        vehicleType: "scooter",
        vehicleModel: "TVS Ntorq",
        seatsTotal: 1,
        seatsAvailable: 1,
        pricePerSeat: 20,
        preferredGender: "any",
        notes: "I leave from Kothrud at 7:50 AM and can pick students travelling towards MIT College.",
        status: "active",
      })
      .returning();

    const myRideId = myRide[0]?.id;

    // A completed ride in history.
    const completedRide = await db
      .insert(rides)
      .values({
        driverId: demo.id,
        direction: "college_to_home",
        fromLocation: "MIT College, Kothrud",
        toLocation: "Kothrud",
        routeStops: "MIT College,Paud Road,Mayur Colony",
        travelDate: yesterday,
        departureTime: "17:30",
        vehicleType: "scooter",
        vehicleModel: "TVS Ntorq",
        seatsTotal: 1,
        seatsAvailable: 0,
        pricePerSeat: 20,
        preferredGender: "any",
        notes: "Completed ride.",
        status: "completed",
      })
      .returning();

    const adityaRideId = aditya
      ? insertedByDriver.get(`${aditya.email}-${dayForTime("08:00")}-08:00`)
      : undefined;
    const priyaRideId = priya
      ? insertedByDriver.get(`${priya.email}-${dayForTime("08:15")}-08:15`)
      : undefined;

    if (myRideId && rohan) {
      const paidRequest = await db
        .insert(bookings)
        .values({
          rideId: myRideId,
          riderId: rohan.id,
          seats: 1,
          pickupPoint: "Kothrud Depot",
          message: "Hi! I am at Karve Nagar, can you pick me up near Kothrud Depot?",
          totalPrice: 20,
          status: "pending",
          contactUnlocked: false,
          paymentStatus: "PAID",
          paymentOrderId: `order_seed_${myRideId}_rohan`,
          paymentId: "pay_seed_rohan_001",
          paymentAmount: 20,
          paymentVerified: true,
          paymentVerifiedAt: new Date(),
        })
        .returning();
      if (paidRequest[0]) {
        await db.insert(payments).values({
          bookingId: paidRequest[0].id,
          userId: rohan.id,
          provider: "razorpay",
          orderId: `order_seed_${myRideId}_rohan`,
          paymentId: "pay_seed_rohan_001",
          amount: 20,
          status: "PAID",
          verified: true,
          verifiedAt: new Date(),
        });
      }
    }

    if (adityaRideId) {
      const paidBooking = await db
        .insert(bookings)
        .values({
          rideId: adityaRideId,
          riderId: demo.id,
          seats: 1,
          pickupPoint: "Kothrud Depot",
          message: "Heading to MIT for the 8:30 lecture, perfect timing!",
          totalPrice: 25,
          status: "accepted",
          contactUnlocked: true,
          paymentStatus: "PAID",
          paymentOrderId: `order_seed_${adityaRideId}_accepted`,
          paymentId: "pay_seed_accepted_001",
          paymentAmount: 25,
          paymentVerified: true,
          paymentVerifiedAt: new Date(),
        })
        .returning();
      if (paidBooking[0]) {
        await db.insert(payments).values({
          bookingId: paidBooking[0].id,
          userId: demo.id,
          provider: "razorpay",
          orderId: `order_seed_${adityaRideId}_accepted`,
          paymentId: "pay_seed_accepted_001",
          amount: 25,
          status: "PAID",
          verified: true,
          verifiedAt: new Date(),
        });
      }
    }

    if (priyaRideId) {
      const unpaidBooking = await db
        .insert(bookings)
        .values({
          rideId: priyaRideId,
          riderId: demo.id,
          seats: 2,
          pickupPoint: "Warje Bridge",
          message: "Two of us from Warje, are both seats free?",
          totalPrice: 80,
          status: "pending",
          contactUnlocked: false,
          paymentStatus: "PENDING",
          paymentOrderId: `order_seed_${priyaRideId}_pending`,
          paymentAmount: 80,
          paymentExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        })
        .returning();
      if (unpaidBooking[0]) {
        await db.insert(payments).values({
          bookingId: unpaidBooking[0].id,
          userId: demo.id,
          provider: "razorpay",
          orderId: `order_seed_${priyaRideId}_pending`,
          amount: 80,
          status: "PENDING",
        });
      }
    }

    if (completedRide[0]?.id && rohan) {
      const completedBooking = await db
        .insert(bookings)
        .values({
          rideId: completedRide[0].id,
          riderId: rohan.id,
          seats: 1,
          pickupPoint: "MIT College Gate",
          message: "Thanks for the ride!",
          totalPrice: 20,
          status: "completed",
          contactUnlocked: true,
          paymentStatus: "PAID",
          paymentOrderId: `order_seed_${completedRide[0].id}_done`,
          paymentId: "pay_seed_done_001",
          paymentAmount: 20,
          paymentVerified: true,
          paymentVerifiedAt: new Date(),
        })
        .returning();
      if (completedBooking[0]) {
        await db.insert(payments).values({
          bookingId: completedBooking[0].id,
          userId: rohan.id,
          provider: "razorpay",
          orderId: `order_seed_${completedRide[0].id}_done`,
          paymentId: "pay_seed_done_001",
          amount: 20,
          status: "PAID",
          verified: true,
          verifiedAt: new Date(),
        });
      }
      await db.insert(reviews).values({
        bookingId: null,
        reviewerId: rohan.id,
        revieweeId: demo.id,
        rating: 5,
        comment: "Very punctual and safe rider. Reached college in 15 minutes.",
      });
    }

    await db.insert(notifications).values([
      {
        userId: demo.id,
        type: "booking_request",
        title: "New booking request",
        body: "Rohan Patil requested 1 seat on your Kothrud → MIT College ride.",
        rideId: myRideId ?? null,
        read: false,
      },
      {
        userId: demo.id,
        type: "booking_accepted",
        title: "Booking accepted 🎉",
        body: "Aditya Sharma accepted your seat request. Contact details unlocked.",
        rideId: adityaRideId ?? null,
        read: false,
      },
      {
        userId: demo.id,
        type: "ride_reminder",
        title: "Ride reminder",
        body: "Your ride to MIT College is in a few hours. Keep your helmet ready.",
        rideId: adityaRideId ?? null,
        read: false,
      },
      {
        userId: demo.id,
        type: "route_match",
        title: "New matching route found",
        body: "Priya Deshmukh is travelling Warje → MIT College at 8:15 AM, 89% match.",
        rideId: priyaRideId ?? null,
        read: false,
      },
    ]);
  }
}

/**
 * In production (Vercel/Supabase), seeding is skipped entirely.
 * The database should be set up separately via migration scripts.
 * In local development, demo data is seeded on first request.
 */
export async function ensureSeeded(): Promise<void> {
  // Skip seeding on production/Supabase — tables are managed by migrations
  const dbUrl = process.env.DATABASE_URL ?? "";
  const isLocal = dbUrl.includes("127.0.0.1") || dbUrl.includes("localhost");
  if (!isLocal) return;

  if (!seedPromise) {
    seedPromise = runSeed().catch((error) => {
      seedPromise = null;
      console.error("[seed] failed:", error instanceof Error ? error.message : error);
      // Don't crash the request — seeding is optional
    });
  }
  return seedPromise;
}

export const DEMO_CREDENTIALS = {
  email: DEMO_EMAIL,
  password: DEMO_PASSWORD,
  fullName: "Aarav Kulkarni",
};
