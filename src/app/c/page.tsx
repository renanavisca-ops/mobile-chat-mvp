'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { browserSupabase } from '@/lib/supabase/client';
import { channelPreview, joinChannel, channelInvitePreview, joinChannelByCode, type ChannelPreview } from '@/lib/db/chats';
import { avatarBg, initials } from '@/lib/ui/avatar';
import { useT } from '@/lib/i18n/context';

type Status = 'loading' | 'needauth' | 'notfound' | 'ready' | 'joining' | 'error';

function ChannelInner() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get('id') || '';
  const code = params.get('code') || '';
  const [status, setStatus] = useState<Status>('loading');
  const [preview, setPreview] = useState<ChannelPreview | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!id && !code) { if (alive) setStatus('notfound'); return; }
      const { data } = await browserSupabase().auth.getSession();
      if (!alive) return;
      if (!data.session?.user) { setStatus('needauth'); return; }
      try {
        // A `code` is a private-channel invite; `id` is a public channel.
        const p = code ? await channelInvitePreview(code) : await channelPreview(id);
        if (!alive) return;
        if (!p) { setStatus('notfound'); return; }
        setPreview(p);
        setStatus('ready');
      } catch {
        if (alive) setStatus('notfound');
      }
    })();
    return () => { alive = false; };
  }, [id, code]);

  async function open() {
    if (preview) router.replace(`/chats/view?c=${preview.id}`);
  }

  async function follow() {
    if (!preview) return;
    setStatus('joining');
    setErr('');
    try {
      if (!preview.joined) {
        if (code) await joinChannelByCode(code);
        else await joinChannel(preview.id);
      }
      router.replace(`/chats/view?c=${preview.id}`);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setStatus('error');
    }
  }

  const title = preview?.title || t('channels.untitled');

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 p-6 text-slate-100">
      <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-center">
        {status === 'loading' && <div className="mx-auto h-24 w-24 animate-pulse rounded-full bg-slate-800" />}

        {status === 'needauth' && (
          <>
            <h1 className="text-lg font-semibold">{t('channelPreview.title')}</h1>
            <p className="mt-2 text-sm text-slate-400">{t('channelPreview.needAuth')}</p>
            <Link href="/login" className="toky-grad mt-4 inline-block rounded-xl px-5 py-2.5 text-sm font-semibold text-white">
              {t('join.signIn')}
            </Link>
          </>
        )}

        {status === 'notfound' && (
          <>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-slate-800 text-2xl">📣</div>
            <h1 className="mt-3 text-lg font-semibold">{t('channelPreview.invalidTitle')}</h1>
            <p className="mt-2 text-sm text-slate-400">{t('channelPreview.invalidBody')}</p>
            <Link href="/channels" className="mt-4 inline-block rounded-xl bg-slate-800 px-5 py-2.5 text-sm text-slate-200 hover:bg-slate-700">
              {t('channelPreview.browse')}
            </Link>
          </>
        )}

        {(status === 'ready' || status === 'joining' || status === 'error') && preview && (
          <>
            {preview.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.avatarUrl} alt="" className="mx-auto h-24 w-24 rounded-full object-cover" />
            ) : (
              <span className="mx-auto grid h-24 w-24 place-items-center rounded-full text-2xl font-semibold text-white" style={{ backgroundImage: avatarBg(title) }}>
                {initials(title)}
              </span>
            )}
            <h1 className="mt-4 text-lg font-semibold">{title}</h1>
            {preview.description && <p className="mt-1 text-sm text-slate-400">{preview.description}</p>}
            {err && <p className="mt-2 text-xs text-rose-300">{err}</p>}
            {preview.joined ? (
              <button
                type="button"
                onClick={open}
                className="toky-grad toky-ring-brand mt-5 w-full rounded-xl px-5 py-3 text-sm font-semibold text-white"
              >
                {t('channelPreview.open')}
              </button>
            ) : (
              <button
                type="button"
                onClick={follow}
                disabled={status === 'joining'}
                className="toky-grad toky-ring-brand mt-5 w-full rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {status === 'joining' ? t('channelPreview.following') : t('channelPreview.follow')}
              </button>
            )}
            <Link href="/chats" className="mt-3 inline-block text-xs text-slate-500 hover:text-slate-300">
              {t('common.cancel')}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function ChannelPreviewPage() {
  return (
    <Suspense fallback={null}>
      <ChannelInner />
    </Suspense>
  );
}
