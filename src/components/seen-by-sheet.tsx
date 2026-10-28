'use client';

import { useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/supabase/client';
import { getMessageReaders } from '@/lib/db/chats';
import { useLanguage } from '@/lib/i18n/context';
import { XIcon } from '@/components/icons';
import { avatarBg, initials } from '@/lib/ui/avatar';

type Member = { id: string; username: string | null; display_name: string | null; avatar_url: string | null };
type Reader = { userId: string; readAt: string; name: string; avatarUrl: string | null };

/**
 * "Seen by" sheet for a group message, shown to its sender. Lists who has read
 * it (with the time) and who hasn't yet. Reads are visible only to chat members
 * via RLS, and refresh live as new reads arrive.
 */
export function SeenBySheet({
  messageId,
  members,
  myId,
  onClose,
}: {
  messageId: string;
  members: Member[];
  myId: string | null;
  onClose: () => void;
}) {
  const { t, lang } = useLanguage();
  const [readers, setReaders] = useState<Reader[] | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => getMessageReaders(messageId).then((r) => { if (alive) setReaders(r); });
    load();
    const supabase = browserSupabase();
    const ch = supabase
      .channel(`reads:${messageId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_reads', filter: `message_id=eq.${messageId}` },
        load,
      )
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [messageId]);

  const readerIds = new Set((readers ?? []).map((r) => r.userId));
  const pending = members.filter((m) => m.id !== myId && !readerIds.has(m.id));
  const nameOf = (m: Member) => m.display_name || m.username || '';
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(lang, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  const Row = ({ name, avatarUrl, sub }: { name: string; avatarUrl: string | null; sub?: string }) => (
    <div className="flex items-center gap-3 py-2">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
      ) : (
        <span
          className="grid h-9 w-9 place-items-center rounded-full text-xs font-semibold text-white"
          style={{ backgroundImage: avatarBg(name) }}
        >
          {initials(name)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-slate-100">{name || t('chat.deletedUser')}</div>
        {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="toky-glass toky-elev flex max-h-[80vh] w-full max-w-sm flex-col rounded-t-3xl border border-slate-800 sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-100">{t('chat.seenBy')}</h2>
          <button onClick={onClose} aria-label={t('common.close')} className="text-slate-400 hover:text-slate-200">
            <XIcon size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
          {readers === null ? (
            <div className="space-y-2 py-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-9 animate-pulse rounded-lg bg-slate-800/60" />
              ))}
            </div>
          ) : (
            <>
              <div className="mt-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-300">
                <span>✓✓ {t('chat.seenByRead')}</span>
                <span className="text-slate-500">{readers.length}</span>
              </div>
              {readers.length === 0 ? (
                <p className="py-2 text-xs text-slate-500">{t('chat.seenByNobody')}</p>
              ) : (
                readers.map((r) => <Row key={r.userId} name={r.name} avatarUrl={r.avatarUrl} sub={fmt(r.readAt)} />)
              )}

              {pending.length > 0 && (
                <>
                  <div className="mt-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <span>{t('chat.seenByPending')}</span>
                    <span className="text-slate-500">{pending.length}</span>
                  </div>
                  <div className="opacity-70">
                    {pending.map((m) => (
                      <Row key={m.id} name={nameOf(m)} avatarUrl={m.avatar_url} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
