// ==============================================================================
// Supabase Edge Function: create-payment
// Description: Provider-agnostic payment order/session creator (Razorpay & Stripe).
// Reads authoritative order total from the database (NEVER from client).
// Checks restaurant_settings payment_provider and payments_enabled.
// Requires order_ref + payment_token and verifies SHA-256 hash against orders.payment_token_hash.
// Eliminates hardcoded fallbacks ('INR', 'The Café Barrackpore', 'http://localhost:5173').
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

    // 1. Authoritative lookup: read order from database (never trust client)
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, order_ref, total, payment_amount, currency, payment_status, payment_provider, customer_name, customer_phone, payment_token_hash')
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
        JSON.stringify({ error: 'Invalid order amount stored in database.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Query restaurant settings for provider, payment status, currency, and business name
    const { data: settings } = await supabase
      .from('restaurant_settings')
      .select('payment_provider, payments_enabled, payment_enabled, allow_pay_at_counter, currency, business_name')
      .limit(1)
      .maybeSingle();

    const effectiveCurrency = (order.currency || settings?.currency)?.toUpperCase();
    if (!effectiveCurrency) {
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

    const paymentsEnabled = settings?.payments_enabled ?? settings?.payment_enabled ?? true;
    const configuredProvider = (settings?.payment_provider || order.payment_provider || 'none').toLowerCase();

    if (!paymentsEnabled || configuredProvider === 'none') {
      return new Response(
        JSON.stringify({
          error: 'Online payments are currently disabled by the restaurant. Please choose Pay at Counter.',
          allowPayAtCounter: settings?.allow_pay_at_counter ?? true,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanBaseUrl = publicSiteUrl.replace(/\/+$/, '');

    // -------------------------------------------------------------
    // RAZORPAY ORDER GENERATION (Supports UPI, Cards, Net Banking)
    // -------------------------------------------------------------
    if (configuredProvider === 'razorpay') {
      const keyId = Deno.env.get('RAZORPAY_KEY_ID');
      const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

      if (!keyId || !keySecret) {
        return new Response(
          JSON.stringify({ error: 'Server configuration error: Razorpay API keys are not configured.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const authHeader = `Basic ${btoa(`${keyId}:${keySecret}`)}`;
      const amountInPaise = Math.round(amount * 100);

      const rzpResponse = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: effectiveCurrency,
          receipt: order.order_ref,
          notes: {
            order_ref: order.order_ref,
            order_id: order.id,
          },
        }),
      });

      const rzpData = await rzpResponse.json();

      if (!rzpResponse.ok) {
        return new Response(
          JSON.stringify({ error: rzpData.error?.description || 'Failed to create Razorpay order' }),
          { status: rzpResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update orders table with Razorpay payment reference
      await supabase
        .from('orders')
        .update({
          payment_provider: 'razorpay',
          payment_reference: rzpData.id,
          updated_at: new Date().toISOString(),
        })
        .eq('order_ref', order.order_ref);

      // Upsert ledger entry
      await supabase.from('payments').upsert({
        order_id: order.id,
        order_ref: order.order_ref,
        provider: 'razorpay',
        provider_payment_id: rzpData.id,
        amount: amount,
        currency: effectiveCurrency,
        status: 'pending',
        metadata: {
          razorpay_order_id: rzpData.id,
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'order_ref' }).catch(() => {});

      return new Response(
        JSON.stringify({
          success: true,
          provider: 'razorpay',
          orderId: rzpData.id,
          razorpayOrderId: rzpData.id,
          keyId: keyId,
          amount: rzpData.amount,
          currency: rzpData.currency,
          orderRef: order.order_ref,
          paymentToken: paymentToken,
          businessName: businessName,
          customer: {
            name: order.customer_name || 'Guest',
            contact: order.customer_phone || undefined,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // -------------------------------------------------------------
    // STRIPE CHECKOUT SESSION (Cards, Apple Pay, Google Pay)
    // -------------------------------------------------------------
    if (configuredProvider === 'stripe') {
      const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

      if (!stripeSecretKey) {
        return new Response(
          JSON.stringify({ error: 'Server configuration error: STRIPE_SECRET_KEY is not configured.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2023-10-16',
        httpClient: Stripe.createFetchHttpClient(),
      });

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: effectiveCurrency.toLowerCase(),
              product_data: {
                name: `Order ${order.order_ref}`,
                description: `${businessName} (${order.customer_name || 'Guest'})`,
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

      // Update orders table with session ID
      await supabase
        .from('orders')
        .update({
          payment_provider: 'stripe',
          payment_reference: session.id,
          updated_at: new Date().toISOString(),
        })
        .eq('order_ref', order.order_ref);

      // Upsert ledger entry
      await supabase.from('payments').upsert({
        order_id: order.id,
        order_ref: order.order_ref,
        provider: 'stripe',
        provider_payment_id: session.id,
        amount: amount,
        currency: effectiveCurrency,
        status: 'pending',
        metadata: {
          stripe_session_id: session.id,
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'order_ref' }).catch(() => {});

      return new Response(
        JSON.stringify({
          success: true,
          provider: 'stripe',
          orderRef: order.order_ref,
          paymentToken: paymentToken,
          paymentId: session.id,
          sessionId: session.id,
          checkoutUrl: session.url,
          clientSecret: session.client_secret,
          amount: amount,
          currency: effectiveCurrency,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unsupported payment provider: ${configuredProvider}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal payment creation error.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
