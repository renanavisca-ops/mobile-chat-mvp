'use client';

import { browserSupabase } from '@/lib/supabase/client';

export type StaffRole = 'agent' | 'admin' | 'superadmin';

/** A staff member of a store. */
export type StaffMember = {
  id: string;
  name: string;
  username: string | null;
  role: StaffRole;
};

function mapRow(r: any): StaffMember {
  return {
    id: r.id,
    name: (r.display_name || r.username || '—') as string,
    username: r.username ?? null,
    role: (r.role ?? 'agent') as StaffRole,
  };
}

/** List the staff of a store (agents, admins, superadmins). */
export async function listStoreStaff(storeId: string): Promise<StaffMember[]> {
  const supabase = browserSupabase();
  const { data, error } = await (supabase as any)
    .from('profiles')
    .select('id, username, display_name, role')
    .eq('store_id', storeId)
    .in('role', ['agent', 'admin', 'superadmin'])
    .order('display_name', { ascending: true });
  if (error) throw error;
  return ((data as any[]) ?? []).map(mapRow);
}

/** Change a staff member's role (agent ↔ admin). Validated server-side. */
export async function setMemberRole(userId: string, role: 'agent' | 'admin'): Promise<void> {
  const supabase = browserSupabase();
  const { error } = await (supabase as any).rpc('set_store_member_role', { p_user: userId, p_role: role });
  if (error) throw error;
}
