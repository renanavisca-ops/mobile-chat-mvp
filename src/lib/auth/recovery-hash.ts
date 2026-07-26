import { createHash } from 'crypto';

/** Normalize a recovery code for comparison: uppercase, keep only A–Z/0–9. */
export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** SHA-256 hash of the normalized code (what we store — never the plaintext). */
export function hashCode(code: string): string {
  return createHash('sha256').update(normalizeCode(code)).digest('hex');
}
