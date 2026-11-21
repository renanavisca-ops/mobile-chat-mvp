import { NextResponse } from 'next/server';
import { reportServerError } from '@/lib/observability';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendCallCancelToTokens } from '@/lib/fcm';
import { realtimeBroadcast } from '@/lib/realtime-broadcast';

/**
 * Declines a RINGING call from a device whose app is killed (the native
 * "Rechazar" notification action). There is no web session to send the usual
 * realtime 'declined' to the caller, so the native side calls this instead.
 *
 * Auth: the device's FCM registration token. The server already trusts that
 * token (it's how it delivers push), and here it must map to the call's callee
 * (`peer_id`), so only the real recipient's device can decline. On success it:
 *   - tells the caller (realtime 'declined' on call-user:<caller>) so their ring
 *     stops and the call shows as rejected, exactly like an in-app decline;
 *   - tells the callee's own other live sessions to stop ringing ('handled');
 *   - clears the native call notification on the callee's other devices.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const callId = body.callId ? String(body.callId) : '';
    const deviceToken = body.deviceToken ? String(body.deviceToken) : '';
    if (!callId || !deviceToken) {
      return NextResponse.json({ error: 'Bad Request' }, { status: 400 });
    }

    // Identify the declining user from their device token.
    const { data: tokRow } = await supabaseAdmin
      .from('device_tokens')
      .select('user_id')
      .eq('token', deviceToken)
      .maybeSingle();
    const calleeId = (tokRow as any)?.user_id as string | undefined;
    if (!calleeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Load the call and verify this user is its callee (not the caller).
    const { data: call } = await supabaseAdmin
      .from('calls')
      .select('id, caller_id, peer_id, answered, ended_at')
      .eq('id', callId)
      .maybeSingle();
    if (!call) return NextResponse.json({ ok: true, skipped: 'no_call' });
    const callerId = (call as any).caller_id as string | null;
    const peerId = (call as any).peer_id as string | null;
    if (!callerId || callerId === calleeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    // For a 1:1 call, the decliner must be the named callee.
    if (peerId && peerId !== calleeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    // Already answered/ended elsewhere — nothing to decline, just ack.
    if ((call as any).answered || (call as any).ended_at) {
      return NextResponse.json({ ok: true, skipped: 'already_resolved' });
    }

    // Notify the caller (ring stops, shows rejected) and our own live sessions.
    await realtimeBroadcast([
      { topic: `call-user:${callerId}`, event: 'declined', payload: { callId, from: calleeId } },
      { topic: `call-user:${calleeId}`, event: 'handled', payload: { callId } },
    ]);

    // Clear the native notification on the callee's other devices.
    const { data: tokens } = await supabaseAdmin
      .from('device_tokens')
      .select('token')
      .eq('user_id', calleeId);
    const others = (tokens ?? []).map((t) => t.token).filter((t) => t !== deviceToken);
    if (others.length > 0) {
      const { staleTokens } = await sendCallCancelToTokens(others, callId);
      if (staleTokens.length > 0) {
        await supabaseAdmin.from('device_tokens').delete().in('token', staleTokens);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Error declining call:', error);
    reportServerError(error, { route: 'push/call/decline' });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
