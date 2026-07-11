import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { status } = await req.json();

    if (!['open', 'in_progress', 'closed'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [{ data: profile }, { data: chat }, { data: membership }] = await Promise.all([
      supabaseAdmin.from('profiles').select('role, store_id').eq('id', user.id).single(),
      supabaseAdmin.from('chats').select('id, kind, store_id, assigned_to, created_by').eq('id', id).single(),
      supabaseAdmin.from('chat_members').select('chat_id').eq('chat_id', id).eq('user_id', user.id).maybeSingle(),
    ]);

    if (!profile || !chat) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    let allowed = false;
    if (profile.role === 'superadmin') {
      allowed = true;
    } else if (profile.role === 'admin') {
      allowed = profile.store_id === (chat as any).store_id;
    } else if (profile.role === 'agent') {
      allowed = (chat as any).assigned_to === user.id || (chat as any).created_by === user.id || Boolean(membership);
    } else {
      allowed = Boolean(membership);
    }

    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from('chats')
      .update({ status })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Error updating status:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
