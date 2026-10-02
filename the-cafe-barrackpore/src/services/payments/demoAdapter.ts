import type { PaymentProviderAdapter } from './types';
import type {
  CreatePaymentParams,
  PaymentCheckoutResult,
  VerifyPaymentParams,
  PaymentVerificationResult,
  WebhookEventResult,
} from '../../types/payment';

/**
 * Demo Payment Adapter (Simulation Only)
 * Used when running in development/demo mode without live provider credentials.
 * Explicitly marks all records as demo/simulated to prevent confusion with real financial transactions.
 */
export class DemoAdapter implements PaymentProviderAdapter {
  readonly provider = 'demo' as const;
  readonly isConfigured = true;

  async createCheckoutSession(params: CreatePaymentParams): Promise<PaymentCheckoutResult> {
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
        error: 'Demo payment mode is strictly disabled in production.',
      };
    }

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

    const demoId = `demo_sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    return {
      success: true,
      provider: this.provider,
      paymentId: demoId,
      orderRef: params.orderRef,
      amount: params.amount,
      currency: params.currency.toUpperCase(),
      isDemo: true,
      checkoutUrl: `/payment/demo?order=${encodeURIComponent(params.orderRef)}&id=${demoId}`,
    };
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<PaymentVerificationResult> {
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
        error: 'Missing demo payment ID.',
      };
    }

    // Allow simulating failure by passing a specific ID containing 'fail'
    const shouldFail = params.providerPaymentId.toLowerCase().includes('fail');

    return {
      success: true,
      paid: !shouldFail,
      provider: this.provider,
      providerPaymentId: params.providerPaymentId,
      orderRef: params.orderRef,
      amount: Number(params.metadata?.amount) || 0,
      currency: String(params.metadata?.currency || 'INR'),
      status: shouldFail ? 'failed' : 'paid',
      error: shouldFail ? 'Simulated payment failure (Demo mode)' : undefined,
    };
  }

  async handleWebhook(
    payload: string | Record<string, unknown>,
    signature: string
  ): Promise<WebhookEventResult> {
    if (!signature || signature !== 'demo_signature') {
      return {
        verified: false,
        error: 'Invalid demo webhook signature.',
      };
    }

    const event = typeof payload === 'string' ? JSON.parse(payload) : payload;
    return {
      verified: true,
      event: 'demo.payment_completed',
      orderRef: String(event.orderRef || event.order_ref || ''),
      providerPaymentId: String(event.paymentId || event.payment_id || `demo_${Date.now()}`),
      amount: Number(event.amount) || 0,
      currency: String(event.currency || 'INR'),
      status: event.status === 'failed' ? 'failed' : 'paid',
    };
  }
}
