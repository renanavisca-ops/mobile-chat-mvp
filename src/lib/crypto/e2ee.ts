/**
 * End-to-end encryption primitives built on the Web Crypto API only
 * (no third-party libraries, no paid services).
 *
 * Model (per-chat symmetric key, NaCl-style but with WebCrypto):
 *  - Every user has one long-lived identity keypair (ECDH P-256).
 *  - Each locked chat has a random AES-GCM 256-bit "chat key".
 *  - The chat key is wrapped (ECIES: ephemeral ECDH -> AES-GCM) to each
 *    member's identity public key and stored server-side per member.
 *  - Messages are sealed with the chat key (AES-GCM + random 96-bit IV).
 *
 * The server only ever stores public keys, opaque wrapped-key blobs, and
 * ciphertext. It can never read message contents.
 *
 * This module is deliberately free of React / Supabase / DOM-only APIs so it
 * can be unit-tested under Node's Web Crypto implementation.
 */

// ---------- base64 <-> bytes ----------

export function bytesToB64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin);
}

export function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

// ---------- identity keypair (ECDH P-256) ----------

export type Jwk = JsonWebKey;

export async function generateIdentity(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveKey',
    'deriveBits',
  ]);
}

export async function exportPublicJwk(key: CryptoKey): Promise<Jwk> {
  return crypto.subtle.exportKey('jwk', key);
}

export async function exportPrivateJwk(key: CryptoKey): Promise<Jwk> {
  return crypto.subtle.exportKey('jwk', key);
}

export async function importPublicJwk(jwk: Jwk): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
}

export async function importPrivateJwk(jwk: Jwk): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveKey',
    'deriveBits',
  ]);
}

/** Derive the matching public JWK from a private identity JWK. */
export function publicJwkFromPrivate(priv: Jwk): Jwk {
  return {
    kty: priv.kty,
    crv: priv.crv,
    x: priv.x,
    y: priv.y,
    ext: true,
    key_ops: [],
  };
}

// ---------- chat key (AES-GCM) ----------

export async function generateChatKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

async function importChatKeyRaw(raw: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
}

async function deriveSharedAesKey(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: publicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export type WrappedKey = {
  ephemeralPub: Jwk; // ephemeral ECDH public used to derive the wrap key
  iv: string; // base64
  ct: string; // base64 (AES-GCM of the raw chat key)
};

/** Wrap a chat key to a recipient's identity public key (ECIES). */
export async function wrapChatKeyFor(recipientPublicJwk: Jwk, chatKey: CryptoKey): Promise<WrappedKey> {
  const recipientPub = await importPublicJwk(recipientPublicJwk);
  const ephemeral = await generateIdentity();
  const wrapKey = await deriveSharedAesKey(ephemeral.privateKey, recipientPub);
  const raw = await crypto.subtle.exportKey('raw', chatKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrapKey, raw);
  return {
    ephemeralPub: await exportPublicJwk(ephemeral.publicKey),
    iv: bytesToB64(iv),
    ct: bytesToB64(ct),
  };
}

/** Unwrap a chat key with my identity private key. */
export async function unwrapChatKey(myPrivateKey: CryptoKey, wrapped: WrappedKey): Promise<CryptoKey> {
  const ephemeralPub = await importPublicJwk(wrapped.ephemeralPub);
  const wrapKey = await deriveSharedAesKey(myPrivateKey, ephemeralPub);
  const raw = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(wrapped.iv) },
    wrapKey,
    b64ToBytes(wrapped.ct)
  );
  return importChatKeyRaw(raw);
}

// ---------- message sealing ----------

export type Sealed = { iv: string; ct: string };

export async function encryptString(chatKey: CryptoKey, plaintext: string): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chatKey, enc.encode(plaintext));
  return { iv: bytesToB64(iv), ct: bytesToB64(ct) };
}

export async function decryptString(chatKey: CryptoKey, sealed: Sealed): Promise<string> {
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(sealed.iv) as unknown as BufferSource },
    chatKey,
    b64ToBytes(sealed.ct)
  );
  return dec.decode(pt);
}

// ---------- passphrase backup of the identity private key ----------

export type KeyBackup = { salt: string; iv: string; ct: string };

async function deriveKekFromPassphrase(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations: 210000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Encrypt the identity private key with a user passphrase for server backup. */
export async function backupPrivateKey(privateKey: CryptoKey, passphrase: string): Promise<KeyBackup> {
  const jwk = await exportPrivateJwk(privateKey);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const kek = await deriveKekFromPassphrase(passphrase, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    kek,
    enc.encode(JSON.stringify(jwk))
  );
  return { salt: bytesToB64(salt), iv: bytesToB64(iv), ct: bytesToB64(ct) };
}

/** Restore the identity private key from a passphrase-protected backup. */
export async function restorePrivateKey(passphrase: string, backup: KeyBackup): Promise<CryptoKey> {
  const kek = await deriveKekFromPassphrase(passphrase, b64ToBytes(backup.salt));
  const ptBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(backup.iv) as unknown as BufferSource },
    kek,
    b64ToBytes(backup.ct)
  );
  const jwk = JSON.parse(dec.decode(ptBuf)) as Jwk;
  return importPrivateJwk(jwk);
}

// ---------- safety-number fingerprint ----------

export async function fingerprint(publicJwk: Jwk): Promise<string> {
  const material = `${publicJwk.x ?? ''}.${publicJwk.y ?? ''}`;
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(material));
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 60);
  return hex.match(/.{1,5}/g)?.join(' ') ?? '';
}
