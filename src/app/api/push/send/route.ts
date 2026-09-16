import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendToTokens } from '@/lib/fcm';

/**
 * Called by a Postgres trigger (public.notify_new_message) right after a
 * message is inserted. Auth'd with a shared secret header, not a user token —
 * the DB is the only expected caller. Looks up the message + its other chat
 * members' push subscriptions and sends a Web Push notification to each.
 */
export async function POST(req: Request) {
  try {
    const secret = req.headers.get('X-Push-Secret');
    if (!secret || secret !== process.env.PUSH_TRIGGER_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:support@example.com';
    // Web Push (browsers) and FCM (native apps) are independent; either, both,
    // or neither may be configured. Only skip the channels that aren't set up.
    const webPushEnabled = !!(vapidPublic && vapidPrivate);
    if (webPushEnabled) webpush.setVapidDetails(vapidSubject, vapidPublic!, vapidPrivate!);

    const { message_id } = await req.json();
    if (!message_id) return NextResponse.json({ error: 'message_id is required' }, { status: 400 });

    const { data: message, error: msgErr } = await supabaseAdmin
      .from('messages')
      .select('id, chat_id, sender_id, content, message_type')
      .eq('id', message_id)
      .single();
    if (msgErr || !message) return NextResponse.json({ ok: true, skipped: 'message_not_found' });
    if (message.message_type === 'system') return NextResponse.json({ ok: true, skipped: 'system_message' });

    const [{ data: members }, { data: chat }] = await Promise.all([
      supabaseAdmin.from('chat_members').select('user_id, muted').eq('chat_id', message.chat_id),
      supabaseAdmin.from('chats').select('kind, title, encrypted').eq('id', message.chat_id).single(),
    ]);

    const recipientIds = (members ?? [])
      .filter((m) => !m.muted)
      .map((m) => m.user_id)
      .filter((id) => id !== message.sender_id);
    if (recipientIds.length === 0) return NextResponse.json({ ok: true, skipped: 'no_recipients' });

    const { data: sender } = await supabaseAdmin
      .from('profiles')
      .select('display_name, username')
      .eq('id', message.sender_id ?? '')
      .maybeSingle();
    const senderName = sender?.display_name || sender?.username || 'Someone';

    const [{ data: subs }, { data: deviceTokens }] = await Promise.all([
      supabaseAdmin
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth, user_id')
        .in('user_id', recipientIds),
      supabaseAdmin.from('device_tokens').select('token').in('user_id', recipientIds),
    ]);

    const hasWeb = webPushEnabled && subs && subs.length > 0;
    const hasNative = deviceTokens && deviceTokens.length > 0;
    if (!hasWeb && !hasNative) return NextResponse.json({ ok: true, skipped: 'no_subscriptions' });

    const title = chat?.kind === 'group' ? (chat.title || 'Group chat') : senderName;
    const body = chat?.encrypted
      ? '🔒 New encrypted message'
      : message.content || 'Sent an attachment';
    const url = `/chats/view?c=${message.chat_id}`;

    // --- Web Push (browsers) ---
    let webSent = 0;
    if (hasWeb) {
      const payload = JSON.stringify({ title, body, url });
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
      if (staleIds.length > 0) {
        await supabaseAdmin.from('push_subscriptions').delete().in('id', staleIds);
      }
    }

    // --- FCM (native iOS/Android apps) ---
    let nativeSent = 0;
    if (hasNative) {
      const tokens = deviceTokens!.map((d) => d.token);
      const { staleTokens, sent } = await sendToTokens(tokens, { title, body, url });
      nativeSent = sent;
      if (staleTokens.length > 0) {
        await supabaseAdmin.from('device_tokens').delete().in('token', staleTokens);
      }
    }

    // A push reaching at least one recipient device is our "delivered" signal:
    // the recipient's app is usually backgrounded (just showing the notification)
    // and never runs the client-side delivered-marking, so do it here. Only bump
    // 'sent' -> 'delivered' so we never clobber a 'read' that raced ahead.
    const totalSent = webSent + nativeSent;
    if (totalSent > 0) {
      await supabaseAdmin
        .from('messages')
        .update({ delivery_status: 'delivered' })
        .eq('id', message.id)
        .eq('delivery_status', 'sent');
    }

    return NextResponse.json({ ok: true, sent: webSent + nativeSent, web: webSent, native: nativeSent });
  } catch (error: any) {
    console.error('Error sending push:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
