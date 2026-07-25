/**
 * Lightweight in-memory rate limiter (fixed window per key).
 *
 * Used to throttle expensive endpoints — notably the AI proxy — so a single
 * client can't run up Anthropic API cost or abuse the service. Keyed by user id
 * (or IP), it counts requests inside a rolling window and reports when the
 * caller has exceeded the limit.
 *
 * Scope note: state lives in the process, so on serverless each warm instance
 * keeps its own counters. That still stops the common case — one client
 * hammering the endpoint in a burst — with zero dependencies or setup. For a
 * hard global cap across instances, back this with Redis/Upstash or a Postgres
 * counter later; the call sites don't need to change.
 */

export type RateLimitResult = {
  /** true if this request is within the limit. */
  ok: boolean;
  /** Max requests allowed per window. */
  limit: number;
  /** Requests remaining in the current window (0 when blocked). */
  remaining: number;
  /** Epoch ms when the current window resets. */
  resetAt: number;
  /** Seconds until the window resets (0 when allowed). */
  retryAfter: number;
};

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Occasionally drop expired buckets so the map can't grow without bound. */
function maybeSweep(now: number) {
  if (Math.random() > 0.01) return; // ~1% of calls
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Record a request against `key` and report whether it's allowed.
 *
 * @param key      Stable identifier to bucket by (e.g. `ai:${userId}`).
 * @param limit    Max requests per window (default 30).
 * @param windowMs Window length in ms (default 60s).
 */
export function rateLimit(key: string, limit = 30, windowMs = 60_000): RateLimitResult {
  const now = Date.now();
  maybeSweep(now);

  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;

  const ok = bucket.count <= limit;
  const remaining = Math.max(0, limit - bucket.count);
  const retryAfter = ok ? 0 : Math.ceil((bucket.resetAt - now) / 1000);

  return { ok, limit, remaining, resetAt: bucket.resetAt, retryAfter };
}

/** Standard rate-limit headers for a response. */
export function rateLimitHeaders(r: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(r.limit),
    'X-RateLimit-Remaining': String(r.remaining),
    'X-RateLimit-Reset': String(Math.ceil(r.resetAt / 1000)),
  };
  if (!r.ok) headers['Retry-After'] = String(r.retryAfter);
  return headers;
}
