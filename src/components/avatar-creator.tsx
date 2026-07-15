'use client';

import { useRef, useState } from 'react';
import { uploadAvatar } from '@/lib/db/avatar';
import { browserSupabase } from '@/lib/supabase/client';
import { useT } from '@/lib/i18n/context';

const EMOJIS = [
  // Expressive faces
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
  '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
  '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪',
  '😝', '🤗', '🤭', '🤫', '🤔', '😐', '😏', '😌',
  '😎', '🤓', '🧐', '🥳', '🤠', '🥸', '😴', '🤤',
  '😵‍💫', '🥴', '😈', '👻', '💀', '🤖', '🎃', '👽',
  // Animals
  '🐶', '🐱', '🦊', '🐼', '🐨', '🦁', '🐯', '🐸',
  '🐵', '🐧', '🐥', '🦉', '🦄', '🐙', '🦖', '🐳',
  '🦋', '🐝', '🐢', '🦕', '🦈', '🐺', '🐰', '🐻',
  // Vibes / objects
  '🌸', '🌈', '🔥', '⚡', '💎', '🌙', '⭐', '✨',
  '🎧', '🎮', '🚀', '👑', '🍀', '🌵', '🍕', '🎸',
  '⚽', '🏀', '🎯', '💜', '💙', '💚', '❤️', '🧡',
];

const GRADIENTS: [string, string][] = [
  ['#6366f1', '#a855f7'],
  ['#0ea5e9', '#22d3ee'],
  ['#f43f5e', '#f59e0b'],
  ['#10b981', '#84cc16'],
  ['#db2777', '#7c3aed'],
  ['#f97316', '#eab308'],
  ['#334155', '#64748b'],
  ['#ec4899', '#8b5cf6'],
  ['#06b6d4', '#3b82f6'],
  ['#ef4444', '#ec4899'],
  ['#22c55e', '#14b8a6'],
  ['#a3a3a3', '#404040'],
];

function gradientCss([a, b]: [string, string]) {
  return `linear-gradient(135deg, ${a}, ${b})`;
}

async function renderAvatar(emoji: string, grad: [string, string]): Promise<File> {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, grad[0]);
  g.addColorStop(1, grad[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  ctx.font = '150px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, size / 2, size / 2 + 10);

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.92));
  if (!blob) throw new Error('Could not render avatar');
  return new File([blob], `avatar_${Date.now()}.png`, { type: 'image/png' });
}

export function AvatarCreator({
  open,
  userId,
  onClose,
  onSaved,
}: {
  open: boolean;
  userId: string;
  onClose: () => void;
  onSaved: (url: string) => void;
}) {
  const t = useT();
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [gradIndex, setGradIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const savingRef = useRef(false);

  if (!open) return null;

  async function save() {
    if (savingRef.current) return;
    savingRef.current = true;
    setBusy(true);
    setErr('');
    try {
      const file = await renderAvatar(emoji, GRADIENTS[gradIndex]);
      const url = await uploadAvatar(userId, file);
      const supabase = browserSupabase();
      const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId);
      if (error) throw error;
      onSaved(url);
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
      savingRef.current = false;
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-900 bg-slate-950 p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold text-slate-100">{t('avatarCreator.title')}</div>
          <button type="button" onClick={onClose} className="rounded bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700">
            {t('common.close')}
          </button>
        </div>

        <div className="mt-4 flex justify-center">
          <div
            className="grid h-24 w-24 place-items-center rounded-full text-5xl"
            style={{ background: gradientCss(GRADIENTS[gradIndex]) }}
          >
            {emoji}
          </div>
        </div>

        {err && <p className="mt-2 text-center text-xs text-red-400">{err}</p>}

        <div className="mt-4">
          <div className="mb-1.5 text-xs text-slate-400">{t('avatarCreator.pickEmoji')}</div>
          <div className="grid max-h-40 grid-cols-8 gap-1 overflow-y-auto">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                aria-label={e}
                className={`grid h-8 w-8 place-items-center rounded-lg text-lg hover:bg-slate-900 ${
                  emoji === e ? 'bg-slate-800 ring-1 ring-indigo-500' : ''
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 text-xs text-slate-400">{t('avatarCreator.pickBackground')}</div>
          <div className="flex flex-wrap gap-2">
            {GRADIENTS.map((g, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setGradIndex(i)}
                aria-label={t('avatarCreator.pickBackground')}
                className={`h-8 w-8 rounded-full border-2 ${gradIndex === i ? 'border-white' : 'border-transparent'}`}
                style={{ background: gradientCss(g) }}
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="mt-5 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? t('avatarCreator.saving') : t('avatarCreator.save')}
        </button>
      </div>
    </div>
  );
}
