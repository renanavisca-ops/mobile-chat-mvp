'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { browserSupabase } from '@/lib/supabase/client';

/**
 * Routes the user to the password-reset form whenever a recovery link is opened.
 *
 * Password-reset emails redirect to a hosted https page (see `authRedirectUrl`).
 * When that page loads, supabase-js `detectSessionInUrl` consumes the tokens
 * from the URL and emits a `PASSWORD_RECOVERY` auth event. Supabase only
 * honours the requested `redirect_to` when it is in the project's allow-list;
 * otherwise it falls back to the Site URL root, which would leave the user on
 * the home page with a valid recovery session but no visible form. Listening
 * for the event here and forwarding to `/reset-password` makes the flow work no
 * matter which allow-listed URL the browser actually landed on.
 */
export function PasswordRecoveryRouter() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const supabase = browserSupabase();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' && pathname !== '/reset-password') {
        router.replace('/reset-password');
      }
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, [router, pathname]);

  return null;
}
