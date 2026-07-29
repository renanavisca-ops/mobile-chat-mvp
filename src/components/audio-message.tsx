'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';

function fmt(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/**
 * Compact, self-contained voice/audio player. We deliberately avoid the native
 * <audio controls> element: on Android WebView it renders as a bare white pill
 * with a "⋮" overflow menu that opens off-screen. This gives a clean play/pause
 * button + progress bar + time that matches the chat bubbles instead.
 */
export function AudioMessage({ src, mine }: { src: string; mine?: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCur(a.currentTime);
    const onMeta = () => setDur(isFinite(a.duration) ? a.duration : 0);
    const onEnd = () => {
      setPlaying(false);
      setCur(0);
    };
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('durationchange', onMeta);
    a.addEventListener('ended', onEnd);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('durationchange', onMeta);
      a.removeEventListener('ended', onEnd);
    };
  }, []);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      void a.play();
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  }

  function seek(e: ChangeEvent<HTMLInputElement>) {
    const a = audioRef.current;
    if (!a) return;
    const t = Number(e.target.value);
    a.currentTime = t;
    setCur(t);
  }

  const pct = dur > 0 ? Math.min(100, (cur / dur) * 100) : 0;
  const track = mine ? 'rgba(255,255,255,0.30)' : 'rgba(148,163,184,0.35)';
  const fill = mine ? '#ffffff' : '#cbd5e1';

  return (
    <div
      className={`mt-2 flex items-center gap-3 rounded-full px-2 py-1.5 ${
        mine ? 'bg-white/15' : 'bg-slate-900/70'
      }`}
    >
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      <button
        type="button"
        onClick={toggle}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-slate-900"
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      <input
        type="range"
        min={0}
        max={dur || 0}
        step={0.1}
        value={cur}
        onChange={seek}
        aria-label="Seek"
        className="toky-audio-range h-1.5 flex-1 cursor-pointer appearance-none rounded-full"
        style={{ background: `linear-gradient(to right, ${fill} ${pct}%, ${track} ${pct}%)` }}
      />
      <span className="w-9 shrink-0 text-right text-[11px] tabular-nums opacity-80">
        {fmt(playing || cur > 0 ? cur : dur)}
      </span>
    </div>
  );
}
