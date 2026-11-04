// Durable, cross-instance rate limiting for API routes, backed by the
// `rate_limit_hit` Postgres function (fixed window). Use this in serverless
// routes where an in-memory counter would not persist across invocations.
// Fail-open: a limiter error must never block a legitimate request.

/**
 * Returns true if the request is allowed, false if the limit was exceeded.
 * `admin` is a Supabase service-role client; typed as `any` because the
 * `rate_limit_hit` function isn't in the generated types (same pattern as the
 * project's other `(supabase as any).rpc(...)` calls).
 */
export async function durableRateLimit(
  admin: any,
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const { data, error } = await admin.rpc('rate_limit_hit', {
      p_bucket: bucket,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) return true; // fail open
    return data !== false;
  } catch {
    return true; // fail open
  }
}

/** Best-effort client IP from proxy headers (first X-Forwarded-For hop). */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}
