// Next.js instrumentation hook. Loads the correct Sentry server config for the
// active runtime and forwards nested React Server Component errors to Sentry.
// Enabled via `experimental.instrumentationHook` in next.config.mjs.
import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
