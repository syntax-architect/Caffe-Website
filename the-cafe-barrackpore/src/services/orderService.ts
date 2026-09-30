import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { CreateOrderPayload, OrderResult } from '../types/order';
import { calculateOrderTotals, generateClientOrderRef } from '../utils/orderCalculations';

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

  const cleanPhone = payload.customer_phone?.replace(/\D/g, '') || '';
  if (!cleanPhone || cleanPhone.length < 10) {
    return { valid: false, error: 'Please provide a valid 10-digit phone number.' };
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

  return { valid: true };
};

/**
 * Creates a restaurant order in Supabase with atomic fallback.
 * Recalculates all pricing from raw cart data.
 * If Supabase is not configured, gracefully falls back to local demo mode.
 */
export const createOrder = async (payload: CreateOrderPayload): Promise<OrderResult> => {
  // 1. Validation
  const validation = validateOrderPayload(payload);
  if (!validation.valid) {
    return {
      success: false,
      orderRef: payload.order_ref || generateClientOrderRef(),
      error: validation.error || 'Invalid order data.',
    };
  }

  // 2. Financial calculation (never trust client-supplied totals)
  const totals = calculateOrderTotals(payload.items);
  if (totals.lineItems.length === 0 || totals.total <= 0) {
    return {
      success: false,
      orderRef: payload.order_ref || generateClientOrderRef(),
      error: 'Cannot process order with zero total.',
    };
  }

  const cleanPhone = payload.customer_phone.replace(/\D/g, '');
  let orderRef = payload.order_ref?.trim() || generateClientOrderRef();

  // 3. Local / Demo mode handling
  if (!isSupabaseConfigured || !supabase) {
    const isDev = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.DEV : true;
    if (isDev) {
      console.info('[orderService] Supabase not configured. Operating in local demo mode with reference:', orderRef);
    }

    if (typeof window !== 'undefined') {
      try {
        const demoOrder = {
          id: `demo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          order_ref: orderRef,
          customer_name: payload.customer_name.trim(),
          customer_phone: cleanPhone,
          order_type: payload.order_type,
          table_number: payload.order_type === 'dine_in' ? payload.table_number?.trim() || null : null,
          special_requests: payload.special_requests?.trim() || null,
          subtotal: totals.subtotal,
          total: totals.total,
          status: 'pending',
          source: payload.source || 'website',
          created_at: new Date().toISOString(),
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
        const raw = localStorage.getItem('cafe_demo_orders');
        const existing = raw ? JSON.parse(raw) : [];
        existing.unshift(demoOrder);
        localStorage.setItem('cafe_demo_orders', JSON.stringify(existing.slice(0, 50)));
        localStorage.setItem('cafe_latest_order_event', JSON.stringify({ event: 'created', order: demoOrder, ts: Date.now() }));
        window.dispatchEvent(new CustomEvent('cafe:order-created', { detail: demoOrder }));
      } catch (err) {
        console.warn('[orderService] Local order sync failed:', err);
      }
    }

    return {
      success: true,
      orderRef,
      isDemoMode: true,
    };
  }

  // 4. Submission to Supabase with collision retry
  const maxAttempts = 3;
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      // Attempt 1: Use atomic RPC function
      const { data: rpcData, error: rpcError } = await supabase.rpc('create_order_atomic', {
        p_order: {
          order_ref: orderRef,
          customer_name: payload.customer_name.trim(),
          customer_phone: cleanPhone,
          order_type: payload.order_type,
          table_number: payload.order_type === 'dine_in' ? payload.table_number?.trim() : null,
          special_requests: payload.special_requests?.trim() || null,
          subtotal: totals.subtotal,
          total: totals.total,
          status: 'pending',
          source: payload.source || 'website',
        },
        p_items: totals.lineItems,
      });

      if (!rpcError && rpcData?.order_id) {
        return {
          success: true,
          orderId: rpcData.order_id,
          orderRef: rpcData.order_ref || orderRef,
        };
      }

      // Check for unique constraint violation on order_ref (PostgreSQL 23505)
      if (rpcError && rpcError.code === '23505') {
        orderRef = generateClientOrderRef();
        continue;
      }

      // Attempt 2: Direct relational insert fallback (if RPC is not yet applied)
      const { data: orderData, error: orderInsertError } = await supabase
        .from('orders')
        .insert({
          order_ref: orderRef,
          customer_name: payload.customer_name.trim(),
          customer_phone: cleanPhone,
          order_type: payload.order_type,
          table_number: payload.order_type === 'dine_in' ? payload.table_number?.trim() : null,
          special_requests: payload.special_requests?.trim() || null,
          subtotal: totals.subtotal,
          total: totals.total,
          status: 'pending',
          source: payload.source || 'website',
        })
        .select('id, order_ref')
        .single();

      if (orderInsertError) {
        if (orderInsertError.code === '23505') {
          orderRef = generateClientOrderRef();
          continue;
        }
        throw orderInsertError;
      }

      const orderId = orderData.id;

      // Insert line items
      const itemsToInsert = totals.lineItems.map((item) => ({
        order_id: orderId,
        menu_item_id: item.menu_item_id,
        item_name: item.item_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.line_total,
      }));

      const { error: itemsInsertError } = await supabase.from('order_items').insert(itemsToInsert);

      if (itemsInsertError) {
        console.error('[orderService] Failed to insert order line items:', itemsInsertError);
        // Note: order record exists; line items failed
      }

      return {
        success: true,
        orderId,
        orderRef: orderData.order_ref,
      };
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
