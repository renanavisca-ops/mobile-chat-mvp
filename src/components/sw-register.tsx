'use client';

import { useEffect } from 'react';

/**
 * Registers the app-shell service worker on startup (for everyone, not just
 * users who enabled push). The SW caches the immutable build assets so the app
 * opens from cache instead of re-downloading its whole bundle on every launch.
 * Registered after load so it never competes with first paint.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);
  return null;
}
