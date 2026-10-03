/**
 * Customer types for The Café Barrackpore owner features.
 */

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  marketing_consent: boolean;
  order_count: number;
  total_spent: number;
  last_order_at: string | null;
  first_order_at: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiscountCode {
  id: string;
  code: string;
  description?: string | null;
  discount_type: 'percentage' | 'flat';
  discount_value: number;
  min_order_amount: number;
  max_discount_amount?: number | null;
  max_uses?: number | null;
  used_count: number;
  valid_from: string;
  valid_until?: string | null;
  active: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface HappyHourSchedule {
  id: string;
  label: string;
  day_of_week: number; // 0=Sun, 6=Sat
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  discount_percentage: number;
  category_id?: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DiscountValidationResult {
  valid: boolean;
  code?: string;
  discount_type?: 'percentage' | 'flat';
  discount_value?: number;
  discount_amount?: number;
  max_discount_amount?: number | null;
  min_order_amount?: number;
  error?: string;
}

export interface ActiveHappyHour {
  label: string;
  discount_percentage: number;
  category_id?: string | null;
  end_time: string;
}

export interface OwnerAnalytics {
  todayRevenue: number;
  averageOrderValue: number;
  repeatCustomerCount: number;
  topSellingItems: TopSellingItem[];
  busiestHours: HourlyData[];
}

export interface TopSellingItem {
  item_name: string;
  total_quantity: number;
  total_revenue: number;
}

export interface HourlyData {
  hour: number; // 0-23
  order_count: number;
  revenue: number;
}
