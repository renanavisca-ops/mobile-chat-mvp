import { describe, it, expect } from 'vitest';
import { durableRateLimit, clientIp } from '../src/lib/ratelimit-db';

const admin = (impl: () => Promise<{ data: unknown; error: unknown }>) => ({ rpc: impl });

describe('durableRateLimit', () => {
  it('allows when the function returns true', async () => {
    const ok = await durableRateLimit(admin(async () => ({ data: true, error: null })), 'b', 5, 60);
    expect(ok).toBe(true);
  });

  it('blocks only when the function returns exactly false', async () => {
    expect(await durableRateLimit(admin(async () => ({ data: false, error: null })), 'b', 5, 60)).toBe(false);
  });

  it('fails open on a function error', async () => {
    expect(await durableRateLimit(admin(async () => ({ data: null, error: { message: 'x' } })), 'b', 5, 60)).toBe(true);
  });

  it('fails open when the call throws', async () => {
    expect(await durableRateLimit(admin(async () => { throw new Error('down'); }), 'b', 5, 60)).toBe(true);
  });
});

describe('clientIp', () => {
  const reqWith = (headers: Record<string, string>) => new Request('https://x.test', { headers });

  it('takes the first X-Forwarded-For hop', () => {
    expect(clientIp(reqWith({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('1.2.3.4');
  });

  it('falls back to X-Real-IP, then "unknown"', () => {
    expect(clientIp(reqWith({ 'x-real-ip': '9.9.9.9' }))).toBe('9.9.9.9');
    expect(clientIp(reqWith({}))).toBe('unknown');
  });
});
