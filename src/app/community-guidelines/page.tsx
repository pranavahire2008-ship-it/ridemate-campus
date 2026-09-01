"use client";

export default function CommunityGuidelinesPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Community Guidelines</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: August 2026</p>
      <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-700">
        <section>
          <h2 className="text-lg font-bold text-slate-900">Be Respectful</h2>
          <p className="mt-2">Treat every student with respect. No harassment, discrimination, or abusive language. We are a campus community — act accordingly.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-slate-900">Be Honest</h2>
          <p className="mt-2">Submit real documents for verification. Do not create fake profiles or provide false information about your identity, vehicle, or ride details.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-slate-900">Be Safe</h2>
          <p className="mt-2">Wear a helmet on two-wheelers. Follow traffic rules. Share ride details with a friend or family member. Meet at public pickup points.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-slate-900">Report Issues</h2>
          <p className="mt-2">If something feels wrong, report it immediately through the app. Every report is reviewed by our team.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-slate-900">Consequences</h2>
          <p className="mt-2">Violations of these guidelines can result in warnings, temporary suspension, or permanent removal from the platform.</p>
        </section>
      </div>
    </div>
  );
}
