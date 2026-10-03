// ==============================================================================
// Supabase Edge Functions: Rate Limiter per IP and per Phone
// Supports Upstash Redis REST API with robust in-memory sliding window fallback.
// ==============================================================================

interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

const DEFAULT_CONFIGS: Record<string, RateLimitConfig> = {
  order: { maxRequests: 5, windowSeconds: 60 },
  reservation: { maxRequests: 5, windowSeconds: 60 },
  login: { maxRequests: 5, windowSeconds: 300 },
};

// In-memory sliding window store
const memoryStore = new Map<string, number[]>();

export async function checkRateLimit(
  action: 'order' | 'reservation' | 'login',
  identifier: string,
  customConfig?: Partial<RateLimitConfig>
): Promise<{ allowed: boolean; remaining: number; resetSeconds: number }> {
  const config: RateLimitConfig = {
    ...DEFAULT_CONFIGS[action],
    ...customConfig,
  };

  const key = `rate_${action}_${identifier.replace(/[^a-zA-Z0-9_\-]/g, '_')}`;
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;

  // 1. Try Upstash Redis if configured
  const upstashUrl = Deno.env.get('UPSTASH_REDIS_REST_URL');
  const upstashToken = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');

  if (upstashUrl && upstashToken) {
    try {
      // Use INCR and EXPIRE pipeline in Upstash
      const res = await fetch(`${upstashUrl}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${upstashToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['INCR', key],
          ['EXPIRE', key, config.windowSeconds],
        ]),
      });

      if (res.ok) {
        const results = await res.json();
        const currentCount = Number(results[0]?.result) || 1;
        const allowed = currentCount <= config.maxRequests;
        return {
          allowed,
          remaining: Math.max(0, config.maxRequests - currentCount),
          resetSeconds: config.windowSeconds,
        };
      }
    } catch {
      // Fallback to in-memory store on Upstash network failure
    }
  }

  // 2. In-memory sliding window fallback
  const windowStart = now - windowMs;
  let timestamps = memoryStore.get(key) || [];
  timestamps = timestamps.filter((t) => t > windowStart);

  if (timestamps.length >= config.maxRequests) {
    const oldestTimestamp = timestamps[0];
    const resetSeconds = Math.ceil((oldestTimestamp + windowMs - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetSeconds: Math.max(1, resetSeconds),
    };
  }

  timestamps.push(now);
  memoryStore.set(key, timestamps);

  return {
    allowed: true,
    remaining: config.maxRequests - timestamps.length,
    resetSeconds: config.windowSeconds,
  };
}
