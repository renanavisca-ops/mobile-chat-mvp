import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * Deletes the caller's own account and personal data. Requires the caller's
 * bearer token (verified via supabaseAdmin.auth.getUser) so a user can only
 * delete themselves.
 *
 * What gets removed:
 *  - Storage files owned by the user: avatars/{uid}, stories/{uid},
 *    wallpapers/{uid} (deleted explicitly here — Storage is not cascaded).
 *  - The auth user, which ON DELETE CASCADE removes profile, devices, device
 *    tokens, push subscriptions, contacts, blocks, chat memberships, reactions,
 *    poll votes, hidden messages, stories, story views, calls, and all
 *    encryption keys/backups (user_keys, key_backups, chat_keys). Chats the
 *    user created/was assigned to have created_by/assigned_to SET NULL.
 *
 * Messages the user sent are intentionally kept so the conversation isn't
 * erased for the other participants; because the sender's profile is deleted,
 * those messages render as belonging to a deleted user (no name or avatar).
 * Shared chat media (chat-media bucket) likewise remains with the chat.
 */
const USER_BUCKETS = ['avatars', 'stories', 'wallpapers'];

async function deleteUserStorage(userId: string): Promise<void> {
  for (const bucket of USER_BUCKETS) {
    try {
      const { data: files } = await supabaseAdmin.storage.from(bucket).list(userId, { limit: 1000 });
      if (files && files.length > 0) {
        await supabaseAdmin.storage.from(bucket).remove(files.map((f) => `${userId}/${f.name}`));
      }
    } catch {
      // best effort — never block account deletion on a storage cleanup error
    }
  }
}

export async function POST(req: Request) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Remove the user's Storage files first (while we still have the id), then
    // delete the auth user, which cascades all their database rows.
    await deleteUserStorage(user.id);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Error deleting account:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
