import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';
import { hashCode } from '@/lib/auth/recovery-hash';

/**
 * Recover access when the authenticator is lost. The caller is only
 * password-verified (aal1) at this point, so everything sensitive happens here
 * with the service role: verify a one-time recovery code, then remove the
 * account's TOTP factors so the existing session becomes fully authenticated.
 * 2FA ends up OFF — the user should re-enable it afterwards.
 *
 * POST /api/mfa/recovery/consume   (Authorization: Bearer <access_token>)
 *   body: { code: string }  -> { ok: true }
 */

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Tight limit: brute-forcing high-entropy codes is infeasible, but cap anyway.
  const rl = rateLimit(`mfa-recover:${user.id}`, 5, 60_000);
  if (!rl.ok) return NextResponse.json({ error: 'Too many attempts. Wait a minute.' }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const code = typeof body?.code === 'string' ? body.code : '';
  if (!code.trim()) return NextResponse.json({ error: 'Missing code' }, { status: 400 });

  const { data: match } = await supabaseAdmin
    .from('mfa_recovery_codes')
    .select('id')
    .eq('user_id', user.id)
    .eq('code_hash', hashCode(code))
    .is('used_at', null)
    .maybeSingle();

  if (!match) return NextResponse.json({ error: 'Invalid recovery code' }, { status: 400 });

  // Burn the code, then drop it and its siblings (2FA is being turned off).
  await supabaseAdmin.from('mfa_recovery_codes').update({ used_at: new Date().toISOString() }).eq('id', match.id);

  // Remove every TOTP factor for the user so the session no longer needs aal2.
  try {
    const { data: factors } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId: user.id });
    for (const f of factors?.factors ?? []) {
      if (f.factor_type === 'totp') {
        await supabaseAdmin.auth.admin.mfa.deleteFactor({ userId: user.id, id: f.id });
      }
    }
  } catch {
    return NextResponse.json({ error: 'Could not reset two-factor. Try again.' }, { status: 500 });
  }

  // With 2FA gone the codes are moot — clear them all.
  await supabaseAdmin.from('mfa_recovery_codes').delete().eq('user_id', user.id);

  return NextResponse.json({ ok: true });
}
