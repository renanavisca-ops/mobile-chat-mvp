// Pure helpers for phone OTP verification (unit-tested). Hashing and storage
// live in the server route; this keeps the policy decisions testable.

export const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const MAX_ATTEMPTS = 5;

/** A 6-digit numeric code as a zero-padded string. */
export function generateCode(rand: () => number = Math.random): string {
  return String(Math.floor(rand() * 1_000_000)).padStart(6, '0');
}

/** Normalize a phone to a comparable form: keep a leading '+' and digits only. */
export function normalizePhone(raw: string): string {
  const trimmed = (raw || '').trim();
  const plus = trimmed.startsWith('+') ? '+' : '';
  return plus + trimmed.replace(/[^0-9]/g, '');
}

/** Minimal E.164-ish sanity check (7–15 digits, optional leading +). */
export function isValidPhone(raw: string): boolean {
  const n = normalizePhone(raw);
  return /^\+?[0-9]{7,15}$/.test(n);
}

export function isExpired(expiresAtMs: number, nowMs: number = Date.now()): boolean {
  return nowMs >= expiresAtMs;
}

export function tooManyAttempts(attempts: number): boolean {
  return attempts >= MAX_ATTEMPTS;
}
