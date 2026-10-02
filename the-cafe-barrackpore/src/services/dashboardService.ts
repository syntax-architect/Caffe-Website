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
  phone: '+918420507105',
  address: '14, Riverside Road, Cantonment, Barrackpore, West Bengal 700120',
  is_ordering_enabled: true,
  is_table_booking_enabled: true,
  opening_time: '11:00 AM',
  closing_time: '11:00 PM',
  announcement_banner: 'Welcome to The Café Barrackpore. Serving artisanal coffee & gourmet wood-fired pizza.',
  country: 'IN',
  currency: 'INR',
  currency_symbol: '₹',
  locale: 'en-IN',
  timezone: 'Asia/Kolkata',
  phone_country_code: '+91',
  tax_enabled: true,
  tax_mode: 'inclusive',
  tax_label: 'GST',
  tax_rate: 0.05,
  dietary_system: 'india',
  primary_contact_method: 'whatsapp',
  email: 'contact@thecafe.com',
  city: 'Barrackpore',
  state_region: 'West Bengal',
  postal_code: '700120',
  payment_provider: 'none',
  payment_enabled: false,
  payments_enabled: false,
  allow_pay_at_counter: true,
};

const getDemoOrders = (): OrderRecord[] => {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('cafe_demo_orders');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
  }
  const defaultOrders: OrderRecord[] = [
    {
      id: 'demo-order-1',
      order_ref: 'CB-2026-X104',
      customer_name: 'Ananya Roy',
      customer_phone: '9830111222',
      order_type: 'dine_in',
      table_number: '07',
      special_requests: 'Less spicy please',
      subtotal: 580,
      total: 580,
      currency: 'INR',
      status: 'pending',
      source: 'qr',
      payment_required: false,
      payment_status: 'not_required',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: [
        { id: 'item-1a', item_name: 'Alfredo Pasta', quantity: 1, unit_price: 380, line_total: 380 },
        { id: 'item-1b', item_name: 'Cold Coffee', quantity: 2, unit_price: 100, line_total: 200 },
      ],
    } as any,
    {
      id: 'demo-order-2',
      order_ref: 'CB-2026-B812',
      customer_name: 'Vikram Mehta',
      customer_phone: '9830222333',
      order_type: 'takeaway',
      table_number: null,
      special_requests: null,
      subtotal: 750,
      total: 750,
      currency: 'INR',
      status: 'preparing',
      source: 'website',
      payment_required: true,
      payment_status: 'paid',
      created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
      items: [
        { id: 'item-2a', item_name: 'Wood-fired Margherita', quantity: 1, unit_price: 450, line_total: 450 },
        { id: 'item-2b', item_name: 'Peri-Peri Fries', quantity: 1, unit_price: 150, line_total: 150 },
        { id: 'item-2c', item_name: 'Lemon Iced Tea', quantity: 1, unit_price: 150, line_total: 150 },
      ],
    } as any,
    {
      id: 'demo-order-3',
      order_ref: 'CB-2026-P319',
      customer_name: 'Sneha Sen',
      customer_phone: '9830555444',
      order_type: 'dine_in',
      table_number: '03',
      special_requests: 'Extra napkins',
      subtotal: 420,
      total: 420,
      currency: 'INR',
      status: 'ready',
      source: 'qr',
      payment_required: false,
      payment_status: 'not_required',
      created_at: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
      items: [
        { id: 'item-3a', item_name: 'Iced Caramel Macchiato', quantity: 2, unit_price: 210, line_total: 420 },
      ],
    } as any,
  ];
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('cafe_demo_orders', JSON.stringify(defaultOrders));
    } catch {
      // ignore
    }
  }
  return defaultOrders;
};

const saveDemoOrders = (orders: OrderRecord[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('cafe_demo_orders', JSON.stringify(orders));
  } catch {
    // ignore
  }
};

const getDemoReservations = (): ReservationRecord[] => {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('cafe_demo_reservations');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
  }
  const today = new Date().toISOString().split('T')[0];
  const defaultReservations: ReservationRecord[] = [
    {
      id: 'demo-res-1',
      reservation_ref: 'RS-2026-A401',
      customer_name: 'Debjit Mukherjee',
      customer_phone: '9830999888',
      reservation_date: today,
      reservation_time: '19:30',
      party_size: 4,
      special_requests: 'Anniversary celebration, window table preferred',
      status: 'confirmed',
      source: 'website',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'demo-res-2',
      reservation_ref: 'RS-2026-B902',
      customer_name: 'Pooja Agarwal',
      customer_phone: '9830777666',
      reservation_date: today,
      reservation_time: '20:30',
      party_size: 2,
      special_requests: 'Quiet booth',
      status: 'pending',
      source: 'website',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('cafe_demo_reservations', JSON.stringify(defaultReservations));
    } catch {
      // ignore
    }
  }
  return defaultReservations;
};

const saveDemoReservations = (reservations: ReservationRecord[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('cafe_demo_reservations', JSON.stringify(reservations));
  } catch {
    // ignore
  }
};

const getDemoTables = (): RestaurantTable[] => {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('cafe_demo_tables');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
  }
  return DEFAULT_TABLES;
};

const saveDemoTables = (tables: RestaurantTable[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('cafe_demo_tables', JSON.stringify(tables));
  } catch {
    // ignore
  }
};

const getDemoSettings = (): RestaurantSettings => {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('cafe_demo_settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch {
      // fallback
    }
  }
  return DEFAULT_SETTINGS;
};

const saveDemoSettings = (settings: RestaurantSettings) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('cafe_demo_settings', JSON.stringify(settings));
  } catch {
    // ignore
  }
};

const getDemoStaff = (): StaffProfile[] => {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('cafe_demo_staff');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
  }
  const defaultStaff: StaffProfile[] = [
    {
      id: 'demo-staff-1',
      user_id: 'demo-user-1',
      full_name: 'Demo Owner',
      role: 'owner',
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'demo-staff-2',
      user_id: 'demo-user-2',
      full_name: 'Operations Manager',
      role: 'manager',
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'demo-staff-3',
      user_id: 'demo-user-3',
      full_name: 'Head Chef',
      role: 'staff',
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
  return defaultStaff;
};

const saveDemoStaff = (staff: StaffProfile[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('cafe_demo_staff', JSON.stringify(staff));
  } catch {
    // ignore
  }
};

/**
 * Fetches dashboard overview KPIs and live activity
 */
export const fetchDashboardOverview = async (): Promise<DashboardOverviewData> => {
  if (!supabase || !isSupabaseConfigured) {
    const demoOrders = getDemoOrders();
    const demoReservations = getDemoReservations();
    const validOrders = demoOrders.filter((o) => o.status !== 'cancelled');
    const revenue = validOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const pendingCount = demoOrders.filter((o) => o.status === 'pending').length;

    return {
      kpis: {
        todayOrdersCount: demoOrders.length,
        todayRevenue: revenue,
        pendingOrdersCount: pendingCount,
        todayReservationsCount: demoReservations.length,
      },
      recentOrders: demoOrders.slice(0, 6),
      todayReservations: demoReservations.slice(0, 6),
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
    let results = getDemoOrders();
    if (options?.status && options.status !== 'all') {
      results = results.filter((o) => o.status === options.status);
    }
    if (options?.orderType && options.orderType !== 'all') {
      results = results.filter((o) => o.order_type === options.orderType);
    }
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
  if (!supabase || !isSupabaseConfigured) {
    const demoOrders = getDemoOrders();
    const order = demoOrders.find((o) => o.id === orderId);
    return (order as any)?.items || [];
  }
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
    const orders = getDemoOrders();
    const updated = orders.map((o) =>
      o.id === orderId ? { ...o, status: newStatus, updated_at: new Date().toISOString() } : o
    );
    saveDemoOrders(updated);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('cafe:order-status-changed', {
          detail: { orderId, newStatus },
        })
      );
    }
    return { success: true };
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
    let results = getDemoReservations();
    const today = new Date().toISOString().split('T')[0];
    if (options?.view === 'today') {
      results = results.filter((r) => r.reservation_date === today);
    } else if (options?.view === 'upcoming') {
      results = results.filter((r) => r.reservation_date >= today);
    }
    if (options?.status && options.status !== 'all') {
      results = results.filter((r) => r.status === options.status);
    }
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
    const list = getDemoReservations();
    const updated = list.map((r) =>
      r.id === reservationId ? { ...r, status: newStatus, updated_at: new Date().toISOString() } : r
    );
    saveDemoReservations(updated);
    return { success: true };
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
    return getDemoTables();
  }

  try {
    const { data, error } = await supabase
      .from('restaurant_tables')
      .select('*')
      .order('table_number', { ascending: true });

    if (error || !data || data.length === 0) {
      return getDemoTables();
    }

    return data as RestaurantTable[];
  } catch {
    return getDemoTables();
  }
};

/**
 * Saves (creates or updates) a restaurant table
 */
export const saveRestaurantTable = async (
  table: Partial<RestaurantTable>
): Promise<{ success: boolean; table?: RestaurantTable; error?: string }> => {
  if (!supabase || !isSupabaseConfigured) {
    const tables = getDemoTables();
    if (table.id) {
      const updated = tables.map((t) =>
        t.id === table.id
          ? {
              ...t,
              table_number: table.table_number?.trim() || t.table_number,
              label: table.label?.trim() || null,
              capacity: Number(table.capacity) || t.capacity,
              active: table.active !== undefined ? table.active : t.active,
            }
          : t
      );
      saveDemoTables(updated);
      const saved = updated.find((t) => t.id === table.id);
      return { success: true, table: saved };
    } else {
      const newTable: RestaurantTable = {
        id: `demo-tbl-${Date.now()}`,
        table_number: table.table_number?.trim() || 'New',
        label: table.label?.trim() || null,
        capacity: Number(table.capacity) || 4,
        active: true,
      };
      const updated = [...tables, newTable];
      saveDemoTables(updated);
      return { success: true, table: newTable };
    }
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
    const tables = getDemoTables();
    const updated = tables.map((t) => (t.id === tableId ? { ...t, active } : t));
    saveDemoTables(updated);
    return { success: true };
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
    return getDemoStaff();
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
    const staff = getDemoStaff();
    const updated = staff.map((s) =>
      s.id === profileId ? { ...s, active, updated_at: new Date().toISOString() } : s
    );
    saveDemoStaff(updated);
    return { success: true };
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
    const staff = getDemoStaff();
    const updated = staff.map((s) =>
      s.id === profileId ? { ...s, role, updated_at: new Date().toISOString() } : s
    );
    saveDemoStaff(updated);
    return { success: true };
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
    return getDemoSettings();
  }

  try {
    const { data, error } = await supabase
      .from('restaurant_settings')
      .select('*')
      .eq('id', 'current')
      .maybeSingle();

    if (error || !data) {
      return getDemoSettings();
    }

    return data as RestaurantSettings;
  } catch {
    return getDemoSettings();
  }
};

/**
 * Updates restaurant settings (owner only)
 */
export const updateRestaurantSettings = async (
  settings: RestaurantSettings
): Promise<{ success: boolean; error?: string }> => {
  if (!supabase || !isSupabaseConfigured) {
    saveDemoSettings(settings);
    return { success: true };
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
        country: settings.country || 'IN',
        currency: settings.currency || 'INR',
        currency_symbol: settings.currency_symbol || '₹',
        locale: settings.locale || 'en-IN',
        timezone: settings.timezone || 'Asia/Kolkata',
        phone_country_code: settings.phone_country_code || '+91',
        tax_enabled: settings.tax_enabled ?? true,
        tax_mode: settings.tax_mode || 'inclusive',
        tax_label: settings.tax_label || 'GST',
        tax_rate: settings.tax_rate ?? 0.05,
        dietary_system: settings.dietary_system || 'india',
        primary_contact_method: settings.primary_contact_method || 'whatsapp',
        email: settings.email || null,
        city: settings.city || null,
        state_region: settings.state_region || null,
        postal_code: settings.postal_code || null,
        payment_provider: settings.payment_provider || 'none',
        payments_enabled: settings.payments_enabled ?? settings.payment_enabled ?? false,
        payment_enabled: settings.payments_enabled ?? settings.payment_enabled ?? false,
        payment_mode: settings.payment_mode || 'disabled',
        allow_pay_at_counter: settings.allow_pay_at_counter ?? true,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update settings.' };
  }
};
