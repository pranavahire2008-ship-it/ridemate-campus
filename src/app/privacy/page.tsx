"use client";

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: August 2026</p>
      <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-700">
        <section>
          <h2 className="text-lg font-bold text-slate-900">1. Information We Collect</h2>
          <p className="mt-2">When you register, we collect your name, email address, phone number, college name, and student/enrollment ID. If you apply for student or driver verification, we collect uploaded identity documents (college ID card, driving licence, vehicle registration). These documents are stored securely and are never publicly accessible.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-slate-900">2. How We Use Your Information</h2>
          <p className="mt-2">Your information is used to: verify your student identity, match rides, process payments through Razorpay, calculate platform commissions, and communicate important updates. We do not sell your personal information to third parties.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-slate-900">3. Document Storage</h2>
          <p className="mt-2">Verification documents (ID cards, licences) are stored in a private server directory. They are never served through public URLs. Only you and authorized administrators can view your documents. Access is controlled through backend authentication checks.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-slate-900">4. Payments</h2>
          <p className="mt-2">Payments are processed securely through Razorpay. RideMate never stores your card number, CVV, UPI PIN, or banking credentials. Only payment reference IDs are stored for transaction records.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-slate-900">5. Contact</h2>
          <p className="mt-2">For privacy-related questions, contact us at the email address listed on the Safety page.</p>
        </section>
      </div>
    </div>
  );
}
