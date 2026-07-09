import { useEffect, useState } from 'react';
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { browserSupabase } from '@/lib/supabase/client';
import type { ProfileRow } from '@/types/chat';

type QueryResult<T> = {
  data: T | null;
  error: any;
};

function fallbackProfile(userId: string): ProfileRow {
  return {
    id: userId,
    username: null,
    store_id: null,
    role: 'agent',
    created_at: new Date().toISOString(),
  };
}

function timeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      window.setTimeout(() => resolve(fallback), ms);
    }),
  ]);
}

/**
 * Loads or auto-creates a profile for the given user.
 * This always returns a safe fallback instead of blocking the app.
 */
async function loadOrCreateProfile(userId: string): Promise<ProfileRow> {
  const supabase = browserSupabase();
  const fallback = fallbackProfile(userId);

  const fetchProfile = async (): Promise<QueryResult<ProfileRow[]>> => {
    const result = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .limit(1);

    return result as QueryResult<ProfileRow[]>;
  };

  const existing = await timeout(fetchProfile(), 2500, {
    data: null,
    error: new Error('Profile fetch timeout'),
  });

  if (existing.data?.[0]) return existing.data[0] as ProfileRow;

  if (existing.error) {
    console.warn('Profile fetch failed, using fallback:', existing.error);
  }

  const createProfile = async (): Promise<QueryResult<ProfileRow[]>> => {
    const result = await supabase
      .from('profiles')
      .upsert([{ id: userId, username: null, role: 'agent' }] as any, { onConflict: 'id' })
      .select('*')
      .limit(1);

    return result as QueryResult<ProfileRow[]>;
  };

  const created = await timeout(createProfile(), 2500, {
    data: null,
    error: new Error('Profile create timeout'),
  });

  if (created.error) {
    console.warn('Profile auto-create failed, using fallback:', created.error);
    return fallback;
  }

  return (created.data?.[0] as ProfileRow | undefined) ?? fallback;
}

export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = browserSupabase();
    let mounted = true;

    const load = async () => {
      try {
        const sessionData = await timeout(
          supabase.auth.getSession().then((result) => result.data),
          2500,
          { session: null }
        );

        if (!mounted) return;

        const currentUser = sessionData.session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          const prof = await loadOrCreateProfile(currentUser.id);
          if (!mounted) return;
          setProfile(prof);
        } else {
          setProfile(null);
        }
      } catch (e) {
        console.error('Session load failed:', e);
        if (mounted) {
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_evt: AuthChangeEvent, session: Session | null) => {
        try {
          const currentUser = session?.user ?? null;
          setUser(currentUser);

          if (currentUser) {
            const prof = await loadOrCreateProfile(currentUser.id);
            setProfile(prof);
          } else {
            setProfile(null);
          }
        } catch (e) {
          console.error('Auth state change failed:', e);
          setProfile(null);
        } finally {
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, profile, loading };
}
