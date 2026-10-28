'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/lib/i18n/context';
import { uploadSticker } from '@/lib/db/stickers';
import { XIcon } from '@/components/icons';

const MAX_DIM = 512; // working/output resolution cap
const MAX_HISTORY = 12;

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

type TextItem = { id: number; text: string; xr: number; yr: number; color: string; sizeR: number };

const TEXT_COLORS = ['#ffffff', '#000000', '#f43f5e', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7'];

/** True when a hex color is light enough to need a dark outline. */
function isLight(hex: string): boolean {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

/** Return a copy of `src` with a solid outline of the opaque silhouette. */
function withOutline(src: HTMLCanvasElement, thickness: number, color: string): HTMLCanvasElement {
  const pad = thickness + 1;
  const out = document.createElement('canvas');
  out.width = src.width + pad * 2;
  out.height = src.height + pad * 2;
  const ctx = out.getContext('2d')!;

  // White (or chosen color) silhouette of the source.
  const sil = document.createElement('canvas');
  sil.width = src.width;
  sil.height = src.height;
  const sctx = sil.getContext('2d')!;
  sctx.drawImage(src, 0, 0);
  sctx.globalCompositeOperation = 'source-in';
  sctx.fillStyle = color;
  sctx.fillRect(0, 0, sil.width, sil.height);

  // Stamp the silhouette around a circle to grow the outline, then the image.
  const steps = 24;
  for (let i = 0; i < steps; i++) {
    const a = (Math.PI * 2 * i) / steps;
    ctx.drawImage(sil, pad + Math.cos(a) * thickness, pad + Math.sin(a) * thickness);
  }
  ctx.drawImage(src, pad, pad);
  return out;
}

/** Draw a text item onto a canvas context (with a contrasting outline). */
function drawText(ctx: CanvasRenderingContext2D, item: TextItem, w: number, h: number) {
  const px = Math.round(item.sizeR * h);
  ctx.save();
  ctx.font = `bold ${px}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  const lines = item.text.split('\n');
  const lh = px * 1.15;
  const cx = item.xr * w;
  let cy = item.yr * h - ((lines.length - 1) * lh) / 2;
  ctx.strokeStyle = isLight(item.color) ? '#000000' : '#ffffff';
  ctx.lineWidth = Math.max(2, px * 0.16);
  for (const line of lines) {
    ctx.strokeText(line, cx, cy);
    cy += lh;
  }
  ctx.fillStyle = item.color;
  cy = item.yr * h - ((lines.length - 1) * lh) / 2;
  for (const line of lines) {
    ctx.fillText(line, cx, cy);
    cy += lh;
  }
  ctx.restore();
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
  const stageRef = useRef<HTMLDivElement | null>(null);
  const origRef = useRef<ImageData | null>(null);
  const historyRef = useRef<ImageData[]>([]);
  const [hasImage, setHasImage] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [mode, setMode] = useState<'remove' | 'erase'>('remove');
  const [tol, setTol] = useState(40);
  const [brush, setBrush] = useState(22);
  const [outline, setOutline] = useState(false);
  const [texts, setTexts] = useState<TextItem[]>([]);
  const [selId, setSelId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [stageH, setStageH] = useState(0); // displayed canvas height, for overlay text sizing
  const drawingRef = useRef(false);
  const dragRef = useRef<{ id: number; dx: number; dy: number } | null>(null);
  const nextId = useRef(1);

  // Reset everything when the modal closes.
  useEffect(() => {
    if (!open) {
      setHasImage(false);
      setErr('');
      setMode('remove');
      setOutline(false);
      setTexts([]);
      setSelId(null);
      setCanUndo(false);
      origRef.current = null;
      historyRef.current = [];
    }
  }, [open]);

  // Track the canvas's displayed height so overlay text matches its baked size.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !open) return;
    const measure = () => setStageH(c.clientHeight);
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(c);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [open, hasImage]);

  const getData = () => {
    const c = canvasRef.current;
    if (!c) return null;
    return c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
  };
  const putData = (d: ImageData) => {
    const c = canvasRef.current;
    if (c) c.getContext('2d')!.putImageData(d, 0, 0);
  };

  // Snapshot the current pixels so the action that follows can be undone.
  const pushHistory = () => {
    const d = getData();
    if (!d) return;
    historyRef.current.push(d);
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
    setCanUndo(true);
  };
  const undo = () => {
    const prev = historyRef.current.pop();
    if (prev) putData(prev);
    setCanUndo(historyRef.current.length > 0);
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
        historyRef.current = [];
        setCanUndo(false);
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
    setSelId(null); // tapping the canvas deselects any text
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const { x, y } = toPixel(e);
    pushHistory();
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
    if (origRef.current) {
      const c = canvasRef.current;
      if (c) {
        c.width = origRef.current.width;
        c.height = origRef.current.height;
        putData(origRef.current);
      }
    }
    historyRef.current = [];
    setCanUndo(false);
    setTexts([]);
    setSelId(null);
  };

  // --- Text overlays ---------------------------------------------------------
  const addText = () => {
    const id = nextId.current++;
    setTexts((prev) => [...prev, { id, text: t('stickers.textPlaceholder'), xr: 0.5, yr: 0.82, color: '#ffffff', sizeR: 0.14 }]);
    setSelId(id);
  };
  const updateText = (id: number, patch: Partial<TextItem>) =>
    setTexts((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const removeText = (id: number) => {
    setTexts((prev) => prev.filter((x) => x.id !== id));
    setSelId((cur) => (cur === id ? null : cur));
  };

  const onTextDown = (e: React.PointerEvent, item: TextItem) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setSelId(item.id);
    const stage = stageRef.current?.getBoundingClientRect();
    if (!stage) return;
    dragRef.current = { id: item.id, dx: e.clientX - (stage.left + item.xr * stage.width), dy: e.clientY - (stage.top + item.yr * stage.height) };
  };
  const onTextMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    const stage = stageRef.current?.getBoundingClientRect();
    if (!drag || !stage) return;
    const xr = Math.max(0, Math.min(1, (e.clientX - drag.dx - stage.left) / stage.width));
    const yr = Math.max(0, Math.min(1, (e.clientY - drag.dy - stage.top) / stage.height));
    updateText(drag.id, { xr, yr });
  };
  const onTextUp = () => {
    dragRef.current = null;
  };

  const save = async () => {
    const c = canvasRef.current;
    if (!c) return;
    setSaving(true);
    setErr('');
    try {
      // Compose: cutout (+ optional outline) with the text baked on top.
      let base: HTMLCanvasElement = c;
      let offX = 0;
      let offY = 0;
      if (outline) {
        const thickness = Math.max(3, Math.round(Math.max(c.width, c.height) * 0.02));
        base = withOutline(c, thickness, '#ffffff');
        offX = thickness + 1;
        offY = thickness + 1;
      }
      const stageCanvas = document.createElement('canvas');
      stageCanvas.width = base.width;
      stageCanvas.height = base.height;
      const sctx = stageCanvas.getContext('2d')!;
      sctx.drawImage(base, 0, 0);
      // Text positions are relative to the cutout canvas; shift by the outline pad.
      for (const item of texts) {
        if (!item.text.trim()) continue;
        const shifted: TextItem = { ...item, xr: (item.xr * c.width + offX) / base.width, yr: (item.yr * c.height + offY) / base.height, sizeR: (item.sizeR * c.height) / base.height };
        drawText(sctx, shifted, base.width, base.height);
      }
      const blob = await trimToBlob(stageCanvas);
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

  const sel = texts.find((x) => x.id === selId) || null;
  // Live CSS preview of the white outline (approximate; baked exactly on save).
  const outlineFilter = outline
    ? 'drop-shadow(1.5px 0 0 #fff) drop-shadow(-1.5px 0 0 #fff) drop-shadow(0 1.5px 0 #fff) drop-shadow(0 -1.5px 0 #fff) drop-shadow(1px 1px 0 #fff) drop-shadow(-1px -1px 0 #fff) drop-shadow(1px -1px 0 #fff) drop-shadow(-1px 1px 0 #fff)'
    : undefined;

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
            <div ref={stageRef} className="relative inline-block" style={{ display: hasImage ? 'inline-block' : 'block' }}>
              <canvas
                ref={canvasRef}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
                style={{ filter: outlineFilter }}
                className={`block max-h-[46vh] max-w-full ${hasImage ? (mode === 'erase' ? 'cursor-crosshair' : 'cursor-pointer') : 'hidden'}`}
              />
              {/* Draggable text overlays */}
              {hasImage &&
                texts.map((item) => (
                  <div
                    key={item.id}
                    onPointerDown={(e) => onTextDown(e, item)}
                    onPointerMove={onTextMove}
                    onPointerUp={onTextUp}
                    onPointerCancel={onTextUp}
                    className="absolute cursor-move select-none whitespace-pre text-center font-bold leading-tight"
                    style={{
                      left: `${item.xr * 100}%`,
                      top: `${item.yr * 100}%`,
                      transform: 'translate(-50%, -50%)',
                      color: item.color,
                      fontSize: `${Math.max(12, item.sizeR * stageH)}px`,
                      WebkitTextStroke: `${Math.max(1, item.sizeR * stageH * 0.08)}px ${isLight(item.color) ? '#000' : '#fff'}`,
                      touchAction: 'none',
                      outline: selId === item.id ? '1px dashed rgba(255,255,255,0.6)' : 'none',
                    }}
                  >
                    {item.text || ' '}
                  </div>
                ))}
            </div>
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
                {sel ? t('stickers.dragTextHint') : mode === 'remove' ? t('stickers.tapBackgroundHint') : t('stickers.eraseHint')}
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

              {/* Undo / outline / add text */}
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={undo} disabled={!canUndo} className="flex-1 rounded-xl bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-40">
                  ↩︎ {t('stickers.undo')}
                </button>
                <button
                  type="button"
                  onClick={() => setOutline((v) => !v)}
                  aria-pressed={outline}
                  className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium ${outline ? 'toky-grad text-white' : 'bg-slate-800 text-slate-300'}`}
                >
                  ⬜ {t('stickers.outline')}
                </button>
                <button type="button" onClick={addText} className="flex-1 rounded-xl bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700">
                  🔤 {t('stickers.addText')}
                </button>
              </div>

              {/* Text editor (shown when a text is selected) */}
              {sel && (
                <div className="mt-3 space-y-2 rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
                  <textarea
                    value={sel.text}
                    onChange={(e) => updateText(sel.id, { text: e.target.value })}
                    rows={2}
                    placeholder={t('stickers.textPlaceholder')}
                    className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{t('stickers.textColor')}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {TEXT_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => updateText(sel.id, { color: c })}
                          aria-label={c}
                          className={`h-6 w-6 rounded-full border-2 ${sel.color === c ? 'border-white' : 'border-transparent'}`}
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-xs text-slate-500">{t('stickers.textSize')}</span>
                    <input
                      type="range"
                      min={6}
                      max={30}
                      value={Math.round(sel.sizeR * 100)}
                      onChange={(e) => updateText(sel.id, { sizeR: Number(e.target.value) / 100 })}
                      className="w-full accent-emerald-500"
                    />
                    <button type="button" onClick={() => removeText(sel.id)} aria-label={t('stickers.deleteText')} className="shrink-0 rounded-lg bg-slate-800 px-2 py-1 text-slate-300 hover:bg-rose-900/60">
                      <XIcon size={16} />
                    </button>
                  </div>
                </div>
              )}

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
