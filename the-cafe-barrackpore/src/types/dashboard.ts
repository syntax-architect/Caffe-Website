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
  /** Cover charge / coperto (e.g. Italy) */
  cover_charge?: number;
  cover_charge_label?: string;
  cover_charge_taxable?: boolean;
  /** Sub-national tax region / state / province (e.g. 'NY', 'CA', 'ON', or 'ALL') */
  region?: string | null;
  /** Accountant compliance sign-off gate */
  accountant_verified?: boolean;
  accountant_verified_at?: string | null;
  accountant_notes?: string | null;
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
  google_review_link?: string | null;
  owner_notification_phone?: string | null;
  owner_notification_email?: string | null;
  owner_notification_method?: 'email' | 'whatsapp' | 'both' | 'none';
  low_stock_alert_threshold?: number;
  governing_law?: string | null;
  features?: RestaurantFeatureFlags;
}

export interface RestaurantFeatureFlags {
  online_ordering: boolean;
  delivery: boolean;
  takeaway: boolean;
  qr_table_ordering: boolean;
  reservations: boolean;
  kds: boolean;
  pos: boolean;
  running_table_bills: boolean;
  split_bills: boolean;
  cash_drawer: boolean;
  kot_printing: boolean;
  discounts: boolean;
  tips: boolean;
  vip_club: boolean;
  online_payments: boolean;
  specials_banner: boolean;
  gallery: boolean;
  language_switcher: boolean;
}

export type FeatureFlagKey = keyof RestaurantFeatureFlags;

export const FEATURE_PRESETS: Record<'cafe' | 'full_restaurant' | 'takeaway_only', RestaurantFeatureFlags> = {
  cafe: {
    online_ordering: true,
    delivery: false,
    takeaway: true,
    qr_table_ordering: true,
    reservations: false,
    kds: true,
    pos: true,
    running_table_bills: true,
    split_bills: false,
    cash_drawer: false,
    kot_printing: true,
    discounts: true,
    tips: true,
    vip_club: true,
    online_payments: true,
    specials_banner: true,
    gallery: true,
    language_switcher: true,
  },
  full_restaurant: {
    online_ordering: true,
    delivery: true,
    takeaway: true,
    qr_table_ordering: true,
    reservations: true,
    kds: true,
    pos: true,
    running_table_bills: true,
    split_bills: true,
    cash_drawer: true,
    kot_printing: true,
    discounts: true,
    tips: true,
    vip_club: true,
    online_payments: true,
    specials_banner: true,
    gallery: true,
    language_switcher: true,
  },
  takeaway_only: {
    online_ordering: true,
    delivery: true,
    takeaway: true,
    qr_table_ordering: false,
    reservations: false,
    kds: false,
    pos: true,
    running_table_bills: false,
    split_bills: false,
    cash_drawer: true,
    kot_printing: true,
    discounts: true,
    tips: true,
    vip_club: false,
    online_payments: true,
    specials_banner: true,
    gallery: false,
    language_switcher: true,
  },
};

export const DEFAULT_FEATURE_FLAGS: RestaurantFeatureFlags = FEATURE_PRESETS.cafe;

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
