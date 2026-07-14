'use client';

import { useEffect, useMemo, useState } from 'react';
import { useT } from '@/lib/i18n/context';
import type { ChatSummary } from '@/lib/db/types';

export function ForwardModal(props: {
  open: boolean;
  chats: ChatSummary[];
  loading: boolean;
  onClose: () => void;
  onConfirm: (chatIds: string[]) => Promise<void>;
}) {
  const { open, chats, loading, onClose, onConfirm } = props;
  const t = useT();

  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) {
      setQ('');
      setSelected({});
      setBusy(false);
      setErr('');
    }
  }, [open]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return chats;

    return chats.filter((c) => {
      const title = (c.title ?? '').toLowerCase();
      const kind = (c.kind ?? '').toLowerCase();
      return title.includes(s) || kind.includes(s) || c.id.toLowerCase().includes(s);
    });
  }, [chats, q]);

  const selectedIds = useMemo(() => Object.keys(selected).filter((id) => selected[id]), [selected]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-900 bg-slate-950 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-900 p-4">
          <div>
            <div className="text-base font-semibold text-slate-100">{t('forward.title')}</div>
            <div className="text-xs text-slate-400">{t('forward.subtitle')}</div>
          </div>
          <button
            className="rounded bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700"
            onClick={onClose}
            disabled={busy}
          >
            {t('forward.close')}
          </button>
        </div>

        <div className="p-4">
          {err ? <div className="mb-3 text-sm text-red-300">{err}</div> : null}

          <input
            className="mb-3 w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            placeholder={t('forward.searchPlaceholder')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <div className="max-h-72 overflow-auto rounded-xl border border-slate-900">
            {loading ? (
              <div className="p-3 text-sm text-slate-400">{t('forward.loadingChats')}</div>
            ) : filtered.length === 0 ? (
              <div className="p-3 text-sm text-slate-400">{t('forward.noMatches')}</div>
            ) : (
              <ul className="divide-y divide-slate-900">
                {filtered.map((c) => {
                  const checked = !!selected[c.id];
                  const title =
                    c.kind === 'group'
                      ? c.title ?? t('forward.group')
                      : c.title ?? t('forward.direct');

                  return (
                    <li key={c.id} className="flex items-center gap-3 p-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setSelected((prev) => ({ ...prev, [c.id]: e.target.checked }))
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-slate-100">{title}</div>
                        <div className="truncate text-xs text-slate-500">
                          {c.kind} • {c.id}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-xs text-slate-400">
              {t('forward.selected')} <span className="font-mono">{selectedIds.length}</span>
            </div>

            <button
              className="rounded bg-blue-600 px-4 py-2 text-sm hover:bg-blue-500 disabled:opacity-60"
              disabled={busy || selectedIds.length === 0}
              onClick={async () => {
                setErr('');
                setBusy(true);
                try {
                  await onConfirm(selectedIds);
                  onClose();
                } catch (e: any) {
                  setErr(e?.message ?? String(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t('forward.forward')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
