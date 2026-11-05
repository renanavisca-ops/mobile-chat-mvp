import { describe, it, expect } from 'vitest';
import { generateCode, normalizePhone, isValidPhone, isExpired, tooManyAttempts, MAX_ATTEMPTS } from '../src/lib/phone/verify';

describe('generateCode', () => {
  it('is always a 6-digit zero-padded string', () => {
    expect(generateCode(() => 0)).toBe('000000');
    expect(generateCode(() => 0.999999)).toMatch(/^\d{6}$/);
    for (let i = 0; i < 50; i++) expect(generateCode()).toMatch(/^\d{6}$/);
  });
});

describe('normalizePhone / isValidPhone', () => {
  it('keeps a leading + and strips non-digits', () => {
    expect(normalizePhone(' +1 (555) 123-4567 ')).toBe('+15551234567');
    expect(normalizePhone('502 5555 1234')).toBe('50255551234');
  });
  it('validates length 7–15', () => {
    expect(isValidPhone('+15551234567')).toBe(true);
    expect(isValidPhone('12345')).toBe(false);
    expect(isValidPhone('abc')).toBe(false);
  });
});

describe('isExpired / tooManyAttempts', () => {
  it('expires at or after the deadline', () => {
    expect(isExpired(1000, 999)).toBe(false);
    expect(isExpired(1000, 1000)).toBe(true);
    expect(isExpired(1000, 2000)).toBe(true);
  });
  it('caps attempts at MAX_ATTEMPTS', () => {
    expect(tooManyAttempts(MAX_ATTEMPTS - 1)).toBe(false);
    expect(tooManyAttempts(MAX_ATTEMPTS)).toBe(true);
  });
});
