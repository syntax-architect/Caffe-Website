/**
 * Core Order types for The Café Barrackpore ordering foundation.
 */

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

export interface CreateOrderPayload {
  order_ref?: string;
  customer_name: string;
  customer_phone: string;
  order_type: OrderType;
  table_number?: string | null;
  special_requests?: string | null;
  items: OrderItemInput[];
  source?: OrderSource;
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
  status: OrderStatus;
  source: OrderSource | string;
  created_at: string;
  updated_at: string;
}

export interface OrderCalculationSummary {
  subtotal: number;
  total: number;
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
