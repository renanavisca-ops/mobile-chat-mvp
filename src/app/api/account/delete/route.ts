import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * Deletes the caller's own account. Requires the caller's bearer token
 * (verified via supabaseAdmin.auth.getUser) so a user can only delete
 * themselves — never someone else's account.
 *
 * profiles / devices / chat_members / contacts / blocks all reference
 * auth.users(id) ON DELETE CASCADE, so they're cleaned up automatically.
 * Messages the user sent remain (sender_id has no FK to auth.users) so chat
 * history isn't erased for the other participants.
 */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Error deleting account:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
