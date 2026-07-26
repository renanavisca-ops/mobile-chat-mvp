'use client';

import { useEffect, useState } from 'react';
import { PageShell } from '@/components/page-shell';
import { useRequireAuth } from '@/lib/auth/use-require-auth';
import { useLanguage } from '@/lib/i18n/context';
import { useCall } from '@/lib/call/call-provider';
import { listCalls, type CallLog } from '@/lib/db/calls';
import { PhoneIcon, VideoIcon } from '@/components/icons';
import { EmptyState } from '@/components/empty-state';

function Avatar({ url, name }: { url: string | null; name: string }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="h-11 w-11 shrink-0 rounded-xl border border-slate-800 object-cover" />;
  }
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-800 text-sm font-semibold text-slate-300">
      {initial}
    </span>
  );
}

function fmt(ts: string, locale: string) {
  const d = new Date(ts);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(locale, { day: '2-digit', month: 'short' }) +
        ' ' +
        d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

export default function CallsPage() {
  const { loading } = useRequireAuth();
  const { t, lang } = useLanguage();
  const { startCall, busy } = useCall();
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    listCalls()
      .then(setCalls)
      .catch((e) => setErr(e?.message ?? String(e)));
  }, []);

  function callBack(c: CallLog, video: boolean) {
    if (!c.chatId || !c.otherUserId) return;
    startCall({ chatId: c.chatId, peerIds: [c.otherUserId], label: c.otherName, video, isGroup: false });
  }

  return (
    <PageShell title={t('calls.title')}>
      {err ? <p className="text-sm text-red-300">{err}</p> : null}

      {loading ? (
        <p className="text-sm text-slate-300">{t('chatsList.loading')}</p>
      ) : calls.length === 0 ? (
        <EmptyState icon={<PhoneIcon size={28} />} title={t('calls.empty')} />
      ) : (
        <ul className="space-y-1">
          {calls.map((c) => {
            // Unanswered incoming = "missed" (red); unanswered outgoing =
            // "unanswered"; answered = direction.
            const trulyMissed = c.missed && c.direction === 'incoming';
            const label = c.missed
              ? c.direction === 'incoming'
                ? t('calls.missed')
                : t('calls.unanswered')
              : c.direction === 'outgoing'
              ? t('calls.outgoing')
              : t('calls.incoming');
            return (
              <li key={c.id} className="flex items-center gap-3 rounded-xl p-2 hover:bg-slate-900/60">
                <Avatar url={c.otherAvatar} name={c.otherName} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{c.otherName}</div>
                  <div className={`flex items-center gap-1 text-xs ${trulyMissed ? 'text-rose-400' : 'text-slate-400'}`}>
                    <span>{c.direction === 'outgoing' ? '↗' : '↙'}</span>
                    <span>{label}</span>
                    <span>· {fmt(c.startedAt, lang)}</span>
                    {c.isVideo ? <VideoIcon size={13} /> : <PhoneIcon size={13} />}
                  </div>
                </div>
                {!c.isGroup && c.otherUserId && c.chatId && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => callBack(c, false)}
                      disabled={busy}
                      className="grid h-9 w-9 place-items-center rounded-full text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-40"
                      aria-label={t('calls.audioCall')}
                      title={t('calls.audioCall')}
                    >
                      <PhoneIcon size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => callBack(c, true)}
                      disabled={busy}
                      className="grid h-9 w-9 place-items-center rounded-full text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-40"
                      aria-label={t('calls.videoCall')}
                      title={t('calls.videoCall')}
                    >
                      <VideoIcon size={18} />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
