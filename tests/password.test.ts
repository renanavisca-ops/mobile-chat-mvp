import { describe, it, expect } from 'vitest';
import { validatePassword, passwordStrength } from '../src/lib/password';

describe('validatePassword', () => {
  it('rejects passwords under the minimum length', () => {
    expect(validatePassword('abc12')).toEqual({ ok: false, code: 'short' });
  });

  it('rejects well-known / breached passwords', () => {
    expect(validatePassword('password').code).toBe('common');
    expect(validatePassword('qwerty123').code).toBe('common');
  });

  it('rejects a single repeated character', () => {
    expect(validatePassword('aaaaaaaa').code).toBe('weak');
  });

  it('requires letters and numbers under length 12', () => {
    expect(validatePassword('abcdefgh').code).toBe('weak'); // letters only
    expect(validatePassword('12345670').code).toBe('weak'); // digits only (not a common seq)
  });

  it('accepts a mixed password, or a long one without digits', () => {
    expect(validatePassword('Str0ngPass')).toEqual({ ok: true });
    expect(validatePassword('abcdefghijkl')).toEqual({ ok: true }); // >= 12 waives the mix rule
  });
});

describe('passwordStrength', () => {
  it('scores a common password as 0', () => {
    expect(passwordStrength('password')).toBe(0);
  });

  it('increases with length and character variety', () => {
    const weak = passwordStrength('abcdefg');      // < 8
    const strong = passwordStrength('Str0ng!Pass12'); // length + case + digit + symbol
    expect(strong).toBeGreaterThan(weak);
    expect(strong).toBeLessThanOrEqual(4);
    expect(strong).toBe(4);
  });
});
