'use client';

import { useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/i18n/context';

type Rotation = 0 | 90 | 180 | 270;
type FilterKey = 'none' | 'grayscale' | 'sepia' | 'vivid' | 'cool' | 'warm' | 'noir' | 'fade' | 'bright';
type Mode = 'view' | 'crop' | 'draw';
type Rect = { x: number; y: number; w: number; h: number };
type Stroke = { color: string; size: number; points: { x: number; y: number }[] };
type Corner = 'nw' | 'ne' | 'sw' | 'se';

const FILTERS: { key: FilterKey; css: string }[] = [
  { key: 'none', css: 'none' },
  { key: 'vivid', css: 'saturate(1.6) contrast(1.1)' },
  { key: 'bright', css: 'brightness(1.15) saturate(1.1)' },
  { key: 'fade', css: 'contrast(0.85) brightness(1.08) saturate(0.9)' },
  { key: 'warm', css: 'saturate(1.15) hue-rotate(-12deg) brightness(1.05)' },
  { key: 'cool', css: 'saturate(1.1) hue-rotate(15deg) brightness(1.03)' },
  { key: 'grayscale', css: 'grayscale(1)' },
  { key: 'noir', css: 'grayscale(1) contrast(1.3)' },
  { key: 'sepia', css: 'sepia(0.8)' },
];

const ASPECTS: { key: string; label: string; value: number | null }[] = [
  { key: 'free', label: 'aspectFree', value: null },
  { key: 'square', label: 'aspectSquare', value: 1 },
  { key: 'portrait', label: 'aspectPortrait', value: 4 / 5 },
  { key: 'wide', label: 'aspectWide', value: 16 / 9 },
];

const BRUSH_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ffffff', '#000000'];

const MAX_DIM = 1600;
const MIN_CROP = 32;

function centeredCrop(cw: number, ch: number, aspect: number | null): Rect {
  if (!aspect) {
    const m = 0.06;
    return { x: cw * m, y: ch * m, w: cw * (1 - 2 * m), h: ch * (1 - 2 * m) };
  }
  let w = cw;
  let h = w / aspect;
  if (h > ch) { h = ch; w = h * aspect; }
  w *= 0.9;
  h *= 0.9;
  return { x: (cw - w) / 2, y: (ch - h) / 2, w, h };
}

export function ImageEditor({
  open,
  file,
  onClose,
  onSave,
}: {
  open: boolean;
  file: File | null;
  onClose: () => void;
  onSave: (file: File) => void;
}) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [rotation, setRotation] = useState<Rotation>(0);
  const [flipH, setFlipH] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('none');
  const [mode, setMode] = useState<Mode>('view');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [brushColor, setBrushColor] = useState(BRUSH_COLORS[0]);
  const [brushSize, setBrushSize] = useState(6);
  const [crop, setCrop] = useState<Rect | null>(null);
  const [aspect, setAspect] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  const drawingStroke = useRef<Stroke | null>(null);
  // Active crop drag: which handle (or move), the fixed anchor corner, and the
  // crop at gesture start.
  const cropDrag = useRef<{ type: Corner | 'move'; anchor: { x: number; y: number }; start: Rect; sx: number; sy: number } | null>(null);

  // Load the image whenever a new file comes in.
  useEffect(() => {
    if (!open || !file) return;
    setReady(false);
    setRotation(0);
    setFlipH(false);
    setFilter('none');
    setMode('view');
    setStrokes([]);
    setCrop(null);
    setAspect(null);

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setReady(true);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [open, file]);

  function canvasSize(): { w: number; h: number } {
    const img = imgRef.current;
    if (!img) return { w: 0, h: 0 };
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    const scale = Math.min(1, MAX_DIM / Math.max(w, h));
    w = Math.round(w * scale);
    h = Math.round(h * scale);
    return rotation === 90 || rotation === 270 ? { w: h, h: w } : { w, h };
  }

  function redraw() {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !ready) return;
    const { w, h } = canvasSize();
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    if (flipH) ctx.scale(-1, 1);
    ctx.filter = FILTERS.find((f) => f.key === filter)?.css ?? 'none';
    const drawW = rotation === 90 || rotation === 270 ? h : w;
    const drawH = rotation === 90 || rotation === 270 ? w : h;
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
    ctx.filter = 'none';

    for (const s of strokes) drawStroke(ctx, s);
    if (drawingStroke.current) drawStroke(ctx, drawingStroke.current);
  }

  function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
    if (s.points.length === 0) return;
    ctx.save();
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(s.points[0].x, s.points[0].y);
    for (const p of s.points.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.restore();
  }

  useEffect(() => {
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, rotation, flipH, filter, strokes]);

  // -------- Drawing (freehand) on the canvas
  function canvasPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }
  function onCanvasDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (mode !== 'draw') return;
    drawingStroke.current = { color: brushColor, size: brushSize, points: [canvasPoint(e)] };
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  }
  function onCanvasMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (mode !== 'draw' || !drawingStroke.current) return;
    drawingStroke.current.points.push(canvasPoint(e));
    redraw();
  }
  function onCanvasUp() {
    if (mode === 'draw' && drawingStroke.current) {
      setStrokes((prev) => [...prev, drawingStroke.current!]);
      drawingStroke.current = null;
    }
  }

  // -------- Crop overlay (move + corner-handle resize, optional aspect lock)
  function enterCrop() {
    const { w, h } = canvasSize();
    setCrop(centeredCrop(w, h, aspect));
    setMode('crop');
  }
  function chooseAspect(a: number | null) {
    setAspect(a);
    const { w, h } = canvasSize();
    setCrop(centeredCrop(w, h, a));
  }
  function overlayPoint(e: React.PointerEvent) {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!canvas || !rect) return { x: 0, y: 0 };
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }
  function startCropDrag(e: React.PointerEvent, type: Corner | 'move') {
    e.stopPropagation();
    if (!crop) return;
    const p = overlayPoint(e);
    const anchorFor: Record<Corner, { x: number; y: number }> = {
      nw: { x: crop.x + crop.w, y: crop.y + crop.h },
      ne: { x: crop.x, y: crop.y + crop.h },
      sw: { x: crop.x + crop.w, y: crop.y },
      se: { x: crop.x, y: crop.y },
    };
    cropDrag.current = {
      type,
      anchor: type === 'move' ? { x: 0, y: 0 } : anchorFor[type],
      start: crop,
      sx: p.x,
      sy: p.y,
    };
    overlayRef.current?.setPointerCapture(e.pointerId);
  }
  function onOverlayMove(e: React.PointerEvent) {
    const d = cropDrag.current;
    if (!d) return;
    const { w: cw, h: ch } = canvasSize();
    const p = overlayPoint(e);
    if (d.type === 'move') {
      let nx = d.start.x + (p.x - d.sx);
      let ny = d.start.y + (p.y - d.sy);
      nx = Math.max(0, Math.min(nx, cw - d.start.w));
      ny = Math.max(0, Math.min(ny, ch - d.start.h));
      setCrop({ x: nx, y: ny, w: d.start.w, h: d.start.h });
      return;
    }
    const px = Math.max(0, Math.min(p.x, cw));
    const py = Math.max(0, Math.min(p.y, ch));
    let x2 = px;
    let y2 = py;
    let w = Math.abs(x2 - d.anchor.x);
    let h = Math.abs(y2 - d.anchor.y);
    if (aspect) {
      if (w / h > aspect) h = w / aspect;
      else w = h * aspect;
      x2 = d.anchor.x + Math.sign(px - d.anchor.x || 1) * w;
      y2 = d.anchor.y + Math.sign(py - d.anchor.y || 1) * h;
    }
    const nx = Math.min(d.anchor.x, x2);
    const ny = Math.min(d.anchor.y, y2);
    const nw = Math.max(MIN_CROP, Math.abs(x2 - d.anchor.x));
    const nh = Math.max(MIN_CROP, Math.abs(y2 - d.anchor.y));
    setCrop({
      x: Math.max(0, Math.min(nx, cw - nw)),
      y: Math.max(0, Math.min(ny, ch - nh)),
      w: nw,
      h: nh,
    });
  }
  function onOverlayUp() {
    cropDrag.current = null;
  }

  async function save() {
    const canvas = canvasRef.current;
    if (!canvas || !file) return;
    setSaving(true);
    try {
      redraw();
      const region = crop ?? { x: 0, y: 0, w: canvas.width, h: canvas.height };
      const out = document.createElement('canvas');
      out.width = Math.max(1, Math.round(region.w));
      out.height = Math.max(1, Math.round(region.h));
      const octx = out.getContext('2d');
      if (!octx) return;
      octx.drawImage(canvas, region.x, region.y, region.w, region.h, 0, 0, out.width, out.height);

      const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const blob: Blob | null = await new Promise((resolve) => out.toBlob(resolve, type, 0.92));
      if (!blob) return;
      onSave(new File([blob], file.name, { type }));
    } finally {
      setSaving(false);
    }
  }

  if (!open || !file) return null;

  const cw = canvasRef.current?.width || 1;
  const ch = canvasRef.current?.height || 1;
  const pct = (v: number, total: number) => `${(v / total) * 100}%`;
  const handleCls =
    'absolute h-5 w-5 rounded-full border-2 border-white bg-indigo-500 shadow touch-none -translate-x-1/2 -translate-y-1/2';

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/80 p-3">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-900 bg-slate-950 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-900 p-3">
          <div className="text-sm font-semibold text-slate-100">{t('imageEditor.title')}</div>
          <button type="button" onClick={onClose} className="rounded bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700">
            {t('common.close')}
          </button>
        </div>

        <div className="flex items-center justify-center overflow-auto bg-black/30 p-3">
          <div className="relative inline-block">
            <canvas
              ref={canvasRef}
              className="max-h-[50vh] max-w-full touch-none rounded-lg border border-slate-800"
              onPointerDown={onCanvasDown}
              onPointerMove={onCanvasMove}
              onPointerUp={onCanvasUp}
              onPointerLeave={onCanvasUp}
            />

            {mode === 'crop' && crop && (
              <div
                ref={overlayRef}
                className="absolute inset-0 touch-none"
                onPointerMove={onOverlayMove}
                onPointerUp={onOverlayUp}
                onPointerCancel={onOverlayUp}
              >
                {/* Dimmed mask outside the crop box (four bands). */}
                <div className="pointer-events-none absolute inset-x-0 top-0 bg-black/55" style={{ height: pct(crop.y, ch) }} />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/55" style={{ height: pct(ch - crop.y - crop.h, ch) }} />
                <div className="pointer-events-none absolute left-0 bg-black/55" style={{ top: pct(crop.y, ch), height: pct(crop.h, ch), width: pct(crop.x, cw) }} />
                <div className="pointer-events-none absolute right-0 bg-black/55" style={{ top: pct(crop.y, ch), height: pct(crop.h, ch), width: pct(cw - crop.x - crop.w, cw) }} />

                {/* Crop box: draggable to move, with rule-of-thirds grid. */}
                <div
                  className="absolute cursor-move border border-white/90 touch-none"
                  style={{ left: pct(crop.x, cw), top: pct(crop.y, ch), width: pct(crop.w, cw), height: pct(crop.h, ch) }}
                  onPointerDown={(e) => startCropDrag(e, 'move')}
                >
                  <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="border border-white/20" />
                    ))}
                  </div>
                </div>

                {/* Corner handles. */}
                {(['nw', 'ne', 'sw', 'se'] as Corner[]).map((c) => {
                  const left = c === 'nw' || c === 'sw' ? crop.x : crop.x + crop.w;
                  const top = c === 'nw' || c === 'ne' ? crop.y : crop.y + crop.h;
                  return (
                    <div
                      key={c}
                      className={handleCls}
                      style={{ left: pct(left, cw), top: pct(top, ch), cursor: c === 'nw' || c === 'se' ? 'nwse-resize' : 'nesw-resize' }}
                      onPointerDown={(e) => startCropDrag(e, c)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3 border-t border-slate-900 p-3">
          {/* Primary tools */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setRotation((r) => ((r + 90) % 360) as Rotation)}
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
            >
              ↻ {t('imageEditor.rotate')}
            </button>
            <button
              type="button"
              onClick={() => setFlipH((v) => !v)}
              aria-pressed={flipH}
              className={`rounded-lg px-3 py-1.5 text-xs ${flipH ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
            >
              ⇄ {t('imageEditor.flip')}
            </button>
            <button
              type="button"
              onClick={() => (mode === 'crop' ? setMode('view') : enterCrop())}
              aria-pressed={mode === 'crop'}
              className={`rounded-lg px-3 py-1.5 text-xs ${mode === 'crop' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
            >
              ▣ {t('imageEditor.crop')}
            </button>
            <button
              type="button"
              onClick={() => setMode(mode === 'draw' ? 'view' : 'draw')}
              aria-pressed={mode === 'draw'}
              className={`rounded-lg px-3 py-1.5 text-xs ${mode === 'draw' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
            >
              ✏️ {t('imageEditor.draw')}
            </button>
            {strokes.length > 0 && (
              <button
                type="button"
                onClick={() => setStrokes([])}
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
              >
                {t('imageEditor.clearDrawing')}
              </button>
            )}
          </div>

          {/* Aspect presets (crop mode) */}
          {mode === 'crop' && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-900 bg-slate-950/60 p-2">
              {ASPECTS.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => chooseAspect(a.value)}
                  aria-pressed={aspect === a.value}
                  className={`rounded-lg px-3 py-1.5 text-xs ${aspect === a.value ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
                >
                  {t(`imageEditor.${a.label}`)}
                </button>
              ))}
            </div>
          )}

          {/* Brush palette (draw mode) */}
          {mode === 'draw' && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-900 bg-slate-950/60 p-2">
              {BRUSH_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setBrushColor(c)}
                  aria-pressed={brushColor === c}
                  className={`h-6 w-6 rounded-full border-2 ${brushColor === c ? 'border-white' : 'border-transparent'}`}
                  style={{ background: c }}
                />
              ))}
              <input
                type="range"
                min={2}
                max={24}
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="ml-2 flex-1"
              />
            </div>
          )}

          {/* Filters */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs ${filter === f.key ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
              >
                {t(`imageEditor.filter_${f.key}`)}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || !ready}
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {saving ? t('imageEditor.saving') : t('imageEditor.applyAndSend')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
