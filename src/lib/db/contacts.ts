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

  // Join: contacts.contact_id -> profiles(id, username)
  const { data, error } = await supabase
    .from('contacts')
    .select('contact_id, profiles:contact_id (id, username)')
    .eq('owner_id', me.user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Supabase typings sometimes represent the joined "profiles" as object or array.
  const rows = (data ?? []) as any[];

  const out: ProfileLite[] = [];
  for (const r of rows) {
    const p = r.profiles;
    if (!p) continue;

    if (Array.isArray(p)) {
      // take first if array
      const first = p[0];
      if (first?.id) out.push({ id: first.id, username: first.username ?? null });
    } else {
      if (p?.id) out.push({ id: p.id, username: p.username ?? null });
    }
  }

  return out;
}

export async function addContact(contactId: string) {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error('Not authenticated');
  if (contactId === me.user.id) return;

  const { error } = await supabase.from('contacts').insert({ owner_id: me.user.id, contact_id: contactId });

  // Duplicate key is fine (already added)
  if (error && !String(error.message).toLowerCase().includes('duplicate')) throw error;
}
}
