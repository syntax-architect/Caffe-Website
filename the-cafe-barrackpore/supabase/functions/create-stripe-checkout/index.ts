// ==============================================================================
// Supabase Edge Function: create-stripe-checkout
// Description: Secure server-side Stripe Checkout session creation.
// Takes only an order_ref, queries authoritative amount from database,
// and returns a real hosted Stripe checkout URL.
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
        JSON.stringify({ error: 'Missing required field: order_ref' }),
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
      .select('id, order_ref, total, payment_amount, currency, payment_status, customer_name, customer_phone')
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
        JSON.stringify({ error: 'Invalid order payment amount stored in database.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currency = (order.currency || 'USD').toLowerCase();
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

    const origin = req.headers.get('origin') || Deno.env.get('PUBLIC_SITE_URL') || 'http://localhost:5173';

    // Create real Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: currency,
            product_data: {
              name: `Order ${order.order_ref}`,
              description: `Dining order at The Café Barrackpore (${order.customer_name || 'Guest'})`,
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
        paymentId: session.id,
        sessionId: session.id,
        checkoutUrl: session.url, // Real hosted Stripe checkout URL
        amount,
        currency: (order.currency || 'USD').toUpperCase(),
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
