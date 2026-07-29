'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isNativeApp, initNativeNotifications, clearDeliveredNotifications } from '@/lib/native-push';
import { App } from '@capacitor/app';

/**
 * Bridges service-worker notification clicks to in-app (SPA) navigation.
 *
 * When a notification is clicked and an app tab is already open, the service
 * worker focuses that tab and posts a `notification-click` message instead of
 * doing a full navigation (a reload would tear down an in-progress call). Here
 * we route to the target with the Next router — but never for calls, whose
 * ringing overlay is already on screen and must not be navigated away from.
 */
export function NotificationRouter() {
  const router = useRouter();

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== 'notification-click') return;
      if (data.kind === 'call') return; // stay on the ringing overlay
      if (typeof data.url === 'string' && data.url) router.push(data.url);
    };

    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [router]);

  // Native (Capacitor) push: attach the FCM notification-tap handler on every
  // launch so tapping a notification opens the specific chat it's about,
  // instead of just resuming whatever chat was last open.
  useEffect(() => {
    if (!isNativeApp()) return;
    void initNativeNotifications((url) => router.push(url));
  }, [router]);

  // Once the user is in the app, the per-message notifications are effectively
  // "seen" — clear the system tray on launch and on every foreground so they
  // don't have to dismiss each one by hand.
  useEffect(() => {
    if (!isNativeApp()) return;
    void clearDeliveredNotifications();
    let remove: (() => void) | undefined;
    void App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void clearDeliveredNotifications();
    }).then((handle) => {
      remove = () => void handle.remove();
    });
    return () => {
      if (remove) remove();
    };
  }, []);

  return null;
}
