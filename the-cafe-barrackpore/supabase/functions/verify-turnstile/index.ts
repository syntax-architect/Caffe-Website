// ==============================================================================
// Supabase Edge Function: verify-turnstile
// Description:
// 1. Verifies Cloudflare Turnstile CAPTCHA tokens server-side.
// 2. Enforces strict per-IP and per-phone rate limiting (via Upstash or Postgres).
// 3. Stores a single-use verified token in the verified_tokens table (5 min expiry, service role only).
// 4. Returns the single-use verified_token to the client for atomic RPC consumption.
// ==============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { getCorsHeaders, handleCorsPreflight } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rateLimiter.ts';

const CLOUDFLARE_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
// Cloudflare's official dummy test secret key (passes any token)
const CLOUDFLARE_TEST_SECRET_KEY = '1x0000000000000000000000000000000AA';

serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);

  try {
    const clientIp = req.headers.get('cf-connecting-ip') ||
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      '127.0.0.1';

    const body = await req.json().catch(() => ({}));
    const token = (body.token || body.captcha_token || '').trim();
    const phone = (body.phone || body.customer_phone || '').trim();
    const action = (body.action || 'order') as 'order' | 'reservation' | 'login';

    // 1. Rate Limiting per IP (Upstash Redis or PostgreSQL rate_limits table)
    const ipRateLimit = await checkRateLimit(action, clientIp);
    if (!ipRateLimit.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Too many requests from your network. Please wait ${ipRateLimit.resetSeconds} seconds before trying again.`,
          code: 'RATE_LIMIT_EXCEEDED_IP',
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Rate Limiting per Phone (if phone number provided)
    if (phone) {
      const phoneRateLimit = await checkRateLimit(action, phone, { maxRequests: 4, windowSeconds: 120 });
      if (!phoneRateLimit.allowed) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Too many attempts with this phone number. Please wait ${phoneRateLimit.resetSeconds} seconds.`,
            code: 'RATE_LIMIT_EXCEEDED_PHONE',
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 3. Cloudflare Turnstile Verification
    const secretKey = Deno.env.get('TURNSTILE_SECRET_KEY') || CLOUDFLARE_TEST_SECRET_KEY;
    let isBypass = false;

    // Handle offline/bypass tokens in testing environments
    if (token === 'cf_offline_bypass_token' || token === 'cf_test_pass_token' || token === 'cf_dev_pass_token') {
      const isDev = Deno.env.get('ENVIRONMENT') === 'development' || !Deno.env.get('TURNSTILE_SECRET_KEY');
      if (isDev) {
        isBypass = true;
      }
    }

    if (!isBypass) {
      if (!token) {
        return new Response(
          JSON.stringify({ success: false, error: 'CAPTCHA token is required.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const formData = new URLSearchParams();
      formData.append('secret', secretKey);
      formData.append('response', token);
      formData.append('remoteip', clientIp);

      const cfResponse = await fetch(CLOUDFLARE_SITEVERIFY_URL, {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      const cfResult = await cfResponse.json();

      if (!cfResult.success) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Security verification failed. Please complete the captcha again.',
            details: cfResult['error-codes'] || [],
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 4. Generate and store single-use verified token in verified_tokens (service_role only, 5 min expiry)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    let verifiedToken: string;
    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      verifiedToken = `vt_${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`;
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      const { error: insertErr } = await supabase
        .from('verified_tokens')
        .insert({
          token: verifiedToken,
          action,
          expires_at: expiresAt,
        });

      if (insertErr) {
        return new Response(
          JSON.stringify({ success: false, error: `Failed to issue security token: ${insertErr.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      verifiedToken = `vt_mock_${crypto.randomUUID().replace(/-/g, '')}`;
    }

    return new Response(
      JSON.stringify({
        success: true,
        verified_token: verifiedToken,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Internal server error verifying CAPTCHA.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
