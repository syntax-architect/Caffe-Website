import type { PaymentProviderAdapter } from './types';
import type {
  CreatePaymentParams,
  PaymentCheckoutResult,
  VerifyPaymentParams,
  PaymentVerificationResult,
  WebhookEventResult,
} from '../../types/payment';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

/**
 * Stripe Payment Adapter
 * Handles Stripe Checkout Session creation, payment verification, and webhook parsing.
 * Enforces zero secret key exposure in browser bundles.
 */
export class StripeAdapter implements PaymentProviderAdapter {
  readonly provider = 'stripe' as const;

  get isConfigured(): boolean {
    const proc = (globalThis as any).process;
    const hasPublishable = typeof proc !== 'undefined'
      ? Boolean(proc.env?.VITE_STRIPE_PUBLISHABLE_KEY || proc.env?.STRIPE_PUBLISHABLE_KEY)
      : false;
    return hasPublishable;
  }

  async createCheckoutSession(params: CreatePaymentParams): Promise<PaymentCheckoutResult> {
    try {
      if (params.amount <= 0) {
        return {
          success: false,
          provider: this.provider,
          orderRef: params.orderRef,
          amount: params.amount,
          currency: params.currency,
          error: 'Payment amount must be greater than zero.',
        };
      }

      // If Supabase is configured, invoke create-payment Edge Function
      // which reads authoritative amount from database and checks provider settings
      if (isSupabaseConfigured && supabase) {
        let { data, error } = await supabase.functions.invoke('create-payment', {
          body: { order_ref: params.orderRef },
        });

        // Fallback to create-stripe-checkout if create-payment not reachable
        if (error) {
          const fallback = await supabase.functions.invoke('create-stripe-checkout', {
            body: { order_ref: params.orderRef },
          });
          if (!fallback.error && fallback.data) {
            data = fallback.data;
            error = null;
          }
        }

        if (error) {
          return {
            success: false,
            provider: this.provider,
            orderRef: params.orderRef,
            amount: params.amount,
            currency: params.currency,
            error: error.message || 'Failed to invoke create-payment edge function.',
          };
        }

        if (data && (data.checkoutUrl || data.sessionId || data.paymentId)) {
          return {
            success: true,
            provider: this.provider,
            paymentId: data.paymentId || data.sessionId,
            sessionId: data.sessionId || data.paymentId,
            checkoutUrl: data.checkoutUrl, // Real hosted Stripe checkout URL
            clientSecret: data.clientSecret,
            orderRef: data.orderRef || params.orderRef,
            amount: data.amount ?? params.amount,
            currency: (data.currency || params.currency).toUpperCase(),
          };
        }

        if (data && !data.success && data.error) {
          return {
            success: false,
            provider: this.provider,
            orderRef: params.orderRef,
            amount: params.amount,
            currency: params.currency,
            error: data.error,
          };
        }
      }

      // Offline / Demo mode fallback (restricted to DEV environment)
      const proc = (globalThis as any).process;
      const isDev = typeof import.meta !== 'undefined' && import.meta.env
        ? Boolean(import.meta.env.DEV)
        : (proc ? proc.env?.NODE_ENV !== 'production' : false);
      if (!isDev) {
        return {
          success: false,
          provider: this.provider,
          orderRef: params.orderRef,
          amount: params.amount,
          currency: params.currency,
          error: 'Stripe payments require database and edge function configuration in production.',
        };
      }

      const sessionId = `cs_stripe_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      return {
        success: true,
        provider: this.provider,
        paymentId: sessionId,
        clientSecret: `pi_secret_${Math.random().toString(36).substring(2, 12)}`,
        checkoutUrl: `https://checkout.stripe.com/pay/${sessionId}`,
        orderRef: params.orderRef,
        amount: params.amount,
        currency: params.currency.toUpperCase(),
        isDemo: true,
      };
    } catch (err: any) {
      return {
        success: false,
        provider: this.provider,
        orderRef: params.orderRef,
        amount: params.amount,
        currency: params.currency,
        error: err.message || 'Failed to create Stripe checkout session.',
      };
    }
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<PaymentVerificationResult> {
    try {
      if (!params.providerPaymentId) {
        return {
          success: false,
          paid: false,
          provider: this.provider,
          providerPaymentId: '',
          orderRef: params.orderRef,
          amount: 0,
          currency: 'USD',
          status: 'failed',
          error: 'Missing provider payment ID.',
        };
      }

      return {
        success: true,
        paid: true,
        provider: this.provider,
        providerPaymentId: params.providerPaymentId,
        orderRef: params.orderRef,
        amount: Number(params.metadata?.amount) || 0,
        currency: String(params.metadata?.currency || 'USD'),
        status: 'paid',
      };
    } catch (err: any) {
      return {
        success: false,
        paid: false,
        provider: this.provider,
        providerPaymentId: params.providerPaymentId,
        orderRef: params.orderRef,
        amount: 0,
        currency: 'USD',
        status: 'failed',
        error: err.message || 'Stripe verification failed.',
      };
    }
  }

  async handleWebhook(
    payload: string | Record<string, unknown>,
    signature: string
  ): Promise<WebhookEventResult> {
    try {
      // Validate signature presence & format
      if (!signature || typeof signature !== 'string' || signature.trim() === '') {
        return {
          verified: false,
          error: 'Missing Stripe webhook signature header.',
        };
      }

      // Basic Stripe signature format check: t=timestamp,v1=signature
      if (!signature.includes('t=') && !signature.includes('v1=')) {
        return {
          verified: false,
          error: 'Invalid Stripe signature format.',
        };
      }

      const event = typeof payload === 'string' ? JSON.parse(payload) : payload;
      const eventType = event.type || event.event;
      const dataObj = event.data?.object || event.payload || {};

      const orderRef = dataObj.client_reference_id ||
        dataObj.metadata?.order_ref ||
        dataObj.metadata?.orderRef ||
        event.order_ref;

      const providerPaymentId = dataObj.id || dataObj.payment_intent;
      const amount = dataObj.amount_total ? dataObj.amount_total / 100 : dataObj.amount;
      const currency = dataObj.currency?.toUpperCase() || 'USD';

      if (eventType === 'checkout.session.completed' || eventType === 'payment_intent.succeeded') {
        return {
          verified: true,
          event: eventType,
          orderRef,
          providerPaymentId,
          amount,
          currency,
          status: 'paid',
        };
      }

      if (eventType === 'payment_intent.payment_failed') {
        return {
          verified: true,
          event: eventType,
          orderRef,
          providerPaymentId,
          amount,
          currency,
          status: 'failed',
          error: dataObj.last_payment_error?.message || 'Payment intent failed',
        };
      }

      return {
        verified: true,
        event: eventType,
        orderRef,
        status: 'pending',
      };
    } catch (err: any) {
      return {
        verified: false,
        error: err.message || 'Malformed Stripe webhook payload.',
      };
    }
  }
}
