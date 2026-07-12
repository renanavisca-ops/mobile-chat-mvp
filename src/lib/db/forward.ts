'use client';

import { browserSupabase } from '@/lib/supabase/client';

export type ForwardPayload = {
  text?: string;
  imagePath?: string;
  imagePaths?: string[];
  videoPath?: string;
  audioPath?: string;
};

export async function forwardMessageToChats(chatIds: string[], payload: ForwardPayload) {
  if (!chatIds.length) return;

  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error('Not authenticated');

  const deviceId = await ensureLocalDevice(me.user.id);

  // En MVP reenviamos el payload tal cual (no re-subimos media)
  const ciphertext = JSON.stringify({ v: 1, ...payload });

  const rows = chatIds.map((chatId) => ({
    chat_id: chatId,
    sender_device_id: deviceId,
    sender_id: me.user!.id,
    sender_type: 'agent',
    message_type: 'whisper',
    ciphertext,
    content: payload.text || null,
    nonce: crypto.randomUUID(),
  }));

  const { error } = await supabase.from('messages').insert(rows);
  if (error) throw error;
}

async function ensureLocalDevice(userId: string): Promise<string> {
  const supabase = browserSupabase();

  const cached = window.localStorage.getItem('active_device_id');

  // Never trust the cached id blindly — messages.sender_device_id has a hard
  // FK to devices(id), so a stale cached id makes every insert fail. Reconcile
  // against the devices that actually exist for this user.
  const { data: devices, error } = await supabase
    .from('devices')
    .select('id')
    .eq('user_id', userId);
  if (error) throw error;

  const ids = (devices ?? []).map((d) => d.id);

  if (cached && ids.includes(cached)) return cached;

  if (ids.length > 0) {
    window.localStorage.setItem('active_device_id', ids[0]);
    return ids[0];
  }

  const label = `Web-${new Date().toISOString().slice(0, 10)}`;

  const { data: created, error: cErr } = await supabase
    .from('devices')
    .insert({
      user_id: userId,
      device_label: label,
      registration_id: 1,
      identity_public_key: 'mvp',
      signed_prekey_id: 1,
      signed_prekey_public: 'mvp',
      signed_prekey_signature: 'mvp',
    })
    .select('id')
    .single();

  if (cErr) throw cErr;

  window.localStorage.setItem('active_device_id', created.id);
  return created.id;
}
