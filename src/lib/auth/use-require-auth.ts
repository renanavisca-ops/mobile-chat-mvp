'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from '@/lib/auth/use-session';
import { browserSupabase } from '@/lib/supabase/client';

export function useRequireAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, loading } = useSession();

  // If the account has 2FA enabled but this session only reached aal1 (password,
  // no code), refuse access: sign out and bounce to login to finish the code.
  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = browserSupabase();
        const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (!cancelled && data && data.nextLevel === 'aal2' && data.currentLevel === 'aal1') {
          await supabase.auth.signOut();
          router.replace('/login');
        }
      } catch {
        /* ignore — never block the app on an MFA lookup failure */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user, router]);

  useEffect(() => {
    if (loading) return;

    // Not signed in -> login
    if (!user) {
      router.replace('/login');
      return;
    }

    // Signed in but no username claimed yet -> onboarding
    if ((!profile || !profile.username) && pathname !== '/onboarding') {
      router.replace('/onboarding');
    }
  }, [loading, user, profile, pathname, router]);

  return { user, profile, loading };
}
