import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { CreateOrderPayload, OrderResult } from '../types/order';
import { calculateOrderTotals, generateClientOrderRef } from '../utils/orderCalculations';
import { validatePhoneNumber } from '../utils/phone';
import { isItemAvailable } from './menuAvailabilityService';
import { enforceRateLimit } from '../utils/rateLimiter';
import { verifyTurnstileToken } from '../utils/security';

/**
 * Validates checkout payload prior to database submission.
 */
export const validateOrderPayload = (payload: CreateOrderPayload): { valid: boolean; error?: string } => {
  if (!payload) {
    return { valid: false, error: 'Order details are missing.' };
  }

  const name = payload.customer_name?.trim();
  if (!name || name.length < 2) {
    return { valid: false, error: 'Please provide a valid full name (minimum 2 characters).' };
  }

  const phoneValidation = validatePhoneNumber(payload.customer_phone);
  if (!phoneValidation.valid) {
    return { valid: false, error: phoneValidation.error || 'Please provide a valid phone number.' };
  }

  if (payload.order_type !== 'dine_in' && payload.order_type !== 'takeaway') {
    return { valid: false, error: 'Please select an order type (Dine-in or Takeaway).' };
  }

  if (payload.order_type === 'dine_in') {
    const table = payload.table_number?.trim();
    if (!table) {
      return { valid: false, error: 'Please provide your table number for Dine-in orders.' };
    }
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    return { valid: false, error: 'Cannot submit an order with an empty cart.' };
  }

  if (payload.items.length > 40) {
    return { valid: false, error: 'Order cannot contain more than 40 distinct items.' };
  }

  for (const item of payload.items) {
    const qty = Number(item.quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 50) {
      return { valid: false, error: 'Item quantity must be between 1 and 50.' };
    }
  }

  return { valid: true };
};

/**
 * Creates a restaurant order in Supabase with atomic fallback.
 * Recalculates all pricing from raw cart data.
 * If Supabase is not configured, gracefully falls back to local demo mode.
 */
export const createOrder = async (payload: CreateOrderPayload): Promise<OrderResult> => {
  // 0. Rate limiting enforcement (5 orders / 60 seconds)
  const rateLimit = enforceRateLimit('order');
  if (!rateLimit.allowed) {
    return {
      success: false,
      orderRef: payload.order_ref || generateClientOrderRef(),
      error: rateLimit.error || 'Too many order attempts. Please wait a moment before trying again.',
    };
  }

  // 0b. Server-side / Edge Turnstile CAPTCHA and IP/Phone rate check
  const captchaVerification = await verifyTurnstileToken('order', payload.captcha_token, payload.customer_phone);
  if (!captchaVerification.success) {
    return {
      success: false,
      orderRef: payload.order_ref || generateClientOrderRef(),
      error: captchaVerification.error || 'Security verification failed.',
    };
  }

  // 1. Validation
  const validation = validateOrderPayload(payload);
  if (!validation.valid) {
    return {
      success: false,
      orderRef: payload.order_ref || generateClientOrderRef(),
      error: validation.error || 'Invalid order data.',
    };
  }

  // 1b. Menu Item Availability (86'd items) defense-in-depth check
  for (const item of payload.items) {
    const itemId = (item as any).item_id || item.id;
    if (itemId && !isItemAvailable(itemId)) {
      const itemName = (item as any).item_name || item.name || 'Selected item';
      return {
        success: false,
        orderRef: payload.order_ref || generateClientOrderRef(),
        error: `Item "${itemName}" is currently unavailable (sold out).`,
      };
    }
  }

  // 2. Financial calculation (never trust client-supplied totals)
  const totals = calculateOrderTotals(payload.items, payload.tax_options);
  if (totals.lineItems.length === 0 || totals.total <= 0) {
    return {
      success: false,
      orderRef: payload.order_ref || generateClientOrderRef(),
      error: 'Cannot process order with zero total.',
    };
  }

  const phoneValidation = validatePhoneNumber(payload.customer_phone);
  const normalizedPhone = phoneValidation.valid ? phoneValidation.normalized : payload.customer_phone.trim();
  const orderCurrency = payload.currency || 'INR';
  let orderRef = payload.order_ref?.trim() || generateClientOrderRef();

  const paymentRequired = payload.payment_required ?? false;
  const paymentStatus = payload.payment_status ?? (paymentRequired ? 'pending' : 'not_required');
  const paymentProvider = payload.payment_provider || null;
  const paymentReference = payload.payment_reference || null;
  const paymentAmount = payload.payment_amount ?? totals.total;

  // 3. Local / Demo mode handling (strictly restricted to DEV environment)
  if (!isSupabaseConfigured || !supabase) {
    const proc = (globalThis as any).process;
    const isDev = typeof import.meta !== 'undefined' && import.meta.env
      ? Boolean(import.meta.env.DEV)
      : (proc ? proc.env?.NODE_ENV !== 'production' : false);
    if (!isDev) {
      return {
        success: false,
        orderRef,
        error: 'Order system database connection is not configured.',
      };
    }
    console.info('[orderService] Supabase not configured. Operating in local demo mode with reference:', orderRef);

    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('cafe_demo_orders');
        const existing = raw ? JSON.parse(raw) : [];

        // Check if pending order already exists with same order_ref (payment retry)
        const existingIdx = existing.findIndex((o: any) => o.order_ref === orderRef);

        const demoOrder = {
          id: existingIdx !== -1 ? existing[existingIdx].id : `demo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          order_ref: orderRef,
          customer_name: payload.customer_name.trim(),
          customer_phone: normalizedPhone,
          order_type: payload.order_type,
          table_number: payload.order_type === 'dine_in' ? payload.table_number?.trim() || null : null,
          special_requests: payload.special_requests?.trim() || null,
          subtotal: totals.subtotal,
          total: totals.total,
          currency: orderCurrency,
          status: 'pending',
          source: payload.source || 'website',
          payment_required: paymentRequired,
          payment_status: paymentStatus,
          payment_provider: paymentProvider,
          payment_reference: paymentReference,
          payment_amount: paymentAmount,
          discount_code: payload.discount_code || null,
          discount_amount: payload.discount_amount || 0,
          marketing_consent: payload.marketing_consent ?? false,
          created_at: existingIdx !== -1 ? existing[existingIdx].created_at : new Date().toISOString(),
          updated_at: new Date().toISOString(),
          items: totals.lineItems.map((li, idx) => ({
            id: `item-${Date.now()}-${idx}`,
            menu_item_id: li.menu_item_id,
            item_name: li.item_name,
            quantity: li.quantity,
            unit_price: li.unit_price,
            line_total: li.line_total,
          })),
        };

        if (existingIdx !== -1) {
          existing[existingIdx] = demoOrder;
        } else {
          existing.unshift(demoOrder);
        }

        localStorage.setItem('cafe_demo_orders', JSON.stringify(existing.slice(0, 50)));

        // Sync customer directory in demo mode
        try {
          const custRaw = localStorage.getItem('cafe_demo_customers');
          const custs = custRaw ? JSON.parse(custRaw) : [];
          const existingCustIdx = custs.findIndex((c: any) => c.phone === normalizedPhone);
          const nowStr = new Date().toISOString();
          if (existingCustIdx >= 0) {
            custs[existingCustIdx].order_count += 1;
            custs[existingCustIdx].total_spent += totals.total;
            custs[existingCustIdx].last_order_at = nowStr;
            if (payload.marketing_consent !== undefined) {
              custs[existingCustIdx].marketing_consent = payload.marketing_consent;
            }
          } else {
            custs.unshift({
              id: `cust-${Date.now()}`,
              name: payload.customer_name.trim(),
              phone: normalizedPhone,
              email: null,
              marketing_consent: payload.marketing_consent ?? false,
              order_count: 1,
              total_spent: totals.total,
              last_order_at: nowStr,
              first_order_at: nowStr,
              created_at: nowStr,
              updated_at: nowStr,
            });
          }
          localStorage.setItem('cafe_demo_customers', JSON.stringify(custs));
        } catch { /* ignore */ }

        localStorage.setItem('cafe_latest_order_event', JSON.stringify({ event: 'created', order: demoOrder, ts: Date.now() }));
        window.dispatchEvent(new CustomEvent('cafe:order-created', { detail: demoOrder }));
      } catch (err) {
        console.warn('[orderService] Local order sync failed:', err);
      }
    }

    return {
      success: true,
      orderRef,
      paymentToken: `demo-token-${Date.now()}`,
      isDemoMode: true,
    };
  }

  // 4. Submission to Supabase with collision retry or existing order update
  const maxAttempts = 3;
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      const restaurantId = payload.restaurant_id || 'the-cafe-barrackpore';
      const isCounterPayment = payload.payment_provider === 'counter' || payload.payment_status === 'pay_at_counter';
      const { data: rpcData, error: rpcError } = await supabase.rpc('create_order_atomic', {
        p_order: {
          order_ref: orderRef,
          restaurant_id: restaurantId,
          customer_name: payload.customer_name.trim(),
          customer_phone: normalizedPhone,
          order_type: payload.order_type,
          table_number: payload.order_type === 'dine_in' ? payload.table_number?.trim() : null,
          special_requests: payload.special_requests?.trim() || null,
          source: payload.source || 'website',
          currency: orderCurrency,
          payment_method: isCounterPayment ? 'counter' : 'online',
          payment_provider: paymentProvider,
          payment_reference: paymentReference,
        },
        p_items: payload.items.map((it: any) => ({
          id: (it as any).menu_item_id || it.id,
          quantity: it.quantity || 1,
          selected_options: (it as any).selected_options || {},
        })),
      });

      if (!rpcError && rpcData?.order_id) {
        return {
          success: true,
          orderId: rpcData.order_id,
          orderRef: rpcData.order_ref || orderRef,
          paymentToken: rpcData.payment_token || undefined,
        };
      }

      // Check for unique constraint violation on order_ref (PostgreSQL 23505)
      if (rpcError && rpcError.code === '23505') {
        orderRef = generateClientOrderRef();
        continue;
      }

      if (rpcError) {
        return {
          success: false,
          orderRef,
          error: rpcError.message || 'Failed to submit order.',
        };
      }
    } catch (err: unknown) {
      if (attempt >= maxAttempts) {
        console.error('[orderService] Supabase order submission error:', err);
        return {
          success: false,
          orderRef,
          error: 'Online order registration encountered a network issue. You can still confirm via WhatsApp.',
        };
      }
    }
  }

  return {
    success: false,
    orderRef,
    error: 'Could not register order with backend. You can still confirm via WhatsApp.',
  };
};

/**
 * Reuses or updates an existing pending order (e.g. on payment retry)
 */
export const updatePendingOrder = async (
  orderRef: string,
  updates: Partial<CreateOrderPayload>
): Promise<OrderResult> => {
  if (!orderRef) {
    return { success: false, orderRef: '', error: 'Missing order reference.' };
  }

  if (isSupabaseConfigured && supabase) {
    try {
      // Client code may NEVER set payment_status to 'paid'. Only verified webhook (service role) can do so.
      const updatePayload: Record<string, any> = {
        payment_provider: updates.payment_provider,
        payment_reference: updates.payment_reference,
        updated_at: new Date().toISOString(),
      };
      if (updates.payment_status && updates.payment_status !== 'paid') {
        updatePayload.payment_status = updates.payment_status;
      }

      const { data, error } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('order_ref', orderRef)
        .select('id, order_ref')
        .single();

      if (error) throw error;
      return { success: true, orderId: data?.id, orderRef };
    } catch (err: any) {
      console.warn('[orderService] Error updating pending order:', err);
      return { success: false, orderRef, error: err.message };
    }
  }

  // Demo fallback
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('cafe_demo_orders');
      if (raw) {
        const orders = JSON.parse(raw);
        const idx = orders.findIndex((o: any) => o.order_ref === orderRef);
        if (idx !== -1) {
          orders[idx] = { ...orders[idx], ...updates, updated_at: new Date().toISOString() };
          localStorage.setItem('cafe_demo_orders', JSON.stringify(orders));
        }
      }
    } catch (e) {
      console.warn('[orderService] Local update pending order failed:', e);
    }
  }

  return { success: true, orderRef };
};

