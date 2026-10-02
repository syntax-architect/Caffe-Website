// ==============================================================================
// Supabase Edge Function: process-refund
// Description: Owner-authorized refund processing for Stripe and Razorpay.
// Enforces staff authentication and owner RBAC gate.
// Reconciles database order and payment ledger.
// ==============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import Stripe from 'https://esm.sh/stripe@14.25.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY is required.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Verify caller authentication and role (Only Owner can refund)
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing authentication token.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid authentication session.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: staffProfile, error: profileErr } = await supabase
      .from('staff_profiles')
      .select('role, is_active')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileErr || !staffProfile || !staffProfile.is_active || staffProfile.role !== 'owner') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Only active restaurant owners can process refunds.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const orderRef = (body.order_ref || body.orderRef || '').trim();
    const reason = body.reason || 'Staff initiated refund';
    const refundAmount = body.amount ? Number(body.amount) : undefined;

    if (!orderRef) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: order_ref' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Lookup order
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*')
      .eq('order_ref', orderRef)
      .maybeSingle();

    if (orderErr || !order) {
      return new Response(
        JSON.stringify({ error: `Order not found for reference: ${orderRef}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (order.payment_status !== 'paid') {
      return new Response(
        JSON.stringify({ error: `Cannot refund order ${orderRef} because payment_status is "${order.payment_status}".` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let refundId = `ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const provider = order.payment_provider || 'manual';
    const paymentRef = order.payment_reference;

    // 3. Provider Refund Execution
    if (provider === 'stripe' && paymentRef) {
      const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
      if (stripeSecretKey) {
        const stripe = new Stripe(stripeSecretKey, {
          apiVersion: '2023-10-16',
          httpClient: Stripe.createFetchHttpClient(),
        });

        let piId = paymentRef;
        if (paymentRef.startsWith('cs_')) {
          try {
            const session = await stripe.checkout.sessions.retrieve(paymentRef);
            if (session.payment_intent) {
              piId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent.id;
            }
          } catch (e: any) {
            console.warn('Failed to retrieve Stripe session payment_intent:', e);
          }
        }

        if (piId && piId.startsWith('pi_')) {
          const refundObj = await stripe.refunds.create({
            payment_intent: piId,
            amount: refundAmount ? Math.round(refundAmount * 100) : undefined,
            reason: 'requested_by_customer',
          });
          refundId = refundObj.id;
        }
      }
    } else if (provider === 'razorpay' && paymentRef) {
      const keyId = Deno.env.get('RAZORPAY_KEY_ID');
      const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
      if (keyId && keySecret) {
        const authHeader = `Basic ${btoa(`${keyId}:${keySecret}`)}`;
        const rzpRefundRes = await fetch(`https://api.razorpay.com/v1/payments/${paymentRef}/refund`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: refundAmount ? Math.round(refundAmount * 100) : undefined,
            notes: {
              order_ref: orderRef,
              reason: reason,
            },
          }),
        });

        if (rzpRefundRes.ok) {
          const rzpRefundData = await rzpRefundRes.json();
          refundId = rzpRefundData.id || refundId;
        }
      }
    }

    // 4. Update Database
    const now = new Date().toISOString();
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
        failure_reason: `Refund processed: ${reason} (ID: ${refundId})`,
        updated_at: now,
      })
      .eq('order_ref', orderRef);

    return new Response(
      JSON.stringify({
        success: true,
        orderRef,
        refundId,
        message: `Order ${orderRef} refunded successfully.`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal refund processing error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
