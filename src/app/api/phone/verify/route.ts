import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { phoneVerificationEnabled, phoneProvider } from '@/lib/phone/config';
import { isExpired, tooManyAttempts } from '@/lib/phone/verify';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/**
 * Verify the code and attach the phone to the signed-in account (sets
 * profiles.phone + phone_verified). DISABLED by default. Enforces expiry and a
 * max-attempts cap. Never creates a second account.
 */
export async function POST(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!phoneVerificationEnabled() || !phoneProvider()) {
    return NextResponse.json({ error: 'Phone verification is not configured.', code: 'not_configured' }, { status: 501 });
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const code = String(body?.code ?? '').trim();
  if (!/^[0-9]{6}$/.test(code)) {
    return NextResponse.json({ error: 'Invalid code', code: 'invalid_code' }, { status: 400 });
  }

  const { data: row } = await (supabaseAdmin as any)
    .from('phone_verifications').select('phone, code_hash, expires_at, attempts').eq('user_id', user.id).maybeSingle();
  if (!row) return NextResponse.json({ error: 'No pending verification', code: 'no_pending' }, { status: 400 });
  if (tooManyAttempts(row.attempts)) {
    return NextResponse.json({ error: 'Too many attempts', code: 'too_many_attempts' }, { status: 429 });
  }
  if (isExpired(new Date(row.expires_at).getTime())) {
    return NextResponse.json({ error: 'Code expired', code: 'expired' }, { status: 410 });
  }

  if (sha256(code) !== row.code_hash) {
    await (supabaseAdmin as any).from('phone_verifications').update({ attempts: row.attempts + 1 }).eq('user_id', user.id);
    return NextResponse.json({ error: 'Wrong code', code: 'wrong_code' }, { status: 400 });
  }

  // Double-check the phone wasn't claimed meanwhile.
  const { data: taken } = await (supabaseAdmin as any)
    .from('profiles').select('id').eq('phone', row.phone).eq('phone_verified', true).neq('id', user.id).maybeSingle();
  if (taken) return NextResponse.json({ error: 'Phone already in use', code: 'phone_taken' }, { status: 409 });

  const { error: updErr } = await (supabaseAdmin as any)
    .from('profiles').update({ phone: row.phone, phone_verified: true }).eq('id', user.id);
  if (updErr) return NextResponse.json({ error: updErr.message, code: 'update_failed' }, { status: 500 });

  await (supabaseAdmin as any).from('phone_verifications').delete().eq('user_id', user.id);
  return NextResponse.json({ ok: true, phone: row.phone });
}
