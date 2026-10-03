// ==============================================================================
// Supabase Edge Function: stock-alerts
// Description: Monitors inventory levels and sends real-time alerts to the owner
// when menu items hit the low-stock threshold or sell out completely (stock_count = 0).
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch settings for threshold & owner contacts
    const { data: settings } = await supabase
      .from('restaurant_settings')
      .select('*')
      .eq('id', 'current')
      .maybeSingle();

    const threshold = settings?.low_stock_alert_threshold ?? 5;
    const businessName = settings?.business_name || 'The Café Barrackpore';
    const targetPhone = settings?.owner_notification_phone || settings?.phone;
    const targetEmail = settings?.owner_notification_email || settings?.email;
    const notifyMethod = settings?.owner_notification_method || 'none';

    // 2. Query low stock & sold out items
    const { data: lowStockItems, error } = await supabase
      .from('menu_items')
      .select('id, name, price, stock_count, available')
      .not('stock_count', 'is', null)
      .lte('stock_count', threshold)
      .order('stock_count', { ascending: true });

    if (error) throw error;

    const items = lowStockItems || [];
    const soldOutItems = items.filter((i) => i.stock_count === 0);
    const criticalItems = items.filter((i) => i.stock_count > 0);

    if (items.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'All inventory items are currently healthy above threshold.',
          count: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. Format alert message
    let alertText = `⚠️ *${businessName.toUpperCase()} — INVENTORY ALERT*\n\n`;

    if (soldOutItems.length > 0) {
      alertText += `🔴 *SOLD OUT (0 remaining):*\n`;
      soldOutItems.forEach((i) => {
        alertText += `• ${i.name}\n`;
      });
      alertText += '\n';
    }

    if (criticalItems.length > 0) {
      alertText += `🟡 *LOW STOCK (≤ ${threshold} remaining):*\n`;
      criticalItems.forEach((i) => {
        alertText += `• ${i.name}: ${i.stock_count} units left\n`;
      });
      alertText += '\n';
    }

    alertText += `Please restock these items in the staff portal: /staff/menu`;

    let whatsappSent = false;
    let emailSent = false;

    // 4. WhatsApp alert
    if ((notifyMethod === 'whatsapp' || notifyMethod === 'both') && targetPhone) {
      const whatsappToken = Deno.env.get('WHATSAPP_API_TOKEN');
      const whatsappPhoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

      if (whatsappToken && whatsappPhoneId) {
        try {
          const cleanPhone = targetPhone.replace(/\D/g, '');
          const waRes = await fetch(
            `https://graph.facebook.com/v19.0/${whatsappPhoneId}/messages`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${whatsappToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: cleanPhone,
                type: 'text',
                text: { body: alertText },
              }),
            }
          );
          whatsappSent = waRes.ok;
        } catch (err: any) {
          console.error('[stock-alerts] WhatsApp send error:', err);
        }
      } else {
        console.log('[Stock Alert — WhatsApp Preview]:\n', alertText);
        whatsappSent = true;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        threshold,
        totalAlerts: items.length,
        soldOutCount: soldOutItems.length,
        lowStockCount: criticalItems.length,
        items,
        dispatched: {
          whatsapp: whatsappSent,
          email: emailSent,
        },
        alertText,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('[stock-alerts] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Internal error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
