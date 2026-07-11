import { useEffect, useState } from 'react';
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { browserSupabase } from '@/lib/supabase/client';
import type { ProfileRow } from '@/types/chat';

/**
 * Loads the current user's profile.
 * Returns null when no profile exists yet (the user still needs to claim a
 * username in /onboarding). We intentionally do NOT auto-insert a blank
 * profile — `profiles.username` has a not-blank + unique constraint, so a
 * null-username insert would fail and leave the account without a profile.
 */
async function loadProfile(userId: string): Promise<ProfileRow | null> {
  const supabase = browserSupabase();

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error loading profile:', error);
    return null;
  }

  return (data as ProfileRow | null) ?? null;
}

export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = browserSupabase();

    const load = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error('getSession error:', error);
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        const currentUser = data.session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          setProfile(await loadProfile(currentUser.id));
        }
      } catch (e) {
        console.error('Session load failed:', e);
        setUser(null);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    void load();

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_evt: AuthChangeEvent, session: Session | null) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          setProfile(await loadProfile(currentUser.id));
        } else {
          setProfile(null);
        }

        setLoading(false);
      }
    );

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, profile, loading };
}
