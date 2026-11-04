'use client';

import { browserSupabase } from '@/lib/supabase/client';
import type { ProfileLite } from '@/lib/db/types';

/**
 * Search users by username
 */
export async function searchUsers(query: string): Promise<ProfileLite[]> {
  const supabase = browserSupabase();
  const q = query.trim();
  if (!q) return [];

  const { data: me } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username')
    .ilike('username', `%${q}%`)
    .limit(20);

  if (error) throw error;

  return (data ?? [])
    .filter((row: any) => row.id !== me.user?.id) // exclude myself
    .map((row: any) => ({
      id: row.id,
      username: row.username ?? null
    }));
}

/**
 * List my contacts WITHOUT using embed/join
 * (avoids PostgREST relationship cache issues)
 */
export async function listMyContacts(): Promise<ProfileLite[]> {
  const supabase = browserSupabase();

  const { data: me, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!me.user) throw new Error('Not authenticated');

  // 1) Get contact IDs only
  const { data: contactRows, error } = await supabase
    .from('contacts')
    .select('contact_id')
    .eq('owner_id', me.user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const ids = (contactRows ?? [])
    .map((r: any) => r.contact_id)
    .filter(Boolean);

  if (ids.length === 0) return [];

  // 2) Fetch profiles separately
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, username')
    .in('id', ids);

  if (pErr) throw pErr;

  const map = new Map<string, ProfileLite>();

  for (const p of profiles ?? []) {
    map.set((p as any).id, {
      id: (p as any).id,
      username: (p as any).username ?? null
    });
  }

  // Preserve order
  const result: ProfileLite[] = [];

  for (const id of ids) {
    const profile = map.get(id);
    if (profile) result.push(profile);
  }

  return result;
}

/** Whether the given user is in the current user's contacts. */
export async function isContact(userId: string): Promise<boolean> {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) return false;
  const { data, error } = await supabase
    .from('contacts')
    .select('contact_id')
    .eq('owner_id', me.user.id)
    .eq('contact_id', userId)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

/**
 * Add a contact
 */
export async function addContact(contactId: string): Promise<void> {
  const supabase = browserSupabase();

  const { data: me, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!me.user) throw new Error('Not authenticated');

  if (contactId === me.user.id) return;

  const { error } = await supabase
    .from('contacts')
    .insert({
      owner_id: me.user.id,
      contact_id: contactId
    });

  if (error) {
    const msg = String((error as any).message ?? '').toLowerCase();

    // Ignore duplicate insert
    if (!msg.includes('duplicate')) {
      throw error;
    }
  }
}

export type ContactCard = { id: string; username: string | null; displayName: string | null; avatarUrl: string | null };

/** Build the shareable "add me" link for a username (origin resolved at runtime). */
export function contactLinkFor(username: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://mobile-chat-mvp.vercel.app';
  return `${origin}/add?u=${encodeURIComponent(username)}`;
}

/** The current user's public contact card (for showing their own QR). */
export async function myContactCard(): Promise<ContactCard | null> {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) return null;
  const { data } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .eq('id', me.user.id)
    .maybeSingle();
  if (!data) return null;
  const row = data as any;
  return { id: row.id, username: row.username ?? null, displayName: row.display_name ?? null, avatarUrl: row.avatar_url ?? null };
}

/** Look up a public contact card by username (for the /add deep link). */
export async function profileByUsername(username: string): Promise<ContactCard | null> {
  const supabase = browserSupabase();
  const u = username.trim();
  if (!u) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .ilike('username', u)
    .limit(1);
  if (error) return null;
  const row = (data as any[])?.[0];
  if (!row) return null;
  return { id: row.id, username: row.username ?? null, displayName: row.display_name ?? null, avatarUrl: row.avatar_url ?? null };
}
