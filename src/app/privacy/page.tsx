import Link from 'next/link';

export const metadata = { title: 'Privacy Policy — Toky Chat' };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 text-slate-200">
      <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
        DRAFT — starter template. Review with a lawyer and fill in the bracketed
        details before launch. Not legal advice.
      </div>

      <Link href="/" className="text-sm text-blue-400 hover:text-blue-300">← Back</Link>
      <h1 className="mt-3 text-2xl font-bold">Privacy Policy</h1>
      <p className="mt-1 text-xs text-slate-500">Effective date: [DATE] · Last updated: [DATE]</p>

      <div className="mt-6 space-y-6 text-sm leading-relaxed text-slate-300">
        <section>
          <p>
            This Privacy Policy explains how [COMPANY NAME] (&quot;we&quot;, &quot;us&quot;)
            handles information when you use Toky Chat (the &quot;Service&quot;). By using the
            Service you agree to this policy.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-100">Information we collect</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li><b>Account data:</b> email address, username, display name, and avatar.</li>
            <li><b>Content:</b> the messages, photos, videos, and voice notes you send.</li>
            <li><b>Usage &amp; device data:</b> log data, device identifiers, and diagnostics needed to run the Service.</li>
          </ul>
          <p className="mt-2">
            <b>Important:</b> messages are stored on our servers and are <b>not</b>
            end-to-end encrypted. They are protected in transit (HTTPS) and access
            is restricted to the participants of a chat.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-100">How we use information</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>To operate the Service — deliver messages, show presence, enable search.</li>
            <li>To secure the Service and prevent abuse.</li>
            <li>To respond to support requests and legal obligations.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-100">Service providers</h2>
          <p>
            We use Supabase (database, authentication, storage) and Vercel (hosting)
            to run the Service. These providers process data on our behalf under their
            own terms. [List any others.]
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-100">Your choices &amp; rights</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Access and update your profile in Settings.</li>
            <li>Request deletion of your account and associated data.</li>
            <li>Control camera, microphone, and notification permissions in your browser/OS.</li>
            <li>[Add GDPR/CCPA rights as applicable to your users.]</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-100">Children</h2>
          <p>
            Toky Chat is not directed to children under [13/16]. You must meet the
            minimum age to use the Service. If we learn we collected data from a child
            below that age without consent, we will delete it.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-100">Retention</h2>
          <p>
            We keep your information for as long as your account is active or as needed
            to provide the Service, then delete or anonymize it. [Define retention
            periods.]
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-100">Contact</h2>
          <p>Questions? Contact us at [PRIVACY EMAIL].</p>
        </section>
      </div>

      <p className="mt-8 text-xs text-slate-500">
        See also our <Link href="/terms" className="text-blue-400 hover:text-blue-300">Terms of Service</Link>.
      </p>
    </main>
  );
}
