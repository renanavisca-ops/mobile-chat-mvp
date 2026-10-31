'use client';

// Central locale-aware formatting for dates, times, numbers and relative time.
// Everything derives from the active UI language and the device's own time
// zone (Intl uses the runtime zone by default), so dates/times read correctly
// per region. Adding a new language only needs an entry in LOCALE_BY_LANG.
import type { LangCode } from './context';

// Map a UI language to a BCP-47 locale. Base codes already format correctly;
// override here if a language needs a specific regional variant.
const LOCALE_BY_LANG: Record<string, string> = {
  es: 'es',
  en: 'en',
};

/** The BCP-47 locale for a UI language (falls back to the code itself). */
export function localeFor(lang: LangCode | string): string {
  return LOCALE_BY_LANG[lang] ?? String(lang);
}

function toDate(input: Date | string | number): Date {
  return input instanceof Date ? input : new Date(input);
}

/** Time only, e.g. "14:05" / "2:05 PM", per locale. */
export function formatTime(input: Date | string | number, lang: LangCode): string {
  try {
    return toDate(input).toLocaleTimeString(localeFor(lang), { hour: '2-digit', minute: '2-digit' });
  } catch {
    return toDate(input).toLocaleTimeString();
  }
}

/** Date only, with sensible defaults overridable per call. */
export function formatDate(
  input: Date | string | number,
  lang: LangCode,
  opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
): string {
  try {
    return toDate(input).toLocaleDateString(localeFor(lang), opts);
  } catch {
    return toDate(input).toLocaleDateString();
  }
}

/** Date + time together, per locale and device time zone. */
export function formatDateTime(input: Date | string | number, lang: LangCode): string {
  try {
    return toDate(input).toLocaleString(localeFor(lang), {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return toDate(input).toLocaleString();
  }
}

/** A localized number, e.g. "1.234,5" (es) / "1,234.5" (en). */
export function formatNumber(n: number, lang: LangCode, opts?: Intl.NumberFormatOptions): string {
  try {
    return new Intl.NumberFormat(localeFor(lang), opts).format(n);
  } catch {
    return String(n);
  }
}

/** Relative time, e.g. "hace 3 min" / "in 2 days". Falls back to a date. */
export function formatRelativeTime(input: Date | string | number, lang: LangCode): string {
  const date = toDate(input);
  const diffMs = date.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  try {
    const rtf = new Intl.RelativeTimeFormat(localeFor(lang), { numeric: 'auto' });
    const sec = diffMs / 1000;
    if (abs < 60_000) return rtf.format(Math.round(sec), 'second');
    if (abs < 3_600_000) return rtf.format(Math.round(sec / 60), 'minute');
    if (abs < 86_400_000) return rtf.format(Math.round(sec / 3600), 'hour');
    if (abs < 7 * 86_400_000) return rtf.format(Math.round(sec / 86400), 'day');
    return formatDate(date, lang);
  } catch {
    return formatDate(date, lang);
  }
}
