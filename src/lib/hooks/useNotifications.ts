'use client';

import { useCallback, useEffect, useState } from 'react';

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (!('Notification' in window)) return;
    setPermission(Notification.permission);
  }, []);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;

    try {
      const p = await Notification.requestPermission();
      setPermission(p);
      return p === 'granted';
    } catch (e) {
      console.error('Error requesting notification permission', e);
      return false;
    }
  }, []);

  // IMPORTANT: keep `notify` referentially stable. It is used as a dependency
  // of the realtime effect in useChatRealtime; a fresh function on every render
  // makes that effect tear down and re-subscribe the realtime channel on every
  // render — an endless re-subscribe loop that floods `getUser`, churns the
  // channel (so messages never actually deliver) and starves other queries.
  const notify = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (!('Notification' in window) || permission !== 'granted') return;

      try {
        new Notification(title, {
          icon: '/icon-192x192.png', // Assuming a standard PWA icon exists
          badge: '/icon-192x192.png',
          ...options,
        });
      } catch (e) {
        console.error('Error showing notification', e);
      }
    },
    [permission]
  );

  return { permission, requestPermission, notify };
}
