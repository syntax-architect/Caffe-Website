// ==============================================================================
// Supabase Edge Function: payment-health-check
// Description: Secure status check for payment provider configuration.
// ONLY reports boolean flags indicating whether secrets exist.
// NEVER exposes secret keys or sensitive values to client or logs.
// ==============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    let settings = {
      payment_provider: 'none',
      payments_enabled: false,
      allow_pay_at_counter: true,
    };

    if (supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data } = await supabase
        .from('restaurant_settings')
        .select('payment_provider, payments_enabled, payment_enabled, allow_pay_at_counter')
        .limit(1)
        .maybeSingle();

      if (data) {
        settings = {
          payment_provider: data.payment_provider || 'none',
          payments_enabled: data.payments_enabled ?? data.payment_enabled ?? false,
          allow_pay_at_counter: data.allow_pay_at_counter ?? true,
        };
      }
    }

    // Inspect server-side secrets as booleans only
    const hasRazorpayKeyId = Boolean(Deno.env.get('RAZORPAY_KEY_ID'));
    const hasRazorpayKeySecret = Boolean(Deno.env.get('RAZORPAY_KEY_SECRET'));
    const hasRazorpayWebhook = Boolean(Deno.env.get('RAZORPAY_WEBHOOK_SECRET'));

    const hasStripeSecretKey = Boolean(Deno.env.get('STRIPE_SECRET_KEY'));
    const hasStripeWebhook = Boolean(Deno.env.get('STRIPE_WEBHOOK_SECRET'));

    const razorpayConnected = hasRazorpayKeyId && hasRazorpayKeySecret && hasRazorpayWebhook;
    const stripeConnected = hasStripeSecretKey && hasStripeWebhook;

    const activeProvider = settings.payment_provider;
    let isConnected = false;

    if (activeProvider === 'razorpay') {
      isConnected = razorpayConnected;
    } else if (activeProvider === 'stripe') {
      isConnected = stripeConnected;
    }

    return new Response(
      JSON.stringify({
        success: true,
        activeProvider,
        paymentsEnabled: settings.payments_enabled,
        allowPayAtCounter: settings.allow_pay_at_counter,
        statusText: isConnected ? 'Connected' : 'Not connected',
        isConnected,
        providers: {
          razorpay: {
            connected: razorpayConnected,
            hasKeyId: hasRazorpayKeyId,
            hasKeySecret: hasRazorpayKeySecret,
            hasWebhookSecret: hasRazorpayWebhook,
          },
          stripe: {
            connected: stripeConnected,
            hasSecretKey: hasStripeSecretKey,
            hasWebhookSecret: hasStripeWebhook,
          },
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal health check error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
