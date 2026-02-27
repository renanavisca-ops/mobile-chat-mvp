'use client';

import { browserSupabase } from '@/lib/supabase/client';
import type { ProfileLite } from '@/lib/db/types';

/**
 * Search users by username (public profile lookup).
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
    username: row.username ?? null
  }));
}

/**
 * List my saved contacts.
 */
export async function listMyContacts(): Promise<ProfileLite[]> {
  const supabase = browserSupabase();

  const { data: me, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!me.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('contacts')
    .select('contact_id, profiles:contact_id (id, username)')
    .eq('owner_id', me.user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const rows = data ?? [];

  const result: ProfileLite[] = [];

  for (const row of rows as any[]) {
    const profile = row.profiles;

    if (!profile) continue;

    if (Array.isArray(profile)) {
      const first = profile[0];
      if (first?.id) {
        result.push({
          id: first.id,
          username: first.username ?? null
        });
      }
    } else {
      if (profile?.id) {
        result.push({
          id: profile.id,
          username: profile.username ?? null
        });
      }
    }
  }

  return result;
}

/**
 * Add a contact (idempotent).
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

    // Ignore duplicate key errors
    if (!msg.includes('duplicate')) {
      throw error;
    }
  }
}
