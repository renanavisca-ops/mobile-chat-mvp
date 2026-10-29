'use client';

import { useEffect, useMemo, useState } from 'react';
import { listMyContacts, searchUsers } from '@/lib/db/contacts';
import { useT } from '@/lib/i18n/context';
import { useBackClose } from '@/lib/back';
import { XIcon } from '@/components/icons';
import { avatarBg, initials } from '@/lib/ui/avatar';
import type { ProfileLite } from '@/lib/db/types';

/** Pick one of my contacts (with search) to share into a chat. */
export function ContactPicker({ open, onClose, onPick }: {
  open: boolean;
  onClose: () => void;
  onPick: (c: ProfileLite) => void;
}) {
  const t = useT();
  useBackClose(open, onClose);
  const [contacts, setContacts] = useState<ProfileLite[]>([]);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ProfileLite[]>([]);

  useEffect(() => {
    if (open) {
      setQ('');
      setResults([]);
      listMyContacts().then(setContacts).catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    const query = q.trim();
    if (!query) { setResults([]); return; }
    let alive = true;
    const id = window.setTimeout(() => {
      searchUsers(query).then((r) => { if (alive) setResults(r); }).catch(() => {});
    }, 250);
    return () => { alive = false; window.clearTimeout(id); };
  }, [q]);

  const list = useMemo(() => {
    if (q.trim()) return results;
    return contacts;
  }, [q, results, contacts]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="toky-glass toky-elev flex max-h-[80vh] w-full max-w-md flex-col rounded-t-3xl border border-slate-800 sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-100">{t('contactPicker.title')}</h2>
          <button onClick={onClose} aria-label={t('common.close')} className="text-slate-400 hover:text-slate-200">
            <XIcon size={20} />
          </button>
        </div>
        <div className="px-4 pt-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('contactPicker.search')}
            autoCapitalize="none"
            className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {list.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-slate-500">{t('contactPicker.empty')}</p>
          ) : (
            <ul>
              {list.map((c) => {
                const name = c.display_name || c.username || c.id.slice(0, 8);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => onPick(c)}
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-slate-800"
                    >
                      {c.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <span className="grid h-10 w-10 place-items-center rounded-full text-sm font-semibold text-white" style={{ backgroundImage: avatarBg(name) }}>
                          {initials(name)}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-slate-100">{name}</span>
                        {c.username && <span className="block truncate text-xs text-slate-500">@{c.username}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
