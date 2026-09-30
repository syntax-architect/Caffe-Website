import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { OrderRecord, OrderStatus } from '../types/order';
import type { ReservationRecord, ReservationStatus } from '../types/reservation';
import type { StaffProfile, StaffRole } from '../types/auth';
import type {
  DashboardKPIs,
  DashboardOverviewData,
  RestaurantTable,
  RestaurantSettings,
} from '../types/dashboard';

/**
 * Fallback tables for local/demo mode or initial setup
 */
const DEFAULT_TABLES: RestaurantTable[] = [
  { id: 'tbl-01', table_number: '01', label: 'Window Seat - Corner', capacity: 2, active: true },
  { id: 'tbl-02', table_number: '02', label: 'Window Seat - Riverside', capacity: 2, active: true },
  { id: 'tbl-03', table_number: '03', label: 'Cozy Booth', capacity: 4, active: true },
  { id: 'tbl-04', table_number: '04', label: 'Central Table', capacity: 4, active: true },
  { id: 'tbl-05', table_number: '05', label: 'Central Table', capacity: 4, active: true },
  { id: 'tbl-06', table_number: '06', label: 'High Top Bar Table', capacity: 2, active: true },
  { id: 'tbl-07', table_number: '07', label: 'Balcony Table - Best View', capacity: 4, active: true },
  { id: 'tbl-08', table_number: '08', label: 'Balcony Table', capacity: 4, active: true },
  { id: 'tbl-09', table_number: '09', label: 'Family Dining Booth', capacity: 6, active: true },
  { id: 'tbl-10', table_number: '10', label: 'Family Dining Booth', capacity: 6, active: true },
  { id: 'tbl-11', table_number: '11', label: 'Garden Terrace Table', capacity: 4, active: true },
  { id: 'tbl-12', table_number: '12', label: 'VIP Private Lounge', capacity: 8, active: true },
];

/**
 * Fallback settings
 */
const DEFAULT_SETTINGS: RestaurantSettings = {
  business_name: 'The Café Barrackpore',
  phone: '+91 98300 12345',
  address: '14, Riverside Road, Cantonment, Barrackpore, West Bengal 700120',
  is_ordering_enabled: true,
  is_table_booking_enabled: true,
  opening_time: '11:00 AM',
  closing_time: '11:00 PM',
  announcement_banner: 'Welcome to The Café Barrackpore. Serving artisanal coffee & gourmet wood-fired pizza.',
};

/**
 * Fetches dashboard overview KPIs and live activity
 */
export const fetchDashboardOverview = async (): Promise<DashboardOverviewData> => {
  if (!supabase || !isSupabaseConfigured) {
    return {
      kpis: {
        todayOrdersCount: 0,
        todayRevenue: 0,
        pendingOrdersCount: 0,
        todayReservationsCount: 0,
      },
      recentOrders: [],
      todayReservations: [],
    };
  }

  try {
    const today = new Date().toISOString().split('T')[0];

    // 1. Fetch today's orders
    const { data: todayOrders, error: orderErr } = await supabase
      .from('orders')
      .select('*')
      .gte('created_at', `${today}T00:00:00.000Z`)
      .order('created_at', { ascending: false });

    if (orderErr) throw orderErr;

    // 2. Fetch pending orders count
    const { count: pendingCount, error: pendingErr } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (pendingErr) throw pendingErr;

    // 3. Fetch today's reservations
    const { data: reservations, error: resErr } = await supabase
      .from('reservations')
      .select('*')
      .eq('reservation_date', today)
      .order('reservation_time', { ascending: true });

    if (resErr) throw resErr;

    // 4. Calculate KPIs
    const validOrders = todayOrders || [];
    const revenue = validOrders
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + Number(o.total || 0), 0);

    const kpis: DashboardKPIs = {
      todayOrdersCount: validOrders.length,
      todayRevenue: revenue,
      pendingOrdersCount: pendingCount || 0,
      todayReservationsCount: reservations?.length || 0,
    };

    return {
      kpis,
      recentOrders: validOrders.slice(0, 6),
      todayReservations: (reservations || []).slice(0, 6),
    };
  } catch (error) {
    console.warn('[dashboardService] Error fetching overview data:', error);
    return {
      kpis: {
        todayOrdersCount: 0,
        todayRevenue: 0,
        pendingOrdersCount: 0,
        todayReservationsCount: 0,
      },
      recentOrders: [],
      todayReservations: [],
    };
  }
};

/**
 * Fetches operational orders list with filters
 */
export const fetchOrders = async (options?: {
  status?: string;
  orderType?: string;
  search?: string;
}): Promise<OrderRecord[]> => {
  if (!supabase || !isSupabaseConfigured) {
    return [];
  }

  try {
    let query = supabase.from('orders').select('*').order('created_at', { ascending: false });

    if (options?.status && options.status !== 'all') {
      query = query.eq('status', options.status);
    }

    if (options?.orderType && options.orderType !== 'all') {
      query = query.eq('order_type', options.orderType);
    }

    const { data, error } = await query;
    if (error) throw error;

    let results = data as OrderRecord[];

    if (options?.search && options.search.trim()) {
      const q = options.search.trim().toLowerCase();
      results = results.filter(
        (o) =>
          o.order_ref.toLowerCase().includes(q) ||
          o.customer_name.toLowerCase().includes(q) ||
          o.customer_phone.includes(q) ||
          (o.table_number && o.table_number.toLowerCase().includes(q))
      );
    }

    return results;
  } catch (err) {
    console.error('[dashboardService] Failed to fetch orders:', err);
    return [];
  }
};

/**
 * Fetches order items for a specific order
 */
export const fetchOrderItems = async (orderId: string) => {
  if (!supabase || !isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[dashboardService] Failed to fetch order items:', err);
    return [];
  }
};

/**
 * Updates order status in Supabase
 */
export const updateOrderStatus = async (
  orderId: string,
  newStatus: OrderStatus
): Promise<{ success: boolean; error?: string }> => {
  if (!supabase || !isSupabaseConfigured) {
    return { success: false, error: 'Database is in demo mode.' };
  }

  try {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', orderId);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('[dashboardService] Failed to update order status:', err);
    return { success: false, error: 'Could not update order status.' };
  }
};

/**
 * Fetches reservations list with view filters
 */
export const fetchReservations = async (options?: {
  view?: 'today' | 'upcoming' | 'all';
  status?: string;
  search?: string;
}): Promise<ReservationRecord[]> => {
  if (!supabase || !isSupabaseConfigured) {
    return [];
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    let query = supabase.from('reservations').select('*');

    if (options?.view === 'today') {
      query = query.eq('reservation_date', today).order('reservation_time', { ascending: true });
    } else if (options?.view === 'upcoming') {
      query = query.gte('reservation_date', today).order('reservation_date', { ascending: true }).order('reservation_time', { ascending: true });
    } else {
      query = query.order('reservation_date', { ascending: false }).order('reservation_time', { ascending: false });
    }

    if (options?.status && options.status !== 'all') {
      query = query.eq('status', options.status);
    }

    const { data, error } = await query;
    if (error) throw error;

    let results = data as ReservationRecord[];

    if (options?.search && options.search.trim()) {
      const q = options.search.trim().toLowerCase();
      results = results.filter(
        (r) =>
          r.reservation_ref.toLowerCase().includes(q) ||
          r.customer_name.toLowerCase().includes(q) ||
          r.customer_phone.includes(q)
      );
    }

    return results;
  } catch (err) {
    console.error('[dashboardService] Failed to fetch reservations:', err);
    return [];
  }
};

/**
 * Updates reservation status in Supabase
 */
export const updateReservationStatus = async (
  reservationId: string,
  newStatus: ReservationStatus
): Promise<{ success: boolean; error?: string }> => {
  if (!supabase || !isSupabaseConfigured) {
    return { success: false, error: 'Database is in demo mode.' };
  }

  try {
    const { error } = await supabase
      .from('reservations')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', reservationId);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('[dashboardService] Failed to update reservation status:', err);
    return { success: false, error: 'Could not update reservation status.' };
  }
};

/**
 * Fetches restaurant floor tables
 */
export const fetchRestaurantTables = async (): Promise<RestaurantTable[]> => {
  if (!supabase || !isSupabaseConfigured) {
    return DEFAULT_TABLES;
  }

  try {
    const { data, error } = await supabase
      .from('restaurant_tables')
      .select('*')
      .order('table_number', { ascending: true });

    if (error || !data || data.length === 0) {
      return DEFAULT_TABLES;
    }

    return data as RestaurantTable[];
  } catch {
    return DEFAULT_TABLES;
  }
};

/**
 * Saves (creates or updates) a restaurant table
 */
export const saveRestaurantTable = async (
  table: Partial<RestaurantTable>
): Promise<{ success: boolean; table?: RestaurantTable; error?: string }> => {
  if (!supabase || !isSupabaseConfigured) {
    return { success: false, error: 'Supabase is not configured.' };
  }

  try {
    if (table.id) {
      // Update
      const { data, error } = await supabase
        .from('restaurant_tables')
        .update({
          table_number: table.table_number?.trim(),
          label: table.label?.trim() || null,
          capacity: Number(table.capacity) || 4,
          active: table.active !== undefined ? table.active : true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', table.id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, table: data as RestaurantTable };
    } else {
      // Insert
      const { data, error } = await supabase
        .from('restaurant_tables')
        .insert({
          table_number: table.table_number?.trim(),
          label: table.label?.trim() || null,
          capacity: Number(table.capacity) || 4,
          active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, table: data as RestaurantTable };
    }
  } catch (err: any) {
    console.error('[dashboardService] Error saving table:', err);
    return { success: false, error: err.message || 'Failed to save table.' };
  }
};

/**
 * Toggles a table active status
 */
export const toggleTableActive = async (
  tableId: string,
  active: boolean
): Promise<{ success: boolean; error?: string }> => {
  if (!supabase || !isSupabaseConfigured) {
    return { success: false, error: 'Supabase is not configured.' };
  }

  try {
    const { error } = await supabase
      .from('restaurant_tables')
      .update({ active, updated_at: new Date().toISOString() })
      .eq('id', tableId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to toggle table status.' };
  }
};

/**
 * Fetches staff roster (owners and managers only)
 */
export const fetchStaffProfiles = async (): Promise<StaffProfile[]> => {
  if (!supabase || !isSupabaseConfigured) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('staff_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data as StaffProfile[]) || [];
  } catch (err) {
    console.error('[dashboardService] Error fetching staff profiles:', err);
    return [];
  }
};

/**
 * Updates staff member active status (owner only)
 */
export const toggleStaffActive = async (
  profileId: string,
  active: boolean
): Promise<{ success: boolean; error?: string }> => {
  if (!supabase || !isSupabaseConfigured) {
    return { success: false, error: 'Supabase is not configured.' };
  }

  try {
    const { error } = await supabase
      .from('staff_profiles')
      .update({ active, updated_at: new Date().toISOString() })
      .eq('id', profileId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update staff status.' };
  }
};

/**
 * Updates staff member role (owner only)
 */
export const updateStaffRole = async (
  profileId: string,
  role: StaffRole
): Promise<{ success: boolean; error?: string }> => {
  if (!supabase || !isSupabaseConfigured) {
    return { success: false, error: 'Supabase is not configured.' };
  }

  try {
    const { error } = await supabase
      .from('staff_profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', profileId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update staff role.' };
  }
};

/**
 * Fetches restaurant settings
 */
export const fetchRestaurantSettings = async (): Promise<RestaurantSettings> => {
  if (!supabase || !isSupabaseConfigured) {
    return DEFAULT_SETTINGS;
  }

  try {
    const { data, error } = await supabase
      .from('restaurant_settings')
      .select('*')
      .eq('id', 'current')
      .maybeSingle();

    if (error || !data) {
      return DEFAULT_SETTINGS;
    }

    return data as RestaurantSettings;
  } catch {
    return DEFAULT_SETTINGS;
  }
};

/**
 * Updates restaurant settings (owner only)
 */
export const updateRestaurantSettings = async (
  settings: RestaurantSettings
): Promise<{ success: boolean; error?: string }> => {
  if (!supabase || !isSupabaseConfigured) {
    return { success: false, error: 'Supabase is not configured.' };
  }

  try {
    const { error } = await supabase
      .from('restaurant_settings')
      .upsert({
        id: 'current',
        business_name: settings.business_name,
        phone: settings.phone,
        address: settings.address,
        is_ordering_enabled: settings.is_ordering_enabled,
        is_table_booking_enabled: settings.is_table_booking_enabled,
        opening_time: settings.opening_time,
        closing_time: settings.closing_time,
        announcement_banner: settings.announcement_banner,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update settings.' };
  }
};
