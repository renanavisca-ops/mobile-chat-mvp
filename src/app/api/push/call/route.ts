import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendToTokens } from '@/lib/fcm';

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
    const webPushEnabled = !!(vapidPublic && vapidPrivate);
    if (webPushEnabled) webpush.setVapidDetails(vapidSubject, vapidPublic!, vapidPrivate!);

    const body = await req.json().catch(() => ({}));
    let calleeIds: string[] = Array.isArray(body.calleeIds) ? body.calleeIds.slice(0, 50) : [];
    const callerName = String(body.callerName ?? 'Someone').slice(0, 80);
    const video = !!body.video;
    const chatId = body.chatId ? String(body.chatId) : null;
    if (calleeIds.length === 0) return NextResponse.json({ ok: true, skipped: 'no_callees' });

    // Never notify a callee who has blocked the caller (or whom the caller
    // blocked). Messages are already blocked by RLS; calls are enforced here.
    const { data: blocks } = await supabaseAdmin
      .from('blocks')
      .select('blocker_id, blocked_id')
      .or(
        `and(blocker_id.eq.${user.id},blocked_id.in.(${calleeIds.join(',')})),` +
          `and(blocked_id.eq.${user.id},blocker_id.in.(${calleeIds.join(',')}))`
      );
    if (blocks && blocks.length > 0) {
      const blocked = new Set<string>();
      for (const b of blocks) blocked.add(b.blocker_id === user.id ? b.blocked_id : b.blocker_id);
      calleeIds = calleeIds.filter((id) => !blocked.has(id));
    }
    if (calleeIds.length === 0) return NextResponse.json({ ok: true, skipped: 'all_blocked' });

    const [{ data: subs }, { data: deviceTokens }] = await Promise.all([
      supabaseAdmin
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth')
        .in('user_id', calleeIds),
      supabaseAdmin.from('device_tokens').select('token').in('user_id', calleeIds),
    ]);

    const hasWeb = webPushEnabled && subs && subs.length > 0;
    const hasNative = deviceTokens && deviceTokens.length > 0;
    if (!hasWeb && !hasNative) return NextResponse.json({ ok: true, skipped: 'no_subscriptions' });

    const title = callerName;
    const text = video ? '📹 Incoming video call' : '📞 Incoming voice call';
    const url = chatId ? `/chats/${chatId}` : '/chats';

    let webSent = 0;
    if (hasWeb) {
      // type:'call' tells the service worker to focus (not reload) an open tab,
      // so clicking the notification never tears down the ringing call UI.
      const payload = JSON.stringify({ title, body: text, url, type: 'call' });
      const staleIds: string[] = [];
      await Promise.all(
        subs!.map(async (sub) => {
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
      webSent = subs!.length - staleIds.length;
      if (staleIds.length > 0) await supabaseAdmin.from('push_subscriptions').delete().in('id', staleIds);
    }

    let nativeSent = 0;
    if (hasNative) {
      const tokens = deviceTokens!.map((d) => d.token);
      const { staleTokens, sent } = await sendToTokens(tokens, { title, body: text, url });
      nativeSent = sent;
      if (staleTokens.length > 0) {
        await supabaseAdmin.from('device_tokens').delete().in('token', staleTokens);
      }
    }

    return NextResponse.json({ ok: true, sent: webSent + nativeSent, web: webSent, native: nativeSent });
  } catch (error: any) {
    console.error('Error sending call push:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
