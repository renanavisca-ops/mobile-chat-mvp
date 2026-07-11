import { useEffect, useState } from 'react';
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { browserSupabase } from '@/lib/supabase/client';
import type { ProfileRow } from '@/types/chat';

type QueryResult<T> = {
  data: T | null;
  error: any;
};

function sanitizeUsername(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
}

function defaultUsernameForUser(user: User): string {
  const emailPrefix = user.email?.split('@')[0] ?? '';
  const cleanPrefix = sanitizeUsername(emailPrefix);
  const suffix = user.id.replace(/-/g, '').slice(0, 8);

  if (cleanPrefix) return `${cleanPrefix}_${suffix}`;
  return `user_${suffix}`;
}

function fallbackProfile(user: User): ProfileRow {
  return {
    id: user.id,
    username: defaultUsernameForUser(user),
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
 * Profiles must always have a searchable username.
 */
async function loadOrCreateProfile(user: User): Promise<ProfileRow> {
  const supabase = browserSupabase();
  const fallback = fallbackProfile(user);
  const defaultUsername = defaultUsernameForUser(user);

  const fetchProfile = async (): Promise<QueryResult<ProfileRow[]>> => {
    const result = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .limit(1);

    return result as QueryResult<ProfileRow[]>;
  };

  const existing = await timeout(fetchProfile(), 2500, {
    data: null,
    error: new Error('Profile fetch timeout'),
  });

  const existingProfile = existing.data?.[0] as ProfileRow | undefined;

  if (existingProfile) {
    const hasUsername = typeof existingProfile.username === 'string' && existingProfile.username.trim().length > 0;

    if (hasUsername) return existingProfile;

    const repairProfile = async (): Promise<QueryResult<ProfileRow[]>> => {
      const result = await supabase
        .from('profiles')
        .update({ username: defaultUsername } as any)
        .eq('id', user.id)
        .select('*')
        .limit(1);

      return result as QueryResult<ProfileRow[]>;
    };

    const repaired = await timeout(repairProfile(), 2500, {
      data: null,
      error: new Error('Profile repair timeout'),
    });

    if (repaired.data?.[0]) return repaired.data[0] as ProfileRow;

    return {
      ...existingProfile,
      username: defaultUsername,
    };
  }

  if (existing.error) {
    console.warn('Profile fetch failed, using fallback:', existing.error);
  }

  const createProfile = async (): Promise<QueryResult<ProfileRow[]>> => {
    const result = await supabase
      .from('profiles')
      .upsert([{ id: user.id, username: defaultUsername, role: 'agent' }] as any, { onConflict: 'id' })
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
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = browserSupabase();
    let mounted = true;

    const applySession = async (session: Session | null) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setAccessToken(session?.access_token ?? null);

      if (currentUser) {
        const prof = await loadOrCreateProfile(currentUser);
        if (!mounted) return;
        setProfile(prof);
      } else {
        setProfile(null);
      }
    };

    const load = async () => {
      try {
        const sessionData = await timeout(
          supabase.auth.getSession().then((result) => result.data),
          2500,
          { session: null }
        );

        if (!mounted) return;
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
    };

    void load();

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_evt: AuthChangeEvent, session: Session | null) => {
        try {
          await applySession(session);
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

  return { user, profile, accessToken, loading };
}
