import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { phoneVerificationEnabled, phoneProvider, phoneSimulated } from '@/lib/phone/config';
import { generateCode, normalizePhone, isValidPhone, CODE_TTL_MS } from '@/lib/phone/verify';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/**
 * Request a phone-verification code for the signed-in account. DISABLED by
 * default. With PHONE_PROVIDER=simulator (dev/test) it returns the code in the
 * response (clearly marked simulated) and sends NO SMS. A real SMS provider is
 * a separate pending adapter — see docs/PHONE.md. This never creates a second
 * account; it only prepares to attach a verified phone to the current one.
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
  const phone = normalizePhone(String(body?.phone ?? ''));
  if (!isValidPhone(phone)) {
    return NextResponse.json({ error: 'Invalid phone', code: 'invalid_phone' }, { status: 400 });
  }

  // Reject a phone already verified on another account.
  const { data: taken } = await (supabaseAdmin as any)
    .from('profiles').select('id').eq('phone', phone).eq('phone_verified', true).neq('id', user.id).maybeSingle();
  if (taken) return NextResponse.json({ error: 'Phone already in use', code: 'phone_taken' }, { status: 409 });

  // Rate-limit code requests per user (fail-open).
  try {
    const { data: ok } = await (supabaseAdmin as any).rpc('rate_limit_hit', {
      p_bucket: `phone:${user.id}`, p_limit: 5, p_window_seconds: 600,
    });
    if (ok === false) return NextResponse.json({ error: 'Too many requests', code: 'rate_limited' }, { status: 429 });
  } catch { /* allow */ }

  const code = generateCode();
  await (supabaseAdmin as any).from('phone_verifications').upsert({
    user_id: user.id,
    phone,
    code_hash: sha256(code),
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    attempts: 0,
    created_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  if (phoneSimulated()) {
    // Dev/test: hand the code back so the flow completes with no SMS. NEVER do
    // this with a real provider.
    return NextResponse.json({ sent: true, simulated: true, simulatedCode: code });
  }
  // A real provider name is set but its SMS adapter isn't implemented.
  return NextResponse.json({ error: 'SMS adapter not implemented.', code: 'adapter_not_implemented' }, { status: 501 });
}
