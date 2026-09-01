"use client";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Terms and Conditions</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: August 2026</p>
      <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-700">
        <section>
          <h2 className="text-lg font-bold text-slate-900">1. Eligibility</h2>
          <p className="mt-2">RideMate is exclusively for verified college students. You must complete student verification with a valid college ID card before booking or offering rides. Only admin-approved drivers can publish rides.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-slate-900">2. Platform Commission</h2>
          <p className="mt-2">RideMate charges a 5% platform commission on every ride fare. This commission is calculated on the server and clearly shown before payment. The remaining 95% is credited to the driver&apos;s earnings ledger.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-slate-900">3. Payments</h2>
          <p className="mt-2">All payments are processed through Razorpay. Bookings are confirmed only after successful server-side payment verification. Failed payments do not result in confirmed bookings.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-slate-900">4. Cancellations and Refunds</h2>
          <p className="mt-2">Passengers and drivers can cancel bookings. If a paid booking is cancelled before the ride, the passenger receives a refund processed through Razorpay. Refunds typically reflect within 5-7 working days. If the driver rejects a paid booking, the refund is issued automatically.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-slate-900">5. User Conduct</h2>
          <p className="mt-2">Users must not create fake profiles, submit fraudulent documents, harass other users, or misuse the platform. Violations may result in account suspension.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-slate-900">6. Safety</h2>
          <p className="mt-2">RideMate provides a reporting and blocking system. Users can report inappropriate behaviour and block other users. All reports are reviewed by administrators.</p>
        </section>
      </div>
    </div>
  );
}
