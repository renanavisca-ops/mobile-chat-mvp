import Link from 'next/link';

export const metadata = { title: 'Terms of Service — Toky Chat' };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 text-slate-200">
      <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
        DRAFT — starter template. Review with a lawyer and fill in the bracketed
        details before launch. Not legal advice.
      </div>

      <Link href="/" className="text-sm text-blue-400 hover:text-blue-300">← Back</Link>
      <h1 className="mt-3 text-2xl font-bold">Terms of Service</h1>
      <p className="mt-1 text-xs text-slate-500">Effective date: [DATE] · Last updated: [DATE]</p>

      <div className="mt-6 space-y-6 text-sm leading-relaxed text-slate-300">
        <section>
          <p>
            These Terms govern your use of Toky Chat (the &quot;Service&quot;), operated by
            [COMPANY NAME]. By creating an account or using the Service, you agree to
            these Terms and to our{' '}
            <Link href="/privacy" className="text-blue-400 hover:text-blue-300">Privacy Policy</Link>.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-100">Eligibility</h2>
          <p>You must be at least [13/16] years old to use the Service.</p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-100">Your account</h2>
          <p>
            You are responsible for activity under your account and for keeping your
            credentials secure. Provide accurate information and notify us of any
            unauthorized use.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-100">Acceptable use</h2>
          <p>You agree not to use the Service to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>break the law or infringe others&apos; rights;</li>
            <li>harass, threaten, or abuse others;</li>
            <li>share illegal, hateful, or sexually exploitative content;</li>
            <li>send spam, malware, or attempt to disrupt the Service;</li>
            <li>impersonate others or misrepresent your affiliation.</li>
          </ul>
          <p className="mt-2">
            We may remove content and suspend or terminate accounts that violate these
            Terms.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-100">Your content</h2>
          <p>
            You retain rights to the content you send. You grant us a limited license
            to host and transmit it solely to operate the Service. You are responsible
            for the content you share.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-100">Termination</h2>
          <p>
            You may stop using the Service and delete your account at any time. We may
            suspend or terminate access if you violate these Terms or to protect the
            Service and its users.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-100">Disclaimers &amp; liability</h2>
          <p>
            The Service is provided &quot;as is&quot; without warranties. To the extent
            permitted by law, [COMPANY NAME] is not liable for indirect or incidental
            damages arising from your use of the Service. [Adjust with counsel.]
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-100">Changes</h2>
          <p>
            We may update these Terms. If changes are material, we will provide notice.
            Continued use after changes means you accept them.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-100">Governing law &amp; contact</h2>
          <p>
            These Terms are governed by the laws of [JURISDICTION]. Contact us at
            [SUPPORT EMAIL].
          </p>
        </section>
      </div>
    </main>
  );
}
