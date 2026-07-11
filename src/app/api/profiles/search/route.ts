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

    const currentUserId = userData.user.id;
    const url = new URL(req.url);
    const q = sanitizeQuery(url.searchParams.get('q') ?? '');

    if (q.length < 2) {
      return NextResponse.json({ users: [], currentUserId });
    }

    const pattern = `%${q}%`;

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, username, email')
      .neq('id', currentUserId)
      .or(`username.ilike.${pattern},email.ilike.${pattern}`)
      .order('username', { ascending: true, nullsFirst: false })
      .limit(20);

    if (error) throw error;

    const users = (data ?? [])
      .filter((row: any) => row.id && row.id !== currentUserId)
      .filter((row: any) => {
        const username = typeof row.username === 'string' ? row.username.trim() : '';
        const email = typeof row.email === 'string' ? row.email.trim() : '';
        return username.length > 0 || email.length > 0;
      })
      .map((row: any) => ({
        id: row.id,
        username: typeof row.username === 'string' && row.username.trim() ? row.username : null,
        email: typeof row.email === 'string' && row.email.trim() ? row.email : null,
      }));

    return NextResponse.json({ users, currentUserId });
  } catch (e: any) {
    console.error('Profile search failed:', e);
    return NextResponse.json({ error: e?.message ?? 'Profile search failed' }, { status: 500 });
  }
}
