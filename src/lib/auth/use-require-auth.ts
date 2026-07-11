'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from '@/lib/auth/use-session';

export function useRequireAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, loading } = useSession();

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
