'use client';

import { browserSupabase } from '@/lib/supabase/client';
import type { ProfileLite } from '@/lib/db/types';

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
  return (data ?? []) as ProfileLite[];
}

export async function listMyContacts(): Promise<ProfileLite[]> {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('contacts')
    .select('contact_id, profiles:contact_id (id, username)')
    .eq('owner_id', me.user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as Array<{ profiles: ProfileLite | null }>;
  return rows.map((r) => r.profiles).filter(Boolean) as ProfileLite[];
}

export async function addContact(contactId: string) {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error('Not authenticated');
  if (contactId === me.user.id) return;

  const { error } = await supabase.from('contacts').insert({ owner_id: me.user.id, contact_id: contactId });
  if (error && !String(error.message).toLowerCase().includes('duplicate')) throw error;
}
