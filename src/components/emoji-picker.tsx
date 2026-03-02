'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type EmojiItem = { e: string; n: string; k: string }; // emoji, name, keywords

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

export function EmojiPicker(props: {
  open: boolean;
  onClose: () => void;
  onPick: (emoji: string) => void;
  anchor?: 'left' | 'right';
}) {
  const { open, onClose, onPick, anchor = 'left' } = props;

  const [q, setQ] = useState('');
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setQ('');

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

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return EMOJIS;
    return EMOJIS.filter((x) => (x.n + ' ' + x.k).toLowerCase().includes(s));
  }, [q]);

  if (!open) return null;

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

      <div className="p-3">
        <input
          className="mb-3 w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          placeholder="Search… (e.g. love, ok, party)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />

        <div className="max-h-56 overflow-auto rounded-xl border border-slate-900">
          {filtered.length === 0 ? (
            <div className="p-3 text-sm text-slate-400">No matches.</div>
          ) : (
            <div className="grid grid-cols-8 gap-1 p-2">
              {filtered.map((x) => (
                <button
                  key={x.e}
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-slate-900"
                  title={x.n}
                  onClick={() => onPick(x.e)}
                >
                  <span className="text-lg">{x.e}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-2 text-[11px] text-slate-500">
          Tip: ESC para cerrar.
        </div>
      </div>
    </div>
  );
}
