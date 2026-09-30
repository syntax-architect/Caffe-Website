import type { OrderRecord } from './order';
import type { ReservationRecord } from './reservation';

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
