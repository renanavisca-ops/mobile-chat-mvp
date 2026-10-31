// Server-side error reporting for API route handlers. Forwards exceptions to
// Sentry (already configured app-wide) so failures in serverless functions are
// visible instead of lost in logs. When no Sentry DSN is configured this is a
// safe no-op. Never pass request bodies or message content here — only the
// error and a small, non-sensitive context (e.g. the route name).
import * as Sentry from '@sentry/nextjs';

export function reportServerError(error: unknown, context?: Record<string, string>): void {
  try {
    Sentry.captureException(error, context ? { tags: context } : undefined);
  } catch {
    // Telemetry must never break the request handler.
  }
}
