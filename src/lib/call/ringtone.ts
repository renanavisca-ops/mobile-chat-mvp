'use client';

// Synthesized call tones (no audio file needed) plus vibration:
//   - startRingtone(): the INCOMING ring heard by the callee.
//   - startRingback(): the ringback heard by the CALLER while the callee's
//     phone is ringing (previously missing — the caller heard nothing).
//
// Both reuse ONE AudioContext that is unlocked on the first user gesture via
// primeRingAudio(). A fresh AudioContext created at call time (with no user
// gesture) starts 'suspended' on mobile/WebView and plays NOTHING, which is why
// a call could arrive silently even with the app open — priming fixes that.

let ctx: AudioContext | null = null;
let unlockBound = false;

function getCtx(): AudioContext | null {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/**
 * Bind a one-time unlock so the ring AudioContext is resumed on the first user
 * interaction anywhere in the app. Call this once on app start (CallProvider).
 * Idempotent and safe to call on the server (no-ops without window).
 */
export function primeRingAudio() {
  if (unlockBound || typeof window === 'undefined') return;
  unlockBound = true;
  const unlock = () => {
    const c = getCtx();
    if (c && c.state === 'suspended') void c.resume();
  };
  for (const evt of ['pointerdown', 'touchstart', 'keydown', 'click']) {
    try {
      window.addEventListener(evt, unlock, { passive: true });
    } catch {}
  }
}

let toneInterval: number | null = null;
let vibrateInterval: number | null = null;

// A classic two-frequency ring burst (440 + 480 Hz) at the given gain/length.
function ringBurst(gainPeak: number, length: number) {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  for (const freq of [440, 480]) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(c.destination);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.05);
    gain.gain.setValueAtTime(gainPeak, now + length - 0.4);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + length);
    osc.start(now);
    osc.stop(now + length + 0.05);
  }
}

function clearTimers() {
  if (toneInterval) {
    clearInterval(toneInterval);
    toneInterval = null;
  }
  if (vibrateInterval) {
    clearInterval(vibrateInterval);
    vibrateInterval = null;
  }
  try {
    navigator.vibrate?.(0);
  } catch {}
}

/** INCOMING ring (callee): loud two-tone every 4s + vibration. */
export function startRingtone() {
  stopRingtone();
  try {
    ringBurst(0.32, 2.0);
    toneInterval = window.setInterval(() => ringBurst(0.32, 2.0), 4000);
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

/**
 * RINGBACK (caller): a softer single burst on a ~1s-on / ~3s-off cadence while
 * we wait for the callee to answer. No vibration (it's our own outgoing call).
 */
export function startRingback() {
  stopRingtone();
  try {
    ringBurst(0.16, 1.1);
    toneInterval = window.setInterval(() => ringBurst(0.16, 1.1), 4000);
  } catch {
    // audio unavailable — the on-screen "calling…" state still shows
  }
}

/** Stop any ring/ringback and vibration. Keeps the AudioContext for reuse. */
export function stopRingtone() {
  clearTimers();
}

/** Alias for symmetry with startRingback(). */
export const stopRingback = stopRingtone;
