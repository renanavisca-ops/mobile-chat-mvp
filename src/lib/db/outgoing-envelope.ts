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
 * @param mustEncrypt whether this chat requires E2EE (encrypted or enc_required)
 * @param plaintext   the full JSON payload string
 * @param text        the human text (stored in `content` for legacy chats only)
 * @param seal        seals plaintext → Sealed, or returns null if it cannot
 */
export async function buildOutgoingEnvelope(opts: {
  mustEncrypt: boolean;
  plaintext: string;
  text: string | null;
  seal: (plaintext: string) => Promise<Sealed | null>;
}): Promise<Envelope> {
  const { mustEncrypt, plaintext, text, seal } = opts;

  if (!mustEncrypt) {
    // Legacy / non-encrypted chat: store as-is (server-readable).
    return { ciphertext: plaintext, content: text };
  }

  const sealed = await seal(plaintext);
  // Fail closed: no sealed result means we must NOT write plaintext.
  if (!sealed) throw new EncryptionRequiredError();

  // content is intentionally null so the server never sees plaintext.
  return { ciphertext: JSON.stringify({ e: 1, ...sealed }), content: null };
}
