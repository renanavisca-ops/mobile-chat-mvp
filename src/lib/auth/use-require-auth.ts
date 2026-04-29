'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth/use-session';

export function useRequireAuth() {
  const router = useRouter();
  const { user, profile, loading } = useSession();

  useEffect(() => {
    // Only redirect when we are DONE loading and there is no user
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  return { user, profile, loading };
}
