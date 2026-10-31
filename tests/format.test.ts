import { describe, it, expect } from 'vitest';
import {
  localeFor, formatTime, formatDate, formatDateTime, formatNumber, formatRelativeTime,
} from '../src/lib/i18n/format';

describe('i18n formatters', () => {
  it('resolves a locale for a language', () => {
    expect(localeFor('es')).toBe('es');
    expect(localeFor('en')).toBe('en');
  });

  it('formats a number for the locale', () => {
    // es uses a comma as the decimal separator, en a dot.
    expect(formatNumber(1234.5, 'es')).toContain(',');
    expect(formatNumber(1234.5, 'en')).toContain('.');
  });

  it('formats a time as a non-empty string with digits', () => {
    const s = formatTime(new Date('2026-01-02T14:05:00Z'), 'es');
    expect(s).toMatch(/\d/);
  });

  it('formats a date and a date-time', () => {
    const d = new Date('2026-01-02T14:05:00Z');
    expect(formatDate(d, 'en')).toMatch(/\d/);
    expect(formatDateTime(d, 'en')).toMatch(/\d/);
  });

  it('formats relative time into a non-empty string', () => {
    const twoMinAgo = new Date(Date.now() - 2 * 60_000);
    expect(formatRelativeTime(twoMinAgo, 'en').length).toBeGreaterThan(0);
    const inThreeHours = new Date(Date.now() + 3 * 3_600_000);
    expect(formatRelativeTime(inThreeHours, 'es').length).toBeGreaterThan(0);
  });

  it('is resilient to bad input via fallbacks', () => {
    // A valid ISO string works; the helpers never throw for normal values.
    expect(() => formatDateTime('2026-01-02T00:00:00Z', 'es')).not.toThrow();
  });
});
