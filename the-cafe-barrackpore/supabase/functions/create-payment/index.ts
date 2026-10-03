// ==============================================================================
// Supabase Edge Function: create-payment
// Description: Provider-agnostic payment order/session creator (Razorpay & Stripe).
// Reads authoritative order total from the database (NEVER from client).
// Checks restaurant_settings payment_provider and payments_enabled.
// Returns the payload required by frontend to trigger checkout (UPI, cards, net banking).
// ==============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import Stripe from 'https://esm.sh/stripe@14.25.0?target=deno';

const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') || 'https://thecafebarrackpore.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const orderRef = (body.order_ref || body.orderRef || '').trim();

    if (!orderRef) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: order_ref' }),
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

    // 1. Authoritative lookup: read order total from database (never trust client amount)
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, order_ref, total, payment_amount, currency, payment_status, payment_provider, customer_name, customer_phone')
      .eq('order_ref', orderRef)
      .maybeSingle();

    if (orderErr || !order) {
      return new Response(
        JSON.stringify({ error: `Order not found for reference: ${orderRef}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // 2. Query restaurant settings for provider and payment status
    const { data: settings } = await supabase
      .from('restaurant_settings')
      .select('payment_provider, payments_enabled, payment_enabled, allow_pay_at_counter, currency, business_name')
      .limit(1)
      .maybeSingle();

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

    const effectiveCurrency = (order.currency || settings?.currency || 'INR').toUpperCase();
    const origin = req.headers.get('origin') || Deno.env.get('PUBLIC_SITE_URL') || 'http://localhost:5173';
    const businessName = settings?.business_name || 'The Café Barrackpore';

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

      // Create official Razorpay Order for standard modal (UPI, Netbanking, Cards)
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
          keyId: keyId, // Public Key ID safe for client SDK
          amount: rzpData.amount, // in paise
          currency: rzpData.currency,
          orderRef: order.order_ref,
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
        success_url: `${origin}/order-success?ref=${order.order_ref}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/checkout?ref=${order.order_ref}&cancelled=true`,
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
