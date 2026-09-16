'use client';

import { Capacitor } from '@capacitor/core';

// Canonical auth deep-link scheme for the bundled app. Kept for the native
// intent-filter / `NativeAuthLinks` plumbing, but NOT used as an email redirect
// target anymore — see `authRedirectUrl` below.
export const AUTH_DEEP_LINK_SCHEME = 'tokychat';

// The hosted web origin that always serves the auth pages (`/reset-password`,
// `/auth/callback`). Password-reset and email-confirmation links are opened in
// the user's *email client / browser*, never inside the app, so the redirect
// target must be a real https URL that any browser can load. A `tokychat://`
// deep link produces a blank page in a browser (nothing can open the custom
// scheme), which is exactly why the reset page came up empty.
const HOSTED_AUTH_ORIGIN = 'https://mobile-chat-mvp.vercel.app';

function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Where Supabase should send the user after an email link.
 *
 * Email links (password reset, confirmation) are followed in a browser, so the
 * target must always be a hosted https page — never the `tokychat://` scheme,
 * which a browser cannot open (that left the reset page blank). Native builds
 * therefore point at the fixed hosted origin; the web build uses its own origin
 * so previews / custom domains keep working same-origin.
 */
export function authRedirectUrl(path: '/auth/callback' | '/reset-password'): string | undefined {
  if (isNative()) return `${HOSTED_AUTH_ORIGIN}${path}`;
  if (typeof window !== 'undefined') return `${window.location.origin}${path}`;
  return HOSTED_AUTH_ORIGIN + path;
}
