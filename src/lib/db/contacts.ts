'use client';

import { browserSupabase } from '@/lib/supabase/client';
import type { ProfileLite } from '@/lib/db/types';

/**
 * Search users by username or email through the server API.
 * This avoids client-side RLS/profile visibility issues.
 */
export async function searchUsers(query: string, accessToken: string): Promise<ProfileLite[]> {
  const q = query.trim();
  if (!q || q.length < 2) return [];
  if (!accessToken) throw new Error('Session token not ready. Refresh and try again.');

  const res = await fetch(`/api/profiles/search?q=${encodeURIComponent(q)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error ?? 'Profile search failed');
  }

  return (data?.users ?? []) as ProfileLite[];
}

/**
 * List contacts for a known authenticated user.
 * The caller passes ownerId to avoid extra Supabase auth calls.
 */
export async function listMyContacts(ownerId: string): Promise<ProfileLite[]> {
  const supabase = browserSupabase();

  if (!ownerId) throw new Error('Not authenticated');

  // 1) Get contact IDs only. Never return the owner as their own contact.
  const { data: contactRows, error } = await supabase
    .from('contacts')
    .select('contact_id')
    .eq('owner_id', ownerId)
    .neq('contact_id', ownerId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const ids = (contactRows ?? [])
    .map((r: any) => r.contact_id)
    .filter((id: string) => Boolean(id) && id !== ownerId);

  if (ids.length === 0) return [];

  // 2) Fetch profiles separately
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, username, email')
    .in('id', ids);

  if (pErr) throw pErr;

  const map = new Map<string, ProfileLite>();

  for (const p of profiles ?? []) {
    const username = (p as any).username;
    const email = (p as any).email;
    const id = (p as any).id;

    if (!id || id === ownerId) continue;

    map.set(id, {
      id,
      username: typeof username === 'string' && username.trim() ? username : null,
      email: typeof email === 'string' && email.trim() ? email : null,
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
  if (!contactId) throw new Error('Missing contact id');
  if (contactId === ownerId) throw new Error('No puedes agregarte a ti mismo como contacto.');

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
