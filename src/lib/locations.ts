export type Place = {
  name: string;
  lat: number;
  lng: number;
  kind: "locality" | "college";
};

export const LOCALITIES: Place[] = [
  { name: "Kothrud", lat: 18.5074, lng: 73.8077, kind: "locality" },
  { name: "Warje", lat: 18.4831, lng: 73.807, kind: "locality" },
  { name: "Karve Nagar", lat: 18.483, lng: 73.823, kind: "locality" },
  { name: "Erandwane", lat: 18.51, lng: 73.833, kind: "locality" },
  { name: "Bhandarkar Road", lat: 18.522, lng: 73.842, kind: "locality" },
  { name: "Deccan Gymkhana", lat: 18.518, lng: 73.839, kind: "locality" },
  { name: "Shivajinagar", lat: 18.5308, lng: 73.8475, kind: "locality" },
  { name: "Model Colony", lat: 18.525, lng: 73.837, kind: "locality" },
  { name: "Aundh", lat: 18.5642, lng: 73.8077, kind: "locality" },
  { name: "Baner", lat: 18.559, lng: 73.7868, kind: "locality" },
  { name: "Pashan", lat: 18.5755, lng: 73.8075, kind: "locality" },
  { name: "Wakad", lat: 18.5993, lng: 73.7626, kind: "locality" },
  { name: "Hinjewadi", lat: 18.5913, lng: 73.7389, kind: "locality" },
  { name: "Balewadi", lat: 18.5745, lng: 73.7635, kind: "locality" },
  { name: "Pimpri", lat: 18.6298, lng: 73.7997, kind: "locality" },
  { name: "Chinchwad", lat: 18.645, lng: 73.8, kind: "locality" },
  { name: "Nigdi", lat: 18.652, lng: 73.774, kind: "locality" },
  { name: "Katraj", lat: 18.457, lng: 73.86, kind: "locality" },
  { name: "Bibwewadi", lat: 18.464, lng: 73.866, kind: "locality" },
  { name: "Sinhagad Road", lat: 18.479, lng: 73.83, kind: "locality" },
  { name: "Sahakar Nagar", lat: 18.488, lng: 73.852, kind: "locality" },
  { name: "Swargate", lat: 18.501, lng: 73.86, kind: "locality" },
  { name: "Kalyani Nagar", lat: 18.546, lng: 73.89, kind: "locality" },
  { name: "Viman Nagar", lat: 18.567, lng: 73.914, kind: "locality" },
  { name: "Kharadi", lat: 18.551, lng: 73.9416, kind: "locality" },
  { name: "Hadapsar", lat: 18.56, lng: 73.93, kind: "locality" },
  { name: "Magarpatta City", lat: 18.5602, lng: 73.928, kind: "locality" },
  { name: "Wagholi", lat: 18.586, lng: 73.74, kind: "locality" },
  { name: "Mundhwa", lat: 18.552, lng: 73.897, kind: "locality" },
  { name: "Nanded City", lat: 18.464, lng: 73.806, kind: "locality" },
];

export const COLLEGES: Place[] = [
  { name: "MIT College, Kothrud", lat: 18.516, lng: 73.842, kind: "college" },
  { name: "MIT WPU, Kothrud", lat: 18.5124, lng: 73.8077, kind: "college" },
  { name: "COEP Tech University", lat: 18.5296, lng: 73.8564, kind: "college" },
  { name: "PICT, Katraj", lat: 18.455, lng: 73.86, kind: "college" },
  { name: "Cummins College, Karve Nagar", lat: 18.485, lng: 73.826, kind: "college" },
  { name: "VIT Pune, Bibwewadi", lat: 18.463, lng: 73.866, kind: "college" },
  { name: "Bharati Vidyapeeth, Katraj", lat: 18.4551, lng: 73.861, kind: "college" },
  { name: "Modern College, Shivajinagar", lat: 18.526, lng: 73.845, kind: "college" },
  { name: "AISSMS IOIT, Shivajinagar", lat: 18.525, lng: 73.858, kind: "college" },
  { name: "Symbiosis, Viman Nagar", lat: 18.566, lng: 73.916, kind: "college" },
  { name: "Indira College, Wakad", lat: 18.598, lng: 73.763, kind: "college" },
  { name: "DY Patil, Pimpri", lat: 18.625, lng: 73.806, kind: "college" },
];

export const ALL_PLACES: Place[] = [...LOCALITIES, ...COLLEGES];

export const VEHICLE_TYPES = [
  { value: "bike", label: "Bike", icon: "🏍️", seats: 1 },
  { value: "scooter", label: "Scooter", icon: "🛵", seats: 1 },
  { value: "car", label: "Car", icon: "🚗", seats: 4 },
] as const;

export type VehicleType = (typeof VEHICLE_TYPES)[number]["value"];

export function isVehicleType(value: string): value is VehicleType {
  return VEHICLE_TYPES.some((v) => v.value === value);
}

export function placeByName(name: string): Place | undefined {
  const clean = name.trim().toLowerCase();
  if (!clean) return undefined;
  return ALL_PLACES.find((p) => p.name.toLowerCase() === clean);
}

/** Fuzzy lookup so "kothrud " or "mit college" still resolves. */
export function resolvePlace(name: string): Place | undefined {
  const clean = name.trim().toLowerCase();
  if (!clean) return undefined;
  const exact = placeByName(clean);
  if (exact) return exact;
  const partial = ALL_PLACES.find(
    (p) => p.name.toLowerCase().includes(clean) || clean.includes(p.name.toLowerCase()),
  );
  return partial;
}

export function distanceKm(a: Place, b: Place): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map((n) => Number.parseInt(n, 10));
  if (Number.isNaN(h)) return 0;
  return h * 60 + (Number.isNaN(m) ? 0 : m);
}

export function minutesToTime(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function formatTime12h(time: string): string {
  const mins = timeToMinutes(time);
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function formatDatePretty(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export type MatchInput = {
  fromLocation: string;
  toLocation: string;
  direction: string;
  travelDate: string;
  departureTime: string;
};

export type RideLike = MatchInput & {
  id: number;
  seatsAvailable: number;
  pricePerSeat: number;
  vehicleType: string;
};

export type MatchResult = {
  score: number;
  pickupKm: number;
  dropKm: number;
  minutesDiff: number;
  reason: string;
};

/**
 * Smart route matching: nearby pickup, same/nearby destination, similar time.
 * An exact location match is NOT required.
 */
export function matchRide<T extends RideLike>(query: MatchInput, ride: T): (MatchResult & { ride: T }) | null {
  if (ride.direction !== query.direction) return null;
  if (ride.travelDate !== query.travelDate) return null;
  if (ride.seatsAvailable <= 0) return null;

  const qFrom = resolvePlace(query.fromLocation);
  const rFrom = resolvePlace(ride.fromLocation);
  const qTo = resolvePlace(query.toLocation);
  const rTo = resolvePlace(ride.toLocation);

  const pickupKm =
    qFrom && rFrom ? distanceKm(qFrom, rFrom) : query.fromLocation.toLowerCase() === ride.fromLocation.toLowerCase() ? 0 : 4;
  const dropKm =
    qTo && rTo ? distanceKm(qTo, rTo) : query.toLocation.toLowerCase() === ride.toLocation.toLowerCase() ? 0 : 3;

  const minutesDiff = Math.abs(timeToMinutes(query.departureTime) - timeToMinutes(ride.departureTime));

  const pickupScore = clamp(100 - (pickupKm / 6) * 100);
  const dropScore = clamp(100 - (dropKm / 4) * 100);
  const timeScore = clamp(100 - (minutesDiff / 75) * 100);

  const score = Math.round(pickupScore * 0.44 + dropScore * 0.31 + timeScore * 0.25);
  // Only surface rides that genuinely overlap the student's travel path.
  if (score < 45) return null;

  const reason =
    pickupKm <= 0.6 && dropKm <= 0.6
      ? "Same route & similar time"
      : pickupKm <= 1.5
        ? "Pickup right near you"
        : dropKm <= 0.6
          ? "Same college drop point"
          : "Route overlaps your travel path";

  return { score, pickupKm, dropKm, minutesDiff, reason, ride };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function sortMatches<T extends RideLike>(query: MatchInput, rides: T[]) {
  return rides
    .map((ride) => matchRide(query, ride))
    .filter((m): m is MatchResult & { ride: T } => m !== null)
    .sort((a, b) => b.score - a.score);
}

/** Date used when a student has not picked one yet: after noon we plan tomorrow. */
export function defaultTravelDate(now = new Date()): string {
  const cutoff = new Date(now);
  cutoff.setHours(12, 0, 0, 0);
  const target = now.getTime() >= cutoff.getTime() ? new Date(now.getTime() + 86400000) : now;
  return target.toISOString().slice(0, 10);
}

/** True when a ride's departure moment is still in the future. */
export function departureIsFuture(date: string, time: string, slackMinutes = 0): boolean {
  const departure = new Date(`${date}T${time}:00`);
  if (Number.isNaN(departure.getTime())) return false;
  return departure.getTime() > Date.now() + slackMinutes * 60 * 1000;
}

export const AVATAR_COLORS = [
  "blue",
  "green",
  "violet",
  "amber",
  "rose",
  "teal",
] as const;

export function avatarGradient(color: string): string {
  switch (color) {
    case "green":
      return "from-emerald-500 to-teal-500";
    case "violet":
      return "from-violet-500 to-indigo-500";
    case "amber":
      return "from-amber-500 to-orange-500";
    case "rose":
      return "from-rose-500 to-pink-500";
    case "teal":
      return "from-teal-500 to-cyan-500";
    default:
      return "from-blue-600 to-indigo-500";
  }
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
