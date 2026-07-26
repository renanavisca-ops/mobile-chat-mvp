/**
 * Lightweight haptic feedback. Uses the Vibration API, which works in the
 * Android Capacitor WebView and Android Chrome without a native plugin. iOS
 * Safari ignores it silently (no-op), which is fine — it never throws.
 */
export function haptic(pattern: number | number[] = 12): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    /* vibration blocked or unsupported — ignore */
  }
}

/** Distinct feels for common interactions. */
export const tap = () => haptic(10);
export const success = () => haptic([12, 40, 18]);
export const impact = () => haptic(18);
