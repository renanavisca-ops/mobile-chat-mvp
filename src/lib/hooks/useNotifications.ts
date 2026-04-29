'use client';

import { useEffect, useState } from 'react';

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (!('Notification' in window)) return;
    setPermission(Notification.permission);
  }, []);

  const requestPermission = async () => {
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
  };

  const notify = (title: string, options?: NotificationOptions) => {
    if (!('Notification' in window) || permission !== 'granted') return;
    
    try {
      new Notification(title, {
        icon: '/icon-192x192.png', // Assuming a standard PWA icon exists
        badge: '/icon-192x192.png',
        ...options
      });
    } catch (e) {
      console.error('Error showing notification', e);
    }
  };

  return { permission, requestPermission, notify };
}
