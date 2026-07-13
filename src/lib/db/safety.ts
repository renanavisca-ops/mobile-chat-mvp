'use client';

import { browserSupabase } from '@/lib/supabase/client';

export async function blockUser(userId: string): Promise<void> {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('blocks')
    .insert({ blocker_id: me.user.id, blocked_id: userId });
  if (error) throw error;
}

export async function unblockUser(userId: string): Promise<void> {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', me.user.id)
    .eq('blocked_id', userId);
  if (error) throw error;
}

export async function isBlockedByMe(userId: string): Promise<boolean> {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) return false;

  const { data, error } = await supabase
    .from('blocks')
    .select('blocked_id')
    .eq('blocker_id', me.user.id)
    .eq('blocked_id', userId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export type ReportInput = {
  reportedUserId?: string | null;
  chatId?: string | null;
  messageId?: string | null;
  reason: string;
  details?: string;
};

export async function submitReport(input: ReportInput): Promise<void> {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error('Not authenticated');

  const { error } = await supabase.from('reports').insert({
    reporter_id: me.user.id,
    reported_user_id: input.reportedUserId ?? null,
    chat_id: input.chatId ?? null,
    message_id: input.messageId ?? null,
    reason: input.reason,
    details: input.details || null,
  });
  if (error) throw error;
}
