/**
 * Client-side Sliding-Window Rate Limiter
 * The Café Barrackpore — Operational Security & Anti-Abuse Protection
 *
 * Protects critical mutation endpoints (Order Creation, Table Reservations)
 * from automated rapid-fire submissions, credential stuffing, and bot spam.
 */

const STORAGE_PREFIX = 'cafe_ratelimit_';
const memoryFallback = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds: number;
}

/**
 * Checks whether an action is currently permitted under rate limiting thresholds.
 * @param action Unique identifier for the action (e.g. 'order', 'reservation')
 * @param maxAttempts Maximum allowed attempts within the sliding window (default: 3)
 * @param windowMs Duration of the sliding window in milliseconds (default: 60,000ms = 1 min)
 */
export function checkRateLimit(
  action: 'order' | 'reservation' | string,
  maxAttempts = 3,
  windowMs = 60000
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - windowMs;
  let timestamps: number[] = [];

  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${action}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        timestamps = parsed.filter((t) => typeof t === 'number' && t > windowStart);
      }
    }
  } catch {
    const mem = memoryFallback.get(action) || [];
    timestamps = mem.filter((t) => t > windowStart);
  }

  if (timestamps.length >= maxAttempts) {
    const oldest = timestamps[0];
    const retryAfterMs = Math.max(0, oldest + windowMs - now);
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  return {
    allowed: true,
    remainingAttempts: maxAttempts - timestamps.length,
    retryAfterSeconds: 0,
  };
}

/**
 * Records an execution attempt in the sliding window.
 */
export function recordRateLimitAttempt(
  action: 'order' | 'reservation' | string,
  windowMs = 60000
): void {
  const now = Date.now();
  const windowStart = now - windowMs;
  let timestamps: number[] = [];

  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${action}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        timestamps = parsed.filter((t) => typeof t === 'number' && t > windowStart);
      }
    }
  } catch {
    timestamps = memoryFallback.get(action)?.filter((t) => t > windowStart) || [];
  }

  timestamps.push(now);

  try {
    localStorage.setItem(`${STORAGE_PREFIX}${action}`, JSON.stringify(timestamps));
  } catch {
    memoryFallback.set(action, timestamps);
  }
}

export interface EnforceRateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds: number;
  error?: string;
}

/**
 * Convenience helper that checks the limit and records an attempt if allowed.
 * Returns EnforceRateLimitResult with allowed status and user-friendly error if exceeded.
 */
export function enforceRateLimit(
  action: 'order' | 'reservation' | string,
  maxAttempts = 5,
  windowMs = 60000
): EnforceRateLimitResult {
  const result = checkRateLimit(action, maxAttempts, windowMs);
  if (!result.allowed) {
    const actionLabel = action === 'order' ? 'order' : 'reservation';
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds: result.retryAfterSeconds,
      error: `Too many ${actionLabel} attempts. Please wait ${result.retryAfterSeconds} second${
        result.retryAfterSeconds === 1 ? '' : 's'
      } before trying again.`,
    };
  }
  recordRateLimitAttempt(action, windowMs);
  return {
    allowed: true,
    remainingAttempts: result.remainingAttempts - 1,
    retryAfterSeconds: 0,
  };
}
