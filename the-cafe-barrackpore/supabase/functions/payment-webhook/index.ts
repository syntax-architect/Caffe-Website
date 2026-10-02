// ==============================================================================
// Supabase Edge Function: payment-webhook
// Description: Secure server-side webhook handler for Razorpay & Stripe
// Enforces:
// 1. Strict signature verification (HMAC-SHA256 for Razorpay, constructEventAsync for Stripe)
// 2. SUPABASE_SERVICE_ROLE_KEY (zero anon-key fallback)
// 3. Idempotency (ignores repeated events)
// 4. Amount and currency matching against authoritative order record
// 5. Handles paid, failed, and refunded lifecycle events
// 6. Rejects unsigned or invalid requests with 400
// ==============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import Stripe from 'https://esm.sh/stripe@14.25.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature, x-razorpay-signature, x-razorpay-event-id',
};

/**
 * Constant-time Razorpay HMAC-SHA256 signature verification using Web Crypto API.
 */
async function verifyRazorpaySignature(body: string, signature: string, secret: string): Promise<boolean> {
  if (!signature || !secret) return false;
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const hashArray = Array.from(new Uint8Array(sigBuffer));
    const expectedSignature = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    if (signature.length !== expectedSignature.length) return false;
    let mismatch = 0;
    for (let i = 0; i < signature.length; i++) {
      mismatch |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
    }
    return mismatch === 0;
  } catch {
    return false;
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = new URL(req.url);
    let provider = url.searchParams.get('provider')?.toLowerCase();

    // Auto-detect provider from headers if not explicitly in query
    if (!provider) {
      if (req.headers.has('stripe-signature')) {
        provider = 'stripe';
      } else if (req.headers.has('x-razorpay-signature')) {
        provider = 'razorpay';
      }
    }

    if (!provider || (provider !== 'stripe' && provider !== 'razorpay')) {
      return new Response(
        JSON.stringify({ error: 'Missing or unsupported payment provider. Must be "stripe" or "razorpay".' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Require SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY is required for webhook reconciliation.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const rawBody = await req.text();

    let parsedEvent: any = null;
    let eventId = '';
    let eventType = '';
    let orderRef = '';
    let providerPaymentId = '';
    let paidAmountInSmallestUnits: number | null = null;
    let paidCurrency = '';
    let eventAction: 'paid' | 'failed' | 'refunded' | 'ignore' = 'ignore';
    let failureReason: string | undefined;

    // -------------------------------------------------------------
    // STRIPE SIGNATURE VERIFICATION & PAYLOAD EXTRACTION
    // -------------------------------------------------------------
    if (provider === 'stripe') {
      const signature = req.headers.get('stripe-signature');
      if (!signature) {
        return new Response(JSON.stringify({ error: 'Missing stripe-signature header' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') || '';
      const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';

      if (!stripeWebhookSecret) {
        return new Response(
          JSON.stringify({ error: 'STRIPE_WEBHOOK_SECRET not configured on server' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2023-10-16',
        httpClient: Stripe.createFetchHttpClient(),
      });

      try {
        parsedEvent = await stripe.webhooks.constructEventAsync(rawBody, signature, stripeWebhookSecret);
      } catch (err: any) {
        return new Response(
          JSON.stringify({ error: `Stripe webhook signature verification failed: ${err.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      eventId = parsedEvent.id || '';
      eventType = parsedEvent.type;
      const dataObj = parsedEvent.data?.object || {};

      orderRef =
        dataObj.client_reference_id ||
        dataObj.metadata?.order_ref ||
        dataObj.metadata?.orderRef ||
        '';

      providerPaymentId = dataObj.id || dataObj.payment_intent || '';

      if (eventType === 'checkout.session.completed') {
        eventAction = 'paid';
        paidAmountInSmallestUnits = Number(dataObj.amount_total);
        paidCurrency = (dataObj.currency || '').toUpperCase();
      } else if (eventType === 'payment_intent.succeeded') {
        eventAction = 'paid';
        paidAmountInSmallestUnits = Number(dataObj.amount_received ?? dataObj.amount);
        paidCurrency = (dataObj.currency || '').toUpperCase();
      } else if (eventType === 'payment_intent.payment_failed') {
        eventAction = 'failed';
        failureReason = dataObj.last_payment_error?.message || 'Stripe card decline or charge failure';
      } else if (eventType === 'charge.refunded' || eventType === 'refund.created' || eventType === 'refund.updated') {
        eventAction = 'refunded';
      }
    }

    // -------------------------------------------------------------
    // RAZORPAY SIGNATURE VERIFICATION & PAYLOAD EXTRACTION
    // -------------------------------------------------------------
    if (provider === 'razorpay') {
      const signature = req.headers.get('x-razorpay-signature');
      if (!signature) {
        return new Response(JSON.stringify({ error: 'Missing x-razorpay-signature header' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const razorpayWebhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET') || '';
      if (!razorpayWebhookSecret) {
        return new Response(
          JSON.stringify({ error: 'RAZORPAY_WEBHOOK_SECRET not configured on server' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const isValid = await verifyRazorpaySignature(rawBody, signature, razorpayWebhookSecret);
      if (!isValid) {
        return new Response(
          JSON.stringify({ error: 'Razorpay HMAC-SHA256 signature verification failed' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        parsedEvent = JSON.parse(rawBody);
      } catch {
        return new Response(JSON.stringify({ error: 'Malformed JSON payload from Razorpay' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      eventId = parsedEvent.id || parsedEvent.event_id || req.headers.get('x-razorpay-event-id') || '';
      eventType = parsedEvent.event;

      const paymentEntity = parsedEvent.payload?.payment?.entity || {};
      const orderEntity = parsedEvent.payload?.order?.entity || {};
      const refundEntity = parsedEvent.payload?.refund?.entity || {};

      orderRef =
        paymentEntity.notes?.order_ref ||
        orderEntity.notes?.order_ref ||
        refundEntity.notes?.order_ref ||
        orderEntity.receipt ||
        '';

      providerPaymentId = paymentEntity.id || refundEntity.payment_id || '';

      if (eventType === 'payment.captured' || eventType === 'order.paid') {
        eventAction = 'paid';
        paidAmountInSmallestUnits = Number(paymentEntity.amount);
        paidCurrency = (paymentEntity.currency || '').toUpperCase();
      } else if (eventType === 'payment.failed') {
        eventAction = 'failed';
        failureReason = paymentEntity.error_description || paymentEntity.error_code || 'Razorpay payment failed';
      } else if (eventType === 'refund.created' || eventType === 'refund.processed' || eventType === 'payment.refunded') {
        eventAction = 'refunded';
      }
    }

    // -------------------------------------------------------------
    // IDEMPOTENCY CHECK
    // -------------------------------------------------------------
    if (eventId) {
      const { data: existingPayment } = await supabase
        .from('payments')
        .select('id, status, idempotency_key')
        .eq('idempotency_key', eventId)
        .maybeSingle();

      if (existingPayment && (existingPayment.status === 'paid' || existingPayment.status === 'refunded')) {
        return new Response(
          JSON.stringify({
            message: 'Event already processed (idempotent duplicate)',
            idempotent: true,
            status: existingPayment.status,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!orderRef) {
      return new Response(
        JSON.stringify({ error: 'Could not resolve order_ref from webhook payload notes/metadata' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // -------------------------------------------------------------
    // FETCH AUTHORITATIVE ORDER RECORD
    // -------------------------------------------------------------
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, order_ref, total, payment_amount, currency, payment_status')
      .eq('order_ref', orderRef)
      .maybeSingle();

    if (orderErr || !order) {
      return new Response(
        JSON.stringify({ error: `Order not found in database for order_ref: ${orderRef}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date().toISOString();

    // -------------------------------------------------------------
    // PAID EVENT: CHECK AMOUNT AND CURRENCY MATCH
    // -------------------------------------------------------------
    if (eventAction === 'paid') {
      const expectedAmountUnits = Math.round(Number(order.payment_amount ?? order.total) * 100);
      const expectedCurrency = (order.currency || 'INR').toUpperCase();

      if (paidCurrency && paidCurrency !== expectedCurrency) {
        return new Response(
          JSON.stringify({
            error: `Currency mismatch: webhook reported ${paidCurrency} but order expects ${expectedCurrency}`,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (paidAmountInSmallestUnits !== null && Math.abs(paidAmountInSmallestUnits - expectedAmountUnits) > 5) {
        return new Response(
          JSON.stringify({
            error: `Amount mismatch: webhook reported ${paidAmountInSmallestUnits} but order expects ${expectedAmountUnits}`,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Authoritative state reconciliation: update order to 'paid'
      await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          payment_provider: provider,
          payment_reference: providerPaymentId || order.payment_reference,
          paid_at: now,
          updated_at: now,
        })
        .eq('order_ref', orderRef);

      // Upsert / update payment ledger
      await supabase
        .from('payments')
        .upsert({
          order_id: order.id,
          order_ref: order.order_ref,
          provider: provider,
          provider_payment_id: providerPaymentId || null,
          amount: Number(order.payment_amount ?? order.total),
          currency: expectedCurrency,
          status: 'paid',
          idempotency_key: eventId || null,
          metadata: {
            webhook_event_type: eventType,
            reconciled_at: now,
          },
          updated_at: now,
        }, { onConflict: 'order_ref' })
        .catch(() => {});
    }

    // -------------------------------------------------------------
    // FAILED EVENT
    // -------------------------------------------------------------
    if (eventAction === 'failed') {
      await supabase
        .from('orders')
        .update({
          payment_status: 'failed',
          updated_at: now,
        })
        .eq('order_ref', orderRef);

      await supabase
        .from('payments')
        .update({
          status: 'failed',
          failure_reason: failureReason || 'Provider reported payment failure',
          idempotency_key: eventId || null,
          updated_at: now,
        })
        .eq('order_ref', orderRef);
    }

    // -------------------------------------------------------------
    // REFUNDED EVENT
    // -------------------------------------------------------------
    if (eventAction === 'refunded') {
      await supabase
        .from('orders')
        .update({
          payment_status: 'refunded',
          updated_at: now,
        })
        .eq('order_ref', orderRef);

      await supabase
        .from('payments')
        .update({
          status: 'refunded',
          idempotency_key: eventId || null,
          updated_at: now,
        })
        .eq('order_ref', orderRef);
    }

    return new Response(
      JSON.stringify({
        success: true,
        orderRef,
        action: eventAction,
        provider,
        providerPaymentId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal webhook error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
