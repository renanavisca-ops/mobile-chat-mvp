import Link from 'next/link';

export const metadata = { title: 'Community Guidelines — Toky Chat' };

export default function GuidelinesPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 text-slate-200">
      <Link href="/" className="text-sm text-blue-400 hover:text-blue-300">← Back to app</Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Community Guidelines</h1>
      <p className="mt-1 text-xs text-slate-500">Effective date: July 24, 2026</p>

      <div className="mt-8 space-y-9 text-sm leading-relaxed text-slate-300">
        <section>
          <p>
            Toky Chat is a place to talk with people you choose. To keep it safe for
            everyone, these guidelines apply to all content and behavior on the Service.
            They are part of our{' '}
            <Link href="/terms" className="text-blue-400 hover:text-blue-300">Terms of Service</Link>.
            Breaking them can lead to content removal, or suspension or termination of your
            account.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Do</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Treat others with respect, even in disagreement.</li>
            <li>Share only content you have the right to share.</li>
            <li>Use the report and block tools if someone crosses a line.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Don&apos;t</h2>
          <p>There is <b>zero tolerance</b> for content that sexually exploits or endangers
            minors (CSAM). We remove it and report it to the authorities and relevant
            organizations as required by law. Beyond that, do not:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>harass, bully, threaten, stalk, or intimidate anyone;</li>
            <li>post hateful content or incite violence against people based on who they are;</li>
            <li>share sexual or intimate images of anyone without their consent;</li>
            <li>promote self-harm, terrorism, or serious violence;</li>
            <li>sell or facilitate clearly illegal goods or services;</li>
            <li>impersonate others or deliberately deceive to cause harm;</li>
            <li>send spam, scams, or unsolicited bulk messages;</li>
            <li>distribute malware or try to break, overload, or gain unauthorized access to the Service.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Reporting &amp; enforcement</h2>
          <p>
            You can <b>report</b> any message or user, and <b>block</b> anyone, from within
            the app. Reports reach us directly and we review them. Depending on severity we
            may remove content, warn, suspend, or permanently ban accounts, and we may
            preserve and share information with authorities where the law requires it. You
            can also email <a className="text-blue-400 hover:text-blue-300" href="mailto:renanavisca@gmail.com">renanavisca@gmail.com</a>.
          </p>
        </section>
      </div>
    </main>
  );
}
