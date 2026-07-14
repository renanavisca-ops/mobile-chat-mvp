'use client';

import { useEffect, useState } from 'react';

/**
 * Lightweight full-screen "message effect" overlay, à la iMessage screen
 * effects. When a message containing a trigger emoji arrives (or you send
 * one), a burst of floating emoji plays for a couple of seconds. Purely
 * decorative and pointer-events-none, and it respects prefers-reduced-motion.
 */

// Map a trigger emoji to the emoji rained across the screen.
const TRIGGERS: Record<string, string[]> = {
  '🎉': ['🎉', '🎊', '✨'],
  '🎊': ['🎉', '🎊', '✨'],
  '❤️': ['❤️', '💕', '💖'],
  '🥳': ['🎉', '🥳', '✨'],
  '🎈': ['🎈', '🎈', '🎉'],
  '🔥': ['🔥', '🔥', '✨'],
  '👍': ['👍', '👍', '✨'],
  '😂': ['😂', '😂', '😆'],
};

export function detectEffect(text: string | undefined | null): string | null {
  if (!text) return null;
  for (const key of Object.keys(TRIGGERS)) {
    if (text.includes(key)) return key;
  }
  return null;
}

type Particle = { id: number; left: number; delay: number; dur: number; emoji: string; size: number };

export function MessageEffects({ trigger, onDone }: { trigger: string | null; onDone: () => void }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!trigger) return;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      onDone();
      return;
    }

    const set = TRIGGERS[trigger] ?? [trigger];
    const next: Particle[] = Array.from({ length: 28 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 600,
      dur: 1800 + Math.random() * 1200,
      emoji: set[i % set.length],
      size: 20 + Math.random() * 22,
    }));
    setParticles(next);

    const timer = window.setTimeout(() => {
      setParticles([]);
      onDone();
    }, 2800);
    return () => window.clearTimeout(timer);
  }, [trigger, onDone]);

  if (!trigger || particles.length === 0) return null;

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
