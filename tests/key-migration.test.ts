import { describe, it, expect } from 'vitest';
import { migrateKey, type KeyBackend } from '../src/lib/crypto/key-migration';

function fake(initial: string | null = null) {
  const state = { value: initial };
  const backend: KeyBackend = {
    async get() { return state.value; },
    async set(v: string) { state.value = v; },
    async remove() { state.value = null; },
  };
  return { backend, state };
}

describe('migrateKey (IndexedDB → secure storage)', () => {
  it('migrates, verifies read-back, THEN removes the source', async () => {
    const from = fake('KEYDATA');
    const to = fake(null);
    expect(await migrateKey(from.backend, to.backend)).toBe('migrated');
    expect(to.state.value).toBe('KEYDATA');
    expect(from.state.value).toBeNull(); // deleted only after verify
  });

  it('is idempotent — a second run returns "already" and changes nothing', async () => {
    const from = fake(null);
    const to = fake('KEYDATA');
    expect(await migrateKey(from.backend, to.backend)).toBe('already');
    expect(to.state.value).toBe('KEYDATA');
  });

  it('cleans a stale source copy when the destination already has the key', async () => {
    const from = fake('STALE');
    const to = fake('KEYDATA');
    expect(await migrateKey(from.backend, to.backend)).toBe('already');
    expect(from.state.value).toBeNull();
  });

  it('returns "none" when there is nothing to migrate', async () => {
    const from = fake(null);
    const to = fake(null);
    expect(await migrateKey(from.backend, to.backend)).toBe('none');
  });

  it('KEEPS the source (recoverable) if the destination read-back does not match', async () => {
    const from = fake('KEYDATA');
    // A destination that silently drops writes → read-back mismatch.
    const to: KeyBackend = { async get() { return null; }, async set() {}, async remove() {} };
    expect(await migrateKey(from.backend, to)).toBe('kept');
    expect(from.state.value).toBe('KEYDATA'); // NOT deleted
  });
});
