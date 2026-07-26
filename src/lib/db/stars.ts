import { browserSupabase } from '@/lib/supabase/client';

export type StarredMessage = {
  message_id: string;
  chat_id: string;
  starred_at: string;
  created_at: string | null;
  preview: string;
  kind: 'text' | 'photo' | 'video' | 'audio' | 'gif' | 'poll' | 'file' | 'deleted' | 'encrypted' | null;
};

/** Derive a short text preview + kind from a raw message row (mirrors the
 *  chat-list logic; encrypted bodies show a lock rather than plaintext). */
function previewOf(row: { content: string | null; ciphertext: string | null }): { preview: string; kind: StarredMessage['kind'] } {
  if (row.content) return { preview: row.content, kind: 'text' };
  if (row.ciphertext) {
    try {
      const p = JSON.parse(row.ciphertext);
      if (p.e === 1) return { preview: '🔒', kind: 'encrypted' };
      if (p.is_deleted) return { preview: '', kind: 'deleted' };
      if (p.text) return { preview: p.text, kind: 'text' };
      if (p.imagePath || p.imagePaths?.length) return { preview: '📷', kind: 'photo' };
      if (p.videoPath) return { preview: '🎬', kind: 'video' };
      if (p.audioPath) return { preview: '🎤', kind: 'audio' };
      if (p.gifUrl) return { preview: 'GIF', kind: 'gif' };
      if (p.filePath) return { preview: p.fileName || '📎', kind: 'file' };
      if (p.poll) return { preview: '📊', kind: 'poll' };
    } catch {
      /* fall through */
    }
  }
  return { preview: '', kind: null };
}

export async function starMessage(messageId: string, chatId: string): Promise<void> {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error('Not signed in');
  const { error } = await supabase
    .from('message_stars')
    .upsert({ user_id: me.user.id, message_id: messageId, chat_id: chatId }, { onConflict: 'user_id,message_id' });
  if (error) throw error;
}

export async function unstarMessage(messageId: string): Promise<void> {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error('Not signed in');
  const { error } = await supabase
    .from('message_stars')
    .delete()
    .eq('user_id', me.user.id)
    .eq('message_id', messageId);
  if (error) throw error;
}

/** Starred message ids within a single chat (for the star indicator). */
export async function getStarredIdsForChat(chatId: string): Promise<string[]> {
  const supabase = browserSupabase();
  const { data, error } = await supabase.from('message_stars').select('message_id').eq('chat_id', chatId);
  if (error) throw error;
  return (data ?? []).map((r) => r.message_id);
}

/** All of my starred messages, newest first, with a rendered preview. */
export async function listStarredMessages(): Promise<StarredMessage[]> {
  const supabase = browserSupabase();
  const { data, error } = await supabase
    .from('message_stars')
    .select('message_id, chat_id, created_at, messages ( content, ciphertext, created_at )')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const msg = (Array.isArray(row.messages) ? row.messages[0] : row.messages) as
      | { content: string | null; ciphertext: string | null; created_at: string | null }
      | null;
    const { preview, kind } = previewOf({ content: msg?.content ?? null, ciphertext: msg?.ciphertext ?? null });
    return {
      message_id: row.message_id,
      chat_id: row.chat_id,
      starred_at: row.created_at,
      created_at: msg?.created_at ?? null,
      preview,
      kind,
    };
  });
}
