// ==============================================================================
// Supabase Edge Functions: Hardened CORS Utility
// Removes all wildcard origins ('*'). Enforces authoritative ALLOWED_ORIGIN secret.
// Returns a 500 configuration error if ALLOWED_ORIGIN and PUBLIC_SITE_URL are both missing.
// ==============================================================================

export function getConfiguredOrigin(): string | null {
  return Deno.env.get('ALLOWED_ORIGIN') || Deno.env.get('PUBLIC_SITE_URL') || null;
}

export function getMissingOriginConfigResponse(): Response {
  return new Response(
    JSON.stringify({ error: 'Server configuration error: ALLOWED_ORIGIN or PUBLIC_SITE_URL environment variable is required.' }),
    { status: 500, headers: { 'Content-Type': 'application/json' } }
  );
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  const configuredOrigin = getConfiguredOrigin();
  if (!configuredOrigin) {
    throw new Error('Server configuration error: ALLOWED_ORIGIN or PUBLIC_SITE_URL environment variable is required.');
  }

  // Check if incoming origin matches configured ALLOWED_ORIGIN or PUBLIC_SITE_URL
  const isAllowed = origin && (
    origin.toLowerCase() === configuredOrigin.toLowerCase() ||
    (Deno.env.get('PUBLIC_SITE_URL') && origin.toLowerCase() === Deno.env.get('PUBLIC_SITE_URL')?.toLowerCase())
  );

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
  const configuredOrigin = getConfiguredOrigin();
  if (!configuredOrigin) {
    return getMissingOriginConfigResponse();
  }
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(req),
    });
  }
  return null;
}
