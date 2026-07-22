'use client';

// Native push for the Capacitor iOS/Android shells. On the web this file is a
// no-op; inside the native app it registers with FCM via
// @capacitor-firebase/messaging (which yields an FCM token on BOTH iOS and
// Android, so the server has a single delivery path) and stores the token in
// device_tokens. The web-push path (src/lib/push.ts) is unchanged and delegates
// here when running natively.
import { Capacitor } from '@capacitor/core';
import { browserSupabase } from '@/lib/supabase/client';

export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** 'ios' | 'android' | 'web' — for diagnosing whether the native bridge is active. */
export function nativePlatform(): string {
  try {
    return Capacitor.getPlatform();
  } catch {
    return 'web';
  }
}

function platform(): 'ios' | 'android' {
  return Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
}

let currentUserId: string | null = null;
let lastToken: string | null = null;
let listenersReady = false;

async function messaging() {
  const mod = await import('@capacitor-firebase/messaging');
  return mod.FirebaseMessaging;
}

async function storeToken(userId: string, token: string): Promise<void> {
  lastToken = token;
  const supabase = browserSupabase();
  const { error } = await supabase
    .from('device_tokens')
    .upsert({ user_id: userId, token, platform: platform() }, { onConflict: 'token' });
  if (error) throw error;
}

// Register handlers once: FCM can rotate the token, and a notification tap
// carries the target path in data.url — navigate the WebView there (it's
// already on the app origin).
async function setupListeners(): Promise<void> {
  if (listenersReady) return;
  listenersReady = true;
  const FirebaseMessaging = await messaging();
  await FirebaseMessaging.addListener('tokenReceived', async (event) => {
    if (currentUserId && event?.token) {
      try {
        await storeToken(currentUserId, event.token);
      } catch {
        // best effort — a failed refresh isn't fatal
      }
    }
  });
  await FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
    const data = event?.notification?.data as Record<string, unknown> | undefined;
    const url = data?.url;
    if (typeof url === 'string' && url) window.location.href = url;
  });
}

/** True once the OS notification permission is granted for this device. */
export async function isNativeRegistered(): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    const FirebaseMessaging = await messaging();
    const perm = await FirebaseMessaging.checkPermissions();
    return perm.receive === 'granted';
  } catch {
    return false;
  }
}

/** Request permission, get the FCM token, and persist it for this user. */
export async function registerNativePush(userId: string): Promise<void> {
  currentUserId = userId;
  const FirebaseMessaging = await messaging();

  let perm = await FirebaseMessaging.checkPermissions();
  if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
    perm = await FirebaseMessaging.requestPermissions();
  }
  if (perm.receive !== 'granted') {
    throw new Error('Notification permission was not granted.');
  }

  await setupListeners();

  // getToken() can hang forever if Firebase isn't configured on the device
  // (missing/mismatched google-services.json). Time it out so the failure is
  // visible instead of the toggle silently doing nothing.
  const result = (await Promise.race([
    FirebaseMessaging.getToken(),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error('Timed out getting FCM token — Firebase not configured on the device. Check google-services.json (package app.toky.chat) and rebuild.')),
        15000
      )
    ),
  ])) as { token?: string };

  const token = result?.token;
  if (!token) throw new Error('No FCM token was returned.');
  await storeToken(userId, token);
}

/** Stop delivery to this device by deleting its token (server + FCM). */
export async function unregisterNativePush(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const FirebaseMessaging = await messaging();
    await FirebaseMessaging.deleteToken();
    await FirebaseMessaging.removeAllListeners();
  } catch {
    // best effort
  }
  listenersReady = false;
  if (lastToken) {
    const supabase = browserSupabase();
    await supabase.from('device_tokens').delete().eq('token', lastToken);
    lastToken = null;
  }
  currentUserId = null;
}
