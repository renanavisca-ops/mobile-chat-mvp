import { useEffect, useState } from 'react';
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { browserSupabase } from '@/lib/supabase/client';
import type { ProfileRow } from '@/types/chat';

type SessionState = {
  user: User | null;
  profile: ProfileRow | null;
  accessToken: string | null;
  loading: boolean;
};

function timeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      window.setTimeout(() => resolve(fallback), ms);
    }),
  ]);
}

async function loadProfile(userId: string): Promise<ProfileRow | null> {
  const supabase = browserSupabase();

  const result = await timeout(
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle(),
    2500,
    { data: null, error: new Error('Profile fetch timeout') }
  );

  if ((result as any).error) {
    console.warn('Profile load failed:', (result as any).error);
    return null;
  }

  return ((result as any).data as ProfileRow | null) ?? null;
}

export function useSession(): SessionState {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = browserSupabase();
    let mounted = true;

    async function applySession(session: Session | null) {
      const currentUser = session?.user ?? null;

      if (!mounted) return;
      setUser(currentUser);
      setAccessToken(session?.access_token ?? null);

      if (!currentUser) {
        setProfile(null);
        return;
      }

      const prof = await loadProfile(currentUser.id);
      if (!mounted) return;
      setProfile(prof);
    }

    async function loadInitialSession() {
      try {
        const sessionData = await timeout(
          supabase.auth.getSession().then((result) => result.data),
          2500,
          { session: null }
        );

        await applySession(sessionData.session);
      } catch (e) {
        console.error('Session load failed:', e);
        if (mounted) {
          setUser(null);
          setProfile(null);
          setAccessToken(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadInitialSession();

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_evt: AuthChangeEvent, session: Session | null) => {
        try {
          await applySession(session);
        } catch (e) {
          console.error('Auth state change failed:', e);
          if (mounted) setProfile(null);
        } finally {
          if (mounted) setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, profile, accessToken, loading };
}
