'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type EmojiItem = { e: string; n: string; k: string }; // emoji, name, keywords

const RECENTS_KEY = 'tokychat:emoji_recents:v1';
const MAX_RECENTS = 24;

const EMOJIS: EmojiItem[] = [
  // Smileys
  { e: '😀', n: 'grinning', k: 'smile happy' },
  { e: '😄', n: 'smile', k: 'happy joy' },
  { e: '😂', n: 'joy', k: 'lol laugh' },
  { e: '🤣', n: 'rofl', k: 'lol laugh' },
  { e: '😊', n: 'blush', k: 'happy' },
  { e: '😉', n: 'wink', k: 'flirt' },
  { e: '😍', n: 'heart eyes', k: 'love' },
  { e: '😘', n: 'kiss', k: 'love' },
  { e: '😎', n: 'sunglasses', k: 'cool' },
  { e: '🤔', n: 'thinking', k: 'hmm' },
  { e: '😴', n: 'sleeping', k: 'tired' },
  { e: '😭', n: 'cry', k: 'sad' },
  { e: '😡', n: 'angry', k: 'mad' },

  // Gestures
  { e: '👍', n: 'thumbs up', k: 'ok yes' },
  { e: '👎', n: 'thumbs down', k: 'no' },
  { e: '👏', n: 'clap', k: 'congrats' },
  { e: '🙏', n: 'pray', k: 'thanks please' },
  { e: '🙌', n: 'raised hands', k: 'yay' },
  { e: '🤝', n: 'handshake', k: 'deal' },
  { e: '✌️', n: 'peace', k: 'victory' },

  // Hearts
  { e: '❤️', n: 'heart', k: 'love' },
  { e: '💙', n: 'blue heart', k: 'love' },
  { e: '💚', n: 'green heart', k: 'love' },
  { e: '💛', n: 'yellow heart', k: 'love' },
  { e: '💜', n: 'purple heart', k: 'love' },
  { e: '🔥', n: 'fire', k: 'lit hot' },
  { e: '✨', n: 'sparkles', k: 'shine' },

  // Objects
  { e: '🎉', n: 'party', k: 'celebrate' },
  { e: '✅', n: 'check', k: 'done' },
  { e: '❌', n: 'cross', k: 'no' },
  { e: '⚠️', n: 'warning', k: 'alert' },
  { e: '📌', n: 'pin', k: 'pinned' },
  { e: '📎', n: 'paperclip', k: 'attach' },
  { e: '🖼️', n: 'photo', k: 'image' },
  { e: '🎥', n: 'video', k: 'movie' },
  { e: '🎵', n: 'music', k: 'song' },
  { e: '💾', n: 'save', k: 'disk' },
  { e: '🗑️', n: 'delete', k: 'trash' },
];

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

type Tab = 'recents' | 'all';

export function EmojiPicker(props: {
  open: boolean;
  onClose: () => void;
  onPick: (emoji: string) => void;
  anchor?: 'left' | 'right';
}) {
  const { open, onClose, onPick, anchor = 'left' } = props;

  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('recents');
  const [recents, setRecents] = useState<string[]>([]);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    setQ('');
    setTab('recents');
    // load recents on open
    setRecents(safeReadRecents());

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);

    const onClickOutside = (e: MouseEvent) => {
      const el = boxRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) onClose();
    };
    window.addEventListener('mousedown', onClickOutside);

    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClickOutside);
    };
  }, [open, onClose]);

  const filteredAll = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return EMOJIS;
    return EMOJIS.filter((x) => (x.n + ' ' + x.k).toLowerCase().includes(s));
  }, [q]);

  const recentsAsItems = useMemo(() => {
    if (recents.length === 0) return [];
    // Keep order from recents; include only if it exists in our dataset (or allow any)
    const setAll = new Set(EMOJIS.map((x) => x.e));
    return recents.filter((e) => setAll.has(e)).map((e) => ({ e, n: 'recent', k: '' }));
  }, [recents]);

  function pick(emoji: string) {
    // update recents first
    const next = pushRecent(emoji);
    setRecents(next);
    onPick(emoji);
  }

  if (!open) return null;

  const showSearch = tab === 'all';

  return (
    <div
      ref={boxRef}
      className={[
        'absolute bottom-14 z-[70] w-72 rounded-2xl border border-slate-900 bg-slate-950 shadow-xl',
        anchor === 'right' ? 'right-0' : 'left-0',
      ].join(' ')}
    >
      <div className="flex items-center justify-between border-b border-slate-900 p-3">
        <div className="text-sm font-semibold text-slate-100">Emojis</div>
        <button
          className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-100 hover:bg-slate-700"
          onClick={onClose}
          type="button"
        >
          Close
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-900 p-2">
        <button
          type="button"
          className={[
            'flex-1 rounded-lg px-3 py-2 text-xs',
            tab === 'recents' ? 'bg-slate-800 text-slate-100' : 'bg-slate-950 text-slate-300 hover:bg-slate-900',
          ].join(' ')}
          onClick={() => {
            setTab('recents');
            setQ('');
          }}
        >
          🕘 Recents
        </button>
        <button
          type="button"
          className={[
            'flex-1 rounded-lg px-3 py-2 text-xs',
            tab === 'all' ? 'bg-slate-800 text-slate-100' : 'bg-slate-950 text-slate-300 hover:bg-slate-900',
          ].join(' ')}
          onClick={() => setTab('all')}
        >
          😀 All
        </button>
      </div>

      <div className="p-3">
        {showSearch ? (
          <input
            className="mb-3 w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            placeholder="Search… (e.g. love, ok, party)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
        ) : null}

        <div className="max-h-56 overflow-auto rounded-xl border border-slate-900">
          {tab === 'recents' ? (
            recentsAsItems.length === 0 ? (
              <div className="p-3 text-sm text-slate-400">No recents yet.</div>
            ) : (
              <div className="grid grid-cols-8 gap-1 p-2">
                {recentsAsItems.map((x) => (
                  <button
                    key={`r:${x.e}`}
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-slate-900"
                    title="recent"
                    onClick={() => pick(x.e)}
                  >
                    <span className="text-lg">{x.e}</span>
                  </button>
                ))}
              </div>
            )
          ) : (
            <>
              {filteredAll.length === 0 ? (
                <div className="p-3 text-sm text-slate-400">No matches.</div>
              ) : (
                <div className="grid grid-cols-8 gap-1 p-2">
                  {filteredAll.map((x) => (
                    <button
                      key={x.e}
                      type="button"
                      className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-slate-900"
                      title={x.n}
                      onClick={() => pick(x.e)}
                    >
                      <span className="text-lg">{x.e}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="mt-2 text-[11px] text-slate-500">Tip: ESC para cerrar.</div>
      </div>
    </div>
  );
}
