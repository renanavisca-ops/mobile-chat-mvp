import { NextResponse } from 'next/server';
import { reportServerError } from '@/lib/observability';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendCallCancelToTokens } from '@/lib/fcm';

/**
 * Clears the native full-screen incoming-call notification on a set of users'
 * devices when the call was answered, declined or cancelled somewhere else.
 *
 * The web/WebView clients already sync over Supabase Realtime; this exists only
 * for a device whose app is killed/backgrounded (so it only has the native
 * notification, which Realtime can't reach). Sends a DATA-only "call_cancelled"
 * FCM that the native TokyMessagingService turns into notify-cancel.
 *
 * Auth: the caller's bearer token. A user may only cancel for themselves (stop
 * ringing on their own other devices) or for a user they are/ were calling —
 * but since this just dismisses a *ringing* notification for a specific callId
 * and carries no content, we keep it simple and allow any authenticated user to
 * target any user ids; the worst case is a no-op dismissal of a stale ring.
 */
export async function POST(req: Request) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const userIds: string[] = Array.isArray(body.userIds) ? body.userIds.slice(0, 50).map(String) : [];
    const callId = body.callId ? String(body.callId) : '';
    if (!callId || userIds.length === 0) return NextResponse.json({ ok: true, skipped: 'no_targets' });

    const { data: deviceTokens } = await supabaseAdmin
      .from('device_tokens')
      .select('token')
      .in('user_id', userIds);
    if (!deviceTokens || deviceTokens.length === 0) {
      return NextResponse.json({ ok: true, skipped: 'no_devices' });
    }

    const tokens = deviceTokens.map((d) => d.token);
    const { staleTokens, sent } = await sendCallCancelToTokens(tokens, callId);
    if (staleTokens.length > 0) {
      await supabaseAdmin.from('device_tokens').delete().in('token', staleTokens);
    }

    return NextResponse.json({ ok: true, sent });
  } catch (error: any) {
    console.error('Error sending call-cancel push:', error);
    reportServerError(error, { route: 'push/call/cancel' });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
