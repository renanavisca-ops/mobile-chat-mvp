import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export async function POST(req: Request) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });
    }

    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );

    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const currentUserId = userData.user.id;
    const body = await req.json().catch(() => ({}));
    const title = String(body?.title ?? '').trim();
    const rawMemberIds = Array.isArray(body?.member_ids) ? body.member_ids : [];

    if (!title) {
      return NextResponse.json({ error: 'Group title required' }, { status: 400 });
    }

    const memberIds = Array.from(
      new Set(
        rawMemberIds
          .map((id: unknown) => String(id ?? '').trim())
          .filter((id: string) => id && id !== currentUserId)
      )
    );

    if (memberIds.length === 0) {
      return NextResponse.json({ error: 'Select at least one member' }, { status: 400 });
    }

    const { data: validProfiles, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .in('id', memberIds);

    if (profileErr) throw profileErr;

    const validMemberIds = (validProfiles ?? []).map((p: any) => p.id).filter(Boolean);

    if (validMemberIds.length === 0) {
      return NextResponse.json({ error: 'No valid member profiles found' }, { status: 400 });
    }

    const { data: chat, error: chatErr } = await supabaseAdmin
      .from('chats')
      .insert([
        {
          kind: 'group',
          title,
          created_by: currentUserId,
          assigned_to: currentUserId,
          status: 'open',
        },
      ] as any)
      .select('id')
      .single();

    if (chatErr) throw chatErr;

    const chatId = (chat as any).id as string;
    const rows = [currentUserId, ...validMemberIds].map((userId) => ({
      chat_id: chatId,
      user_id: userId,
    }));

    const { error: membersErr } = await supabaseAdmin
      .from('chat_members')
      .upsert(rows as any, { onConflict: 'chat_id,user_id' });

    if (membersErr) throw membersErr;

    return NextResponse.json({ chatId });
  } catch (e: any) {
    console.error('Group chat creation failed:', e);
    return NextResponse.json(
      { error: e?.message ?? 'Group chat creation failed' },
      { status: 500 }
    );
  }
}
