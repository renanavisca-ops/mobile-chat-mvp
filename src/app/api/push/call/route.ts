import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * Sends a Web Push "incoming call" notification to the callees so their device
 * alerts them even when the browser/tab is closed (calls otherwise rely on
 * Realtime, which needs an open client). Auth'd with the caller's bearer token.
 * Requires the same VAPID env vars as /api/push/send.
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

    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:support@example.com';
    if (!vapidPublic || !vapidPrivate) {
      return NextResponse.json({ ok: true, skipped: 'vapid_not_configured' });
    }
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    const body = await req.json().catch(() => ({}));
    const calleeIds: string[] = Array.isArray(body.calleeIds) ? body.calleeIds.slice(0, 50) : [];
    const callerName = String(body.callerName ?? 'Someone').slice(0, 80);
    const video = !!body.video;
    const chatId = body.chatId ? String(body.chatId) : null;
    if (calleeIds.length === 0) return NextResponse.json({ ok: true, skipped: 'no_callees' });

    const { data: subs } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .in('user_id', calleeIds);
    if (!subs || subs.length === 0) return NextResponse.json({ ok: true, skipped: 'no_subscriptions' });

    const payload = JSON.stringify({
      title: callerName,
      body: video ? '📹 Incoming video call' : '📞 Incoming voice call',
      url: chatId ? `/chats/${chatId}` : '/chats',
    });

    const staleIds: string[] = [];
    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
        } catch (e: any) {
          if (e?.statusCode === 404 || e?.statusCode === 410) staleIds.push(sub.id);
        }
      })
    );
    if (staleIds.length > 0) await supabaseAdmin.from('push_subscriptions').delete().in('id', staleIds);

    return NextResponse.json({ ok: true, sent: subs.length - staleIds.length });
  } catch (error: any) {
    console.error('Error sending call push:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
