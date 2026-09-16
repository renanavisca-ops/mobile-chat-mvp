import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * CORS for the app's own `/api/*` routes.
 *
 * The bundled mobile app runs at the local origin `https://localhost`, so its
 * calls to the hosted API routes are cross-origin. Those routes authenticate
 * with a Supabase Bearer token in the `Authorization` header (no cookies), so a
 * wildcard origin is safe and no credentials are needed. Without these headers
 * the browser/WebView blocks the response and the call fails with
 * "Failed to fetch". On the hosted web build the app is same-origin, so this is
 * a harmless no-op there.
 *
 * NOTE: this file is stashed out during the static mobile export
 * (scripts/build-mobile.mjs), because `output: 'export'` doesn't support
 * middleware — it only ever runs on the hosted (Vercel) build.
 */
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, apikey, x-client-info',
  'Access-Control-Max-Age': '86400',
};

export function middleware(req: NextRequest) {
  // Preflight — answer directly with the CORS headers.
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }
  const res = NextResponse.next();
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  return res;
}

export const config = {
  matcher: '/api/:path*',
};
