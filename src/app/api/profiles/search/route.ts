import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function sanitizeQuery(value: string): string {
  return value.trim().replace(/[%,]/g, '').slice(0, 64);
}

export async function GET(req: Request) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const url = new URL(req.url);
    const q = sanitizeQuery(url.searchParams.get('q') ?? '');

    if (q.length < 2) {
      return NextResponse.json({ users: [] });
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, username')
      .not('username', 'is', null)
      .neq('id', userData.user.id)
      .ilike('username', `%${q}%`)
      .order('username', { ascending: true })
      .limit(20);

    if (error) throw error;

    const users = (data ?? [])
      .filter((row: any) => typeof row.username === 'string' && row.username.trim().length > 0)
      .map((row: any) => ({ id: row.id, username: row.username }));

    return NextResponse.json({ users });
  } catch (e: any) {
    console.error('Profile search failed:', e);
    return NextResponse.json({ error: e?.message ?? 'Profile search failed' }, { status: 500 });
  }
}
