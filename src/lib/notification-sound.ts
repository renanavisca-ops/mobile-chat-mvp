'use client';

/**
 * User-selectable notification sound for the in-app (foreground) alert.
 *
 * Sounds are synthesized with the Web Audio API — no audio files to ship or
 * license, and they play in any WebView/browser. The choice is stored per device
 * (localStorage). `none` is silent. Used by the foreground push handler and by
 * the Settings preview.
 */

export type NotifSoundId = 'chime' | 'ding' | 'tritone' | 'pop' | 'marimba' | 'none';

export const NOTIF_SOUNDS: { id: NotifSoundId; labelKey: string }[] = [
  { id: 'chime', labelKey: 'sounds.chime' },
  { id: 'ding', labelKey: 'sounds.ding' },
  { id: 'tritone', labelKey: 'sounds.tritone' },
  { id: 'pop', labelKey: 'sounds.pop' },
  { id: 'marimba', labelKey: 'sounds.marimba' },
  { id: 'none', labelKey: 'sounds.none' },
];

const KEY = 'toky.notifSound';
const DEFAULT: NotifSoundId = 'chime';

export function getNotifSound(): NotifSoundId {
  try {
    const v = localStorage.getItem(KEY) as NotifSoundId | null;
    return v && NOTIF_SOUNDS.some((s) => s.id === v) ? v : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function setNotifSound(id: NotifSoundId): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* private mode / quota */
  }
}

/** Play the given sound (or the saved choice). Best-effort; silent on failure. */
export function playNotifSound(id?: NotifSoundId): void {
  const sound = id ?? getNotifSound();
  if (sound === 'none') return;
  try {
    const Ctx =
      (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const t0 = ctx.currentTime;

    const note = (freq: number, start: number, dur: number, type: OscillatorType, peak: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const s = t0 + start;
      gain.gain.exponentialRampToValueAtTime(peak, s + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, s + dur);
      osc.start(s);
      osc.stop(s + dur + 0.03);
    };

    switch (sound) {
      case 'chime':
        note(880, 0, 0.3, 'sine', 0.18);
        break;
      case 'ding':
        note(660, 0, 0.15, 'sine', 0.2);
        note(990, 0.12, 0.28, 'sine', 0.2);
        break;
      case 'tritone':
        note(784, 0, 0.14, 'triangle', 0.17);
        note(988, 0.13, 0.14, 'triangle', 0.17);
        note(1319, 0.26, 0.3, 'triangle', 0.17);
        break;
      case 'pop':
        note(440, 0, 0.09, 'square', 0.14);
        break;
      case 'marimba':
        note(523, 0, 0.26, 'sine', 0.16);
        note(784, 0.1, 0.34, 'sine', 0.13);
        break;
    }

    // Close the context after the longest sound finishes.
    setTimeout(() => {
      try {
        void ctx.close();
      } catch {
        /* ignore */
      }
    }, 900);
  } catch {
    /* ignore */
  }
}
