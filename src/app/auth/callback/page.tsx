'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { browserSupabase } from '@/lib/supabase/client';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const supabase = browserSupabase();

    const handle = async () => {
      const { data } = await supabase.auth.getSession();

      if (data.session) {
        router.replace('/chats');
      } else {
        router.replace('/');
      }
    };

    handle();
  }, [router]);

  return <p>Procesando login...</p>;
}
