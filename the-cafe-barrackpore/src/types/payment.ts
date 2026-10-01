/**
 * Payment Architecture Types
 * The Café Barrackpore — Global Restaurant Operations Platform (Phase 1J)
 */

export type PaymentStatus =
  | 'not_required'
  | 'pending'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'refunded'
  | 'partially_refunded';

export type PaymentProvider = 'stripe' | 'razorpay' | 'manual' | 'demo';

export type PaymentMode = 'disabled' | 'online' | 'optional';

export interface PaymentConfiguration {
  enabled: boolean;
  provider: PaymentProvider;
  mode: PaymentMode;
  publishableKey?: string;
}

export interface PaymentRecord {
  id: string;
  order_id: string;
  order_ref: string;
  provider: PaymentProvider | string;
  provider_payment_id?: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  failure_reason?: string | null;
  idempotency_key?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreatePaymentParams {
  orderId: string;
  orderRef: string;
  amount: number;
  currency: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  successUrl?: string;
  cancelUrl?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentCheckoutResult {
  success: boolean;
  provider: PaymentProvider;
  paymentId?: string;
  checkoutUrl?: string;
  clientSecret?: string;
  orderRef: string;
  amount: number;
  currency: string;
  isDemo?: boolean;
  error?: string;
}

export interface VerifyPaymentParams {
  orderRef: string;
  providerPaymentId: string;
  signature?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentVerificationResult {
  success: boolean;
  paid: boolean;
  provider: string;
  providerPaymentId: string;
  orderRef: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  error?: string;
}

export interface WebhookEventResult {
  verified: boolean;
  orderRef?: string;
  event?: string;
  status?: PaymentStatus;
  providerPaymentId?: string;
  amount?: number;
  currency?: string;
  error?: string;
}
