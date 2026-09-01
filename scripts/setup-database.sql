-- RideMate Campus Database Setup Script
-- Run this once on your Supabase database via the SQL Editor
-- Dashboard → SQL Editor → New Query → Paste this → Run

-- Users
CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY,
  full_name varchar(120) NOT NULL,
  email varchar(160) NOT NULL UNIQUE,
  password_hash varchar(255) NOT NULL,
  phone varchar(20) NOT NULL DEFAULT '',
  phone_number varchar(20) NOT NULL DEFAULT '',
  college varchar(160) NOT NULL DEFAULT '',
  student_id varchar(60) NOT NULL DEFAULT '',
  gender varchar(20) NOT NULL DEFAULT 'prefer_not_say',
  home_location varchar(120) NOT NULL DEFAULT '',
  avatar_color varchar(40) NOT NULL DEFAULT 'blue',
  verified boolean NOT NULL DEFAULT false,
  verification_status varchar(20) NOT NULL DEFAULT 'UNVERIFIED',
  role varchar(16) NOT NULL DEFAULT 'STUDENT',
  suspended boolean NOT NULL DEFAULT false,
  rating_sum integer NOT NULL DEFAULT 0,
  rating_count integer NOT NULL DEFAULT 0,
  rides_completed integer NOT NULL DEFAULT 0,
  driver_verified boolean NOT NULL DEFAULT false,
  driver_verification_status varchar(20) NOT NULL DEFAULT 'NOT_SUBMITTED',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS users_verification_status_idx ON users(verification_status);
CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);

-- Auth Sessions
CREATE TABLE IF NOT EXISTS auth_sessions (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash varchar(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  user_agent varchar(300) NOT NULL DEFAULT '',
  ip_address varchar(64) NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions(expires_at);

-- Rides
CREATE TABLE IF NOT EXISTS rides (
  id serial PRIMARY KEY,
  driver_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  direction varchar(30) NOT NULL,
  from_location varchar(120) NOT NULL,
  to_location varchar(120) NOT NULL,
  route_stops text NOT NULL DEFAULT '',
  travel_date varchar(20) NOT NULL,
  departure_time varchar(10) NOT NULL,
  vehicle_type varchar(20) NOT NULL,
  vehicle_model varchar(80) NOT NULL DEFAULT '',
  seats_total integer NOT NULL DEFAULT 1,
  seats_available integer NOT NULL DEFAULT 1,
  price_per_seat integer NOT NULL DEFAULT 0,
  preferred_gender varchar(20) NOT NULL DEFAULT 'any',
  notes text NOT NULL DEFAULT '',
  status varchar(20) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rides_driver_idx ON rides(driver_id);
CREATE INDEX IF NOT EXISTS rides_status_idx ON rides(status);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id serial PRIMARY KEY,
  ride_id integer NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  rider_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seats integer NOT NULL DEFAULT 1,
  pickup_point varchar(160) NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  total_price integer NOT NULL DEFAULT 0,
  status varchar(20) NOT NULL DEFAULT 'PENDING',
  contact_unlocked boolean NOT NULL DEFAULT false,
  payment_status varchar(24) NOT NULL DEFAULT 'PENDING',
  payment_order_id varchar(80),
  razorpay_order_id varchar(80),
  payment_id varchar(80),
  razorpay_payment_id varchar(80),
  payment_amount integer NOT NULL DEFAULT 0,
  commission_amount integer NOT NULL DEFAULT 0,
  driver_amount integer NOT NULL DEFAULT 0,
  payment_currency varchar(8) NOT NULL DEFAULT 'INR',
  payment_verified boolean NOT NULL DEFAULT false,
  payment_verified_at timestamptz,
  payment_expires_at timestamptz,
  refund_id varchar(80),
  refund_amount integer NOT NULL DEFAULT 0,
  cancelled_at timestamptz,
  cancelled_by varchar(20),
  cancellation_reason varchar(240),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bookings_ride_idx ON bookings(ride_id);
CREATE INDEX IF NOT EXISTS bookings_rider_idx ON bookings(rider_id);
CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings(status);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id serial PRIMARY KEY,
  booking_id integer NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider varchar(24) NOT NULL DEFAULT 'razorpay',
  order_id varchar(80) NOT NULL UNIQUE,
  razorpay_order_id varchar(80),
  payment_id varchar(80),
  razorpay_payment_id varchar(80),
  amount integer NOT NULL,
  total_amount integer NOT NULL DEFAULT 0,
  commission_amount integer NOT NULL DEFAULT 0,
  driver_amount integer NOT NULL DEFAULT 0,
  currency varchar(8) NOT NULL DEFAULT 'INR',
  status varchar(24) NOT NULL DEFAULT 'PENDING',
  payment_status varchar(24) NOT NULL DEFAULT 'PENDING',
  verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  refund_id varchar(80),
  refund_amount integer NOT NULL DEFAULT 0,
  refund_status varchar(24),
  failure_reason varchar(200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_booking_idx ON payments(booking_id);
CREATE INDEX IF NOT EXISTS payments_user_idx ON payments(user_id);
CREATE INDEX IF NOT EXISTS payments_order_idx ON payments(order_id);

-- Driver Earnings
CREATE TABLE IF NOT EXISTS driver_earnings (
  id serial PRIMARY KEY,
  driver_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_id integer NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  ride_id integer NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  total_fare integer NOT NULL,
  commission_amount integer NOT NULL,
  driver_earning integer NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'PENDING',
  payout_id varchar(80),
  razorpay_transfer_id varchar(80),
  payout_method varchar(30) NOT NULL DEFAULT 'RAZORPAY_ROUTE',
  failure_reason varchar(240),
  paid_out_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS driver_earnings_driver_idx ON driver_earnings(driver_id);
CREATE INDEX IF NOT EXISTS driver_earnings_status_idx ON driver_earnings(status);

-- Student Verifications
CREATE TABLE IF NOT EXISTS student_verifications (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name varchar(120) NOT NULL,
  college_name varchar(160) NOT NULL,
  student_id_text varchar(60) NOT NULL,
  document_path varchar(300) NOT NULL,
  document_type varchar(10) NOT NULL DEFAULT 'image',
  status varchar(20) NOT NULL DEFAULT 'PENDING',
  rejection_reason varchar(400),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by integer REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sv_user_idx ON student_verifications(user_id);
CREATE INDEX IF NOT EXISTS sv_status_idx ON student_verifications(status);

-- Driver Verifications
CREATE TABLE IF NOT EXISTS driver_verifications (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  licence_document_path varchar(300) NOT NULL,
  vehicle_number varchar(30) NOT NULL,
  vehicle_type varchar(30) NOT NULL,
  vehicle_reg_document_path varchar(300) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'PENDING',
  rejection_reason varchar(400),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by integer REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dv_user_idx ON driver_verifications(user_id);
CREATE INDEX IF NOT EXISTS dv_status_idx ON driver_verifications(status);

-- Webhook Events (for Razorpay idempotency)
CREATE TABLE IF NOT EXISTS webhook_events (
  id serial PRIMARY KEY,
  event_id varchar(120) NOT NULL UNIQUE,
  event_type varchar(60) NOT NULL,
  order_id varchar(80),
  payment_id varchar(80),
  processed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type varchar(40) NOT NULL,
  title varchar(160) NOT NULL,
  body text NOT NULL DEFAULT '',
  ride_id integer,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id);

-- Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id serial PRIMARY KEY,
  booking_id integer,
  reviewer_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewee_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating integer NOT NULL DEFAULT 5,
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reviews_reviewee_idx ON reviews(reviewee_id);

-- Reports
CREATE TABLE IF NOT EXISTS reports (
  id serial PRIMARY KEY,
  reporter_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_user_id integer,
  ride_id integer,
  reason varchar(80) NOT NULL,
  details text NOT NULL DEFAULT '',
  status varchar(20) NOT NULL DEFAULT 'OPEN',
  reviewed_by integer,
  resolution text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Blocks
CREATE TABLE IF NOT EXISTS blocks (
  id serial PRIMARY KEY,
  blocker_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason varchar(160) NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id serial PRIMARY KEY,
  actor_id integer NOT NULL REFERENCES users(id),
  action varchar(60) NOT NULL,
  target_type varchar(30) NOT NULL DEFAULT '',
  target_id integer,
  details text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create Super Admin account (change password after first login!)
INSERT INTO users (full_name, email, password_hash, role, verified, verification_status, college, student_id)
VALUES (
  'RideMate Admin',
  'admin@ridematecampus.com',
  -- bcrypt hash of 'RideMate@Admin2026!' (change this password immediately)
  '$2b$11$K7KeGCF4xm8aN6Y5K.o7ruQbUbQfGhxAm5QqKKWGG4v2YVD.xMQa2',
  'SUPER_ADMIN',
  true,
  'VERIFIED',
  'RideMate Campus',
  'ADMIN001'
) ON CONFLICT (email) DO NOTHING;

SELECT 'Database setup complete! All tables created.' as result;
