/**
 * POS Point-of-Sale, Running Bills, and KOT Types
 * Uses Integer Minor Units (Paise/Cents) for All Financial Math
 */

export type POSOrderType = 'dine_in' | 'takeaway' | 'delivery';

export type POSBillStatus = 'running' | 'printed' | 'paid' | 'voided' | 'transferred' | 'merged';

export type POSPaymentMethod = 'cash' | 'card' | 'upi' | 'counter' | 'split' | 'online';

/**
 * Currency minor unit conversions
 * 1 Rupee = 100 Paise
 */
export const toMinorUnits = (major: number): number => Math.round((Number(major) || 0) * 100);
export const toMajorUnits = (minor: number): number => (Number(minor) || 0) / 100;
export const formatMinorUnits = (minor: number, currency = ''): string => `${currency ? currency + ' ' : ''}${(toMajorUnits(minor)).toFixed(2)}`;

export interface POSModifier {
  id: string;
  name: string;
  price: number;
  price_minor?: number;
}

export interface POSBillItem {
  id: string;
  bill_id: string;
  restaurant_id?: string;
  kot_batch_id?: string | null;
  menu_item_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  unit_price_minor?: number;
  line_total_minor?: number;
  tax_category?: string;
  modifiers?: POSModifier[];
  notes?: string | null;
  is_voided: boolean;
  void_reason?: string | null;
  void_approved_by?: string | null;
  voided_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface POSKotBatch {
  id: string;
  bill_id: string;
  restaurant_id?: string;
  kot_number: string;
  batch_index: number;
  order_id?: string | null;
  status: 'sent' | 'preparing' | 'ready' | 'served' | 'cancelled';
  special_instructions?: string | null;
  items?: POSBillItem[];
  created_at: string;
}

export interface POSBill {
  id: string;
  restaurant_id?: string;
  bill_number: string;
  order_type: POSOrderType;
  table_number: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  delivery_address?: string | null;
  status: POSBillStatus;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  grand_total: number;
  discount_type?: 'percentage' | 'flat' | 'manual' | null;
  discount_code?: string | null;
  discount_value?: number;
  discount_value_minor?: number;
  discount_amount_minor?: number;
  discount_approved_by?: string | null;
  tax_amount_minor?: number;
  subtotal_minor?: number;
  grand_total_minor?: number;
  tax_details?: any[];
  service_charge_minor?: number;
  tips_minor?: number;
  payment_method?: POSPaymentMethod | null;
  payment_status?: 'unpaid' | 'processing' | 'paid' | 'refunded' | 'voided';
  is_split?: boolean;
  split_type?: 'equal' | 'item' | 'custom' | null;
  split_count?: number;
  notes?: string | null;
  shift_id?: string | null;
  printed_at?: string | null;
  paid_at?: string | null;
  created_at: string;
  updated_at: string;
  items?: POSBillItem[];
  kot_batches?: POSKotBatch[];
}

export type POSTableStatus = 'free' | 'running' | 'printed' | 'paid';

export interface POSTableMapItem {
  id: string;
  table_number: string;
  label?: string | null;
  capacity: number;
  active: boolean;
  status: POSTableStatus;
  current_bill?: POSBill | null;
  running_total: number;
  running_total_minor?: number;
  item_count: number;
  occupied_since?: string | null;
}
