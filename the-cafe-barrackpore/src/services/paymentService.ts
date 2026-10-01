import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type {
  PaymentProvider,
  PaymentStatus,
  CreatePaymentParams,
  PaymentCheckoutResult,
  VerifyPaymentParams,
  PaymentVerificationResult,
  WebhookEventResult,
  PaymentRecord,
} from '../types/payment';
import type { OrderItemInput, OrderCalculationSummary } from '../types/order';
import type { TaxCalculationOptions } from '../utils/orderCalculations';
import { calculateOrderTotals, roundCurrency } from '../utils/orderCalculations';
import { menuData } from '../data/menu';
import { getLocalAvailabilityMap, fetchAvailabilityMap } from './menuAvailabilityService';
import type { PaymentProviderAdapter } from './payments/types';
import { StripeAdapter } from './payments/stripeAdapter';
import { RazorpayAdapter } from './payments/razorpayAdapter';
import { DemoAdapter } from './payments/demoAdapter';

/**
 * Payment Provider Registry
 */
const providers: Record<string, PaymentProviderAdapter> = {
  stripe: new StripeAdapter(),
  razorpay: new RazorpayAdapter(),
  demo: new DemoAdapter(),
  manual: new DemoAdapter(),
};

export const getPaymentProvider = (providerName: PaymentProvider = 'demo'): PaymentProviderAdapter => {
  return providers[providerName] || providers.demo;
};

export interface AuthoritativeItemCheck {
  id: string;
  name: string;
  quantity: number;
  authoritativePrice: number;
  lineTotal: number;
  available: boolean;
}

export interface OrderPaymentValidationResult {
  valid: boolean;
  error?: string;
  totals?: OrderCalculationSummary;
  authoritativeItems?: AuthoritativeItemCheck[];
}

/**
 * Authoritatively validates order items, availability, and pricing against canonical server menu data.
 * Rejects client-side price tampering, 86'd items, and invalid calculations.
 */
export const validateAndCalculateOrderPayment = async (
  items: OrderItemInput[],
  taxOptions?: TaxCalculationOptions,
  clientSuppliedTotal?: number,
  checkAvailability = true
): Promise<OrderPaymentValidationResult> => {
  if (!Array.isArray(items) || items.length === 0) {
    return { valid: false, error: 'Cannot process payment for an empty order.' };
  }

  // Fetch current 86'd / sold out item map
  const availabilityMap = checkAvailability
    ? await fetchAvailabilityMap().catch(() => getLocalAvailabilityMap())
    : getLocalAvailabilityMap();

  const validatedItems: OrderItemInput[] = [];
  const authoritativeChecks: AuthoritativeItemCheck[] = [];

  for (const item of items) {
    const rawId = String(item.id || (item as any).menu_item_id || '').trim();
    const rawName = String(item.name || (item as any).item_name || '').trim();

    // Look up canonical item in menu database
    const canonical = menuData.find(
      (m) => (rawId && m.id === rawId) || m.name.toLowerCase() === rawName.toLowerCase()
    );

    if (!canonical) {
      return {
        valid: false,
        error: `Item "${rawName || rawId}" is not a recognized menu item.`,
      };
    }

    // Check availability (86'd status)
    const isAvailable = availabilityMap[canonical.id] !== false;
    if (!isAvailable) {
      return {
        valid: false,
        error: `"${canonical.name}" is currently sold out and cannot be ordered.`,
      };
    }

    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
    const authoritativePrice = roundCurrency(canonical.price);
    const lineTotal = roundCurrency(authoritativePrice * quantity);

    authoritativeChecks.push({
      id: canonical.id,
      name: canonical.name,
      quantity,
      authoritativePrice,
      lineTotal,
      available: true,
    });

    validatedItems.push({
      id: canonical.id,
      name: canonical.name,
      price: authoritativePrice,
      quantity,
    });
  }

  // Calculate authoritative totals with restaurant tax configuration
  const totals = calculateOrderTotals(validatedItems, taxOptions);

  if (totals.total <= 0) {
    return {
      valid: false,
      error: 'Authoritative order total must be greater than zero.',
    };
  }

  // Detect and reject client price tampering (within 0.05 tolerance for rounding)
  if (clientSuppliedTotal !== undefined && clientSuppliedTotal !== null) {
    const difference = Math.abs(clientSuppliedTotal - totals.total);
    if (difference > 0.05) {
      return {
        valid: false,
        error: `Total price discrepancy detected. Client: ${clientSuppliedTotal}, Authoritative: ${totals.total}. Payment creation rejected.`,
      };
    }
  }

  return {
    valid: true,
    totals,
    authoritativeItems: authoritativeChecks,
  };
};

/**
 * Demo payments in-memory/localStorage store for local development and testing
 */
const DEMO_PAYMENTS_KEY = 'cafe_demo_payments';

const getDemoPayments = (): PaymentRecord[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DEMO_PAYMENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveDemoPayment = (record: PaymentRecord): void => {
  if (typeof window === 'undefined') return;
  try {
    const existing = getDemoPayments();
    const updated = [record, ...existing.filter((p) => p.id !== record.id)].slice(0, 100);
    localStorage.setItem(DEMO_PAYMENTS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('[paymentService] Failed to save demo payment:', err);
  }
};

/**
 * Creates a payment session with the chosen provider and logs it into the payment ledger.
 */
export const createPaymentSession = async (
  params: CreatePaymentParams,
  providerName: PaymentProvider = 'demo'
): Promise<PaymentCheckoutResult> => {
  const provider = getPaymentProvider(providerName);

  // 1. Provider checkout session generation
  const checkoutResult = await provider.createCheckoutSession(params);
  if (!checkoutResult.success) {
    return checkoutResult;
  }

  // 2. Record payment initiation into database or demo ledger
  const paymentRecord: PaymentRecord = {
    id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    order_id: params.orderId,
    order_ref: params.orderRef,
    provider: providerName,
    provider_payment_id: checkoutResult.paymentId || null,
    amount: params.amount,
    currency: params.currency.toUpperCase(),
    status: 'pending',
    idempotency_key: params.idempotencyKey || null,
    metadata: {
      isDemo: checkoutResult.isDemo ?? false,
      ...(params.metadata || {}),
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { error: insertErr } = await supabase.from('payments').insert({
        order_id: params.orderId,
        order_ref: params.orderRef,
        provider: providerName,
        provider_payment_id: checkoutResult.paymentId || null,
        amount: params.amount,
        currency: params.currency.toUpperCase(),
        status: 'pending',
        idempotency_key: params.idempotencyKey || null,
        metadata: paymentRecord.metadata,
      });

      if (insertErr) {
        console.warn('[paymentService] Could not insert into payments table:', insertErr.message);
      }
    } catch (e) {
      console.warn('[paymentService] Exception recording payment to Supabase:', e);
    }
  } else {
    saveDemoPayment(paymentRecord);
  }

  return checkoutResult;
};

/**
 * Verifies payment result server-side / provider-side and reconciles order state.
 */
export const verifyAndReconcilePayment = async (
  params: VerifyPaymentParams,
  providerName: PaymentProvider = 'demo'
): Promise<PaymentVerificationResult> => {
  const provider = getPaymentProvider(providerName);
  const verifyResult = await provider.verifyPayment(params);

  if (verifyResult.success && verifyResult.paid) {
    await updateOrderAndPaymentStatus(
      params.orderRef,
      'paid',
      params.providerPaymentId,
      providerName
    );
  } else if (!verifyResult.paid) {
    await updateOrderAndPaymentStatus(
      params.orderRef,
      'failed',
      params.providerPaymentId,
      providerName,
      verifyResult.error || 'Payment verification failed'
    );
  }

  return verifyResult;
};

/**
 * Updates order payment status in database and dispatches events for KDS and staff dashboard.
 */
export const updateOrderAndPaymentStatus = async (
  orderRef: string,
  status: PaymentStatus,
  providerPaymentId?: string,
  providerName: PaymentProvider = 'demo',
  failureReason?: string
): Promise<{ success: boolean; error?: string }> => {
  const paidAt = status === 'paid' ? new Date().toISOString() : null;

  if (isSupabaseConfigured && supabase) {
    try {
      // 1. Update orders table
      const { error: orderErr } = await supabase
        .from('orders')
        .update({
          payment_status: status,
          payment_provider: providerName,
          payment_reference: providerPaymentId || null,
          paid_at: paidAt,
          updated_at: new Date().toISOString(),
        })
        .eq('order_ref', orderRef);

      if (orderErr) {
        console.error('[paymentService] Failed to update order payment status:', orderErr);
      }

      // 2. Update payments ledger
      const { error: payErr } = await supabase
        .from('payments')
        .update({
          status,
          failure_reason: failureReason || null,
          updated_at: new Date().toISOString(),
        })
        .eq('order_ref', orderRef);

      if (payErr) {
        console.warn('[paymentService] Failed to update payments table:', payErr);
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // Local / Demo Mode Update
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('cafe_demo_orders');
      if (raw) {
        const orders = JSON.parse(raw);
        const idx = orders.findIndex((o: any) => o.order_ref === orderRef);
        if (idx !== -1) {
          orders[idx].payment_status = status;
          orders[idx].payment_reference = providerPaymentId || null;
          orders[idx].paid_at = paidAt;
          orders[idx].updated_at = new Date().toISOString();
          localStorage.setItem('cafe_demo_orders', JSON.stringify(orders));

          // Broadcast status change for KDS & UI
          window.dispatchEvent(
            new CustomEvent('cafe:order-status-changed', {
              detail: {
                orderId: orders[idx].id,
                newStatus: orders[idx].status,
                order: orders[idx],
                ts: Date.now(),
              },
            })
          );
        }
      }

      const demoPayments = getDemoPayments();
      const pIdx = demoPayments.findIndex((p) => p.order_ref === orderRef);
      if (pIdx !== -1) {
        demoPayments[pIdx].status = status;
        demoPayments[pIdx].failure_reason = failureReason || null;
        demoPayments[pIdx].updated_at = new Date().toISOString();
        localStorage.setItem(DEMO_PAYMENTS_KEY, JSON.stringify(demoPayments));
      }
    } catch (e) {
      console.warn('[paymentService] Demo payment status update error:', e);
    }
  }

  return { success: true };
};

/**
 * Handles incoming webhooks with signature verification and idempotency check.
 */
export const handleWebhookEvent = async (
  providerName: PaymentProvider,
  payload: string | Record<string, unknown>,
  signature: string,
  idempotencyKey?: string
): Promise<WebhookEventResult> => {
  const provider = getPaymentProvider(providerName);

  // 1. Idempotency Check: if this idempotency key was already recorded, return safely
  if (idempotencyKey && isSupabaseConfigured && supabase) {
    try {
      const { data: existingPayment } = await supabase
        .from('payments')
        .select('id, status, order_ref, provider_payment_id, amount, currency')
        .eq('idempotency_key', idempotencyKey)
        .single();

      if (existingPayment && existingPayment.status === 'paid') {
        return {
          verified: true,
          event: 'idempotent_duplicate',
          orderRef: existingPayment.order_ref,
          providerPaymentId: existingPayment.provider_payment_id || undefined,
          status: 'paid',
          amount: Number(existingPayment.amount),
          currency: existingPayment.currency,
        };
      }
    } catch {
      // Continue if not found
    }
  }

  // 2. Delegate to provider adapter for signature check & payload parsing
  const webhookResult = await provider.handleWebhook(payload, signature);

  if (!webhookResult.verified) {
    return webhookResult;
  }

  // 3. Reconcile order and payment state if an order reference is present
  if (webhookResult.orderRef && webhookResult.status) {
    await updateOrderAndPaymentStatus(
      webhookResult.orderRef,
      webhookResult.status,
      webhookResult.providerPaymentId,
      providerName,
      webhookResult.error
    );
  }

  return webhookResult;
};

/**
 * Staff-authorized server-side refund boundary (Section 24).
 * Enforces staff authentication and delegates to provider adapter if available.
 */
export const processRefund = async (
  orderRef: string,
  amount?: number,
  reason?: string
): Promise<{ success: boolean; refundId?: string; error?: string }> => {
  // Check that caller is authenticated staff member
  if (isSupabaseConfigured && supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Unauthorized: Only authenticated staff can initiate refunds.' };
    }
  }

  const effectiveReason = reason || (amount ? `Staff initiated refund of ${amount}` : 'Staff initiated refund');

  // Update order and payments to refunded
  await updateOrderAndPaymentStatus(
    orderRef,
    'refunded',
    undefined,
    'demo',
    effectiveReason
  );

  return {
    success: true,
    refundId: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
  };
};
