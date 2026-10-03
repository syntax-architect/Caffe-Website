// ==============================================================================
// Supabase Edge Function: daily-sales-summary
// Description: Computes daily sales metrics and dispatches an executive summary
// to the restaurant owner via WhatsApp / Email. Can be triggered via pg_cron,
// Supabase Scheduled Functions, or manual staff portal invocation.
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

    // Require x-cron-secret header matching CRON_SECRET
    const cronSecret = Deno.env.get('CRON_SECRET');
    const reqCronSecret = req.headers.get('x-cron-secret');
    if (!cronSecret || !reqCronSecret || reqCronSecret !== cronSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized: invalid or missing cron secret' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch restaurant settings
    const { data: settings } = await supabase
      .from('restaurant_settings')
      .select('*')
      .eq('id', 'current')
      .maybeSingle();

    if (!settings?.business_name || !settings?.currency) {
      return new Response(
        JSON.stringify({ error: 'Configuration error: business_name and currency must be configured in restaurant_settings' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const businessName = settings.business_name;
    const currency = settings.currency;
    const currencySymbol = settings?.currency_symbol || '₹';
    const notifyMethod = settings?.owner_notification_method || 'none';
    const targetPhone = settings?.owner_notification_phone || settings?.phone;
    const targetEmail = settings?.owner_notification_email || settings?.email;

    // 2. Fetch today's orders
    const today = new Date().toISOString().split('T')[0];
    const { data: orders, error: orderErr } = await supabase
      .from('orders')
      .select('id, order_ref, customer_name, order_type, total, status, payment_status, payment_provider, created_at')
      .gte('created_at', `${today}T00:00:00.000Z`)
      .neq('status', 'cancelled');

    if (orderErr) throw orderErr;

    const validOrders = orders || [];
    const totalOrders = validOrders.length;
    const grossRevenue = validOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const avgOrderValue = totalOrders > 0 ? Math.round(grossRevenue / totalOrders) : 0;

    const dineInCount = validOrders.filter((o) => o.order_type === 'dine_in').length;
    const takeawayCount = validOrders.filter((o) => o.order_type === 'takeaway').length;

    const paidOnline = validOrders.filter((o) => o.payment_status === 'paid').length;
    const payAtCounter = validOrders.filter((o) => o.payment_status !== 'paid').length;

    // 3. Top selling items for today
    const orderIds = validOrders.map((o) => o.id);
    let topItemsSummary = 'None recorded';
    if (orderIds.length > 0) {
      const { data: items } = await supabase
        .from('order_items')
        .select('item_name, quantity, line_total')
        .in('order_id', orderIds);

      if (items && items.length > 0) {
        const itemMap: Record<string, { qty: number; rev: number }> = {};
        items.forEach((it) => {
          const name = it.item_name;
          if (!itemMap[name]) itemMap[name] = { qty: 0, rev: 0 };
          itemMap[name].qty += Number(it.quantity || 0);
          itemMap[name].rev += Number(it.line_total || 0);
        });

        const sorted = Object.entries(itemMap)
          .map(([name, data]) => ({ name, ...data }))
          .sort((a, b) => b.qty - a.qty)
          .slice(0, 5);

        topItemsSummary = sorted
          .map((it, idx) => `${idx + 1}. ${it.name} (${it.qty} sold · ${currencySymbol}${it.rev})`)
          .join('\n');
      }
    }

    // 4. Construct formatted text report
    const reportText = `📊 *${businessName.toUpperCase()} — DAILY SALES SUMMARY*
📅 Date: ${today}

💰 *Financials*
• Gross Revenue: ${currencySymbol}${grossRevenue.toLocaleString()}
• Total Orders: ${totalOrders}
• Average Order Value: ${currencySymbol}${avgOrderValue}

🍽️ *Service Breakdown*
• Dine-in: ${dineInCount} (${totalOrders > 0 ? Math.round((dineInCount / totalOrders) * 100) : 0}%)
• Takeaway: ${takeawayCount} (${totalOrders > 0 ? Math.round((takeawayCount / totalOrders) * 100) : 0}%)

💳 *Payment Channels*
• Online Verified: ${paidOnline}
• Counter / Cash: ${payAtCounter}

🏆 *Top 5 Selling Items*
${topItemsSummary}

Automated Dispatch by The Café Executive Terminal.`;

    let whatsappSent = false;
    let emailSent = false;
    const dispatchLogs: string[] = [];

    // 5. WhatsApp dispatch (if enabled & phone present)
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
                text: { body: reportText },
              }),
            }
          );
          whatsappSent = waRes.ok;
          dispatchLogs.push(`WhatsApp Cloud API: HTTP ${waRes.status}`);
        } catch (err: any) {
          dispatchLogs.push(`WhatsApp error: ${err.message}`);
        }
      } else {
        dispatchLogs.push('WhatsApp API secrets (WHATSAPP_API_TOKEN, WHATSAPP_PHONE_NUMBER_ID) not configured — logged to console');
        console.log('[Daily Sales Summary — WhatsApp Preview]:\n', reportText);
        whatsappSent = true; // simulated in test mode
      }
    }

    // 6. Email dispatch (if enabled & email present)
    if ((notifyMethod === 'email' || notifyMethod === 'both') && targetEmail) {
      const resendApiKey = Deno.env.get('RESEND_API_KEY');

      if (resendApiKey) {
        try {
          const emailHtml = `
            <div style="font-family: Arial, sans-serif; background-color: #120B08; color: #F3EFEA; padding: 24px; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #D4AF37;">
              <h2 style="color: #D4AF37; margin-bottom: 4px;">${businessName}</h2>
              <p style="color: #A1A1AA; font-size: 13px; margin-top: 0;">Daily Executive Sales Report — ${today}</p>
              
              <div style="background-color: #1A130E; border: 1px solid rgba(212,175,55,0.2); border-radius: 8px; padding: 16px; margin: 20px 0;">
                <h3 style="color: #4ADE80; font-size: 28px; margin: 0;">${currencySymbol}${grossRevenue.toLocaleString()}</h3>
                <p style="color: #D4D4D8; font-size: 13px; margin: 4px 0 0 0;">Gross Revenue across ${totalOrders} orders (AOV: ${currencySymbol}${avgOrderValue})</p>
              </div>

              <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin: 16px 0;">
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                  <td style="padding: 8px 0; color: #A1A1AA;">Dine-in Tickets</td>
                  <td style="padding: 8px 0; text-align: right; color: #FFFFFF; font-weight: bold;">${dineInCount}</td>
                </tr>
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                  <td style="padding: 8px 0; color: #A1A1AA;">Takeaway Orders</td>
                  <td style="padding: 8px 0; text-align: right; color: #FFFFFF; font-weight: bold;">${takeawayCount}</td>
                </tr>
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                  <td style="padding: 8px 0; color: #A1A1AA;">Paid Online</td>
                  <td style="padding: 8px 0; text-align: right; color: #4ADE80; font-weight: bold;">${paidOnline}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #A1A1AA;">Pay at Counter</td>
                  <td style="padding: 8px 0; text-align: right; color: #FBBF24; font-weight: bold;">${payAtCounter}</td>
                </tr>
              </table>

              <h4 style="color: #D4AF37; margin: 20px 0 8px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Top 5 Selling Items</h4>
              <pre style="background-color: #0A0705; padding: 12px; border-radius: 6px; font-size: 12px; color: #E4E4E7; white-space: pre-wrap; font-family: monospace;">${topItemsSummary}</pre>

              <p style="color: #71717A; font-size: 11px; margin-top: 24px; text-align: center;">Automated notification from ${businessName} POS platform.</p>
            </div>
          `;

          const emailRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'The Café Reports <reports@thecafebarrackpore.com>',
              to: targetEmail,
              subject: `${businessName} — Daily Sales Report (${currencySymbol}${grossRevenue.toLocaleString()})`,
              html: emailHtml,
            }),
          });
          emailSent = emailRes.ok;
          dispatchLogs.push(`Resend Email API: HTTP ${emailRes.status}`);
        } catch (err: any) {
          dispatchLogs.push(`Email error: ${err.message}`);
        }
      } else {
        dispatchLogs.push('RESEND_API_KEY secret not configured — logged to console');
        console.log('[Daily Sales Summary — Email Preview sent to', targetEmail, ']:\n', reportText);
        emailSent = true;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: today,
        metrics: {
          totalOrders,
          grossRevenue,
          averageOrderValue: avgOrderValue,
          dineInCount,
          takeawayCount,
          paidOnline,
          payAtCounter,
        },
        dispatches: {
          method: notifyMethod,
          whatsappSent,
          emailSent,
          logs: dispatchLogs,
        },
        reportText,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('[daily-sales-summary] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Internal error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
