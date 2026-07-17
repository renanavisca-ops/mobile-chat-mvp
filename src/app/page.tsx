'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth/use-session';

// The root route is just a router: send people to the right place based on
// auth. Signed-out -> the welcome/login screen; signed-in without a username
// -> onboarding; otherwise -> their chats.
export default function HomePage() {
  const router = useRouter();
  const { user, profile, loading } = useSession();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (!profile || !profile.username) {
      router.replace('/onboarding');
      return;
    }
    router.replace('/chats');
  }, [loading, user, profile, router]);

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-slate-950 text-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-emerald-500 text-3xl font-extrabold text-white shadow-lg shadow-blue-600/30">
          T
        </div>
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-700 border-t-slate-200" />
      </div>
    </main>
  );
}
