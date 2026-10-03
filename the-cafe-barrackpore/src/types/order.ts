/**
 * Core Order types for The Café Barrackpore ordering foundation.
 */
import type { PaymentStatus, PaymentProvider } from './payment';
import type { TaxRule, ServiceChargeConfig, TaxMode } from './tax';

export type OrderType = 'dine_in' | 'takeaway';
export type OrderSource = 'website' | 'qr';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled';

export interface OrderItemInput {
  id: string;
  name: string;
  price: number;
  quantity: number;
  selected_options?: Record<string, unknown>;
}

export interface OrderItemRecord {
  id: string;
  order_id: string;
  menu_item_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  selected_options: Record<string, unknown>;
  created_at: string;
}

export interface TaxCalculationOptions {
  enabled?: boolean;
  rate?: number;
  label?: string;
  mode?: TaxMode;
  serviceCharge?: Partial<ServiceChargeConfig>;
  rules?: TaxRule[];
  taxIdLabel?: string;
  showBreakdown?: boolean;
  roundingMode?: 'line' | 'total';
}

export interface CreateOrderPayload {
  order_ref?: string;
  customer_name: string;
  customer_phone: string;
  order_type: OrderType;
  table_number?: string | null;
  special_requests?: string | null;
  items: OrderItemInput[];
  source?: OrderSource;
  currency?: string;
  payment_required?: boolean;
  payment_status?: PaymentStatus;
  payment_provider?: PaymentProvider;
  payment_reference?: string | null;
  payment_amount?: number;
  tax_options?: TaxCalculationOptions;
  restaurant_id?: string;
  captcha_token?: string;
  marketing_consent?: boolean;
  discount_code?: string | null;
  discount_amount?: number;
}

export interface OrderRecord {
  id: string;
  order_ref: string;
  customer_name: string;
  customer_phone: string;
  order_type: OrderType;
  table_number: string | null;
  special_requests: string | null;
  subtotal: number;
  total: number;
  currency?: string;
  status: OrderStatus;
  source: OrderSource | string;
  payment_required?: boolean;
  payment_status?: PaymentStatus;
  payment_provider?: PaymentProvider | string | null;
  payment_reference?: string | null;
  payment_amount?: number | null;
  paid_at?: string | null;
  marketing_consent?: boolean;
  discount_code?: string | null;
  discount_amount?: number | null;
  created_at: string;
  updated_at: string;
}

export interface OrderCalculationSummary {
  subtotal: number;
  tax: number;
  total: number;
  taxLabel?: string;
  taxRate?: number;
  taxMode?: 'inclusive' | 'exclusive';
  serviceCharge?: number;
  serviceChargeLabel?: string;
  taxBreakdownLines?: Array<{
    label: string;
    rate: number;
    mode: string;
    amount: number;
  }>;
  netSubtotal?: number;
  itemCount: number;
  lineItems: Array<{
    menu_item_id: string;
    item_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  orderRef: string;
  isDemoMode?: boolean;
  error?: string;
}
