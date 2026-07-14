'use client';

import { useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/i18n/context';

type Rotation = 0 | 90 | 180 | 270;
type FilterKey = 'none' | 'grayscale' | 'sepia' | 'vivid' | 'cool' | 'warm';
type Mode = 'view' | 'crop' | 'draw';
type Rect = { x: number; y: number; w: number; h: number };
type Stroke = { color: string; size: number; points: { x: number; y: number }[] };

const FILTERS: { key: FilterKey; css: string }[] = [
  { key: 'none', css: 'none' },
  { key: 'grayscale', css: 'grayscale(1)' },
  { key: 'sepia', css: 'sepia(0.8)' },
  { key: 'vivid', css: 'saturate(1.6) contrast(1.1)' },
  { key: 'cool', css: 'saturate(1.1) hue-rotate(15deg) brightness(1.03)' },
  { key: 'warm', css: 'saturate(1.15) hue-rotate(-12deg) brightness(1.05)' },
];

const BRUSH_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ffffff', '#000000'];

const MAX_DIM = 1600;

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
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [rotation, setRotation] = useState<Rotation>(0);
  const [filter, setFilter] = useState<FilterKey>('none');
  const [mode, setMode] = useState<Mode>('view');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [brushColor, setBrushColor] = useState(BRUSH_COLORS[0]);
  const [brushSize, setBrushSize] = useState(6);
  const [crop, setCrop] = useState<Rect | null>(null);
  const [dragRect, setDragRect] = useState<Rect | null>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  const drawingStroke = useRef<Stroke | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  // Load the image whenever a new file comes in.
  useEffect(() => {
    if (!open || !file) return;
    setReady(false);
    setRotation(0);
    setFilter('none');
    setMode('view');
    setStrokes([]);
    setCrop(null);
    setDragRect(null);

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
    const filterCss = FILTERS.find((f) => f.key === filter)?.css ?? 'none';
    ctx.filter = filterCss;
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
  }, [ready, rotation, filter, strokes]);

  function eventToCanvasPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const p = eventToCanvasPoint(e);
    if (mode === 'draw') {
      drawingStroke.current = { color: brushColor, size: brushSize, points: [p] };
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    } else if (mode === 'crop') {
      dragStart.current = p;
      setDragRect({ x: p.x, y: p.y, w: 0, h: 0 });
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (mode === 'draw' && drawingStroke.current) {
      const p = eventToCanvasPoint(e);
      drawingStroke.current.points.push(p);
      redraw();
    } else if (mode === 'crop' && dragStart.current) {
      const p = eventToCanvasPoint(e);
      const start = dragStart.current;
      setDragRect({
        x: Math.min(start.x, p.x),
        y: Math.min(start.y, p.y),
        w: Math.abs(p.x - start.x),
        h: Math.abs(p.y - start.y),
      });
    }
  }

  function onPointerUp() {
    if (mode === 'draw' && drawingStroke.current) {
      setStrokes((prev) => [...prev, drawingStroke.current!]);
      drawingStroke.current = null;
    } else if (mode === 'crop' && dragStart.current) {
      dragStart.current = null;
      setDragRect((r) => {
        if (r && r.w > 10 && r.h > 10) {
          setCrop(r);
        }
        return null;
      });
    }
  }

  function resetCrop() {
    setCrop(null);
    setDragRect(null);
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
      const edited = new File([blob], file.name, { type });
      onSave(edited);
    } finally {
      setSaving(false);
    }
  }

  if (!open || !file) return null;

  const displayRect = dragRect ?? crop;

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
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            />
            {displayRect && canvasRef.current && (
              <div
                className="pointer-events-none absolute border-2 border-dashed border-amber-400 bg-amber-400/10"
                style={{
                  left: `${(displayRect.x / canvasRef.current.width) * 100}%`,
                  top: `${(displayRect.y / canvasRef.current.height) * 100}%`,
                  width: `${(displayRect.w / canvasRef.current.width) * 100}%`,
                  height: `${(displayRect.h / canvasRef.current.height) * 100}%`,
                }}
              />
            )}
          </div>
        </div>

        <div className="space-y-3 border-t border-slate-900 p-3">
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
              onClick={() => setMode(mode === 'crop' ? 'view' : 'crop')}
              aria-pressed={mode === 'crop'}
              className={`rounded-lg px-3 py-1.5 text-xs ${mode === 'crop' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
            >
              ▣ {t('imageEditor.crop')}
            </button>
            {crop && (
              <button type="button" onClick={resetCrop} className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700">
                {t('imageEditor.resetCrop')}
              </button>
            )}
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

          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
                className={`rounded-lg px-3 py-1.5 text-xs ${filter === f.key ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
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
