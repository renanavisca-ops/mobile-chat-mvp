'use client';

import { browserSupabase } from '@/lib/supabase/client';

export type Community = {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  createdBy: string | null;
  isOwner: boolean;
};

export type CommunityGroup = { chatId: string; title: string | null; avatarUrl: string | null };
export type AdminGroup = { chatId: string; title: string | null };

export async function listMyCommunities(): Promise<Community[]> {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  const uid = me.user?.id ?? null;
  const { data, error } = await (supabase as any)
    .from('communities')
    .select('id, name, description, avatar_url, created_by')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return (data as any[]).map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description ?? null,
    avatarUrl: c.avatar_url ?? null,
    createdBy: c.created_by ?? null,
    isOwner: !!uid && c.created_by === uid,
  }));
}

export async function createCommunity(name: string, description?: string): Promise<string> {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error('Not authenticated');
  const { data, error } = await (supabase as any)
    .from('communities')
    .insert({ name: name.trim(), description: description?.trim() || null, created_by: me.user.id })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteCommunity(id: string): Promise<void> {
  const supabase = browserSupabase();
  const { error } = await (supabase as any).from('communities').delete().eq('id', id);
  if (error) throw error;
}

export async function getCommunityGroups(communityId: string): Promise<CommunityGroup[]> {
  const supabase = browserSupabase();
  const { data, error } = await (supabase as any)
    .from('community_groups')
    .select('chat_id')
    .eq('community_id', communityId);
  if (error || !data || data.length === 0) return [];
  const ids = (data as any[]).map((r) => r.chat_id);
  const { data: chats } = await (supabase as any)
    .from('chats')
    .select('id, title, avatar_url')
    .in('id', ids);
  const byId = new Map((chats ?? []).map((c: any) => [c.id, c]));
  return ids.map((id: string) => {
    const c: any = byId.get(id);
    return { chatId: id, title: c?.title ?? null, avatarUrl: c?.avatar_url ?? null };
  });
}

export async function addGroupToCommunity(communityId: string, chatId: string): Promise<void> {
  const supabase = browserSupabase();
  const { error } = await (supabase as any)
    .from('community_groups')
    .insert({ community_id: communityId, chat_id: chatId });
  if (error && !String(error.message).includes('duplicate')) throw error;
}

export async function removeGroupFromCommunity(communityId: string, chatId: string): Promise<void> {
  const supabase = browserSupabase();
  const { error } = await (supabase as any)
    .from('community_groups')
    .delete()
    .eq('community_id', communityId)
    .eq('chat_id', chatId);
  if (error) throw error;
}

/** Groups the current user administers (creator or role=admin) — addable to a community. */
export async function listMyAdminGroups(): Promise<AdminGroup[]> {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) return [];
  const uid = me.user.id;
  const { data: mems } = await (supabase as any)
    .from('chat_members')
    .select('chat_id, role')
    .eq('user_id', uid);
  if (!mems || mems.length === 0) return [];
  const ids = (mems as any[]).map((m) => m.chat_id);
  const roleByChat = new Map((mems as any[]).map((m) => [m.chat_id, m.role]));
  const { data: chats } = await (supabase as any)
    .from('chats')
    .select('id, title, created_by, kind')
    .in('id', ids)
    .eq('kind', 'group');
  return (chats ?? [])
    .filter((c: any) => c.created_by === uid || roleByChat.get(c.id) === 'admin')
    .map((c: any) => ({ chatId: c.id, title: c.title ?? null }));
}
