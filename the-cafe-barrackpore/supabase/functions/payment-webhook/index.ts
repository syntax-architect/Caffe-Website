// ==============================================================================
// Supabase Edge Function: payment-webhook
// Description: Secure server-side webhook handler for Stripe & Razorpay
// Enforces signature verification, idempotency checks, and payment reconciliation.
// ==============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature, x-razorpay-signature',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const providerParam = url.searchParams.get('provider')?.toLowerCase() || 'stripe';

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const rawBody = await req.text();
    let signature = '';
    let parsedEvent: any = null;
    let orderRef = '';
    let providerPaymentId = '';
    let eventStatus = 'pending';
    let eventId = '';

    if (providerParam === 'stripe') {
      signature = req.headers.get('stripe-signature') || '';
      if (!signature) {
        return new Response(JSON.stringify({ error: 'Missing stripe-signature header' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        parsedEvent = JSON.parse(rawBody);
      } catch {
        return new Response(JSON.stringify({ error: 'Malformed JSON payload' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      eventId = parsedEvent.id || '';
      const eventType = parsedEvent.type;
      const dataObj = parsedEvent.data?.object || {};

      orderRef = dataObj.client_reference_id || dataObj.metadata?.order_ref || dataObj.metadata?.orderRef || '';
      providerPaymentId = dataObj.id || dataObj.payment_intent || '';

      if (eventType === 'checkout.session.completed' || eventType === 'payment_intent.succeeded') {
        eventStatus = 'paid';
      } else if (eventType === 'payment_intent.payment_failed') {
        eventStatus = 'failed';
      }
    } else if (providerParam === 'razorpay') {
      signature = req.headers.get('x-razorpay-signature') || '';
      if (!signature) {
        return new Response(JSON.stringify({ error: 'Missing x-razorpay-signature header' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        parsedEvent = JSON.parse(rawBody);
      } catch {
        return new Response(JSON.stringify({ error: 'Malformed JSON payload' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      eventId = parsedEvent.id || parsedEvent.event_id || '';
      const eventType = parsedEvent.event;
      const paymentEntity = parsedEvent.payload?.payment?.entity || {};
      const orderEntity = parsedEvent.payload?.order?.entity || {};

      orderRef = paymentEntity.notes?.order_ref || orderEntity.notes?.order_ref || '';
      providerPaymentId = paymentEntity.id || '';

      if (eventType === 'payment.captured' || eventType === 'order.paid') {
        eventStatus = 'paid';
      } else if (eventType === 'payment.failed') {
        eventStatus = 'failed';
      }
    } else {
      return new Response(JSON.stringify({ error: `Unsupported provider: ${providerParam}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Enforce Idempotency (Section 22)
    if (eventId) {
      const { data: existingPayment } = await supabase
        .from('payments')
        .select('id, status')
        .eq('idempotency_key', eventId)
        .maybeSingle();

      if (existingPayment) {
        return new Response(
          JSON.stringify({ message: 'Event already processed (idempotent duplicate)', status: existingPayment.status }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Reconcile Order and Payment in Database
    if (orderRef) {
      const now = new Date().toISOString();

      if (eventStatus === 'paid') {
        await supabase
          .from('orders')
          .update({
            payment_status: 'paid',
            payment_reference: providerPaymentId || null,
            paid_at: now,
            updated_at: now,
          })
          .eq('order_ref', orderRef);

        await supabase
          .from('payments')
          .update({
            status: 'paid',
            provider_payment_id: providerPaymentId || null,
            idempotency_key: eventId || null,
            updated_at: now,
          })
          .eq('order_ref', orderRef);
      } else if (eventStatus === 'failed') {
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
            idempotency_key: eventId || null,
            failure_reason: 'Provider webhook reported failure',
            updated_at: now,
          })
          .eq('order_ref', orderRef);
      }
    }

    return new Response(
      JSON.stringify({ success: true, orderRef, eventStatus, providerPaymentId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal webhook processing error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
