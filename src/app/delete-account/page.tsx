import Link from 'next/link';

export const metadata = { title: 'Delete Your Account & Data — Toky Chat' };

export default function DeleteAccountPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 text-slate-200">
      <Link href="/" className="text-sm text-blue-400 hover:text-blue-300">← Back to app</Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Delete Your Account &amp; Data</h1>
      <p className="mt-1 text-xs text-slate-500">How to permanently delete your Toky Chat account and associated data.</p>

      <div className="mt-8 space-y-9 text-sm leading-relaxed text-slate-300">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Delete from inside the app</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Open <b>Settings</b>.</li>
            <li>Scroll to <b>Delete account</b>.</li>
            <li>Confirm. Your account and personal data are removed right away; residual copies in encrypted backups are purged within 90 days.</li>
          </ol>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Request deletion by email</h2>
          <p>
            If you can&apos;t sign in, email{' '}
            <a className="text-blue-400 hover:text-blue-300" href="mailto:renanavisca@gmail.com">renanavisca@gmail.com</a>{' '}
            from the address on your account and ask us to delete it. We&apos;ll verify the
            request and complete it, typically within 30 days.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">What gets deleted</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Your profile (username, display name, avatar).</li>
            <li>Your devices, contacts, chat memberships, blocks, and encryption keys.</li>
            <li>Push-notification tokens for your devices.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">What may remain</h2>
          <p>
            Messages you already sent may stay visible to the people you sent them to, so
            that deleting your account doesn&apos;t erase other people&apos;s conversation
            history. Copies in encrypted backups are purged within 90 days. We may retain
            limited information where the law requires it. See our{' '}
            <Link href="/privacy" className="text-blue-400 hover:text-blue-300">Privacy Policy</Link>{' '}
            for details.
          </p>
        </section>
      </div>
    </main>
  );
}
