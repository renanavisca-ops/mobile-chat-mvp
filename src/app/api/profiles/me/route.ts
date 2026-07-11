import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function sanitizeUsername(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
}

function defaultUsernameForUser(user: { id: string; email?: string | null }): string {
  const emailPrefix = user.email?.split('@')[0] ?? '';
  const cleanPrefix = sanitizeUsername(emailPrefix);
  const suffix = user.id.replace(/-/g, '').slice(0, 8);
  return cleanPrefix ? `${cleanPrefix}_${suffix}`.slice(0, 32) : `user_${suffix}`;
}

export async function POST(req: Request) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const requestedUsername = sanitizeUsername(String(body?.username ?? '').trim());
    const user = userData.user;
    const email = user.email?.trim().toLowerCase() || null;

    const { data: existingProfile, error: existingErr } = await supabaseAdmin
      .from('profiles')
      .select('id, username, email, role, store_id, created_at')
      .eq('id', user.id)
      .maybeSingle();

    if (existingErr) throw existingErr;

    const existingUsername = typeof existingProfile?.username === 'string' ? existingProfile.username.trim() : '';
    const username = requestedUsername || existingUsername || defaultUsernameForUser(user);

    if (!username || username.length < 3) {
      return NextResponse.json({ error: 'Username must have at least 3 characters' }, { status: 400 });
    }

    const role = existingProfile?.role ?? 'agent';

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .upsert(
        [{ id: user.id, username, email, role }],
        { onConflict: 'id' }
      )
      .select('id, username, email, role, store_id, created_at')
      .single();

    if (profileErr) throw profileErr;

    let deviceId: string | null = null;
    const bundle = body?.deviceBundle;

    if (bundle && typeof bundle === 'object') {
      const deviceLabel = String(body?.deviceLabel ?? `Web-${new Date().toISOString().slice(0, 10)}`);

      const { data: device, error: deviceErr } = await supabaseAdmin
        .from('devices')
        .insert([
          {
            user_id: user.id,
            device_label: deviceLabel,
            registration_id: bundle.registrationId,
            identity_public_key: bundle.identityKey,
            signed_prekey_id: bundle.signedPreKeyId,
            signed_prekey_public: bundle.signedPreKeyPublic,
            signed_prekey_signature: bundle.signedPreKeySignature,
          },
        ] as any)
        .select('id')
        .single();

      if (deviceErr) throw deviceErr;
      deviceId = (device as any).id;
    }

    return NextResponse.json({ profile, deviceId });
  } catch (e: any) {
    const raw = String(e?.message ?? e ?? 'Profile upsert failed');
    const msg = raw.toLowerCase().includes('duplicate') || raw.toLowerCase().includes('unique')
      ? 'Ese username o email ya está en uso. Escoge otro username.'
      : raw;

    console.error('Profile upsert failed:', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
