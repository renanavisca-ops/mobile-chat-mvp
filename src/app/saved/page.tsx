'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageShell } from '@/components/page-shell';
import { EmptyState } from '@/components/empty-state';
import { useRequireAuth } from '@/lib/auth/use-require-auth';
import { useLanguage } from '@/lib/i18n/context';
import { listStarredMessages, unstarMessage, type StarredMessage } from '@/lib/db/stars';
import { listChats } from '@/lib/db/chats';

function StarGlyph({ filled, size = 18 }: { filled?: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden
      fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.9 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" />
    </svg>
  );
}

export default function SavedPage() {
  const { loading } = useRequireAuth();
  const { t, lang } = useLanguage();
  const router = useRouter();
  const [items, setItems] = useState<StarredMessage[]>([]);
  const [chatMap, setChatMap] = useState<Map<string, string>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    try {
      const [stars, chats] = await Promise.all([listStarredMessages(), listChats()]);
      const map = new Map<string, string>();
      for (const c of chats) map.set(c.id, c.title || (c.kind === 'group' ? t('chatsList.group') : t('chatsList.directChat')));
      setChatMap(map);
      setItems(stars);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function unstar(messageId: string) {
    setItems((prev) => prev.filter((s) => s.message_id !== messageId));
    try {
      await unstarMessage(messageId);
    } catch {
      load(); // revert on failure
    }
  }

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(lang, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <PageShell title={t('chat.starredTitle')}>
      {err ? <p className="text-sm text-red-300">{err}</p> : null}

      {loading || !loaded ? (
        <p className="text-sm text-slate-300">{t('chatsList.loading')}</p>
      ) : items.length === 0 ? (
        <EmptyState icon={<StarGlyph filled size={26} />} title={t('chat.noStarred')} />
      ) : (
        <ul className="space-y-1">
          {items.map((s) => (
            <li key={s.message_id} className="flex items-center gap-3 rounded-xl p-2 hover:bg-slate-900/60">
              <button
                type="button"
                onClick={() => router.push(`/chats/view?c=${s.chat_id}&m=${s.message_id}`)}
                className="flex min-w-0 flex-1 flex-col items-start text-left"
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-slate-100">{chatMap.get(s.chat_id) || t('chatsList.directChat')}</span>
                  <span className="shrink-0 text-[11px] text-slate-500">{fmt(s.created_at)}</span>
                </span>
                <span className="mt-0.5 line-clamp-2 text-sm text-slate-400">
                  {s.kind === 'deleted' ? t('chat.deletedMessage') : s.preview || t('chatsList.photo')}
                </span>
              </button>
              <button
                type="button"
                onClick={() => unstar(s.message_id)}
                aria-label={t('chat.actionUnstar')}
                className="shrink-0 rounded-full p-2 text-amber-300 hover:bg-slate-800"
              >
                <StarGlyph filled size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
