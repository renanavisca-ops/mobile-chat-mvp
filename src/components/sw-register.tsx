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

    // When a NEW service worker activates and takes control (e.g. after a deploy
    // that bumped the shell-cache version), reload once so the page swaps to the
    // fresh HTML/chunks instead of running whatever bundle first painted. Only
    // reload if a controller already existed when this page loaded — otherwise
    // the first controllerchange is just the initial install claiming the page,
    // which must NOT trigger a reload. The flag makes it reload at most once.
    const hadController = !!navigator.serviceWorker.controller;
    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      if (hadController) window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);
  return null;
}
