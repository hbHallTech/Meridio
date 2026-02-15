/**
 * In-memory rate limiter for serverless environments.
 * For production at scale, consider using Upstash Redis or similar.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}, 60_000); // Every minute

interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check rate limit for a given key (typically IP + route).
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    // New window
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: now + config.windowMs,
    };
  }

  entry.count++;
  store.set(key, entry);

  if (entry.count > config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

// Pre-configured rate limits
export const RATE_LIMITS = {
  signin: { maxRequests: 5, windowMs: 15 * 60 * 1000 }, // 5 per 15 min
  resetPassword: { maxRequests: 3, windowMs: 15 * 60 * 1000 }, // 3 per 15 min
  twoFactorVerify: { maxRequests: 5, windowMs: 15 * 60 * 1000 }, // 5 per 15 min
  twoFactorSend: { maxRequests: 5, windowMs: 15 * 60 * 1000 }, // 5 per 15 min
} as const;

/**
 * Extract IP address from request headers.
 */
export function getRequestIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : "unknown";
}
