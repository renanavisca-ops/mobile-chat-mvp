// Sentry initialisation for the browser / Capacitor WebView bundle.
//
// This is the crash reporter for the app users actually touch: the Next.js UI
// runs inside the native WebView, so client-side errors here cover the mobile
// apps too. It is a no-op unless NEXT_PUBLIC_SENTRY_DSN is set, so local dev and
// unconfigured builds send nothing.
//
// Privacy note: Toky is a private-messaging app, so we deliberately do NOT enable
// Session Replay (it would capture message contents) and do not send default PII.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENV || process.env.NODE_ENV,
  // Sample a slice of transactions for performance; errors are always sent.
  tracesSampleRate: 0.1,
  // No Session Replay — it would record chat content. Intentionally off.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  // Do not attach IP / cookies / user identifiers automatically.
  sendDefaultPii: false,
});
