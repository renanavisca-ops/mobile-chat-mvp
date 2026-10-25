'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/lib/i18n/context';
import { uploadSticker } from '@/lib/db/stickers';
import { XIcon } from '@/components/icons';

const MAX_DIM = 512; // working/output resolution cap

type RGB = { r: number; g: number; b: number };

function colorAt(d: Uint8ClampedArray, i: number): RGB {
  return { r: d[i], g: d[i + 1], b: d[i + 2] };
}

/** Flood-fill transparency from a seed pixel over connected pixels whose color
 *  is within `tol` of the seed (classic "remove plain background"). */
function floodErase(data: ImageData, sx: number, sy: number, tol: number) {
  const { width: w, height: h, data: d } = data;
  const sIdx = (sy * w + sx) * 4;
  if (d[sIdx + 3] === 0) return; // already transparent
  const seed = colorAt(d, sIdx);
  const tol2 = tol * tol * 3; // compare squared distance against 3 channels
  const seen = new Uint8Array(w * h);
  const stack: number[] = [sy * w + sx];
  while (stack.length) {
    const p = stack.pop()!;
    if (seen[p]) continue;
    seen[p] = 1;
    const i = p * 4;
    if (d[i + 3] === 0) continue;
    const dr = d[i] - seed.r;
    const dg = d[i + 1] - seed.g;
    const db = d[i + 2] - seed.b;
    if (dr * dr + dg * dg + db * db > tol2) continue;
    d[i + 3] = 0; // erase
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w);
    if (y < h - 1) stack.push(p + w);
  }
}

/** Crop a canvas to its non-transparent bounds (+small padding). Returns a PNG blob. */
function trimToBlob(src: HTMLCanvasElement): Promise<Blob | null> {
  const ctx = src.getContext('2d')!;
  const { width: w, height: h } = src;
  const d = ctx.getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] !== 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return Promise.resolve(null); // fully transparent
  const pad = 6;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  out.getContext('2d')!.drawImage(src, minX, minY, cw, ch, 0, 0, cw, ch);
  return new Promise((r) => out.toBlob(r, 'image/png'));
}

export function StickerCreator({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (url: string) => void;
}) {
  const { t } = useLanguage();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const origRef = useRef<ImageData | null>(null);
  const [hasImage, setHasImage] = useState(false);
  const [mode, setMode] = useState<'remove' | 'erase'>('remove');
  const [tol, setTol] = useState(40);
  const [brush, setBrush] = useState(22);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const drawingRef = useRef(false);

  // Reset everything when the modal closes.
  useEffect(() => {
    if (!open) {
      setHasImage(false);
      setErr('');
      setMode('remove');
      origRef.current = null;
    }
  }, [open]);

  const getData = () => {
    const c = canvasRef.current;
    if (!c) return null;
    return c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
  };
  const putData = (d: ImageData) => {
    const c = canvasRef.current;
    if (c) c.getContext('2d')!.putImageData(d, 0, 0);
  };

  const loadFile = useCallback(
    (file: File) => {
      setErr('');
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const c = canvasRef.current;
        if (!c) return;
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d')!;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        origRef.current = ctx.getImageData(0, 0, w, h);
        // Auto-remove a plain background touching the corners (the common case).
        const d = ctx.getImageData(0, 0, w, h);
        for (const [sx, sy] of [
          [0, 0],
          [w - 1, 0],
          [0, h - 1],
          [w - 1, h - 1],
        ] as const) {
          floodErase(d, sx, sy, tol);
        }
        ctx.putImageData(d, 0, 0);
        setHasImage(true);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        setErr(t('stickers.loadError'));
      };
      img.src = url;
    },
    [tol, t]
  );

  // Map a pointer event to canvas pixel coordinates.
  const toPixel = (e: React.PointerEvent) => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * c.width);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * c.height);
    return { x: Math.max(0, Math.min(c.width - 1, x)), y: Math.max(0, Math.min(c.height - 1, y)) };
  };

  const eraseCircle = (cx: number, cy: number) => {
    const c = canvasRef.current!;
    const ctx = c.getContext('2d')!;
    const r = Math.max(2, Math.round((brush / 100) * Math.max(c.width, c.height) * 0.12));
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const onDown = (e: React.PointerEvent) => {
    if (!hasImage) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const { x, y } = toPixel(e);
    if (mode === 'remove') {
      const d = getData();
      if (!d) return;
      floodErase(d, x, y, tol);
      putData(d);
    } else {
      drawingRef.current = true;
      eraseCircle(x, y);
    }
  };
  const onMove = (e: React.PointerEvent) => {
    if (mode !== 'erase' || !drawingRef.current) return;
    const { x, y } = toPixel(e);
    eraseCircle(x, y);
  };
  const onUp = () => {
    drawingRef.current = false;
  };

  const reset = () => {
    if (origRef.current) putData(origRef.current);
  };

  const save = async () => {
    const c = canvasRef.current;
    if (!c) return;
    setSaving(true);
    setErr('');
    try {
      const blob = await trimToBlob(c);
      if (!blob) throw new Error(t('stickers.emptyError'));
      const { url } = await uploadSticker(blob);
      onCreated(url);
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="toky-glass toky-elev flex max-h-[92vh] w-full max-w-md flex-col rounded-t-3xl border border-slate-800 sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="font-display text-base font-bold text-slate-100">{t('stickers.create')}</h2>
          <button onClick={onClose} aria-label={t('common.cancel')} className="text-slate-400 hover:text-slate-200">
            <XIcon size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) loadFile(f);
              e.currentTarget.value = '';
            }}
          />

          {/* Canvas area on a checkerboard (shows transparency) */}
          <div
            className="toky-checker mx-auto flex max-h-[46vh] items-center justify-center overflow-hidden rounded-2xl border border-slate-800"
            style={{ touchAction: 'none' }}
          >
            <canvas
              ref={canvasRef}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              className={`max-h-[46vh] max-w-full ${hasImage ? (mode === 'erase' ? 'cursor-crosshair' : 'cursor-pointer') : 'hidden'}`}
            />
            {!hasImage && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-40 w-full flex-col items-center justify-center gap-2 text-sm text-slate-400"
              >
                <span className="toky-grad toky-ring-brand grid h-14 w-14 place-items-center rounded-2xl text-white text-2xl">🖼️</span>
                {t('stickers.pickImage')}
              </button>
            )}
          </div>

          {hasImage && (
            <>
              <p className="mt-3 text-center text-xs text-slate-500">
                {mode === 'remove' ? t('stickers.tapBackgroundHint') : t('stickers.eraseHint')}
              </p>

              {/* Mode toggle */}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode('remove')}
                  className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium ${mode === 'remove' ? 'toky-grad text-white' : 'bg-slate-800 text-slate-300'}`}
                >
                  {t('stickers.removeBg')}
                </button>
                <button
                  type="button"
                  onClick={() => setMode('erase')}
                  className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium ${mode === 'erase' ? 'toky-grad text-white' : 'bg-slate-800 text-slate-300'}`}
                >
                  🧽 {t('stickers.eraser')}
                </button>
              </div>

              {/* Slider: tolerance (remove) or brush size (erase) */}
              <div className="mt-3">
                <label className="mb-1 block text-xs text-slate-500">
                  {mode === 'remove' ? t('stickers.tolerance') : t('stickers.brushSize')}
                </label>
                {mode === 'remove' ? (
                  <input type="range" min={5} max={120} value={tol} onChange={(e) => setTol(Number(e.target.value))} className="w-full accent-emerald-500" />
                ) : (
                  <input type="range" min={5} max={100} value={brush} onChange={(e) => setBrush(Number(e.target.value))} className="w-full accent-emerald-500" />
                )}
              </div>

              <div className="mt-2 flex gap-2">
                <button type="button" onClick={reset} className="flex-1 rounded-xl bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700">
                  {t('stickers.reset')}
                </button>
                <button type="button" onClick={() => fileRef.current?.click()} className="flex-1 rounded-xl bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700">
                  {t('stickers.changeImage')}
                </button>
              </div>
            </>
          )}

          {err && <p className="mt-3 text-center text-xs text-rose-300">{err}</p>}
        </div>

        <div className="border-t border-slate-800 p-3">
          <button
            type="button"
            onClick={save}
            disabled={!hasImage || saving}
            className="toky-grad toky-ring-brand w-full rounded-full py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? t('stickers.saving') : t('stickers.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
