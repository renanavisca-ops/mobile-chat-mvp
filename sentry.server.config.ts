// Sentry initialisation for the Node.js server runtime (API routes, SSR).
// No-op unless NEXT_PUBLIC_SENTRY_DSN is set. See sentry.client.config.ts for
// the privacy rationale (no PII, no replay).
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENV || process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
});
