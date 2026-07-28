import { describe, it, expect } from 'vitest';
import { encryptMedia, decryptMedia } from '../src/lib/crypto/media';

describe('toky-media-v1 media encryption', () => {
  it('uploads CIPHERTEXT (not the original bytes) and round-trips on decrypt', async () => {
    const original = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const file = new Blob([original], { type: 'image/png' });

    const { cipher, enc } = await encryptMedia(file);
    const cipherBytes = new Uint8Array(await cipher.arrayBuffer());

    // What gets uploaded is NOT the plaintext.
    expect(Array.from(cipherBytes)).not.toEqual(Array.from(original));
    expect(cipher.type).toBe('application/octet-stream');
    expect(enc.v).toBe(1);
    expect(enc.alg).toBe('AES-GCM');

    // Authorized participant (has the metadata/key) recovers the original.
    const back = await decryptMedia(await cipher.arrayBuffer(), enc);
    expect(Array.from(new Uint8Array(await back.arrayBuffer()))).toEqual(Array.from(original));
    expect(back.type).toBe('image/png');
  });

  it('a WRONG key cannot decrypt (AES-GCM authentication fails)', async () => {
    const file = new Blob([new Uint8Array([9, 9, 9, 9])], { type: 'application/octet-stream' });
    const { cipher, enc } = await encryptMedia(file);
    const other = await encryptMedia(file); // different random key
    const wrong = { ...enc, k: other.enc.k };
    await expect(decryptMedia(await cipher.arrayBuffer(), wrong)).rejects.toBeTruthy();
  });

  it('rejects invalid/missing metadata before attempting decryption', async () => {
    const { cipher } = await encryptMedia(new Blob([new Uint8Array([1])]));
    // @ts-expect-error intentionally invalid meta
    await expect(decryptMedia(await cipher.arrayBuffer(), { v: 2 })).rejects.toThrow(/metadata/i);
  });

  it('rejects files over the 25 MB single-shot cap', async () => {
    const big = new Blob([new Uint8Array(26 * 1024 * 1024)]);
    await expect(encryptMedia(big)).rejects.toThrow(/too large/i);
  });
});
