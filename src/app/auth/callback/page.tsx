'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { browserSupabase } from '@/lib/supabase/client';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleAuth = async () => {
      const { data, error } = await browserSupabase.auth.getSession();

      if (error) {
        console.error(error);
        router.push('/');
        return;
      }

      if (data.session) {
        router.push('/chats');
      } else {
        router.push('/');
      }
    };

    handleAuth();
  }, [router]);

  return <p>Procesando login...</p>;
}
