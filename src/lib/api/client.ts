'use client';

/**
 * Centralized backend base URL for the app's own Next.js API routes
 * (`/api/*`). These routes are server-side and stay hosted on Vercel.
 *
 * - Hosted web build: `NEXT_PUBLIC_API_BASE_URL` is empty, so calls stay
 *   same-origin (relative `/api/...`) exactly as before.
 * - Bundled mobile app: there is no local backend, so the build sets
 *   `NEXT_PUBLIC_API_BASE_URL` to the hosted origin (e.g.
 *   `https://mobile-chat-mvp.vercel.app`) and every call is made absolute.
 *
 * Only the app's own `/api/*` endpoints go through here. Supabase and
 * Cloudflare are already called against their own hosted URLs and are
 * unaffected. No server-only secret is ever read here — only the public base
 * URL — so nothing sensitive is exposed via `NEXT_PUBLIC_*`.
 */

import { Capacitor } from '@capacitor/core';

/** The hosted origin that serves the app's `/api/*` routes. */
const HOSTED_ORIGIN = 'https://mobile-chat-mvp.vercel.app';

function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

const RAW_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || '').trim();
/**
 * Normalized base with any trailing slash removed. On native we ALWAYS use the
 * hosted origin (there is no local backend), regardless of the build env — this
 * makes the bundled app resilient to a missing/mis-typed NEXT_PUBLIC_API_BASE_URL.
 * On the web it stays same-origin (empty) so calls are relative, exactly as before.
 */
export const API_BASE = isNative() ? HOSTED_ORIGIN : RAW_BASE.replace(/\/+$/, '');

/** Resolve an app API path to an absolute (or same-origin) URL. */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path; // already absolute
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

/**
 * Thin `fetch` wrapper that prefixes the configured backend base URL. It
 * returns the raw `Response` so existing call-sites keep their own
 * `.ok` / `.json()` / error handling unchanged — this only centralizes WHERE
 * the request goes, not how each caller parses it.
 */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), init);
}
