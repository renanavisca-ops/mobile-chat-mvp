'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '@/lib/i18n/context';
import { useBackClose } from '@/lib/back';
import { XIcon, TrashIcon } from '@/components/icons';
import {
  listCachedMedia,
  deleteCachedPaths,
  deleteCachedForChat,
  clearMediaCache,
  type CachedMediaItem,
} from '@/lib/storage/media-cache';
import { listChats } from '@/lib/db/chats';

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

type ChatRow = { chatId: string | null; title: string; size: number; count: number };

/**
 * On-device storage manager. Shows how much the media cache uses, broken down
 * by chat and by largest files, and lets the user free space. This only clears
 * the LOCAL cache — the shared copy in storage is untouched, so cleared media
 * simply re-downloads next time it's opened.
 */
export function StorageManager({ onClose }: { onClose: () => void }) {
  const { t, lang } = useLanguage();
  useBackClose(true, onClose);

  const [items, setItems] = useState<CachedMediaItem[] | null>(null);
  const [titles, setTitles] = useState<Map<string, string>>(new Map());
  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [media, chats] = await Promise.all([listCachedMedia(), listChats().catch(() => [])]);
    const map = new Map<string, string>();
    for (const c of chats) {
      map.set(c.id, c.title || (c.kind === 'group' ? t('chatsList.group') : t('chatsList.directChat')));
    }
    setTitles(map);
    setItems(media);
    try {
      if (navigator.storage?.estimate) {
        const e = await navigator.storage.estimate();
        setEstimate({ usage: e.usage ?? 0, quota: e.quota ?? 0 });
      }
    } catch {}
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = useMemo(() => (items ?? []).reduce((a, b) => a + b.size, 0), [items]);

  const byChat = useMemo<ChatRow[]>(() => {
    const m = new Map<string, ChatRow>();
    for (const it of items ?? []) {
      const key = it.chatId ?? '—';
      const row = m.get(key) ?? {
        chatId: it.chatId,
        title: it.chatId ? titles.get(it.chatId) ?? t('storage.unknownChat') : t('storage.otherFiles'),
        size: 0,
        count: 0,
      };
      row.size += it.size;
      row.count += 1;
      m.set(key, row);
    }
    return Array.from(m.values()).sort((a, b) => b.size - a.size);
  }, [items, titles, t]);

  const largest = useMemo(
    () => [...(items ?? [])].sort((a, b) => b.size - a.size).slice(0, 12),
    [items],
  );

  async function clearChat(chatId: string | null) {
    if (busy) return;
    setBusy(true);
    try {
      if (chatId) await deleteCachedForChat(chatId);
      else await deleteCachedPaths((items ?? []).filter((i) => !i.chatId).map((i) => i.path));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function clearOne(path: string) {
    if (busy) return;
    setBusy(true);
    try {
      await deleteCachedPaths([path]);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function clearAll() {
    if (busy) return;
    setBusy(true);
    try {
      await clearMediaCache();
      await load();
    } finally {
      setBusy(false);
    }
  }

  const fileName = (path: string) => decodeURIComponent(path.split('/').pop() || path).replace(/^\d+_[0-9a-f-]+_/i, '');

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="toky-glass toky-elev flex max-h-[85vh] w-full max-w-md flex-col rounded-t-3xl border border-slate-800 sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-100">{t('storage.title')}</h2>
          <button onClick={onClose} aria-label={t('common.close')} className="text-slate-400 hover:text-slate-200">
            <XIcon size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {items === null ? (
            <div className="space-y-2 py-2">
              {[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-800/60" />)}
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                <div className="text-xs text-slate-400">{t('storage.cacheUsed')}</div>
                <div className="mt-0.5 text-2xl font-semibold text-slate-100">{formatBytes(total)}</div>
                {estimate && estimate.quota > 0 && (
                  <div className="mt-1 text-[11px] text-slate-500">
                    {t('storage.deviceUsed', { used: formatBytes(estimate.usage), quota: formatBytes(estimate.quota) })}
                  </div>
                )}
                <div className="mt-2 text-[11px] text-slate-500">{t('storage.localOnlyNote')}</div>
              </div>

              {total === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">{t('storage.empty')}</p>
              ) : (
                <>
                  {/* By chat */}
                  <div className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('storage.byChat')}</div>
                  <div className="space-y-1.5">
                    {byChat.map((row) => (
                      <div key={row.chatId ?? '—'} className="flex items-center gap-3 rounded-lg border border-slate-900 bg-slate-950/40 p-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm text-slate-100">{row.title}</div>
                          <div className="text-[11px] text-slate-500">{formatBytes(row.size)} · {row.count} {t('storage.items')}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => clearChat(row.chatId)}
                          disabled={busy}
                          className="shrink-0 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                        >
                          {t('storage.free')}
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Largest files */}
                  <div className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('storage.largest')}</div>
                  <div className="space-y-1.5">
                    {largest.map((it) => (
                      <div key={it.path} className="flex items-center gap-3 rounded-lg border border-slate-900 bg-slate-950/40 p-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs text-slate-300">{fileName(it.path)}</div>
                          <div className="text-[11px] text-slate-500">
                            {formatBytes(it.size)}
                            {it.chatId && titles.get(it.chatId) ? ` · ${titles.get(it.chatId)}` : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => clearOne(it.path)}
                          disabled={busy}
                          aria-label={t('storage.free')}
                          className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-rose-300 disabled:opacity-50"
                        >
                          <TrashIcon size={16} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={clearAll}
                    disabled={busy}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-900/60 bg-rose-950/30 px-4 py-2.5 text-sm font-medium text-rose-200 hover:bg-rose-950/50 disabled:opacity-50"
                  >
                    <TrashIcon size={16} /> {t('storage.clearAll')}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
