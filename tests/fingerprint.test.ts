import { describe, expect, it } from 'vitest';
import { fingerprintFromIdentity } from '@/lib/crypto/fingerprint';

describe('fingerprintFromIdentity', () => {
  it('returns grouped deterministic hash', async () => {
    const fp = await fingerprintFromIdentity('identity-key');
    expect(fp).toMatch(/^[0-9a-f ]+$/);
    expect(fp.split(' ').length).toBeGreaterThan(5);
  });
});
