import { describe, it, expect } from 'vitest';
import { buildOutgoingEnvelope, EncryptionRequiredError } from '../src/lib/db/outgoing-envelope';

const plaintext = JSON.stringify({ v: 1, text: 'hola' });

describe('buildOutgoingEnvelope — fail-closed encryption', () => {
  it('legacy chat stores plaintext + content as-is', async () => {
    const env = await buildOutgoingEnvelope({
      mustEncrypt: false,
      plaintext,
      text: 'hola',
      seal: async () => ({ iv: 'x', ct: 'y' }),
    });
    expect(env.ciphertext).toBe(plaintext);
    expect(env.content).toBe('hola');
  });

  it('encrypted chat stores sealed envelope with NO plaintext content', async () => {
    const env = await buildOutgoingEnvelope({
      mustEncrypt: true,
      plaintext,
      text: 'hola',
      seal: async () => ({ iv: 'IV', ct: 'CT' }),
    });
    expect(env.content).toBeNull();
    expect(env.ciphertext).toBe(JSON.stringify({ e: 1, iv: 'IV', ct: 'CT' }));
    // The plaintext must never appear in what gets stored.
    expect(env.ciphertext).not.toContain('hola');
  });

  it('THROWS (never returns plaintext) when sealing fails on a required chat', async () => {
    await expect(
      buildOutgoingEnvelope({
        mustEncrypt: true,
        plaintext,
        text: 'hola',
        seal: async () => null, // encryption unavailable
      }),
    ).rejects.toBeInstanceOf(EncryptionRequiredError);
  });

  it('THROWS if the seal function itself errors — no plaintext fallback', async () => {
    await expect(
      buildOutgoingEnvelope({
        mustEncrypt: true,
        plaintext,
        text: 'hola',
        seal: async () => {
          throw new Error('crypto broke');
        },
      }),
    ).rejects.toBeTruthy();
  });

  it('opportunistic mode: still SEALS when a key is available (E2EE not skipped)', async () => {
    const env = await buildOutgoingEnvelope({
      mustEncrypt: true,
      opportunistic: true,
      plaintext,
      text: 'hola',
      seal: async () => ({ iv: 'IV', ct: 'CT' }),
    });
    expect(env.content).toBeNull();
    expect(env.ciphertext).toBe(JSON.stringify({ e: 1, iv: 'IV', ct: 'CT' }));
    expect(env.ciphertext).not.toContain('hola');
  });

  it('opportunistic mode: falls back to TLS plaintext (does NOT throw) when sealing is unavailable', async () => {
    const env = await buildOutgoingEnvelope({
      mustEncrypt: true,
      opportunistic: true,
      plaintext,
      text: 'hola',
      seal: async () => null, // no chat key on this device yet
    });
    expect(env.ciphertext).toBe(plaintext);
    expect(env.content).toBe('hola');
  });
});
