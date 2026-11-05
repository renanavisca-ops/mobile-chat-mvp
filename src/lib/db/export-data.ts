'use client';

import { browserSupabase } from '@/lib/supabase/client';

const MSG_CAP = 5000;

/**
 * Gather the signed-in user's own data for a personal-data export (§14). Every
 * query runs through the browser client, so RLS returns only what the user may
 * see / owns. Message bodies are included as stored: plaintext for non-E2EE
 * chats, otherwise the encrypted envelope (noted in the export).
 */
export async function buildDataExport(): Promise<Record<string, unknown>> {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error('Not authenticated');
  const uid = me.user.id;

  const [profileRes, contactsRes, membershipRes, storiesRes, devicesRes, paymentsRes, msgRes] = await Promise.all([
    (supabase as any).from('profiles').select('*').eq('id', uid).maybeSingle(),
    supabase.from('contacts').select('contact_id, created_at').eq('owner_id', uid),
    supabase.from('chat_members').select('chat_id, role').eq('user_id', uid),
    (supabase as any).from('stories').select('id, media_type, text_content, created_at, expires_at').eq('user_id', uid),
    (supabase as any).from('devices').select('id, device_label, created_at').eq('user_id', uid),
    (supabase as any).from('payments').select('*').or(`sender_id.eq.${uid},recipient_id.eq.${uid}`),
    supabase.from('messages').select('id, chat_id, content, ciphertext, message_type, created_at').eq('sender_id', uid)
      .order('created_at', { ascending: false }).limit(MSG_CAP + 1),
  ]);

  const chatIds = ((membershipRes.data as any[]) || []).map((m) => m.chat_id).filter(Boolean);
  let chats: any[] = [];
  if (chatIds.length) {
    const { data } = await supabase.from('chats').select('id, kind, title, created_at').in('id', chatIds);
    chats = (data as any[]) || [];
  }

  const msgs = (msgRes.data as any[]) || [];
  const messagesTruncated = msgs.length > MSG_CAP;

  return {
    exportedAt: new Date().toISOString(),
    note: 'Personal data export. Message bodies are as stored: plaintext for non-encrypted chats, otherwise the encrypted envelope (not decryptable outside your device).',
    account: {
      id: uid,
      email: me.user.email ?? null,
      ...(profileRes.data || {}),
    },
    contacts: (contactsRes.data as any[]) || [],
    chats,
    memberships: (membershipRes.data as any[]) || [],
    messages: msgs.slice(0, MSG_CAP),
    messagesTruncated,
    stories: (storiesRes.data as any[]) || [],
    devices: (devicesRes.data as any[]) || [],
    payments: (paymentsRes.data as any[]) || [],
  };
}
