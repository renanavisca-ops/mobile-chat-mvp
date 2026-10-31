import { describe, it, expect } from 'vitest';
import { assessLink } from '../src/lib/link-safety';

describe('assessLink', () => {
  it('treats ordinary https links as safe', () => {
    expect(assessLink('https://example.com/path?q=1').risky).toBe(false);
    expect(assessLink('https://sub.example.co.uk/').risky).toBe(false);
  });

  it('flags credentials embedded in the authority (phishing disguise)', () => {
    const r = assessLink('https://apple.com@evil.ru/login');
    expect(r.risky).toBe(true);
    expect(r.reasonKey).toBe('userinfo');
  });

  it('flags punycode / homograph hosts', () => {
    const r = assessLink('https://xn--80ak6aa92e.com/');
    expect(r.risky).toBe(true);
    expect(r.reasonKey).toBe('punycode');
  });

  it('flags raw IPv4 and IPv6 hosts', () => {
    expect(assessLink('http://192.168.0.1/admin').reasonKey).toBe('ip');
    expect(assessLink('http://[2001:db8::1]/').reasonKey).toBe('ip');
  });

  it('does not flag (or throw on) unparseable input', () => {
    expect(assessLink('not a url').risky).toBe(false);
    expect(assessLink('').risky).toBe(false);
  });
});
