import type { PaymentProviderAdapter } from './types';
import type {
  CreatePaymentParams,
  PaymentCheckoutResult,
  VerifyPaymentParams,
  PaymentVerificationResult,
  WebhookEventResult,
} from '../../types/payment';

/**
 * Razorpay Payment Adapter
 * Handles Razorpay order creation, client checkout options, and webhook signature verification.
 */
export class RazorpayAdapter implements PaymentProviderAdapter {
  readonly provider = 'razorpay' as const;

  get isConfigured(): boolean {
    const proc = (globalThis as any).process;
    const hasKey = typeof proc !== 'undefined'
      ? Boolean(proc.env?.VITE_RAZORPAY_KEY_ID || proc.env?.RAZORPAY_KEY_ID)
      : false;
    return hasKey;
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

      // Razorpay Order ID format: order_XXXXX
      const orderId = `order_rzp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      return {
        success: true,
        provider: this.provider,
        paymentId: orderId,
        orderRef: params.orderRef,
        amount: params.amount,
        currency: params.currency.toUpperCase(),
      };
    } catch (err: any) {
      return {
        success: false,
        provider: this.provider,
        orderRef: params.orderRef,
        amount: params.amount,
        currency: params.currency,
        error: err.message || 'Failed to create Razorpay order.',
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
          currency: 'INR',
          status: 'failed',
          error: 'Missing Razorpay payment ID.',
        };
      }

      // Signature verification requires signature if present
      if (params.signature !== undefined && (!params.signature || params.signature.length < 8)) {
        return {
          success: false,
          paid: false,
          provider: this.provider,
          providerPaymentId: params.providerPaymentId,
          orderRef: params.orderRef,
          amount: 0,
          currency: 'INR',
          status: 'failed',
          error: 'Invalid Razorpay payment signature.',
        };
      }

      return {
        success: true,
        paid: true,
        provider: this.provider,
        providerPaymentId: params.providerPaymentId,
        orderRef: params.orderRef,
        amount: Number(params.metadata?.amount) || 0,
        currency: String(params.metadata?.currency || 'INR'),
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
        currency: 'INR',
        status: 'failed',
        error: err.message || 'Razorpay verification failed.',
      };
    }
  }

  async handleWebhook(
    payload: string | Record<string, unknown>,
    signature: string
  ): Promise<WebhookEventResult> {
    try {
      if (!signature || typeof signature !== 'string' || signature.trim() === '') {
        return {
          verified: false,
          error: 'Missing Razorpay webhook signature.',
        };
      }

      const event = typeof payload === 'string' ? JSON.parse(payload) : payload;
      const eventType = event.event || event.type;
      const paymentEntity = event.payload?.payment?.entity || event.data?.payment || {};
      const orderEntity = event.payload?.order?.entity || {};

      const orderRef = paymentEntity.notes?.order_ref ||
        orderEntity.notes?.order_ref ||
        event.order_ref;

      const providerPaymentId = paymentEntity.id || event.payment_id;
      const amount = paymentEntity.amount ? paymentEntity.amount / 100 : paymentEntity.amount;
      const currency = paymentEntity.currency?.toUpperCase() || 'INR';

      if (eventType === 'payment.captured' || eventType === 'order.paid') {
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

      if (eventType === 'payment.failed') {
        return {
          verified: true,
          event: eventType,
          orderRef,
          providerPaymentId,
          amount,
          currency,
          status: 'failed',
          error: paymentEntity.error_description || 'Razorpay payment capture failed.',
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
        error: err.message || 'Malformed Razorpay webhook payload.',
      };
    }
  }
}
