'use client';

// A synthesized ringtone (no audio file needed) plus vibration, for incoming
// calls. Uses the Web Audio API to play a classic two-tone ring on a loop.
let ctx: AudioContext | null = null;
let ringInterval: number | null = null;
let vibrateInterval: number | null = null;

function ringOnce() {
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const freq of [440, 480]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.32, now + 0.05);
    gain.gain.setValueAtTime(0.32, now + 1.6);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);
    osc.start(now);
    osc.stop(now + 2.05);
  }
}

export function startRingtone() {
  stopRingtone();
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (AC) {
      ctx = new AC();
      void ctx.resume();
      ringOnce();
      ringInterval = window.setInterval(ringOnce, 4000);
    }
  } catch {
    // audio may be blocked; vibration below still helps on mobile
  }
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate([600, 1000]);
      vibrateInterval = window.setInterval(() => {
        try {
          navigator.vibrate([600, 1000]);
        } catch {}
      }, 3000);
    }
  } catch {}
}

export function stopRingtone() {
  if (ringInterval) {
    clearInterval(ringInterval);
    ringInterval = null;
  }
  if (vibrateInterval) {
    clearInterval(vibrateInterval);
    vibrateInterval = null;
  }
  try {
    navigator.vibrate?.(0);
  } catch {}
  if (ctx) {
    try {
      void ctx.close();
    } catch {}
    ctx = null;
  }
}
