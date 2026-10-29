'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { browserSupabase } from '@/lib/supabase/client';
import { groupInvitePreview, joinGroupByCode, type InvitePreview } from '@/lib/db/chats';
import { avatarBg, initials } from '@/lib/ui/avatar';
import { useT } from '@/lib/i18n/context';

type Status = 'loading' | 'needauth' | 'notfound' | 'ready' | 'joining' | 'error';

function JoinInner() {
  const t = useT();
  const router = useRouter();
  const code = useSearchParams().get('code') || '';
  const [status, setStatus] = useState<Status>('loading');
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!code) { if (alive) setStatus('notfound'); return; }
      const { data } = await browserSupabase().auth.getSession();
      if (!alive) return;
      if (!data.session?.user) { setStatus('needauth'); return; }
      try {
        const p = await groupInvitePreview(code);
        if (!alive) return;
        if (!p) { setStatus('notfound'); return; }
        setPreview(p);
        setStatus('ready');
      } catch {
        if (alive) setStatus('notfound');
      }
    })();
    return () => { alive = false; };
  }, [code]);

  async function join() {
    setStatus('joining');
    setErr('');
    try {
      const chatId = await joinGroupByCode(code);
      router.replace(`/chats/view?c=${chatId}`);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setStatus('error');
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 p-6 text-slate-100">
      <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-center">
        {status === 'loading' && <div className="mx-auto h-24 w-24 animate-pulse rounded-full bg-slate-800" />}

        {status === 'needauth' && (
          <>
            <h1 className="text-lg font-semibold">{t('join.title')}</h1>
            <p className="mt-2 text-sm text-slate-400">{t('join.needAuth')}</p>
            <Link href="/login" className="toky-grad mt-4 inline-block rounded-xl px-5 py-2.5 text-sm font-semibold text-white">
              {t('join.signIn')}
            </Link>
          </>
        )}

        {status === 'notfound' && (
          <>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-slate-800 text-2xl">🔗</div>
            <h1 className="mt-3 text-lg font-semibold">{t('join.invalidTitle')}</h1>
            <p className="mt-2 text-sm text-slate-400">{t('join.invalidBody')}</p>
            <Link href="/chats" className="mt-4 inline-block rounded-xl bg-slate-800 px-5 py-2.5 text-sm text-slate-200 hover:bg-slate-700">
              {t('join.goToChats')}
            </Link>
          </>
        )}

        {(status === 'ready' || status === 'joining' || status === 'error') && preview && (
          <>
            {preview.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.avatarUrl} alt="" className="mx-auto h-24 w-24 rounded-full object-cover" />
            ) : (
              <span className="mx-auto grid h-24 w-24 place-items-center rounded-full text-2xl font-semibold text-white" style={{ backgroundImage: avatarBg(preview.title) }}>
                {initials(preview.title)}
              </span>
            )}
            <h1 className="mt-4 text-lg font-semibold">{preview.title || t('chatsList.group')}</h1>
            <p className="mt-1 text-sm text-slate-400">{preview.members} {t('join.members')}</p>
            {err && <p className="mt-2 text-xs text-rose-300">{err}</p>}
            <button
              type="button"
              onClick={join}
              disabled={status === 'joining'}
              className="toky-grad toky-ring-brand mt-5 w-full rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {status === 'joining' ? t('join.joining') : t('join.joinButton')}
            </button>
            <Link href="/chats" className="mt-3 inline-block text-xs text-slate-500 hover:text-slate-300">
              {t('common.cancel')}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <JoinInner />
    </Suspense>
  );
}
