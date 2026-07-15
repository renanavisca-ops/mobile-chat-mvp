import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * Returns a short-lived set of ICE servers (STUN + Cloudflare TURN) for a
 * WebRTC call. Requires the caller's Supabase bearer token so only signed-in
 * users can mint credentials.
 *
 * Configure two server-side env vars (Cloudflare dashboard → Realtime → TURN):
 *   CLOUDFLARE_TURN_KEY_ID     — the TURN key / token id
 *   CLOUDFLARE_TURN_API_TOKEN  — the TURN key's API token (secret)
 *
 * If they're not set, we still return free public STUN so calls work on
 * permissive networks (they just won't have a TURN relay fallback).
 */

const PUBLIC_STUN = {
  urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'],
};

export async function POST(req: Request) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const keyId = process.env.CLOUDFLARE_TURN_KEY_ID;
    const apiToken = process.env.CLOUDFLARE_TURN_API_TOKEN;

    if (!keyId || !apiToken) {
      // No TURN configured yet — STUN-only.
      return NextResponse.json({ iceServers: [PUBLIC_STUN] });
    }

    const res = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl: 86400 }),
      }
    );

    if (!res.ok) {
      console.error('Cloudflare TURN error', res.status, await res.text().catch(() => ''));
      // Degrade gracefully to STUN-only rather than failing the call outright.
      return NextResponse.json({ iceServers: [PUBLIC_STUN] });
    }

    const data = await res.json();
    // Cloudflare returns { iceServers: {...} } (single object) or an array
    // depending on the endpoint; normalize to an array and always include STUN.
    const raw = data.iceServers;
    const iceServers = Array.isArray(raw) ? raw : raw ? [raw] : [];
    if (!iceServers.some((s: { urls?: string | string[] }) => JSON.stringify(s.urls ?? '').includes('stun:'))) {
      iceServers.unshift(PUBLIC_STUN);
    }

    return NextResponse.json({ iceServers });
  } catch (error: any) {
    console.error('TURN route error:', error);
    return NextResponse.json({ iceServers: [PUBLIC_STUN] });
  }
}
