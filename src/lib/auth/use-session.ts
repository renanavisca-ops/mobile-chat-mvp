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
// Dedupe profile loads: several components mount useSession at once (chats page,
// conversation, presence…), each of which used to fire its own profile query.
// A short-lived memory cache + in-flight sharing collapses those to one request.
const PROFILE_TTL = 30_000;
let profileCache: { userId: string; profile: ProfileRow | null; at: number } | null = null;
const profileInflight = new Map<string, Promise<ProfileRow | null>>();

async function loadProfile(userId: string): Promise<ProfileRow | null> {
  if (profileCache && profileCache.userId === userId && Date.now() - profileCache.at < PROFILE_TTL) {
    return profileCache.profile;
  }
  const inflight = profileInflight.get(userId);
  if (inflight) return inflight;

  const promise = (async () => {
    const supabase = browserSupabase();
    // Retry transient failures with backoff. A profile fetch that errors (a
    // flaky network right after a fresh install, a cold connection) must NOT be
    // mistaken for "this user has no profile": that would bounce an existing
    // user to /onboarding and leave the app empty (no chats/contacts), exactly
    // the "logged in on a new phone but nothing loaded" report. A genuine
    // no-profile case returns data=null with NO error and is handled normally.
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (!error) {
        const profile = (data as ProfileRow | null) ?? null;
        profileCache = { userId, profile, at: Date.now() };
        return profile;
      }
      lastErr = error;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
    // Give up for now WITHOUT caching, so a later trigger (auth change or the
    // `online` re-check in useSession) retries from scratch instead of being
    // stuck on a cached null.
    console.error('Error loading profile (after retries):', lastErr);
    return null;
  })();

  profileInflight.set(userId, promise);
  try {
    return await promise;
  } finally {
    profileInflight.delete(userId);
  }
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

    // If the profile load failed while offline/flaky (so we're showing no
    // profile for a signed-in user), re-read the session and reload it as soon
    // as connectivity returns — otherwise the user stays stranded until they
    // restart the app. The 30s cache makes this cheap when nothing's wrong.
    const onReconnect = () => {
      supabase.auth
        .getSession()
        .then(({ data }) => applyUser(data.session?.user ?? null))
        .catch(() => {});
    };
    window.addEventListener('online', onReconnect);
    window.addEventListener('focus', onReconnect);

    return () => {
      active = false;
      sub.subscription.unsubscribe();
      window.removeEventListener('online', onReconnect);
      window.removeEventListener('focus', onReconnect);
    };
  }, []);

  return { user, profile, loading };
}
