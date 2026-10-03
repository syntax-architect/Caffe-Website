// ==============================================================================
// Supabase Edge Function: create-stripe-checkout
// Description: Secure server-side Stripe Checkout session creation.
// Requires order_ref + payment_token and verifies SHA-256 hash against orders.payment_token_hash.
// Eliminates hardcoded fallbacks ('USD', 'The Café Barrackpore', 'http://localhost:5173').
// Reads currency and business name from restaurant_settings.
// ==============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import Stripe from 'https://esm.sh/stripe@14.25.0?target=deno';

async function computeSha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

serve(async (req: Request) => {
  const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') || Deno.env.get('PUBLIC_SITE_URL') || '';
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const publicSiteUrl = Deno.env.get('PUBLIC_SITE_URL');
    if (!publicSiteUrl) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error: PUBLIC_SITE_URL environment variable is required.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const orderRef = (body.order_ref || body.orderRef || '').trim();
    const paymentToken = (body.payment_token || body.paymentToken || '').trim();

    if (!orderRef || !paymentToken) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: order_ref and payment_token are required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY is required.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Read order and authoritative amount from database
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, order_ref, total, payment_amount, currency, payment_status, customer_name, customer_phone, payment_token_hash')
      .eq('order_ref', orderRef)
      .maybeSingle();

    if (orderErr || !order) {
      return new Response(
        JSON.stringify({ error: `Order not found for reference: ${orderRef}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify payment token hash
    const expectedHash = await computeSha256(paymentToken);
    if (!order.payment_token_hash || !timingSafeEqual(order.payment_token_hash, expectedHash)) {
      return new Response(
        JSON.stringify({ error: 'Invalid payment token for this order.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (order.payment_status === 'paid') {
      return new Response(
        JSON.stringify({ error: `Order ${orderRef} is already marked as paid.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const amount = Number(order.payment_amount ?? order.total);
    if (isNaN(amount) || amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid order payment amount stored in database.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Query restaurant settings for currency and business name
    const { data: settings } = await supabase
      .from('restaurant_settings')
      .select('currency, business_name')
      .limit(1)
      .maybeSingle();

    const currency = (order.currency || settings?.currency)?.toLowerCase();
    if (!currency) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Currency is not configured in restaurant_settings.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const businessName = settings?.business_name;
    if (!businessName) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Business name is not configured in restaurant_settings.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error: STRIPE_SECRET_KEY not configured.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const cleanBaseUrl = publicSiteUrl.replace(/\/+$/, '');

    // Create real Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: currency,
            product_data: {
              name: `Order ${order.order_ref}`,
              description: `Dining order at ${businessName} (${order.customer_name || 'Guest'})`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      client_reference_id: order.order_ref,
      metadata: {
        order_ref: order.order_ref,
        order_id: order.id,
      },
      success_url: `${cleanBaseUrl}/order-success?ref=${order.order_ref}&token=${encodeURIComponent(paymentToken)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${cleanBaseUrl}/checkout?ref=${order.order_ref}&token=${encodeURIComponent(paymentToken)}&cancelled=true`,
    });

    // Update orders table with session reference
    await supabase
      .from('orders')
      .update({
        payment_provider: 'stripe',
        payment_reference: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq('order_ref', order.order_ref);

    return new Response(
      JSON.stringify({
        success: true,
        orderRef: order.order_ref,
        paymentToken: paymentToken,
        paymentId: session.id,
        sessionId: session.id,
        checkoutUrl: session.url,
        amount,
        currency: currency.toUpperCase(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal checkout creation error.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
