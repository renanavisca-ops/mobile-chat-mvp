import Link from 'next/link';

export const metadata = { title: 'Help & Support — Toky Chat' };

export default function SupportPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 text-slate-200">
      <Link href="/" className="text-sm text-blue-400 hover:text-blue-300">← Back to app</Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Help &amp; Support</h1>
      <p className="mt-1 text-xs text-slate-500">We&apos;re a small independent team and read every message.</p>

      <div className="mt-8 space-y-9 text-sm leading-relaxed text-slate-300">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Contact us</h2>
          <p>
            Email <a className="text-blue-400 hover:text-blue-300" href="mailto:renanavisca@gmail.com">renanavisca@gmail.com</a>{' '}
            for help, bug reports, privacy questions, or to report abuse. We aim to reply
            within a few business days. For safety-related reports we respond as quickly as
            we can.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Common tasks</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li><b>Block someone:</b> open the chat or their contact entry and choose <i>Block user</i>. They can no longer contact you.</li>
            <li><b>Report a message or user:</b> press and hold a message (or open a contact) and choose <i>Report</i>. Reports come straight to us.</li>
            <li><b>Mute a chat:</b> open the chat menu and toggle <i>Mute</i> to stop notifications from it.</li>
            <li><b>Encryption backup:</b> in <b>Settings → Encryption</b>, set a passphrase to back up your key. You&apos;ll need it to read encrypted messages after reinstalling or on a new device.</li>
            <li><b>Delete your account:</b> see our <Link href="/delete-account" className="text-blue-400 hover:text-blue-300">account &amp; data deletion</Link> page.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Policies</h2>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/guidelines" className="text-blue-400 hover:text-blue-300">Community Guidelines</Link>
            <Link href="/terms" className="text-blue-400 hover:text-blue-300">Terms of Service</Link>
            <Link href="/privacy" className="text-blue-400 hover:text-blue-300">Privacy Policy</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
