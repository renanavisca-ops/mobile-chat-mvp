import Link from 'next/link';

export const metadata = { title: 'Terms of Service — Toky Chat' };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 text-slate-200">
      <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
        DRAFT TEMPLATE — this is a thorough starting point, not legal advice. Have a
        qualified lawyer review and adapt it, and replace every [BRACKETED] value,
        before you rely on it in production.
      </div>

      <Link href="/" className="text-sm text-blue-400 hover:text-blue-300">← Back to app</Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p className="mt-1 text-xs text-slate-500">
        Effective date: [DATE] · Last updated: [DATE]
      </p>

      <div className="mt-8 space-y-9 text-sm leading-relaxed text-slate-300">
        <section>
          <p>
            These Terms of Service (&quot;Terms&quot;) are a binding agreement between you
            and <b>[COMPANY LEGAL NAME]</b> (&quot;Toky Chat&quot;, &quot;we&quot;,
            &quot;us&quot;) governing your access to and use of the Toky Chat application
            and related services (the &quot;Service&quot;). By creating an account,
            clicking to accept, or using the Service, you agree to these Terms and to our{' '}
            <Link href="/privacy" className="text-blue-400 hover:text-blue-300">Privacy Policy</Link>.
            If you do not agree, do not use the Service.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">1. Eligibility &amp; age</h2>
          <p>
            You must be at least <b>[MINIMUM AGE — e.g. 13, or 16 in parts of the EU]</b>{' '}
            years old (or the minimum age of digital consent in your country) to use the
            Service. If you are under the age of majority, you represent that a parent or
            legal guardian has reviewed and agreed to these Terms. You must have the legal
            capacity to enter into this agreement, and you must not be barred from using
            the Service under applicable law.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">2. The Service</h2>
          <p>
            Toky Chat is a messaging service that lets you send text, images, video, and
            voice messages, create one-to-one and group chats, and manage a profile. We
            may add, change, or remove features at any time. Messages are stored on our
            servers and are <b>not</b> end-to-end encrypted; see our Privacy Policy for
            details on how content is handled.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">3. Your account</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>You must provide accurate information and keep it up to date.</li>
            <li>You are responsible for all activity that occurs under your account.</li>
            <li>Keep your credentials confidential and notify us immediately of any unauthorized use at [SECURITY EMAIL].</li>
            <li>You may not share, sell, or transfer your account, or use another person&apos;s account without permission.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">4. Acceptable use</h2>
          <p>You agree that you will not, and will not help or permit others to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>violate any law or regulation, or infringe the intellectual property, privacy, or other rights of others;</li>
            <li>harass, bully, threaten, defame, or abuse any person;</li>
            <li>post or share content that is hateful, violent, or that sexually exploits or endangers minors (which we report to authorities as required by law);</li>
            <li>share sexual content involving anyone without consent, or otherwise unlawful or non-consensual intimate imagery;</li>
            <li>send spam, chain messages, or unsolicited bulk communications;</li>
            <li>distribute malware, or attempt to gain unauthorized access to the Service, other accounts, or our systems;</li>
            <li>scrape, crawl, or harvest data, or use bots or automated means except as we expressly permit;</li>
            <li>interfere with, disrupt, or overload the Service, or circumvent security or rate limits;</li>
            <li>impersonate any person or entity, or misrepresent your affiliation;</li>
            <li>reverse engineer or attempt to extract source code except to the extent permitted by law.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">5. Your content &amp; license</h2>
          <p>
            You retain ownership of the content you create and share (&quot;User
            Content&quot;). You grant us a worldwide, non-exclusive, royalty-free license
            to host, store, reproduce, and transmit your User Content solely to operate,
            provide, and secure the Service (for example, to deliver a message to its
            recipients and display it to them). This license ends when your User Content
            is deleted, except for content already shared with others or retained in
            backups for a limited period, and except as needed to comply with law.
          </p>
          <p className="mt-2">
            You represent that you have the necessary rights to your User Content and that
            it does not violate these Terms or any law. You are solely responsible for
            your User Content.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">6. Reporting, moderation &amp; enforcement</h2>
          <p>
            You can report content or users and block other users within the Service. We
            may, but are not obligated to, review reported content. We may remove content,
            limit visibility, and warn, suspend, or terminate accounts that violate these
            Terms or that we reasonably believe create legal or safety risk. We may
            preserve and disclose information where required by law or to protect users.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">7. Our intellectual property</h2>
          <p>
            The Service, including its software, design, trademarks, and content we
            provide, is owned by [COMPANY LEGAL NAME] or its licensors and is protected by
            law. We grant you a limited, revocable, non-exclusive, non-transferable license
            to use the Service for your personal, non-commercial use in accordance with
            these Terms. All rights not expressly granted are reserved.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">8. Third-party services</h2>
          <p>
            The Service relies on third-party providers (such as hosting and
            infrastructure) and may link to third-party sites or content. We are not
            responsible for third-party services, and your use of them may be subject to
            their own terms.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">9. Termination</h2>
          <p>
            You may stop using the Service and delete your account at any time. We may
            suspend or terminate your access, with or without notice, if you violate these
            Terms, if required by law, or to protect the Service or its users. Upon
            termination, your right to use the Service ends. Sections that by their nature
            should survive termination (including content license limitations,
            disclaimers, limitation of liability, and indemnification) will survive.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">10. Disclaimers</h2>
          <p>
            THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT
            WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING
            WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND
            NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED,
            SECURE, OR ERROR-FREE. [Some jurisdictions do not allow certain disclaimers, so
            these may not fully apply to you.]
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">11. Limitation of liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, [COMPANY LEGAL NAME] AND ITS AFFILIATES
            WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
            PUNITIVE DAMAGES, OR ANY LOSS OF DATA, PROFITS, OR GOODWILL, ARISING FROM OR
            RELATING TO YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY FOR ANY CLAIM WILL NOT
            EXCEED [THE GREATER OF THE AMOUNT YOU PAID US IN THE PAST 12 MONTHS OR USD 100].
            Nothing in these Terms limits liability that cannot be limited under
            applicable law.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">12. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless [COMPANY LEGAL NAME] and its
            affiliates from any claims, damages, liabilities, and expenses (including
            reasonable legal fees) arising from your User Content, your use of the Service,
            or your violation of these Terms or of any law or third-party right.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">13. Governing law &amp; disputes</h2>
          <p>
            These Terms are governed by the laws of [JURISDICTION], without regard to its
            conflict-of-laws rules. [Choose a dispute-resolution mechanism: courts of
            [LOCATION], and/or binding arbitration and a class-action waiver where
            enforceable. Consumer-protection laws in your users&apos; countries may
            override these choices — confirm with counsel.]
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">14. Changes to these Terms</h2>
          <p>
            We may modify these Terms from time to time. If changes are material, we will
            provide reasonable notice (for example, in-app or by email). Your continued use
            of the Service after changes take effect means you accept the revised Terms.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">15. General</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li><b>Entire agreement:</b> these Terms and the Privacy Policy are the entire agreement between you and us regarding the Service.</li>
            <li><b>Severability:</b> if any provision is unenforceable, the rest remain in effect.</li>
            <li><b>No waiver:</b> our failure to enforce a provision is not a waiver.</li>
            <li><b>Assignment:</b> you may not assign these Terms; we may assign them in connection with a merger, acquisition, or sale of assets.</li>
            <li><b>Force majeure:</b> we are not liable for delays or failures caused by events beyond our reasonable control.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">16. Contact</h2>
          <p>
            Questions about these Terms? Contact [COMPANY LEGAL NAME] at [SUPPORT EMAIL],
            [REGISTERED ADDRESS].
          </p>
        </section>
      </div>

      <p className="mt-10 text-xs text-slate-500">
        See also our <Link href="/privacy" className="text-blue-400 hover:text-blue-300">Privacy Policy</Link>.
      </p>
    </main>
  );
}
