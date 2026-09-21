'use client';

// Native push for the Capacitor iOS/Android shells. On the web this file is a
// no-op; inside the native app it registers with FCM via
// @capacitor-firebase/messaging (which yields an FCM token on BOTH iOS and
// Android, so the server has a single delivery path) and stores the token in
// device_tokens. The web-push path (src/lib/push.ts) is unchanged and delegates
// here when running natively.
import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
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
let tapHandlerReady = false;
let navigateFn: ((url: string) => void) | null = null;

async function storeToken(userId: string, token: string): Promise<void> {
  lastToken = token;
  const supabase = browserSupabase();
  const { error } = await supabase
    .from('device_tokens')
    .upsert({ user_id: userId, token, platform: platform() }, { onConflict: 'token' });
  if (error) throw error;
}

// Register the token-refresh handler once (FCM can rotate the token). The
// notification-TAP handler is registered separately in initNativeNotifications
// so it's attached on every app launch, not only when the user enables push.
async function setupListeners(): Promise<void> {
  if (listenersReady) return;
  listenersReady = true;
  await FirebaseMessaging.addListener('tokenReceived', async (event) => {
    if (currentUserId && event?.token) {
      try {
        await storeToken(currentUserId, event.token);
      } catch {
        // best effort — a failed refresh isn't fatal
      }
    }
  });
}

/**
 * Attach the notification-tap handler so tapping a push opens the RIGHT chat
 * (the target path travels in data.url). This must run on every native app
 * launch — not just when enabling notifications — otherwise a tap has no
 * handler and the app merely resumes whatever chat was last open. Idempotent.
 * `navigate` is refreshed on each call so it always uses the live SPA router.
 */
export async function initNativeNotifications(navigate: (url: string) => void): Promise<void> {
  if (!isNativeApp()) return;
  navigateFn = navigate;
  if (tapHandlerReady) return;
  tapHandlerReady = true;
  try {
    await FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
      const data = event?.notification?.data as Record<string, unknown> | undefined;
      const url = data?.url;
      if (typeof url === 'string' && url) {
        if (navigateFn) navigateFn(url);
        else window.location.href = url;
      }
    });
  } catch {
    // If the listener can't attach, leave tapHandlerReady set so we don't spin;
    // the next launch retries from a fresh module state.
  }
}

/**
 * Clear every push notification this app has posted to the system tray. Called
 * when the app becomes active so that opening the app on one device dismisses
 * the pile of per-message notifications the user has effectively "seen" — they
 * don't have to swipe each one away by hand. Best-effort and a no-op on web.
 */
export async function clearDeliveredNotifications(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    if (typeof FirebaseMessaging?.removeAllDeliveredNotifications === 'function') {
      await FirebaseMessaging.removeAllDeliveredNotifications();
    }
  } catch {
    // best effort — never let tray cleanup throw into app startup/resume
  }
}

/** True once the OS notification permission is granted for this device. */
export async function isNativeRegistered(): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    const perm = await FirebaseMessaging.checkPermissions();
    return perm.receive === 'granted';
  } catch {
    return false;
  }
}

// Any plugin call can hang forever if the native side stalls; race each with a
// timeout that names the step, so a stuck registration surfaces WHERE it stuck.
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timed out at: ${label}`)), ms)),
  ]);
}

// A short chime for a push that arrives while the app is in the FOREGROUND.
// Android/iOS don't display an FCM notification message while the app is open —
// the plugin hands it to JS instead — so without this the app is silent while
// you're using it. Best-effort (a suspended AudioContext or no Web Audio just
// no-ops).
function playChime(): void {
  try {
    const Ctx = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t = ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.start(t);
    osc.stop(t + 0.32);
    osc.onended = () => { try { void ctx.close(); } catch { /* ignore */ } };
  } catch {
    /* ignore */
  }
}

let foregroundReady = false;

/**
 * Handle pushes that arrive while the app is in the foreground: play a chime and
 * raise a `toky:push` window event so an in-app banner can show (see
 * PushBanner). The OS won't display a foreground FCM message on its own, so this
 * is what makes messages audible/visible while you're using the app. Idempotent;
 * no-op on web.
 */
export async function initForegroundPush(): Promise<void> {
  if (!isNativeApp() || foregroundReady) return;
  foregroundReady = true;
  try {
    await FirebaseMessaging.addListener('notificationReceived', (event: unknown) => {
      const n = (event as { notification?: Record<string, unknown> })?.notification
        ?? (event as Record<string, unknown>);
      const title = (n?.title as string) || 'Toky Chat';
      const body = (n?.body as string) || '';
      const data = (n?.data as Record<string, unknown>) || {};
      const url = typeof data.url === 'string' ? (data.url as string) : undefined;
      // Skip if you're already looking at that chat.
      try {
        if (url && typeof window !== 'undefined' && window.location.href.includes(url)) return;
      } catch { /* ignore */ }
      playChime();
      try {
        window.dispatchEvent(new CustomEvent('toky:push', { detail: { title, body, url } }));
      } catch { /* ignore */ }
    });
  } catch {
    foregroundReady = false;
  }
}

/** Request permission, get the FCM token, and persist it for this user. */
export async function registerNativePush(userId: string): Promise<void> {
  // Overall guard: even if the plugin load or an unwrapped call stalls, this
  // ALWAYS settles so the toggle can't spin "registering…" forever.
  await withTimeout(doRegisterNativePush(userId), 30000, 'enabling notifications');
}

async function doRegisterNativePush(userId: string): Promise<void> {
  currentUserId = userId;

  if (!FirebaseMessaging || typeof FirebaseMessaging.checkPermissions !== 'function') {
    throw new Error('Notifications are unavailable on this device.');
  }

  let perm = await withTimeout(FirebaseMessaging.checkPermissions(), 8000, 'checking notification permission');
  if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
    perm = await withTimeout(FirebaseMessaging.requestPermissions(), 60000, 'waiting for the permission prompt');
  }
  if (perm.receive !== 'granted') {
    throw new Error('Notification permission was not granted.');
  }

  await withTimeout(setupListeners(), 8000, 'addListeners');

  const result = await withTimeout(
    FirebaseMessaging.getToken(),
    15000,
    'getting the notification token'
  );

  const token = result?.token;
  if (!token) throw new Error('No FCM token was returned.');
  await withTimeout(storeToken(userId, token), 8000, 'saving token to database');
}

/** Stop delivery to this device by deleting its token (server + FCM). */
export async function unregisterNativePush(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await FirebaseMessaging.deleteToken();
    await FirebaseMessaging.removeAllListeners();
  } catch {
    // best effort
  }
  listenersReady = false;
  // removeAllListeners() above also dropped the tap handler; allow it to be
  // re-attached (next app launch, via initNativeNotifications).
  tapHandlerReady = false;
  if (lastToken) {
    const supabase = browserSupabase();
    await supabase.from('device_tokens').delete().eq('token', lastToken);
    lastToken = null;
  }
  currentUserId = null;
}
