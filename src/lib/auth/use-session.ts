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

async function ensureProfile(accessToken: string): Promise<ProfileRow | null> {
  const response = await timeout(
    fetch('/api/profiles/me', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({}),
    }),
    4000,
    null as any
  );

  if (!response) return null;

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.warn('Profile ensure failed:', data?.error ?? response.statusText);
    return null;
  }

  return (data?.profile as ProfileRow | undefined) ?? null;
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
      const token = session?.access_token ?? null;

      if (!mounted) return;
      setUser(currentUser);
      setAccessToken(token);

      if (!currentUser || !token) {
        setProfile(null);
        return;
      }

      const prof = await ensureProfile(token);
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
