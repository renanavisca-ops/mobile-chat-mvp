'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageShell } from '@/components/page-shell';
import { browserSupabase } from '@/lib/supabase/client';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState('Completing login…');

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = browserSupabase();
        const { data } = await supabase.auth.getUser();
        if (!data.user) throw new Error('No user session');
        setStatus('✅ Logged in. Redirecting…');
        router.replace('/onboarding');
      } catch (e: any) {
        setStatus(`❌ ${e?.message ?? String(e)}`);
      }
    };
    void run();
  }, [router]);

  return (
    <PageShell title="Auth Callback">
      <p className="text-sm text-slate-300">{status}</p>
    </PageShell>
  );
}
