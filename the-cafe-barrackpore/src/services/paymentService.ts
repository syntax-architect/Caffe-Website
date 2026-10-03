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
import { getCanonicalMenuItem } from './menuService';
import { getLocalAvailabilityMap, fetchAvailabilityMap } from './menuAvailabilityService';
import type { PaymentProviderAdapter } from './payments/types';
import { StripeAdapter } from './payments/stripeAdapter';
import { RazorpayAdapter } from './payments/razorpayAdapter';
import { DemoAdapter } from './payments/demoAdapter';

const proc = (globalThis as any).process;
const isDev = typeof import.meta !== 'undefined' && import.meta.env
  ? Boolean(import.meta.env.DEV)
  : (proc ? proc.env?.NODE_ENV !== 'production' : false);

/**
 * Payment Provider Registry
 * Demo / simulated adapters are strictly omitted from production builds (Requirement 6).
 */
const providers: Record<string, PaymentProviderAdapter> = {
  stripe: new StripeAdapter(),
  razorpay: new RazorpayAdapter(),
  ...(isDev ? { demo: new DemoAdapter(), manual: new DemoAdapter() } : {}),
};

export const getPaymentProvider = (providerName: PaymentProvider = 'stripe'): PaymentProviderAdapter => {
  if ((providerName === 'demo' || providerName === 'manual') && !isDev) {
    throw new Error('Demo payment provider is strictly disabled in production builds.');
  }
  const provider = providers[providerName];
  if (!provider) {
    if (providerName === 'demo' || providerName === 'manual') {
      if (isDev) return new DemoAdapter();
      throw new Error('Demo payment provider is strictly disabled in production builds.');
    }
    return providers.stripe || providers.razorpay;
  }
  return provider;
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
    const canonical = await getCanonicalMenuItem(rawId || rawName);

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
  const proc = (globalThis as any).process;
  const isDev = typeof import.meta !== 'undefined' && import.meta.env
    ? Boolean(import.meta.env.DEV)
    : (proc ? proc.env?.NODE_ENV !== 'production' : false);
  if (!isDev || typeof window === 'undefined') return;
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

  if (!isSupabaseConfigured || !supabase) {
    saveDemoPayment(paymentRecord);
  } else {
    // Requirement 4: Browser never directly writes to payments table; only server/webhook does.
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

  // In offline local demo mode (development only, when Supabase is not configured)
  if (!isSupabaseConfigured && providerName === 'demo') {
    if (verifyResult.success && verifyResult.paid) {
      await updateOrderAndPaymentStatus(
        params.orderRef,
        'paid',
        params.providerPaymentId,
        providerName
      );
    }
  } else if (!verifyResult.paid) {
    await updateOrderAndPaymentStatus(
      params.orderRef,
      'failed',
      params.providerPaymentId,
      providerName,
      verifyResult.error || 'Payment verification failed'
    );
  }
  // NOTE: For live providers (Stripe, Razorpay) with Supabase, client code NEVER
  // marks the order as 'paid'. That is strictly handled server-side by the payment webhook
  // using the service-role key.

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
  // CLIENT SECURITY ENFORCEMENT:
  // Client code may NEVER set payment_status to 'paid' in Supabase.
  // Only the verified webhook (service role) is permitted to mark an order as paid.
  if (status === 'paid' && isSupabaseConfigured && supabase) {
    console.info(
      `[paymentService] Client-side 'paid' status mutation skipped for ${orderRef}. Authoritative reconciliation is handled exclusively by verified webhook.`
    );
    return { success: true };
  }

  const paidAt = status === 'paid' ? new Date().toISOString() : null;

  if (isSupabaseConfigured && supabase) {
    // Requirement 4: Remove all browser writes to payments and orders from paymentService.ts and orderService.ts;
    // only the payment-webhook (service role) may write them.
    console.info(
      `[paymentService] Browser write to orders/payments skipped for ${orderRef}. Status updates are handled exclusively by verified payment webhook.`
    );
    return { success: true };
  }

  // Local / Demo Mode Update (strictly restricted to DEV environment)
  const proc = (globalThis as any).process;
  const isDev = typeof import.meta !== 'undefined' && import.meta.env
    ? Boolean(import.meta.env.DEV)
    : (proc ? proc.env?.NODE_ENV !== 'production' : false);
  if (!isDev) {
    return { success: false, error: 'Database is not configured and demo mode is disabled in production.' };
  }

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
        demoPayments[pIdx].provider = providerName;
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
 * Enforces staff authentication and delegates to process-refund Edge Function.
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

    try {
      const { data, error } = await supabase.functions.invoke('process-refund', {
        body: { order_ref: orderRef, amount, reason },
      });

      if (error) {
        return { success: false, error: error.message || 'Refund invocation failed.' };
      }

      if (data && !data.success) {
        return { success: false, error: data.error || 'Refund rejected by server.' };
      }

      return {
        success: true,
        refundId: data?.refundId || `ref_${Date.now()}`,
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Exception during refund invocation.' };
    }
  }

  // Local / dev fallback
  if (!isDev) {
    return { success: false, error: 'Refunds require backend connection in production.' };
  }

  const effectiveReason = reason || (amount ? `Staff initiated refund of ${amount}` : 'Staff initiated refund');
  await updateOrderAndPaymentStatus(
    orderRef,
    'refunded',
    undefined,
    'demo',
    effectiveReason
  );

  return {
    success: true,
    refundId: `ref_demo_${Date.now()}`,
  };
};

export interface PaymentHealthStatus {
  activeProvider: string;
  paymentsEnabled: boolean;
  allowPayAtCounter: boolean;
  statusText: 'Connected' | 'Not connected';
  isConnected: boolean;
  providers: {
    razorpay: {
      connected: boolean;
      hasKeyId: boolean;
      hasKeySecret: boolean;
      hasWebhookSecret: boolean;
    };
    stripe: {
      connected: boolean;
      hasSecretKey: boolean;
      hasWebhookSecret: boolean;
    };
  };
}

/**
 * Health check: queries payment-health-check Edge Function.
 * NEVER returns secret values, only boolean connection flags.
 */
export const checkPaymentHealth = async (): Promise<PaymentHealthStatus> => {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.functions.invoke('payment-health-check');
      if (!error && data && data.success) {
        return data;
      }
    } catch (err) {
      console.warn('[paymentService] Health check failed, using fallback:', err);
    }
  }

  return {
    activeProvider: isDev ? 'demo' : 'none',
    paymentsEnabled: false,
    allowPayAtCounter: true,
    statusText: 'Not connected',
    isConnected: false,
    providers: {
      razorpay: { connected: false, hasKeyId: false, hasKeySecret: false, hasWebhookSecret: false },
      stripe: { connected: false, hasSecretKey: false, hasWebhookSecret: false },
    },
  };
};

/**
 * Initiates a test payment transaction to verify end-to-end gateway configuration.
 */
export const sendTestPayment = async (
  provider: PaymentProvider = 'stripe',
  amount = 100,
  currency = 'INR'
): Promise<{ success: boolean; orderRef?: string; message?: string; error?: string }> => {
  const testRef = `TEST-${Date.now().toString(36).toUpperCase()}`;

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('create_order_atomic', {
        p_order: {
          order_ref: testRef,
          customer_name: 'Test Payment Simulator',
          customer_phone: '+919999999999',
          order_type: 'dine_in',
          table_number: '99',
          special_requests: 'Simulated test transaction from staff settings',
          currency: currency.toUpperCase(),
          source: 'website',
          payment_method: 'online',
          payment_provider: provider,
          payment_amount: amount,
        },
        p_items: [],
      });

      if (rpcError) {
        return { success: false, error: `Could not create test order: ${rpcError.message}` };
      }

      const { data: createData, error: createErr } = await supabase.functions.invoke('create-payment', {
        body: {
          order_ref: testRef,
          payment_token: rpcData?.payment_token,
        },
      });

      if (createErr) {
        return { success: false, error: `create-payment edge function error: ${createErr.message}` };
      }

      return {
        success: true,
        orderRef: testRef,
        message: `Test payment initiated successfully for ${provider.toUpperCase()}.${createData?.paymentId || createData?.orderId ? ` Ref: ${createData?.paymentId || createData?.orderId}` : ''}`,
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Test payment failed.' };
    }
  }

  return {
    success: true,
    orderRef: testRef,
    message: `Test payment simulation completed for ${provider}.`,
  };
};

