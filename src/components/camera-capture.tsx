'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Live webcam capture modal (works on desktop and mobile via getUserMedia).
 * Produces a JPEG File and hands it back through onCapture.
 */
export function CameraCapture({
  open,
  onClose,
  onCapture,
}: {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [err, setErr] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setErr('');
    setReady(false);

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch (e: any) {
        setErr(
          e?.name === 'NotAllowedError'
            ? 'Permiso de cámara denegado. Habilítalo en el navegador.'
            : e?.name === 'NotFoundError'
            ? 'No se encontró ninguna cámara.'
            : `No se pudo abrir la cámara: ${e?.message ?? String(e)}`
        );
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCapture(file);
        onClose();
      },
      'image/jpeg',
      0.9
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-900 bg-slate-950 p-3 shadow-xl">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-100">Tomar foto</div>
          <button
            type="button"
            className="rounded bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>

        {err ? (
          <p className="p-4 text-sm text-red-300">{err}</p>
        ) : (
          <>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} playsInline muted className="w-full rounded-lg bg-black" />
            <div className="mt-3 flex justify-center">
              <button
                type="button"
                onClick={capture}
                disabled={!ready}
                className="rounded-full bg-blue-600 px-6 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-60"
              >
                📸 Capturar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
