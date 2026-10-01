import type {
  PaymentProvider,
  CreatePaymentParams,
  PaymentCheckoutResult,
  VerifyPaymentParams,
  PaymentVerificationResult,
  WebhookEventResult,
} from '../../types/payment';

export interface PaymentProviderAdapter {
  readonly provider: PaymentProvider;
  readonly isConfigured: boolean;

  createCheckoutSession(params: CreatePaymentParams): Promise<PaymentCheckoutResult>;

  verifyPayment(params: VerifyPaymentParams): Promise<PaymentVerificationResult>;

  handleWebhook(
    payload: string | Record<string, unknown>,
    signature: string
  ): Promise<WebhookEventResult>;

  processRefund?(
    paymentId: string,
    amount?: number
  ): Promise<{ success: boolean; refundId?: string; error?: string }>;
}
