'use client';

/**
 * Lightweight, client-side heuristics to flag links that are commonly used to
 * deceive — without any external reputation service. We only flag high-signal,
 * low-false-positive cases and show the user a confirmation before opening;
 * we never block. Reason keys map to i18n strings (linkSafety.reason_*).
 */

export type LinkAssessment = { risky: boolean; reasonKey?: string };

function isIpHost(host: string): boolean {
  // IPv4 literal, or bracketed/colon IPv6.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  if (host.startsWith('[') || host.includes(':')) return true;
  return false;
}

export function assessLink(rawUrl: string): LinkAssessment {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return { risky: false };
  }

  // Credentials embedded in the authority (e.g. https://apple.com@evil.ru) —
  // the real host is after the "@", a classic phishing disguise.
  if (u.username || u.password) return { risky: true, reasonKey: 'userinfo' };

  const host = u.hostname.toLowerCase();

  // Punycode / internationalized host (xn--) can impersonate a brand with
  // look-alike Unicode letters (homograph attack).
  if (host.split('.').some((label) => label.startsWith('xn--'))) {
    return { risky: true, reasonKey: 'punycode' };
  }

  // Raw IP address instead of a domain — unusual for legitimate links.
  if (isIpHost(host)) return { risky: true, reasonKey: 'ip' };

  return { risky: false };
}
