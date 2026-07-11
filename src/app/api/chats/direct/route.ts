import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function sortPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
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
    const otherUserId = String(body?.other_user ?? body?.otherUserId ?? '').trim();

    if (!otherUserId) {
      return NextResponse.json({ error: 'Missing other user id' }, { status: 400 });
    }

    if (otherUserId === currentUserId) {
      return NextResponse.json({ error: 'Cannot create a direct chat with yourself' }, { status: 400 });
    }

    const { data: otherProfile, error: otherErr } = await supabaseAdmin
      .from('profiles')
      .select('id, username')
      .eq('id', otherUserId)
      .maybeSingle();

    if (otherErr) throw otherErr;
    if (!otherProfile) {
      return NextResponse.json({ error: 'Other user profile not found' }, { status: 404 });
    }

    const [a, b] = sortPair(currentUserId, otherUserId);
    const directKey = `${a}:${b}`;

    const { data: existingByKey, error: existingKeyErr } = await supabaseAdmin
      .from('chats')
      .select('id')
      .eq('kind', 'direct')
      .eq('direct_key', directKey)
      .maybeSingle();

    if (!existingKeyErr && existingByKey?.id) {
      const chatId = existingByKey.id;
      await supabaseAdmin
        .from('chat_members')
        .upsert(
          [
            { chat_id: chatId, user_id: currentUserId },
            { chat_id: chatId, user_id: otherUserId },
          ] as any,
          { onConflict: 'chat_id,user_id' }
        );
      return NextResponse.json({ chatId });
    }

    if (existingKeyErr) {
      const { data: memberRows, error: memberErr } = await supabaseAdmin
        .from('chat_members')
        .select('chat_id')
        .in('user_id', [currentUserId, otherUserId]);

      if (memberErr) throw memberErr;

      const counts = new Map<string, number>();
      for (const row of memberRows ?? []) {
        const id = (row as any).chat_id as string;
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }

      const candidateIds = Array.from(counts.entries())
        .filter(([, count]) => count >= 2)
        .map(([id]) => id);

      if (candidateIds.length > 0) {
        const { data: existing, error: exErr } = await supabaseAdmin
          .from('chats')
          .select('id')
          .eq('kind', 'direct')
          .in('id', candidateIds)
          .limit(1);

        if (exErr) throw exErr;
        if (existing?.[0]?.id) {
          return NextResponse.json({ chatId: existing[0].id });
        }
      }
    }

    const insertChat: Record<string, any> = {
      kind: 'direct',
      created_by: currentUserId,
      assigned_to: currentUserId,
      title: (otherProfile as any).username ?? 'Direct chat',
      status: 'open',
    };

    if (!existingKeyErr) insertChat.direct_key = directKey;

    const { data: chat, error: chatErr } = await supabaseAdmin
      .from('chats')
      .insert([insertChat])
      .select('id')
      .single();

    if (chatErr) throw chatErr;

    const chatId = (chat as any).id as string;

    const { error: membersErr } = await supabaseAdmin
      .from('chat_members')
      .upsert(
        [
          { chat_id: chatId, user_id: currentUserId },
          { chat_id: chatId, user_id: otherUserId },
        ] as any,
        { onConflict: 'chat_id,user_id' }
      );

    if (membersErr) throw membersErr;

    return NextResponse.json({ chatId });
  } catch (e: any) {
    console.error('Direct chat creation failed:', e);
    return NextResponse.json(
      { error: e?.message ?? 'Direct chat creation failed' },
      { status: 500 }
    );
  }
}
