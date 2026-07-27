'use client';

import { useEffect, useRef, useState } from 'react';
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

const OUT = 256; // avatar output resolution (square)

function gradientCss([a, b]: [string, string]) {
  return `linear-gradient(135deg, ${a}, ${b})`;
}

async function renderEmoji(emoji: string, grad: [string, string]): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = OUT;
  canvas.height = OUT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  const g = ctx.createLinearGradient(0, 0, OUT, OUT);
  g.addColorStop(0, grad[0]);
  g.addColorStop(1, grad[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, OUT, OUT);

  ctx.font = '150px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, OUT / 2, OUT / 2 + 10);

  const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/png', 0.92));
  if (!blob) throw new Error('Could not render avatar');
  return new File([blob], `avatar_${Date.now()}.png`, { type: 'image/png' });
}

function fileFromCanvas(canvas: HTMLCanvasElement): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(new File([blob], `avatar_${Date.now()}.jpg`, { type: 'image/jpeg' })) : reject(new Error('Could not render avatar'))),
      'image/jpeg',
      0.9,
    );
  });
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
  const [mode, setMode] = useState<'emoji' | 'photo'>('emoji');
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [gradIndex, setGradIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const savingRef = useRef(false);

  // Photo-crop state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const drag = useRef({ active: false, sx: 0, sy: 0, ox: 0, oy: 0 });
  const [hasPhoto, setHasPhoto] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });

  const baseScale = (img: HTMLImageElement) => Math.max(OUT / img.naturalWidth, OUT / img.naturalHeight);

  function clampOff(o: { x: number; y: number }, eff: number, img: HTMLImageElement) {
    const mx = Math.max(0, (img.naturalWidth * eff - OUT) / 2);
    const my = Math.max(0, (img.naturalHeight * eff - OUT) / 2);
    return { x: Math.max(-mx, Math.min(mx, o.x)), y: Math.max(-my, Math.min(my, o.y)) };
  }

  function draw() {
    const c = canvasRef.current;
    const img = imgRef.current;
    if (!c || !img) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const eff = baseScale(img) * zoom;
    const drawW = img.naturalWidth * eff;
    const drawH = img.naturalHeight * eff;
    const o = clampOff(off, eff, img);
    ctx.clearRect(0, 0, OUT, OUT);
    ctx.fillStyle = '#0b1222';
    ctx.fillRect(0, 0, OUT, OUT);
    ctx.drawImage(img, (OUT - drawW) / 2 + o.x, (OUT - drawH) / 2 + o.y, drawW, drawH);
  }

  // Redraw whenever the crop changes or the photo tab becomes visible.
  useEffect(() => {
    if (open && mode === 'photo') draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, off, hasPhoto, mode, open]);

  if (!open) return null;

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setZoom(1);
      setOff({ x: 0, y: 0 });
      setHasPhoto(true);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      setErr('Could not load that image.');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!hasPhoto) return;
    drag.current = { active: true, sx: e.clientX, sy: e.clientY, ox: off.x, oy: off.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drag.current.active) return;
    const img = imgRef.current;
    if (!img) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const factor = OUT / rect.width; // CSS px → canvas px
    const eff = baseScale(img) * zoom;
    const next = {
      x: drag.current.ox + (e.clientX - drag.current.sx) * factor,
      y: drag.current.oy + (e.clientY - drag.current.sy) * factor,
    };
    setOff(clampOff(next, eff, img));
  }
  function onPointerUp() {
    drag.current.active = false;
  }

  async function save() {
    if (savingRef.current) return;
    savingRef.current = true;
    setBusy(true);
    setErr('');
    try {
      let file: File;
      if (mode === 'photo') {
        if (!canvasRef.current || !hasPhoto) throw new Error(t('avatarCreator.choosePhoto'));
        file = await fileFromCanvas(canvasRef.current);
      } else {
        file = await renderEmoji(emoji, GRADIENTS[gradIndex]);
      }
      const url = await uploadAvatar(userId, file);
      // The /api/avatar route already syncs avatar_url; this keeps older callers
      // consistent and is a no-op if the value already matches.
      const supabase = browserSupabase();
      await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId);
      onSaved(url);
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
      savingRef.current = false;
    }
  }

  const tabClass = (active: boolean) =>
    `flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
      active ? 'toky-grad text-white' : 'text-slate-300 hover:bg-slate-900'
    }`;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-3xl border border-slate-800 toky-glass toky-elev p-4">
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold text-slate-100">{t('avatarCreator.title')}</div>
          <button type="button" onClick={onClose} className="rounded bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700">
            {t('common.close')}
          </button>
        </div>

        {/* Mode toggle */}
        <div className="mt-3 flex gap-1 rounded-xl border border-slate-800 bg-slate-900/60 p-1">
          <button type="button" className={tabClass(mode === 'emoji')} onClick={() => setMode('emoji')}>
            {t('avatarCreator.modeEmoji')}
          </button>
          <button type="button" className={tabClass(mode === 'photo')} onClick={() => setMode('photo')}>
            {t('avatarCreator.modePhoto')}
          </button>
        </div>

        {err && <p className="mt-2 text-center text-xs text-red-400">{err}</p>}

        {mode === 'emoji' ? (
          <>
            <div className="mt-4 flex justify-center">
              <div
                className="grid h-24 w-24 place-items-center rounded-full text-5xl"
                style={{ background: gradientCss(GRADIENTS[gradIndex]) }}
              >
                {emoji}
              </div>
            </div>

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
          </>
        ) : (
          <div className="mt-4 flex flex-col items-center">
            {/* Circular crop preview (drag to reposition) */}
            <div className="relative h-56 w-56">
              <canvas
                ref={canvasRef}
                width={OUT}
                height={OUT}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                className={`h-56 w-56 touch-none rounded-full ring-2 ring-white/15 ${hasPhoto ? 'cursor-grab active:cursor-grabbing' : ''}`}
                style={{ background: '#0b1222' }}
              />
              {!hasPhoto && (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="absolute inset-0 grid place-items-center rounded-full text-center text-sm text-slate-300"
                >
                  <span className="toky-grad rounded-full px-4 py-2 font-semibold text-white">
                    {t('avatarCreator.choosePhoto')}
                  </span>
                </button>
              )}
            </div>

            {hasPhoto && (
              <>
                <div className="mt-4 flex w-full items-center gap-2">
                  <span className="text-xs text-slate-400">{t('avatarCreator.zoom')}</span>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.01}
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="flex-1 accent-blue-500"
                  />
                </div>
                <p className="mt-2 text-center text-[11px] text-slate-500">{t('avatarCreator.dragHint')}</p>
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="mt-2 text-xs font-medium text-blue-400 hover:text-blue-300"
                >
                  {t('avatarCreator.chooseAnother')}
                </button>
              </>
            )}

            <input ref={photoInputRef} type="file" hidden accept="image/*" onChange={onPickPhoto} />
          </div>
        )}

        <button
          type="button"
          onClick={save}
          disabled={busy || (mode === 'photo' && !hasPhoto)}
          className="mt-5 w-full toky-grad toky-ring-brand rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? t('avatarCreator.saving') : t('avatarCreator.save')}
        </button>
      </div>
    </div>
  );
}
