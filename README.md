# RideMate Campus

RideMate Campus is a student-only carpooling platform for safer, more affordable everyday travel between home and college. It supports student and driver verification, ride publishing, matching, bookings, payments, safety reporting, and an administrator console.

## Run locally

1. Install Node.js 20.9 or later and PostgreSQL (or create a Supabase Postgres database).
2. Copy `.env.example` to `.env.local` and fill in `DATABASE_URL` and a strong `AUTH_SECRET`.
3. Run the database setup script in `scripts/setup-database.sql`.
4. Install and run:

   ```bash
   npm install
   npm run dev
   ```

Open `http://localhost:3000`.

## Production checklist

- Set `DATABASE_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, and the Razorpay variables in the hosting provider.
- Generate `AUTH_SECRET` with `openssl rand -hex 32`; the app refuses to use a development fallback in production.
- Use Razorpay live keys only after testing complete booking, webhook, refund, and reconciliation flows.
- Configure the Razorpay webhook endpoint as `/api/webhooks/razorpay` and set its signing secret.
- Set `ADMIN_EMAILS` to a comma-separated list of the people responsible for verification and safety reports.
- Create a database backup policy and keep verification uploads outside version control.
- Review your Privacy Policy, Terms, and Community Guidelines with a local legal advisor before launch.

## Quality checks

```bash
npm run lint
npm run typecheck
npm run build
```
