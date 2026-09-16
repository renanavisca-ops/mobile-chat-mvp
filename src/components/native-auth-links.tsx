'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { browserSupabase } from '@/lib/supabase/client';

// Only these in-app destinations may be opened by a deep link, so a crafted
// link can't route the app to an arbitrary screen.
const ALLOWED_PATHS = new Set(['/auth/callback', '/reset-password']);

/**
 * Completes email-link / password-reset auth inside the bundled app.
 *
 * On the hosted web build supabase-js reads the tokens straight from the URL
 * (`detectSessionInUrl`). In the bundled app the email link is a custom-scheme
 * deep link (`tokychat://…`); the OS hands it to us via `@capacitor/app`'s
 * `appUrlOpen`, and here we establish the session from the link's tokens and
 * route to the right screen. No-op on web.
 */
export function NativeAuthLinks() {
  const router = useRouter();

  useEffect(() => {
    let isNative = false;
    try {
      isNative = Capacitor.isNativePlatform();
    } catch {
      isNative = false;
    }
    if (!isNative) return;

    let remove: (() => void) | undefined;

    void App.addListener('appUrlOpen', async ({ url }) => {
      if (!url || !url.toLowerCase().startsWith('tokychat:')) return;
      try {
        const u = new URL(url);
        const supabase = browserSupabase();

        // Tokens arrive either as a PKCE `code` (query) or as
        // access/refresh tokens in the URL fragment (implicit flow).
        const code = u.searchParams.get('code');
        const hash = u.hash.startsWith('#') ? u.hash.slice(1) : u.hash;
        const hp = new URLSearchParams(hash);
        const accessToken = hp.get('access_token');
        const refreshToken = hp.get('refresh_token');
        const type = hp.get('type') || u.searchParams.get('type') || '';

        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        } else if (accessToken && refreshToken) {
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        }

        // Resolve the in-app destination from the link, validated against the
        // allow-list. `tokychat://auth/callback` → host "auth", path "/callback".
        let path = `/${u.host}${u.pathname}`.replace(/\/+$/, '') || '/auth/callback';
        if (type === 'recovery') path = '/reset-password';
        if (!ALLOWED_PATHS.has(path)) path = '/auth/callback';

        router.replace(path);
      } catch {
        router.replace('/login');
      }
    }).then((handle) => {
      remove = () => void handle.remove();
    });

    return () => {
      if (remove) remove();
    };
  }, [router]);

  return null;
}
