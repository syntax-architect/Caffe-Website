// ==============================================================================
// Supabase Edge Functions: Hardened CORS Utility
// Removes all wildcard origins ('*'). Enforces authoritative production origin.
// ==============================================================================

const PRODUCTION_DOMAIN = 'https://thecafebarrackpore.com';

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  const configuredOrigin = Deno.env.get('ALLOWED_ORIGIN') || Deno.env.get('SITE_URL') || PRODUCTION_DOMAIN;

  // Allowed origin list: Production domain, configured origin override, plus localhost strictly in development
  const isDev = Deno.env.get('ENVIRONMENT') === 'development' || Deno.env.get('DENO_ENV') === 'development';
  const allowedOrigins = [configuredOrigin, PRODUCTION_DOMAIN];

  if (isDev) {
    allowedOrigins.push('http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000');
  }

  const isAllowed = origin && allowedOrigins.some((allowed) => allowed.toLowerCase() === origin.toLowerCase());
  const allowedOriginHeader = isAllowed ? origin : configuredOrigin;

  return {
    'Access-Control-Allow-Origin': allowedOriginHeader,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-forwarded-for',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

export function handleCorsPreflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(req),
    });
  }
  return null;
}
