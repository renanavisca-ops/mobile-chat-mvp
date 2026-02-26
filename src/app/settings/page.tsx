'use client';

import { useEffect, useState } from 'react';
import { PageShell } from '@/components/page-shell';
import { useRequireAuth } from '@/lib/auth/use-require-auth';
import { browserSupabase } from '@/lib/supabase/client';

export default function SettingsPage() {
  const { user, loading } = useRequireAuth();
  const [status, setStatus] = useState<string>('');
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);

  useEffect(() => {
    setActiveDeviceId(localStorage.getItem('active_device_id'));
  }, []);

  async function signOut() {
    setStatus('');
    const supabase = browserSupabase();
    await supabase.auth.signOut();
    setStatus('✅ Signed out');
  }

  return (
    <PageShell title="Settings">
      {loading ? (
        <p className="text-sm text-slate-300">Loading…</p>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-900 bg-slate-950/50 p-3">
            <div className="text-sm text-slate-300">User</div>
            <div className="text-xs text-slate-400">{user?.email ?? user?.id}</div>
          </div>

          <div className="rounded-xl border border-slate-900 bg-slate-950/50 p-3">
            <div className="text-sm text-slate-300">Active Device (localStorage)</div>
            <div className="text-xs text-slate-400">{activeDeviceId ?? '(none) — run /onboarding'}</div>
          </div>

          <button className="rounded bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700" onClick={signOut}>
            Sign out
          </button>

          <p className="text-sm whitespace-pre-wrap">{status}</p>
        </div>
      )}
    </PageShell>
  );
}
