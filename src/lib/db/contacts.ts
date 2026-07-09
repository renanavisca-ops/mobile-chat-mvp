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

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username')
    .ilike('username', `%${q}%`)
    .limit(20);

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    username: row.username ?? null,
  }));
}

/**
 * List contacts for a known authenticated user.
 * The caller passes ownerId to avoid extra Supabase auth calls.
 */
export async function listMyContacts(ownerId: string): Promise<ProfileLite[]> {
  const supabase = browserSupabase();

  if (!ownerId) throw new Error('Not authenticated');

  // 1) Get contact IDs only
  const { data: contactRows, error } = await supabase
    .from('contacts')
    .select('contact_id')
    .eq('owner_id', ownerId)
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
      username: (p as any).username ?? null,
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

/**
 * Add a contact for a known authenticated user.
 * The caller passes ownerId to avoid extra Supabase auth calls.
 */
export async function addContact(ownerId: string, contactId: string): Promise<void> {
  const supabase = browserSupabase();

  if (!ownerId) throw new Error('Not authenticated');
  if (contactId === ownerId) return;

  const { error } = await supabase
    .from('contacts')
    .insert({
      owner_id: ownerId,
      contact_id: contactId,
    });

  if (error) {
    const msg = String((error as any).message ?? '').toLowerCase();

    // Ignore duplicate insert
    if (!msg.includes('duplicate')) {
      throw error;
    }
  }
}
