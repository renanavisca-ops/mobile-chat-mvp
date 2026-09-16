'use client';

import { Capacitor } from '@capacitor/core';

// Canonical auth deep-link scheme for the bundled app. Email confirmation,
// magic links and password-reset links redirect here; the OS opens the app and
// `NativeAuthLinks` completes the session. On the hosted web build the same
// flows keep using same-origin paths.
export const AUTH_DEEP_LINK_SCHEME = 'tokychat';

function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Where Supabase should send the user after an email link. Native builds get a
 * custom-scheme deep link (must be in the Supabase redirect allowlist); web
 * builds get a same-origin URL, exactly as before.
 */
export function authRedirectUrl(path: '/auth/callback' | '/reset-password'): string | undefined {
  if (isNative()) {
    // `tokychat:/` + `/auth/callback` => `tokychat://auth/callback`
    return `${AUTH_DEEP_LINK_SCHEME}:/${path}`;
  }
  if (typeof window !== 'undefined') return `${window.location.origin}${path}`;
  return undefined;
}
