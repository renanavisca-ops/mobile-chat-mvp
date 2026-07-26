/**
 * Client-side password policy — the free substitute for Supabase's Pro-only
 * leaked-password (HaveIBeenPwned) protection. It won't catch every breached
 * password, but it blocks the handful that show up in the overwhelming majority
 * of account-takeover attempts, plus trivially weak shapes.
 */

const MIN_LENGTH = 8;

// The most-reused passwords from public breach corpora (rockyou / HIBP tops),
// normalized to lowercase. Kept short but high-impact.
const COMMON = new Set([
  'password', 'password1', 'password123', 'passw0rd', 'qwerty', 'qwerty123',
  'qwertyuiop', '12345678', '123456789', '1234567890', '111111', '000000',
  '123123', '12341234', 'abc123', 'abcd1234', 'iloveyou', 'admin', 'admin123',
  'welcome', 'welcome1', 'letmein', 'monkey', 'dragon', 'football', 'baseball',
  'sunshine', 'princess', 'superman', 'trustno1', 'whatever', 'starwars',
  'michael', 'ashley', 'shadow', 'master', 'login', 'test1234', 'changeme',
  'zaq12wsx', '1q2w3e4r', '1qaz2wsx', 'q1w2e3r4', 'asdfghjk', 'a1b2c3d4',
]);

export type PasswordCheck = { ok: boolean; code?: string };

/**
 * Validate a password against the policy. Returns a stable `code` on failure so
 * callers can map it to a localized message.
 *   'short'   — under the minimum length
 *   'common'  — a well-known / breached password
 *   'weak'    — too little variety (single repeated char, or no letter+number)
 */
export function validatePassword(pw: string): PasswordCheck {
  if (pw.length < MIN_LENGTH) return { ok: false, code: 'short' };

  const lower = pw.toLowerCase();
  if (COMMON.has(lower)) return { ok: false, code: 'common' };

  // A single repeated character ("aaaaaaaa") or a strict run.
  if (/^(.)\1+$/.test(pw)) return { ok: false, code: 'weak' };

  // Require some variety: at least one letter and one number, OR length >= 12.
  const hasLetter = /[a-zA-Z]/.test(pw);
  const hasNumber = /[0-9]/.test(pw);
  if (pw.length < 12 && !(hasLetter && hasNumber)) return { ok: false, code: 'weak' };

  return { ok: true };
}

/** 0–4 strength score for a simple visual meter. */
export function passwordStrength(pw: string): number {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  if (COMMON.has(pw.toLowerCase())) return 0;
  return Math.min(4, score);
}
