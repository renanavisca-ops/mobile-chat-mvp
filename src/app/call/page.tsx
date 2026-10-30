'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRequireAuth } from '@/lib/auth/use-require-auth';
import { browserSupabase } from '@/lib/supabase/client';
import { useCall } from '@/lib/call/call-provider';
import { useT } from '@/lib/i18n/context';

function JoinCallInner() {
  const { loading: authLoading, user } = useRequireAuth();
  const { joinCallByLink } = useCall();
  const router = useRouter();
  const params = useSearchParams();
  const t = useT();
  const [state, setState] = useState<'checking' | 'denied'>('checking');

  const callId = params.get('c') ?? '';
  const chatId = params.get('chat') ?? '';
  const video = params.get('v') === '1';

  useEffect(() => {
    if (authLoading || !user) return;
    let alive = true;
    (async () => {
      if (!callId) { router.replace('/chats'); return; }
      // Access control: only members of the call's chat may join via the link.
      let allowed = false;
      if (chatId) {
        try {
          const { data } = await browserSupabase()
            .from('chat_members')
            .select('user_id')
            .eq('chat_id', chatId)
            .eq('user_id', user.id)
            .maybeSingle();
          allowed = !!data;
        } catch { allowed = false; }
      }
      if (!alive) return;
      if (!allowed) { setState('denied'); return; }
      joinCallByLink({ callId, chatId, video, label: t('call.incomingTitle') });
      // The call overlay (from CallProvider) now covers the screen; leave this
      // route for the chat list underneath.
      router.replace('/chats');
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-slate-950 px-6 text-center text-slate-200">
      {state === 'denied' ? (
        <>
          <p className="text-sm text-slate-400">{t('call.linkDenied')}</p>
          <button onClick={() => router.replace('/chats')} className="rounded-xl bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700">
            {t('common.close')}
          </button>
        </>
      ) : (
        <p className="text-sm text-slate-400">{t('call.joining')}</p>
      )}
    </div>
  );
}

export default function JoinCallPage() {
  return (
    <Suspense fallback={null}>
      <JoinCallInner />
    </Suspense>
  );
}
