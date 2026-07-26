import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';
import { hashCode } from '@/lib/auth/recovery-hash';

/**
 * Generate a fresh set of one-time 2FA recovery codes for the signed-in user.
 * Replaces any existing codes. Returns the plaintext codes ONCE — only their
 * hashes are stored — so the client must show/save them immediately.
 *
 * POST /api/mfa/recovery/generate   (Authorization: Bearer <access_token>)
 *   -> { codes: string[] }
 */

export const runtime = 'nodejs';

const CODE_COUNT = 10;
// Unambiguous alphabet (no 0/O/1/I) for codes users may type by hand.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function makeCode(): string {
  const bytes = randomBytes(10);
  let out = '';
  for (let i = 0; i < 10; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return `${out.slice(0, 5)}-${out.slice(5)}`;
}

export async function POST(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = rateLimit(`mfa-gen:${user.id}`, 10, 60_000);
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const codes = Array.from({ length: CODE_COUNT }, makeCode);

  // Replace any previous codes with the new set.
  await supabaseAdmin.from('mfa_recovery_codes').delete().eq('user_id', user.id);
  const rows = codes.map((c) => ({ user_id: user.id, code_hash: hashCode(c) }));
  const { error: insErr } = await supabaseAdmin.from('mfa_recovery_codes').insert(rows);
  if (insErr) return NextResponse.json({ error: 'Could not create recovery codes' }, { status: 500 });

  return NextResponse.json({ codes });
}
