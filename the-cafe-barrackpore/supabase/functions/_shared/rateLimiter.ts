// ==============================================================================
// Supabase Edge Functions: Rate Limiter per IP and per Phone
// Enforces rate limiting strictly via Upstash Redis REST API or PostgreSQL rate_limits table.
// ==============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

const DEFAULT_CONFIGS: Record<string, RateLimitConfig> = {
  order: { maxRequests: 5, windowSeconds: 60 },
  reservation: { maxRequests: 5, windowSeconds: 60 },
  login: { maxRequests: 5, windowSeconds: 300 },
};

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
      // Fall through to Postgres rate_limits table on network failure
    }
  }

  // 2. PostgreSQL rate_limits table (persistent across all Edge Function instances)
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  if (supabaseUrl && serviceRoleKey) {
    try {
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      const { data: existing, error: selectErr } = await supabase
        .from('rate_limits')
        .select('count, reset_at')
        .eq('key', key)
        .maybeSingle();

      if (!selectErr && existing) {
        const resetTime = new Date(existing.reset_at).getTime();
        if (now < resetTime) {
          const currentCount = Number(existing.count) || 1;
          const resetSeconds = Math.max(1, Math.ceil((resetTime - now) / 1000));
          if (currentCount >= config.maxRequests) {
            return {
              allowed: false,
              remaining: 0,
              resetSeconds,
            };
          }

          // Increment count
          await supabase
            .from('rate_limits')
            .update({
              count: currentCount + 1,
              updated_at: new Date(now).toISOString(),
            })
            .eq('key', key);

          return {
            allowed: true,
            remaining: Math.max(0, config.maxRequests - (currentCount + 1)),
            resetSeconds,
          };
        }
      }

      // Reset window or new entry
      const resetAt = new Date(now + windowMs).toISOString();
      await supabase
        .from('rate_limits')
        .upsert({
          key,
          count: 1,
          reset_at: resetAt,
          updated_at: new Date(now).toISOString(),
        });

      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetSeconds: config.windowSeconds,
      };
    } catch {
      // Return safe allow if DB lookup encounters network error
      return {
        allowed: true,
        remaining: 1,
        resetSeconds: config.windowSeconds,
      };
    }
  }

  // Safe fallback if neither Upstash nor Supabase DB configured (e.g. testing)
  return {
    allowed: true,
    remaining: config.maxRequests,
    resetSeconds: config.windowSeconds,
  };
}
