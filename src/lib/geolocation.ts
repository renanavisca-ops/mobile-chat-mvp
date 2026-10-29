'use client';

import { Capacitor } from '@capacitor/core';

/**
 * Get the device's current location. On native it uses @capacitor/geolocation
 * (prompts for permission); on the web it uses the browser Geolocation API.
 * Rejects if permission is denied or location is unavailable.
 */
export async function getCurrentLocation(): Promise<{ lat: number; lng: number }> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      try { await Geolocation.requestPermissions(); } catch { /* getCurrentPosition will fail if denied */ }
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch {
      /* plugin missing (older build) or denied — fall through to the web API */
    }
  }
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation unavailable'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  });
}

/** Google Maps link for a coordinate (opens the Maps app / site). */
export function mapsUrlFor(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
