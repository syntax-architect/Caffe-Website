// ==============================================================================
// Supabase Edge Functions: Hardened CORS Utility
// Removes all wildcard origins ('*'). Enforces authoritative ALLOWED_ORIGIN secret.
// ==============================================================================

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  const configuredOrigin = Deno.env.get('ALLOWED_ORIGIN') || Deno.env.get('PUBLIC_SITE_URL') || '';

  // Check if incoming origin matches configured ALLOWED_ORIGIN or PUBLIC_SITE_URL
  const isAllowed = origin && configuredOrigin && (
    origin.toLowerCase() === configuredOrigin.toLowerCase() ||
    (Deno.env.get('PUBLIC_SITE_URL') && origin.toLowerCase() === Deno.env.get('PUBLIC_SITE_URL')?.toLowerCase())
  );

  const allowedOriginHeader = isAllowed ? origin : (configuredOrigin || '');

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
