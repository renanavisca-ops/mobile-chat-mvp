'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Full-screen "message effect" overlay, à la iMessage screen effects. When a
 * message with a trigger arrives (or you send one) a short celebratory effect
 * plays: a canvas fireworks burst (with sound) for New Year, or a rain of
 * emoji for birthdays, Christmas, love, etc. Triggers come from both emoji in
 * the text and festive phrases (Spanish + English). Purely decorative,
 * pointer-events-none, and it respects prefers-reduced-motion.
 */

type Kind = 'fireworks' | 'rain';

interface EffectDef {
  kind: Kind;
  /** Emoji used by the "rain" renderer. */
  emojis?: string[];
  /** Fall slower (snow) vs. normal confetti speed. */
  slow?: boolean;
  /** Synthesized sound to play alongside the visual. */
  sound?: 'fireworks';
}

// Effect ids → how they render. detectEffect() returns one of these keys.
const EFFECTS: Record<string, EffectDef> = {
  fireworks: { kind: 'fireworks', sound: 'fireworks' },
  confetti: { kind: 'rain', emojis: ['🎉', '🎊', '✨', '🥳'] },
  balloons: { kind: 'rain', emojis: ['🎈', '🎉', '🎊'] },
  snow: { kind: 'rain', emojis: ['❄️', '🎄', '⛄', '✨'], slow: true },
  hearts: { kind: 'rain', emojis: ['❤️', '💕', '💖', '😍'] },
  fire: { kind: 'rain', emojis: ['🔥', '🔥', '✨'] },
  thumbs: { kind: 'rain', emojis: ['👍', '👍', '✨'] },
  laugh: { kind: 'rain', emojis: ['😂', '😂', '😆'] },
};

// Festive phrases (accent- and case-insensitive) → effect id. Checked before
// the emoji triggers so "¡Feliz año nuevo! 🎉" still plays fireworks.
const PHRASES: { re: RegExp; effect: string }[] = [
  { re: /(feliz\s+a(?:n|ñ)o\s+nuevo|pr(?:o|ó)spero\s+a(?:n|ñ)o|happy\s+new\s+year|a(?:n|ñ)o\s+nuevo|fuegos\s+artificiales|fireworks)/i, effect: 'fireworks' },
  { re: /(feliz\s+cumplea(?:n|ñ)os|feliz\s+cumple|happy\s+birthday)/i, effect: 'balloons' },
  { re: /(felicidades|felicitaciones|congrats|congratulations)/i, effect: 'confetti' },
  { re: /(feliz\s+navidad|merry\s+christmas|felices\s+fiestas|happy\s+holidays)/i, effect: 'snow' },
  { re: /(te\s+amo|te\s+quiero\s+mucho|i\s+love\s+you|feliz\s+san\s+valent(?:i|í)n|happy\s+valentine)/i, effect: 'hearts' },
];

// Emoji → effect id (first match wins).
const EMOJI_EFFECTS: { emoji: string; effect: string }[] = [
  { emoji: '🎆', effect: 'fireworks' },
  { emoji: '🎇', effect: 'fireworks' },
  { emoji: '🧨', effect: 'fireworks' },
  { emoji: '🎉', effect: 'confetti' },
  { emoji: '🎊', effect: 'confetti' },
  { emoji: '🥳', effect: 'confetti' },
  { emoji: '🎈', effect: 'balloons' },
  { emoji: '🎂', effect: 'balloons' },
  { emoji: '🎄', effect: 'snow' },
  { emoji: '❄️', effect: 'snow' },
  { emoji: '☃️', effect: 'snow' },
  { emoji: '⛄', effect: 'snow' },
  { emoji: '❤️', effect: 'hearts' },
  { emoji: '🥰', effect: 'hearts' },
  { emoji: '😍', effect: 'hearts' },
  { emoji: '🔥', effect: 'fire' },
  { emoji: '👍', effect: 'thumbs' },
  { emoji: '😂', effect: 'laugh' },
];

export function detectEffect(text: string | undefined | null): string | null {
  if (!text) return null;
  for (const { re, effect } of PHRASES) {
    if (re.test(text)) return effect;
  }
  for (const { emoji, effect } of EMOJI_EFFECTS) {
    if (text.includes(emoji)) return effect;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Sound (synthesized, no audio asset shipped). Reuses one AudioContext.

let audioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!audioCtx) audioCtx = new Ctor();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
  } catch {
    return null;
  }
}

/** A single firework "pop": a low thump + a short filtered-noise crackle. */
function fireworkPop(ctx: AudioContext, when: number, gainScale: number) {
  // Boom: low sine with a fast decay.
  const osc = ctx.createOscillator();
  const og = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(140, when);
  osc.frequency.exponentialRampToValueAtTime(50, when + 0.18);
  og.gain.setValueAtTime(0.0001, when);
  og.gain.exponentialRampToValueAtTime(0.5 * gainScale, when + 0.01);
  og.gain.exponentialRampToValueAtTime(0.0001, when + 0.25);
  osc.connect(og).connect(ctx.destination);
  osc.start(when);
  osc.stop(when + 0.3);

  // Crackle: high-passed white noise with a quick decay.
  const dur = 0.5;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / data.length;
    data[i] = (Math.random() * 2 - 1) * (1 - t) * (1 - t);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1500;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, when);
  ng.gain.exponentialRampToValueAtTime(0.35 * gainScale, when + 0.03);
  ng.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  noise.connect(hp).connect(ng).connect(ctx.destination);
  noise.start(when);
  noise.stop(when + dur);
}

function playFireworksSound(offsetsMs: number[]) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.02;
  offsetsMs.forEach((ms, i) => fireworkPop(ctx, t0 + ms / 1000, i === 0 ? 1 : 0.85));
}

// ---------------------------------------------------------------------------
// Fireworks canvas renderer.

const BURST_OFFSETS = [0, 350, 750, 1150, 1650, 2150, 2600];

function FireworksCanvas({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      doneRef.current();
      return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = (canvas.width = Math.floor(window.innerWidth * dpr));
    const H = (canvas.height = Math.floor(window.innerHeight * dpr));

    const colors = ['#ff4d6d', '#ffd60a', '#4cc9f0', '#80ed99', '#c77dff', '#ff9e00', '#ffffff'];
    type P = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number };
    let particles: P[] = [];

    function burst(cx: number, cy: number) {
      const base = colors[Math.floor(Math.random() * colors.length)];
      const n = 56 + Math.floor(Math.random() * 40);
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + Math.random() * 0.25;
        const sp = (1.4 + Math.random() * 3.4) * dpr;
        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 0,
          max: 850 + Math.random() * 550,
          color: Math.random() < 0.18 ? '#ffffff' : base,
          size: (1.4 + Math.random() * 1.6) * dpr,
        });
      }
    }

    const start = performance.now();
    let last = start;
    let bi = 0;
    let raf = 0;

    const frame = (now: number) => {
      const dt = Math.min(now - last, 40);
      last = now;
      const elapsed = now - start;

      while (bi < BURST_OFFSETS.length && elapsed >= BURST_OFFSETS[bi]) {
        burst((0.15 + Math.random() * 0.7) * W, (0.14 + Math.random() * 0.42) * H);
        bi++;
      }

      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      const g = (0.02 * dpr * dt) / 16; // gravity per frame
      particles = particles.filter((p) => p.life < p.max);
      for (const p of particles) {
        p.life += dt;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += g;
        p.vx *= 0.985;
        p.vy *= 0.985;
        const alpha = Math.max(0, 1 - p.life / p.max);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (elapsed < 3300 || particles.length > 0) {
        raf = requestAnimationFrame(frame);
      } else {
        doneRef.current();
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      {/* Night-sky dim so the sparks read like iMessage's fireworks. */}
      <div className="toky-fx-dim pointer-events-none fixed inset-0 z-[94] bg-black" aria-hidden="true" />
      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[95]" aria-hidden="true" />
    </>
  );
}

// ---------------------------------------------------------------------------
// Emoji-rain renderer (confetti / snow / hearts / reactions).

type Particle = { id: number; left: number; delay: number; dur: number; emoji: string; size: number };

function EmojiRain({ def, onDone }: { def: EffectDef; onDone: () => void }) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const set = def.emojis && def.emojis.length ? def.emojis : ['✨'];
    const slow = def.slow;
    const next: Particle[] = Array.from({ length: slow ? 34 : 28 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * (slow ? 1200 : 600),
      dur: (slow ? 3200 : 1800) + Math.random() * (slow ? 1800 : 1200),
      emoji: set[i % set.length],
      size: 20 + Math.random() * 22,
    }));
    setParticles(next);
    const timer = window.setTimeout(() => {
      setParticles([]);
      doneRef.current();
    }, slow ? 3800 : 2800);
    return () => window.clearTimeout(timer);
  }, [def]);

  if (particles.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[95] overflow-hidden" aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute -top-10 select-none"
          style={{
            left: `${p.left}%`,
            fontSize: `${p.size}px`,
            animation: `messageEffectFall ${p.dur}ms ${p.delay}ms cubic-bezier(0.4,0,0.6,1) forwards`,
          }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}

export function MessageEffects({ trigger, onDone }: { trigger: string | null; onDone: () => void }) {
  // Play the sound as a side-effect when the trigger changes (kept here so it
  // fires once per effect, within the user-gesture window on send).
  useEffect(() => {
    if (!trigger) return;
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      onDone();
      return;
    }
    const def = EFFECTS[trigger];
    if (def?.sound === 'fireworks') playFireworksSound(BURST_OFFSETS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  if (!trigger) return null;
  const def = EFFECTS[trigger];
  if (!def) return null;

  const reduce =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return null;

  if (def.kind === 'fireworks') return <FireworksCanvas onDone={onDone} />;
  return <EmojiRain def={def} onDone={onDone} />;
}
