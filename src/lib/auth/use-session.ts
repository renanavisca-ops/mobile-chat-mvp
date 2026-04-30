import { useEffect, useState } from 'react';
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { browserSupabase } from '@/lib/supabase/client';
import type { ProfileRow } from '@/types/chat';

/**
 * Loads or auto-creates a profile for the given user.
 * This guarantees profile always exists after session is established.
 */
async function loadOrCreateProfile(userId: string): Promise<ProfileRow | null> {
  const supabase = browserSupabase();

  // 1. Try to fetch existing profile
  const { data: prof, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (prof) return prof as ProfileRow;

  // 2. Profile doesn't exist — auto-create with defaults
  if (error?.code === 'PGRST116' || !prof) {
    console.warn('Profile not found, auto-creating for user:', userId);

    const { data: created, error: createErr } = await supabase
      .from('profiles')
      .upsert(
        { id: userId, username: null, role: 'agent' },
        { onConflict: 'id' }
      )
      .select('*')
      .single();

    if (createErr) {
      console.error('Failed to auto-create profile:', createErr);
      // Return a fallback so the app doesn't freeze
      return {
        id: userId,
        username: null,
        store_id: null,
        role: 'agent',
        created_at: new Date().toISOString(),
      } as ProfileRow;
    }

    return (created as ProfileRow) ?? null;
  }

  // 3. Some other error
  console.error('Error loading profile:', error);
  return null;
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

        console.log('RAW SESSION:', data.session); // 👈 ESTE ES EL DEBUG

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
          const prof = await loadOrCreateProfile(currentUser.id);
          setProfile(prof);
        }
      } catch (e) {
        console.error('Session load failed:', e);
        setUser(null);
        setProfile(null);
      } finally {
        // ALWAYS resolve loading
        setLoading(false);
      }
    };

    void load();

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_evt: AuthChangeEvent, session: Session | null) => {
        console.log('AUTH CHANGE SESSION:', session); // 👈 EXTRA DEBUG

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          const prof = await loadOrCreateProfile(currentUser.id);
          setProfile(prof);
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
