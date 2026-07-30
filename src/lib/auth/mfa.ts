import { apiFetch } from '@/lib/api/client';
import { browserSupabase } from '@/lib/supabase/client';

/**
 * Thin wrappers around Supabase's TOTP MFA. Two-factor is OPT-IN: users enable
 * it in Settings; if enabled, login requires a 6-digit authenticator code.
 */

export type EnrollResult = { factorId: string; qr: string; secret: string; uri: string };

/** Whether this account has a verified TOTP factor. */
export async function isMfaEnabled(): Promise<boolean> {
  const supabase = browserSupabase();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) return false;
  return (data?.totp ?? []).some((f) => f.status === 'verified');
}

/** Begin TOTP enrollment. Returns the QR image + secret to show the user. */
export async function enrollTotp(): Promise<EnrollResult> {
  const supabase = browserSupabase();
  // Clean up any half-finished (unverified) factors so we don't pile them up.
  const { data: list } = await supabase.auth.mfa.listFactors();
  for (const f of list?.all ?? []) {
    if (f.factor_type === 'totp' && f.status === 'unverified') {
      await supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => {});
    }
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
  if (error) throw error;
  return {
    factorId: data.id,
    qr: data.totp.qr_code,
    secret: data.totp.secret,
    uri: data.totp.uri,
  };
}

/** Complete enrollment by verifying the first code from the authenticator app. */
export async function verifyEnroll(factorId: string, code: string): Promise<void> {
  const supabase = browserSupabase();
  const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
  if (chErr) throw chErr;
  const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code: code.trim() });
  if (error) throw error;
}

/** Turn 2FA off: unenroll every TOTP factor on the account. */
export async function disableTotp(): Promise<void> {
  const supabase = browserSupabase();
  const { data } = await supabase.auth.mfa.listFactors();
  for (const f of data?.all ?? []) {
    if (f.factor_type === 'totp') {
      await supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => {});
    }
  }
}

/**
 * After a password sign-in, tell whether a TOTP challenge is still required to
 * reach the fully-authenticated (aal2) level, and which factor to use.
 */
export async function pendingMfa(): Promise<{ required: boolean; factorId?: string }> {
  const supabase = browserSupabase();
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!aal || aal.currentLevel === aal.nextLevel || aal.nextLevel !== 'aal2') {
    return { required: false };
  }
  const { data: list } = await supabase.auth.mfa.listFactors();
  const factor = (list?.totp ?? []).find((f) => f.status === 'verified');
  return { required: !!factor, factorId: factor?.id };
}

/** Verify a login-time TOTP code, elevating the session to aal2. */
export async function verifyLoginCode(factorId: string, code: string): Promise<void> {
  const supabase = browserSupabase();
  const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
  if (chErr) throw chErr;
  const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code: code.trim() });
  if (error) throw error;
}

async function authHeader(): Promise<Record<string, string>> {
  const supabase = browserSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  return session ? { Authorization: `Bearer ${session.access_token}` } : {};
}

/** Generate a fresh set of one-time recovery codes (shown once). */
export async function generateRecoveryCodes(): Promise<string[]> {
  const res = await apiFetch('/api/mfa/recovery/generate', { method: 'POST', headers: await authHeader() });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
  const data = await res.json();
  return data.codes as string[];
}

/** Use a recovery code (lost authenticator): removes TOTP so the session is
 *  fully authenticated. 2FA ends up off. */
export async function consumeRecoveryCode(code: string): Promise<void> {
  const res = await apiFetch('/api/mfa/recovery/consume', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
}
