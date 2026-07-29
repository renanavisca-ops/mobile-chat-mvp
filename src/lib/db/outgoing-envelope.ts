/**
 * Decides how an outgoing message is stored, and does so **fail-closed**: if a
 * chat must be encrypted and sealing is unavailable, this throws — it never
 * falls back to server-readable plaintext. Kept pure (no Supabase/DOM) so the
 * "encryption failure cannot produce plaintext" invariant is unit-testable.
 */

/** Thrown when a chat requires E2EE but the message could not be sealed. */
export class EncryptionRequiredError extends Error {
  /** User ids that still need to set up encryption (empty = locked on this device). */
  readonly missing: string[];
  constructor(missing: string[] = []) {
    super('encryption-required');
    this.name = 'EncryptionRequiredError';
    this.missing = missing;
  }
}

export type Sealed = { iv: string; ct: string };
export type Envelope = { ciphertext: string; content: string | null };

/**
 * @param mustEncrypt   whether this chat should be E2EE (encrypted or enc_required)
 * @param plaintext     the full JSON payload string
 * @param text          the human text (stored in `content` for legacy chats only)
 * @param seal          seals plaintext → Sealed, or returns null if it cannot
 * @param opportunistic when true, a chat we couldn't seal falls back to a
 *   TLS-protected (server-readable) message instead of throwing. This keeps the
 *   user able to send while encryption auto-upgrades once a chat key exists.
 *   When false (the default) the builder is strictly fail-closed and throws
 *   rather than ever emitting plaintext for an encrypted chat.
 */
export async function buildOutgoingEnvelope(opts: {
  mustEncrypt: boolean;
  plaintext: string;
  text: string | null;
  seal: (plaintext: string) => Promise<Sealed | null>;
  opportunistic?: boolean;
}): Promise<Envelope> {
  const { mustEncrypt, plaintext, text, seal, opportunistic } = opts;

  if (!mustEncrypt) {
    // Legacy / non-encrypted chat: store as-is (server-readable).
    return { ciphertext: plaintext, content: text };
  }

  const sealed = await seal(plaintext);
  if (!sealed) {
    // Best-effort E2EE: no chat key on this device yet. Rather than block the
    // user, send over TLS. The message auto-upgrades to E2EE once the chat can
    // be locked (both parties enrolled + a key present on this device).
    if (opportunistic) return { ciphertext: plaintext, content: text };
    // Fail closed: no sealed result means we must NOT write plaintext.
    throw new EncryptionRequiredError();
  }

  // content is intentionally null so the server never sees plaintext.
  return { ciphertext: JSON.stringify({ e: 1, ...sealed }), content: null };
}
