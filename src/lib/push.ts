'use client';

import { browserSupabase } from '@/lib/supabase/client';
import {
  isNativeApp,
  isNativeRegistered,
  registerNativePush,
  unregisterNativePush,
} from '@/lib/native-push';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export function pushSupported(): boolean {
  // Inside the native shell, push is delivered via APNs/FCM instead of the
  // browser PushManager, so report supported there regardless.
  if (isNativeApp()) return true;
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

/** Whether this device currently has an active push subscription. */
export async function isPushSubscribed(): Promise<boolean> {
  if (isNativeApp()) return isNativeRegistered();
  if (!pushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    const sub = await reg?.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

/**
 * Registers the service worker, requests notification permission if needed,
 * subscribes to Web Push, and stores the subscription for this user so the
 * server can send to it later (even when the tab is closed).
 */
export async function subscribeToPush(userId: string): Promise<void> {
  if (isNativeApp()) return registerNativePush(userId);
  if (!pushSupported()) throw new Error('Push notifications are not supported in this browser.');

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) throw new Error('Push is not configured (missing VAPID public key).');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted.');

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    });
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('Invalid push subscription.');
  }

  const supabase = browserSupabase();
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
    { onConflict: 'endpoint' }
  );
  if (error) throw error;
}

export async function unsubscribeFromPush(): Promise<void> {
  if (isNativeApp()) return unregisterNativePush();
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration('/sw.js');
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  const supabase = browserSupabase();
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
}
