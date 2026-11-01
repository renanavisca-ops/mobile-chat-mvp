import { describe, it, expect } from 'vitest';
import { sanitizeEventData, ALLOWED_KEYS } from '../src/lib/integrations/events';

describe('sanitizeEventData', () => {
  it('keeps whitelisted scalar fields', () => {
    const out = sanitizeEventData({ chatId: 'c1', status: 'closed', hasText: true, assigned: false });
    expect(out).toEqual({ chatId: 'c1', status: 'closed', hasText: true, assigned: false });
  });

  it('drops non-whitelisted keys (never leaks message content)', () => {
    const out = sanitizeEventData({
      chatId: 'c1',
      text: 'secret message body',
      content: 'secret',
      body: 'secret',
      ciphertext: 'secret',
      phone: '+123',
      email: 'a@b.com',
    } as any);
    expect(out).toEqual({ chatId: 'c1' });
    expect('text' in out).toBe(false);
    expect('content' in out).toBe(false);
    expect('phone' in out).toBe(false);
  });

  it('drops non-scalar values even for whitelisted keys', () => {
    const out = sanitizeEventData({ chatId: { nested: 'x' }, status: ['a'], labelId: 'l1' } as any);
    expect(out).toEqual({ labelId: 'l1' });
  });

  it('the whitelist contains no free-text keys', () => {
    for (const k of ['text', 'content', 'body', 'message', 'ciphertext', 'phone', 'email']) {
      expect(ALLOWED_KEYS.has(k)).toBe(false);
    }
  });
});
