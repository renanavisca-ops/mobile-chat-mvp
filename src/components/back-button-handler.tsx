'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { handleBack } from '@/lib/back';

/**
 * Wires the Android back gesture / button to the overlay stack. Mounted once,
 * app-wide. Adding this listener takes over Capacitor's default back behavior,
 * so we reproduce it: close the top overlay, else go back in history, else send
 * the app to the background (Android's "back at the home screen" behavior).
 * iOS has no hardware back, so this effectively only fires on Android.
 */
export function BackButtonHandler() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let remove: (() => void) | undefined;
    App.addListener('backButton', ({ canGoBack }) => {
      if (handleBack()) return; // an overlay consumed the back
      if (canGoBack) {
        window.history.back();
      } else {
        // At a root screen with nothing to pop — behave like Android home.
        App.minimizeApp().catch(() => App.exitApp().catch(() => {}));
      }
    }).then((h) => {
      remove = () => h.remove();
    });
    return () => remove?.();
  }, []);
  return null;
}
