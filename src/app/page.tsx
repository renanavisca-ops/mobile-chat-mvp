'use client';

import Link from 'next/link';
import { PageShell } from '@/components/page-shell';
import { useSession } from '@/lib/auth/use-session';

export default function HomePage() {
  const { user, loading } = useSession();

  return (
    <PageShell
      title="Signal-like MVP"
      right={
        user ? (
          <span className="text-xs text-slate-400">Signed in</span>
        ) : (
          <Link className="text-sm text-slate-200 hover:text-white" href="/login">
            Login
          </Link>
        )
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-900 bg-slate-950/40 p-4">
          <h2 className="text-lg font-semibold">What you get</h2>
          <ul className="mt-2 list-inside list-disc text-sm text-slate-300">
            <li>Chats list + chat screen</li>
            <li>Contacts search/add</li>
            <li>Create groups</li>
            <li>Realtime messages</li>
            <li>Media upload (Storage)</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link className="rounded bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700" href="/chats">
              Go to Chats
            </Link>
            <Link className="rounded bg-slate-900 px-3 py-2 text-sm hover:bg-slate-800" href="/contacts">
              Contacts
            </Link>
            <Link className="rounded bg-slate-900 px-3 py-2 text-sm hover:bg-slate-800" href="/groups/new">
              New group
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-900 bg-slate-950/40 p-4">
          <h2 className="text-lg font-semibold">First-time setup</h2>
          <p className="mt-2 text-sm text-slate-300">
            If you just created your account, run onboarding to generate local keys and register your device.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link className="rounded bg-blue-600 px-3 py-2 text-sm hover:bg-blue-500" href="/onboarding">
              Run Onboarding
            </Link>
            <Link className="rounded bg-slate-900 px-3 py-2 text-sm hover:bg-slate-800" href="/settings">
              Settings
            </Link>
          </div>

          <div className="mt-4 rounded-xl border border-slate-900 bg-slate-950/60 p-3 text-xs text-slate-400">
            {loading ? 'Loading session…' : user ? `User: ${user.email ?? user.id}` : 'Not signed in'}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
