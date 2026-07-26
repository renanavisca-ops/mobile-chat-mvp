'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '@/lib/i18n/context';
import { EMOJI_CATEGORIES, ALL_EMOJIS } from '@/lib/emoji-data';

const RECENTS_KEY = 'tokychat:emoji_recents:v1';
const MAX_RECENTS = 32;

function safeReadRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((x) => typeof x === 'string' && x.length > 0).slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

function safeWriteRecents(recents: string[]) {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(recents.slice(0, MAX_RECENTS)));
  } catch {}
}

function pushRecent(emoji: string) {
  const prev = safeReadRecents();
  const next = [emoji, ...prev.filter((x) => x !== emoji)].slice(0, MAX_RECENTS);
  safeWriteRecents(next);
  return next;
}

type Tab = 'recents' | 'all' | 'gif';

export function EmojiPicker(props: {
  open: boolean;
  onClose: () => void;
  onPick: (emoji: string) => void;
  onGif?: () => void;
  anchor?: 'left' | 'right';
}) {
  const { open, onClose, onPick, onGif, anchor = 'left' } = props;
  const t = useT();

  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('recents');
  const [recents, setRecents] = useState<string[]>([]);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setTab('recents');
    setRecents(safeReadRecents());

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const onClickOutside = (e: Event) => {
      const el = boxRef.current;
      if (el && !el.contains(e.target as Node)) onClose();
    };
    // pointerdown fires reliably on touch (mousedown can be flaky in WebViews).
    window.addEventListener('pointerdown', onClickOutside);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onClickOutside);
    };
  }, [open, onClose]);

  const searchResults = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return null;
    return ALL_EMOJIS.filter((x) => x.k.includes(s)).map((x) => x.e);
  }, [q]);

  const recentItems = useMemo(() => {
    const known = new Set(ALL_EMOJIS.map((x) => x.e));
    return recents.filter((e) => known.has(e));
  }, [recents]);

  function pick(emoji: string) {
    setRecents(pushRecent(emoji));
    onPick(emoji);
  }

  if (!open) return null;

  function EmojiButton({ e }: { e: string }) {
    return (
      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-slate-900"
        onClick={() => pick(e)}
      >
        <span className="text-xl">{e}</span>
      </button>
    );
  }

  return (
    <div
      ref={boxRef}
      className={[
        'absolute bottom-14 z-[70] w-80 rounded-3xl border border-slate-800 toky-glass toky-elev',
        anchor === 'right' ? 'right-0' : 'left-0',
      ].join(' ')}
    >
      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-900 p-2">
        <button
          type="button"
          className={`flex-1 rounded-lg px-2 py-1.5 text-xs ${tab === 'recents' ? 'bg-slate-800 text-slate-100' : 'text-slate-300 hover:bg-slate-900'}`}
          onClick={() => { setTab('recents'); setQ(''); }}
        >
          🕘 {t('emoji.recents')}
        </button>
        <button
          type="button"
          className={`flex-1 rounded-lg px-2 py-1.5 text-xs ${tab === 'all' ? 'bg-slate-800 text-slate-100' : 'text-slate-300 hover:bg-slate-900'}`}
          onClick={() => setTab('all')}
        >
          😀 {t('emoji.all')}
        </button>
        <button
          type="button"
          className={`flex-1 rounded-lg px-2 py-1.5 text-xs ${tab === 'gif' ? 'bg-slate-800 text-slate-100' : 'text-slate-300 hover:bg-slate-900'}`}
          onClick={() => {
            setTab('gif');
            onGif?.();
          }}
        >
          🎞️ GIF
        </button>
      </div>

      <div className="p-2">
        {tab === 'gif' ? (
          <div className="p-4 text-center text-sm text-slate-400">
            {onGif ? t('gif.searchPlaceholder') : t('gif.notConfigured')}
          </div>
        ) : tab === 'recents' ? (
          recentItems.length === 0 ? (
            <div className="p-4 text-sm text-slate-400">{t('emoji.noRecents')}</div>
          ) : (
            <div className="grid grid-cols-8 gap-0.5">
              {recentItems.map((e) => (
                <EmojiButton key={`r:${e}`} e={e} />
              ))}
            </div>
          )
        ) : (
          <>
            <input
              className="mb-2 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              placeholder={t('emoji.searchPlaceholder')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
            />
            <div className="max-h-64 overflow-auto">
              {searchResults ? (
                searchResults.length === 0 ? (
                  <div className="p-3 text-sm text-slate-400">{t('emoji.noMatches')}</div>
                ) : (
                  <div className="grid grid-cols-8 gap-0.5">
                    {searchResults.map((e) => (
                      <EmojiButton key={e} e={e} />
                    ))}
                  </div>
                )
              ) : (
                EMOJI_CATEGORIES.map((cat) => (
                  <div key={cat.key}>
                    <div className="sticky top-0 bg-slate-950 px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {cat.label}
                    </div>
                    <div className="grid grid-cols-8 gap-0.5 pb-1">
                      {cat.emojis.map(([e]) => (
                        <EmojiButton key={e} e={e} />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
