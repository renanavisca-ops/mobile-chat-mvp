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
    let active = true;

    // Apply an auth state and (re)load the profile. The profile query runs
    // OUTSIDE any Supabase auth-lock context — see the onAuthStateChange note.
    const applyUser = (currentUser: User | null) => {
      if (!active) return;
      setUser(currentUser);

      if (!currentUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      loadProfile(currentUser.id)
        .then((p) => {
          if (active) setProfile(p);
        })
        .catch((e) => {
          console.error('Session load failed:', e);
          if (active) setProfile(null);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };

    // Initial read.
    supabase.auth
      .getSession()
      .then(({ data }) => applyUser(data.session?.user ?? null))
      .catch(() => {
        if (active) setLoading(false);
      });

    // IMPORTANT: supabase-js holds an internal auth lock while it runs this
    // callback. Awaiting another Supabase call here (e.g. a `.from(...)`
    // query, which itself needs getSession) re-enters that lock and DEADLOCKS
    // the client — every later query/auth call then hangs, which shows up as
    // the whole app "loading forever". So the callback must stay synchronous
    // and defer any Supabase work to a microtask via setTimeout(…, 0).
    const { data: sub } = supabase.auth.onAuthStateChange(
      (_evt: AuthChangeEvent, session: Session | null) => {
        const currentUser = session?.user ?? null;
        setTimeout(() => applyUser(currentUser), 0);
      }
    );

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, profile, loading };
}
