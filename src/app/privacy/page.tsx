import Link from 'next/link';

export const metadata = { title: 'Privacy Policy — Toky Chat' };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 text-slate-200">
      <Link href="/" className="text-sm text-blue-400 hover:text-blue-300">← Back to app</Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-1 text-xs text-slate-500">
        Effective date: July 24, 2026 · Last updated: July 24, 2026
      </p>

      <div className="mt-8 space-y-9 text-sm leading-relaxed text-slate-300">
        <section>
          <p>
            This Privacy Policy describes how <b>Toky Chat</b> (&quot;Toky
            Chat&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) collects,
            uses, discloses, and safeguards your information when you use our messaging
            application and related services (collectively, the &quot;Service&quot;).
            It also explains your rights and choices. For the purposes of the EU/UK
            General Data Protection Regulation (&quot;GDPR&quot;), the data controller
            is Toky Chat, an independent app operated by its individual creators, contactable at renanavisca@gmail.com. If you do not agree with this
            Policy, please do not use the Service.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">1. Information we collect</h2>

          <h3 className="mb-1 mt-4 font-semibold text-slate-200">a. Information you provide</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li><b>Account information:</b> your email address and authentication credentials (passwords are handled and stored by our authentication provider, not by us in plaintext).</li>
            <li><b>Profile information:</b> username, display name, and profile photo (avatar).</li>
            <li><b>Content you share:</b> the messages, images, videos, and voice notes you send or receive, including any captions or metadata attached to them.</li>
            <li><b>Relationships:</b> your contacts, the chats and groups you belong to, and who you communicate with.</li>
            <li><b>Communications with us:</b> information you provide in support requests, reports, or feedback.</li>
          </ul>

          <h3 className="mb-1 mt-4 font-semibold text-slate-200">b. Information collected automatically</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li><b>Device &amp; connection data:</b> IP address, browser type, operating system, device identifiers, and language settings.</li>
            <li><b>Usage &amp; log data:</b> actions taken in the Service, timestamps, message delivery and read status, presence and &quot;last seen&quot; information, and error/diagnostic logs.</li>
            <li><b>Local storage:</b> we store data on your device (for example, session tokens, your selected chat wallpaper, your consent choice, and an active-device identifier) to keep you signed in and remember preferences.</li>
          </ul>

          <h3 className="mb-1 mt-4 font-semibold text-slate-200">c. Information from third parties</h3>
          <p>
            If you sign in through a third-party provider or our authentication provider,
            we receive account identifiers and basic profile data necessary to create and
            secure your account.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">2. How we use information</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Provide, maintain, and operate the Service — deliver messages and media, show presence and typing indicators, enable search, groups, and profiles.</li>
            <li>Authenticate you and keep your account secure.</li>
            <li>Detect, prevent, and respond to abuse, spam, fraud, and safety issues (including handling reports and blocks).</li>
            <li>Provide customer support and respond to your requests.</li>
            <li>Send you service-related communications and, where you have opted in, notifications.</li>
            <li>Maintain, debug, and improve the Service.</li>
            <li>Comply with legal obligations and enforce our Terms.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">3. Legal bases for processing (EEA/UK)</h2>
          <p>Where GDPR applies, we rely on the following legal bases:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><b>Performance of a contract</b> — to provide the Service you request.</li>
            <li><b>Legitimate interests</b> — to secure the Service, prevent abuse, and improve our product, balanced against your rights.</li>
            <li><b>Consent</b> — for optional features such as browser notifications and camera/microphone access; you may withdraw consent at any time.</li>
            <li><b>Legal obligation</b> — to comply with applicable law and lawful requests.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">4. How we share information</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li><b>With other users:</b> your profile (username, display name, avatar, presence) and the content you send are visible to the participants of your chats and groups.</li>
            <li><b>With service providers (processors):</b> we use Supabase (database, authentication, file storage, realtime) and Vercel (application hosting) to run the Service. They process data on our behalf under contractual and security obligations. We also use Google Firebase Cloud Messaging to deliver push notifications.</li>
            <li><b>For legal reasons &amp; safety:</b> to comply with law, respond to lawful requests, enforce our Terms, or protect the rights, property, and safety of our users and the public.</li>
            <li><b>Business transfers:</b> in connection with a merger, acquisition, or sale of assets, subject to this Policy.</li>
          </ul>
          <p className="mt-2"><b>We do not sell your personal information.</b></p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">5. International data transfers</h2>
          <p>
            Your information may be processed and stored in [COUNTRY/REGION, e.g. the
            United States] and other countries where we or our providers operate. Where
            we transfer data out of the EEA/UK, we use appropriate safeguards such as the
            European Commission&apos;s Standard Contractual Clauses. [Confirm your
            providers&apos; transfer mechanisms.]
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">6. Data retention</h2>
          <p>
            We keep personal information for as long as your account is active or as
            needed to provide the Service, and thereafter only as required for the
            purposes described here. Indicative periods:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><b>Account &amp; profile:</b> kept until you delete your account, then removed right away; residual copies in backups are purged within 90 days.</li>
            <li><b>Messages &amp; media:</b> kept until deleted by participants. When you delete your account, messages you already sent remain visible to the other participants but are <b>anonymized</b> — they are shown as coming from a deleted user, with no name or profile. Backups are purged within 90 days.</li>
            <li><b>Logs &amp; diagnostics:</b> up to 90 days.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">7. Security</h2>
          <p>
            We use technical and organizational measures to protect your information,
            including encryption in transit (HTTPS) and access controls that restrict
            message and media access to the participants of a chat (enforced at the
            database level).
          </p>
          <p className="mt-2">
            <b>End-to-end encryption.</b> In direct (one-to-one) chats, the text and
            details of your messages are end-to-end encrypted by default. The encryption
            keys are generated on your device; we store only public keys and encrypted
            ciphertext for that content, so we cannot read it. <b>Media attachments</b>{' '}
            (images, videos, and files) are stored on our servers and protected by access
            controls, but are <b>not</b> yet end-to-end encrypted. If you lose access to
            your device and have not saved a passphrase backup of your key, your encrypted
            message history may be unrecoverable.
          </p>
          <p className="mt-2">
            Group chats and channels, and any chat where end-to-end encryption has not
            been enabled, are stored on our servers protected by the access controls
            above but are <b>not</b> end-to-end encrypted — in principle they could be
            accessed by us or by parties with lawful or administrative access to our
            systems. No method of transmission or storage is completely secure.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">8. Your rights &amp; choices</h2>
          <p>
            Depending on where you live, you may have some or all of the following rights:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><b>Access</b> and receive a copy of your personal information.</li>
            <li><b>Rectify</b> inaccurate or incomplete data (you can edit your profile in Settings).</li>
            <li><b>Erase</b> your data and delete your account.</li>
            <li><b>Restrict</b> or <b>object</b> to certain processing.</li>
            <li><b>Data portability</b> — receive your data in a portable format.</li>
            <li><b>Withdraw consent</b> at any time (for example, revoke notification or camera permissions).</li>
            <li><b>Complain</b> to your local data protection authority.</li>
          </ul>
          <p className="mt-3">
            <b>California residents (CCPA/CPRA):</b> you have the right to know, delete,
            and correct personal information, and to be free from discrimination for
            exercising these rights. We do not sell or &quot;share&quot; personal
            information as those terms are defined under California law.
          </p>
          <p className="mt-3">
            To exercise any right, contact us at <b>renanavisca@gmail.com</b>. We will verify
            your request and respond within the timeframe required by law.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">9. Children&apos;s privacy</h2>
          <p>
            The Service is not directed to, and we do not knowingly collect personal
            information from, children under <b>[MINIMUM AGE — e.g. 13, or 16 in parts of
            the EU]</b>. If you believe a child has provided us information without the
            required consent, contact us and we will delete it.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">10. Cookies &amp; local storage</h2>
          <p>
            We use browser local storage and similar technologies that are necessary to
            operate the Service (keeping you signed in and remembering your preferences).
            [If you add analytics or non-essential cookies, describe them and provide a
            consent mechanism.]
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">11. Changes to this Policy</h2>
          <p>
            We may update this Policy from time to time. If changes are material, we will
            provide notice through the Service or by other reasonable means. The
            &quot;Last updated&quot; date reflects the latest revision.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">12. Contact us</h2>
          <p>
            Toky Chat — an independent app operated by its individual creators.<br />
            Privacy &amp; data-protection contact: renanavisca@gmail.com
          </p>
        </section>
      </div>

      <p className="mt-10 text-xs text-slate-500">
        See also our <Link href="/terms" className="text-blue-400 hover:text-blue-300">Terms of Service</Link>.
      </p>
    </main>
  );
}
