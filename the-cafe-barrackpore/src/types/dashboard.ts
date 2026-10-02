import type { OrderRecord } from './order';
import type { ReservationRecord } from './reservation';
import type { PaymentProvider, PaymentMode } from './payment';

export interface DashboardKPIs {
  todayOrdersCount: number;
  todayRevenue: number;
  pendingOrdersCount: number;
  todayReservationsCount: number;
}

export interface RestaurantTable {
  id: string;
  table_number: string;
  label: string | null;
  capacity: number;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface RestaurantSettings {
  id?: string;
  business_name: string;
  phone: string;
  address: string;
  is_ordering_enabled: boolean;
  is_table_booking_enabled: boolean;
  opening_time: string;
  closing_time: string;
  announcement_banner?: string | null;
  country?: string;
  currency?: string;
  currency_symbol?: string;
  locale?: string;
  timezone?: string;
  phone_country_code?: string;
  tax_enabled?: boolean;
  tax_mode?: 'inclusive' | 'exclusive';
  tax_label?: string;
  tax_rate?: number;
  /** JSON string of TaxRule[] for split tax display (e.g. CGST + SGST) */
  tax_rules?: string | null;
  /** Tax registration number (GSTIN, VAT No., EIN, etc.) */
  tax_id?: string | null;
  /** Label for the tax ID field (e.g. "GSTIN", "VAT No.") */
  tax_id_label?: string | null;
  /** Whether to show tax breakdown on receipts */
  tax_show_breakdown?: boolean;
  /** Rounding mode: 'line' (US) or 'total' (EU/India) */
  tax_rounding_mode?: 'line' | 'total';
  /** Service charge enabled */
  service_charge_enabled?: boolean;
  /** Service charge rate (decimal, e.g. 0.10 = 10%) */
  service_charge_rate?: number;
  /** Service charge label */
  service_charge_label?: string;
  /** Whether service charge is taxable */
  service_charge_taxable?: boolean;
  /** Whether customer can opt out of service charge */
  service_charge_optional?: boolean;
  dietary_system?: 'india' | 'international';
  primary_contact_method?: 'whatsapp' | 'phone' | 'email';
  email?: string | null;
  city?: string | null;
  state_region?: string | null;
  postal_code?: string | null;
  payment_enabled?: boolean;
  payments_enabled?: boolean;
  payment_provider?: PaymentProvider;
  payment_mode?: PaymentMode;
  allow_pay_at_counter?: boolean;
}

export interface DashboardNotification {
  id: string;
  type: 'success' | 'warning' | 'info' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read?: boolean;
}

export interface DashboardOverviewData {
  kpis: DashboardKPIs;
  recentOrders: OrderRecord[];
  todayReservations: ReservationRecord[];
}
