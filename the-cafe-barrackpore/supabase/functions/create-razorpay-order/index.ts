// ==============================================================================
// Supabase Edge Function: create-razorpay-order
// Description: Secure server-side Razorpay order and hosted checkout creation.
// Takes only an order_ref, reads authoritative amount from database,
// and returns a real hosted Razorpay checkout URL.
// ==============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

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

    const currency = (order.currency || 'INR').toUpperCase();
    const keyId = Deno.env.get('RAZORPAY_KEY_ID');
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!keyId || !keySecret) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not configured.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const origin = req.headers.get('origin') || Deno.env.get('PUBLIC_SITE_URL') || 'http://localhost:5173';
    const authHeader = `Basic ${btoa(`${keyId}:${keySecret}`)}`;

    // Create a real hosted Razorpay Payment Link (returns short_url)
    const rzpResponse = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // In paise (smallest unit)
        currency: currency,
        accept_partial: false,
        reference_id: order.order_ref,
        description: `Order ${order.order_ref} at The Café Barrackpore`,
        customer: {
          name: order.customer_name || 'Guest',
          contact: order.customer_phone || undefined,
        },
        notify: {
          sms: false,
          email: false,
        },
        callback_url: `${origin}/order-success?ref=${order.order_ref}`,
        callback_method: 'get',
        notes: {
          order_ref: order.order_ref,
          order_id: order.id,
        },
      }),
    });

    const rzpData = await rzpResponse.json();

    if (!rzpResponse.ok) {
      return new Response(
        JSON.stringify({ error: rzpData.error?.description || 'Failed to create Razorpay payment link' }),
        { status: rzpResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Official hosted checkout URL returned by Razorpay
    const checkoutUrl = rzpData.short_url;

    // Update orders table with Razorpay payment reference
    await supabase
      .from('orders')
      .update({
        payment_provider: 'razorpay',
        payment_reference: rzpData.id,
        updated_at: new Date().toISOString(),
      })
      .eq('order_ref', order.order_ref);

    return new Response(
      JSON.stringify({
        success: true,
        orderRef: order.order_ref,
        paymentId: rzpData.id,
        orderId: rzpData.order_id || rzpData.id,
        checkoutUrl: checkoutUrl, // Real hosted Razorpay checkout URL
        amount,
        currency,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal Razorpay order creation error.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
