'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n/context';
import { listStatusAudience, setStatusHidden, type StatusAudiencePerson } from '@/lib/db/stories';
import { avatarBg, initials } from '@/lib/ui/avatar';

/**
 * "Who can't see my status" manager. Lists everyone who could see my status
 * (my contacts + people I share a chat with) with a per-person toggle. When a
 * person is toggled on, they're added to my status hide list (server-side RLS
 * then excludes them from my status).
 */
export function StatusPrivacyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const [people, setPeople] = useState<StatusAudiencePerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listStatusAudience()
      .then(setPeople)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  async function toggle(person: StatusAudiencePerson) {
    const next = !person.hidden;
    // Optimistic; roll back on failure.
    setPeople((prev) => prev.map((p) => (p.user_id === person.user_id ? { ...p, hidden: next } : p)));
    setPending((prev) => new Set(prev).add(person.user_id));
    try {
      await setStatusHidden(person.user_id, next);
    } catch {
      setPeople((prev) => prev.map((p) => (p.user_id === person.user_id ? { ...p, hidden: !next } : p)));
    } finally {
      setPending((prev) => {
        const n = new Set(prev);
        n.delete(person.user_id);
        return n;
      });
    }
  }

  const hiddenCount = people.filter((p) => p.hidden).length;

  return (
    <div
      className="fixed inset-0 z-[85] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-t-3xl border border-slate-800 toky-glass toky-elev sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-800 p-4">
          <div>
            <div className="text-base font-semibold text-slate-100">{t('statusHide.title')}</div>
            <div className="text-xs text-slate-400">{t('statusHide.desc')}</div>
          </div>
          <button type="button" onClick={onClose} className="rounded bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700">
            {t('common.close')}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="space-y-2 p-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-800/60" />
              ))}
            </div>
          ) : people.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400">{t('statusHide.empty')}</p>
          ) : (
            <ul className="space-y-1">
              {people.map((p) => {
                const name = p.display_name || p.username || '—';
                return (
                  <li key={p.user_id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                    {p.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.avatar_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold text-white ${avatarBg(p.user_id)}`}
                      >
                        {initials(name)}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-100">{name}</span>
                    <button
                      type="button"
                      onClick={() => toggle(p)}
                      disabled={pending.has(p.user_id)}
                      role="switch"
                      aria-checked={p.hidden}
                      aria-label={t('statusHide.cantSee')}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                        p.hidden ? 'bg-rose-600' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          p.hidden ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-slate-800 p-3 text-center text-xs text-slate-400">
          {t('statusHide.hiddenCount', { n: hiddenCount })}
        </div>
      </div>
    </div>
  );
}
