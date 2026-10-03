/**
 * Owner-focused service layer: analytics, customers, discounts, happy hours, stock alerts.
 * The Café Barrackpore — Owner Features
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type {
  Customer,
  DiscountCode,
  HappyHourSchedule,
  DiscountValidationResult,
  ActiveHappyHour,
  OwnerAnalytics,
  TopSellingItem,
  HourlyData,
} from '../types/owner';

// ============================================================
// DEMO DATA
// ============================================================

const getDemoCustomers = (): Customer[] => {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('cafe_demo_customers');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* fallback */ }
  }
  const now = new Date().toISOString();
  const demoCustomers: Customer[] = [
    { id: 'cust-1', name: 'Ananya Roy', phone: '9830111222', email: null, marketing_consent: true, order_count: 12, total_spent: 6840, last_order_at: now, first_order_at: '2026-06-15T10:00:00Z', notes: null, created_at: now, updated_at: now },
    { id: 'cust-2', name: 'Vikram Mehta', phone: '9830222333', email: 'vikram@email.com', marketing_consent: false, order_count: 8, total_spent: 5200, last_order_at: now, first_order_at: '2026-07-01T14:00:00Z', notes: null, created_at: now, updated_at: now },
    { id: 'cust-3', name: 'Sneha Sen', phone: '9830555444', email: null, marketing_consent: true, order_count: 5, total_spent: 2100, last_order_at: new Date(Date.now() - 86400000).toISOString(), first_order_at: '2026-08-10T18:00:00Z', notes: 'Regular dine-in', created_at: now, updated_at: now },
    { id: 'cust-4', name: 'Debjit Mukherjee', phone: '9830999888', email: 'debjit@email.com', marketing_consent: true, order_count: 3, total_spent: 1450, last_order_at: new Date(Date.now() - 172800000).toISOString(), first_order_at: '2026-09-01T19:00:00Z', notes: null, created_at: now, updated_at: now },
    { id: 'cust-5', name: 'Pooja Agarwal', phone: '9830777666', email: null, marketing_consent: false, order_count: 2, total_spent: 980, last_order_at: new Date(Date.now() - 259200000).toISOString(), first_order_at: '2026-09-15T20:00:00Z', notes: null, created_at: now, updated_at: now },
  ];
  return demoCustomers;
};

const getDemoDiscountCodes = (): DiscountCode[] => {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('cafe_demo_discounts');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* fallback */ }
  }
  const now = new Date().toISOString();
  return [
    { id: 'disc-1', code: 'WELCOME10', description: '10% off for new customers', discount_type: 'percentage', discount_value: 10, min_order_amount: 200, max_discount_amount: 100, max_uses: null, used_count: 24, valid_from: now, valid_until: null, active: true, created_by: null, created_at: now, updated_at: now },
    { id: 'disc-2', code: 'FLAT50', description: '₹50 off on orders above ₹500', discount_type: 'flat', discount_value: 50, min_order_amount: 500, max_discount_amount: null, max_uses: 100, used_count: 67, valid_from: now, valid_until: '2027-01-01T00:00:00Z', active: true, created_by: null, created_at: now, updated_at: now },
  ];
};

const saveDemoDiscountCodes = (codes: DiscountCode[]) => {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem('cafe_demo_discounts', JSON.stringify(codes)); } catch { /* ignore */ }
};

const getDemoHappyHours = (): HappyHourSchedule[] => {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('cafe_demo_happy_hours');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* fallback */ }
  }
  const now = new Date().toISOString();
  return [
    { id: 'hh-1', label: 'Weekday Happy Hour', day_of_week: 1, start_time: '15:00', end_time: '17:00', discount_percentage: 15, category_id: null, active: true, created_at: now, updated_at: now },
    { id: 'hh-2', label: 'Weekday Happy Hour', day_of_week: 2, start_time: '15:00', end_time: '17:00', discount_percentage: 15, category_id: null, active: true, created_at: now, updated_at: now },
    { id: 'hh-3', label: 'Weekday Happy Hour', day_of_week: 3, start_time: '15:00', end_time: '17:00', discount_percentage: 15, category_id: null, active: true, created_at: now, updated_at: now },
    { id: 'hh-4', label: 'Weekday Happy Hour', day_of_week: 4, start_time: '15:00', end_time: '17:00', discount_percentage: 15, category_id: null, active: true, created_at: now, updated_at: now },
    { id: 'hh-5', label: 'Weekday Happy Hour', day_of_week: 5, start_time: '15:00', end_time: '17:00', discount_percentage: 15, category_id: null, active: true, created_at: now, updated_at: now },
  ];
};

const saveDemoHappyHours = (schedules: HappyHourSchedule[]) => {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem('cafe_demo_happy_hours', JSON.stringify(schedules)); } catch { /* ignore */ }
};

// ============================================================
// ANALYTICS
// ============================================================

export const fetchOwnerAnalytics = async (): Promise<OwnerAnalytics> => {
  if (!supabase || !isSupabaseConfigured) {
    // Demo analytics
    return {
      todayRevenue: 1750,
      averageOrderValue: 583,
      repeatCustomerCount: 3,
      topSellingItems: [
        { item_name: 'Wood-fired Margherita', total_quantity: 18, total_revenue: 8100 },
        { item_name: 'Cold Coffee', total_quantity: 15, total_revenue: 1500 },
        { item_name: 'Alfredo Pasta', total_quantity: 12, total_revenue: 4560 },
        { item_name: 'Peri-Peri Fries', total_quantity: 10, total_revenue: 1500 },
        { item_name: 'Iced Caramel Macchiato', total_quantity: 8, total_revenue: 1680 },
      ],
      busiestHours: [
        { hour: 11, order_count: 2, revenue: 400 },
        { hour: 12, order_count: 5, revenue: 1250 },
        { hour: 13, order_count: 8, revenue: 2400 },
        { hour: 14, order_count: 4, revenue: 1100 },
        { hour: 15, order_count: 3, revenue: 750 },
        { hour: 16, order_count: 2, revenue: 500 },
        { hour: 17, order_count: 4, revenue: 1000 },
        { hour: 18, order_count: 6, revenue: 1800 },
        { hour: 19, order_count: 10, revenue: 3500 },
        { hour: 20, order_count: 12, revenue: 4200 },
        { hour: 21, order_count: 8, revenue: 2800 },
        { hour: 22, order_count: 3, revenue: 900 },
      ],
    };
  }

  try {
    const today = new Date().toISOString().split('T')[0];

    // Today's orders (non-cancelled)
    const { data: todayOrders, error: ordErr } = await supabase
      .from('orders')
      .select('id, total, created_at, customer_phone')
      .gte('created_at', `${today}T00:00:00.000Z`)
      .neq('status', 'cancelled');

    if (ordErr) throw ordErr;

    const orders = todayOrders || [];
    const todayRevenue = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const averageOrderValue = orders.length > 0 ? Math.round(todayRevenue / orders.length) : 0;

    // Repeat customers (>1 order today)
    const phoneCounts: Record<string, number> = {};
    orders.forEach((o) => {
      if (o.customer_phone) phoneCounts[o.customer_phone] = (phoneCounts[o.customer_phone] || 0) + 1;
    });
    const repeatCustomerCount = Object.values(phoneCounts).filter((c) => c > 1).length;

    // Top-selling items (join order_items for today)
    const orderIds = orders.map((o) => o.id);
    let topSellingItems: TopSellingItem[] = [];
    if (orderIds.length > 0) {
      const { data: items, error: itemErr } = await supabase
        .from('order_items')
        .select('item_name, quantity, line_total')
        .in('order_id', orderIds);

      if (!itemErr && items) {
        const itemMap: Record<string, { qty: number; rev: number }> = {};
        items.forEach((it) => {
          const key = it.item_name;
          if (!itemMap[key]) itemMap[key] = { qty: 0, rev: 0 };
          itemMap[key].qty += Number(it.quantity || 0);
          itemMap[key].rev += Number(it.line_total || 0);
        });
        topSellingItems = Object.entries(itemMap)
          .map(([name, data]) => ({ item_name: name, total_quantity: data.qty, total_revenue: data.rev }))
          .sort((a, b) => b.total_quantity - a.total_quantity)
          .slice(0, 10);
      }
    }

    // Busiest hours
    const hourMap: Record<number, { count: number; revenue: number }> = {};
    orders.forEach((o) => {
      const hour = new Date(o.created_at).getHours();
      if (!hourMap[hour]) hourMap[hour] = { count: 0, revenue: 0 };
      hourMap[hour].count += 1;
      hourMap[hour].revenue += Number(o.total || 0);
    });
    const busiestHours: HourlyData[] = Object.entries(hourMap)
      .map(([h, d]) => ({ hour: Number(h), order_count: d.count, revenue: d.revenue }))
      .sort((a, b) => a.hour - b.hour);

    return { todayRevenue, averageOrderValue, repeatCustomerCount, topSellingItems, busiestHours };
  } catch (error) {
    console.warn('[ownerService] Error fetching analytics:', error);
    return { todayRevenue: 0, averageOrderValue: 0, repeatCustomerCount: 0, topSellingItems: [], busiestHours: [] };
  }
};

// ============================================================
// CUSTOMERS
// ============================================================

export const fetchCustomers = async (options?: {
  search?: string;
  consentOnly?: boolean;
}): Promise<Customer[]> => {
  if (!supabase || !isSupabaseConfigured) {
    let results = getDemoCustomers();
    if (options?.consentOnly) {
      results = results.filter((c) => c.marketing_consent);
    }
    if (options?.search?.trim()) {
      const q = options.search.trim().toLowerCase();
      results = results.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          (c.email && c.email.toLowerCase().includes(q))
      );
    }
    return results;
  }

  try {
    let query = supabase
      .from('customers')
      .select('*')
      .order('last_order_at', { ascending: false });

    if (options?.consentOnly) {
      query = query.eq('marketing_consent', true);
    }

    const { data, error } = await query;
    if (error) throw error;

    let results = (data || []) as Customer[];

    if (options?.search?.trim()) {
      const q = options.search.trim().toLowerCase();
      results = results.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          (c.email && c.email.toLowerCase().includes(q))
      );
    }

    return results;
  } catch (err) {
    console.error('[ownerService] Failed to fetch customers:', err);
    return [];
  }
};

export const updateCustomerConsent = async (
  customerId: string,
  consent: boolean
): Promise<{ success: boolean; error?: string }> => {
  if (!supabase || !isSupabaseConfigured) {
    return { success: true };
  }

  try {
    const { error } = await supabase
      .from('customers')
      .update({ marketing_consent: consent, updated_at: new Date().toISOString() })
      .eq('id', customerId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update consent.' };
  }
};

export const exportCustomersCSV = (customers: Customer[]): string => {
  const headers = ['Name', 'Phone', 'Email', 'Marketing Consent', 'Order Count', 'Total Spent', 'Last Order', 'First Order'];
  const rows = customers.map((c) => [
    `"${c.name.replace(/"/g, '""')}"`,
    c.phone,
    c.email || '',
    c.marketing_consent ? 'Yes' : 'No',
    String(c.order_count),
    String(c.total_spent),
    c.last_order_at ? new Date(c.last_order_at).toLocaleDateString() : '',
    c.first_order_at ? new Date(c.first_order_at).toLocaleDateString() : '',
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
};

export const downloadCSV = (csv: string, filename: string) => {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// ============================================================
// DISCOUNT CODES
// ============================================================

export const fetchDiscountCodes = async (): Promise<DiscountCode[]> => {
  if (!supabase || !isSupabaseConfigured) {
    return getDemoDiscountCodes();
  }

  try {
    const { data, error } = await supabase
      .from('discount_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as DiscountCode[];
  } catch (err) {
    console.error('[ownerService] Failed to fetch discount codes:', err);
    return [];
  }
};

export const saveDiscountCode = async (
  code: Partial<DiscountCode>
): Promise<{ success: boolean; data?: DiscountCode; error?: string }> => {
  if (!supabase || !isSupabaseConfigured) {
    const codes = getDemoDiscountCodes();
    if (code.id) {
      const updated = codes.map((c) => (c.id === code.id ? { ...c, ...code, updated_at: new Date().toISOString() } : c));
      saveDemoDiscountCodes(updated);
      return { success: true, data: updated.find((c) => c.id === code.id) };
    } else {
      const newCode: DiscountCode = {
        id: `disc-${Date.now()}`,
        code: code.code || 'NEW',
        description: code.description || null,
        discount_type: code.discount_type || 'percentage',
        discount_value: code.discount_value || 10,
        min_order_amount: code.min_order_amount || 0,
        max_discount_amount: code.max_discount_amount || null,
        max_uses: code.max_uses || null,
        used_count: 0,
        valid_from: code.valid_from || new Date().toISOString(),
        valid_until: code.valid_until || null,
        active: code.active ?? true,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      saveDemoDiscountCodes([newCode, ...codes]);
      return { success: true, data: newCode };
    }
  }

  try {
    if (code.id) {
      const { data, error } = await supabase
        .from('discount_codes')
        .update({
          code: code.code,
          description: code.description,
          discount_type: code.discount_type,
          discount_value: code.discount_value,
          min_order_amount: code.min_order_amount,
          max_discount_amount: code.max_discount_amount,
          max_uses: code.max_uses,
          valid_from: code.valid_from,
          valid_until: code.valid_until,
          active: code.active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', code.id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data: data as DiscountCode };
    } else {
      const { data, error } = await supabase
        .from('discount_codes')
        .insert({
          code: code.code?.toUpperCase(),
          description: code.description,
          discount_type: code.discount_type || 'percentage',
          discount_value: code.discount_value || 10,
          min_order_amount: code.min_order_amount || 0,
          max_discount_amount: code.max_discount_amount,
          max_uses: code.max_uses,
          valid_from: code.valid_from || new Date().toISOString(),
          valid_until: code.valid_until,
          active: code.active ?? true,
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data: data as DiscountCode };
    }
  } catch (err: any) {
    console.error('[ownerService] Error saving discount code:', err);
    return { success: false, error: err.message || 'Failed to save discount code.' };
  }
};

export const deleteDiscountCode = async (
  id: string
): Promise<{ success: boolean; error?: string }> => {
  if (!supabase || !isSupabaseConfigured) {
    const codes = getDemoDiscountCodes();
    saveDemoDiscountCodes(codes.filter((c) => c.id !== id));
    return { success: true };
  }

  try {
    const { error } = await supabase.from('discount_codes').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete discount code.' };
  }
};

export const validateDiscountCode = async (
  code: string,
  orderTotal: number
): Promise<DiscountValidationResult> => {
  if (!supabase || !isSupabaseConfigured) {
    // Demo validation
    const codes = getDemoDiscountCodes();
    const found = codes.find((c) => c.code.toUpperCase() === code.toUpperCase() && c.active);
    if (!found) return { valid: false, error: 'Invalid or expired discount code.' };
    if (orderTotal < found.min_order_amount) {
      return { valid: false, error: `Minimum order amount: ₹${found.min_order_amount}` };
    }
    if (found.max_uses && found.used_count >= found.max_uses) {
      return { valid: false, error: 'This code has reached its usage limit.' };
    }

    let discountAmount = 0;
    if (found.discount_type === 'percentage') {
      discountAmount = Math.round(orderTotal * (found.discount_value / 100));
      if (found.max_discount_amount && discountAmount > found.max_discount_amount) {
        discountAmount = found.max_discount_amount;
      }
    } else {
      discountAmount = found.discount_value;
    }

    return {
      valid: true,
      code: found.code,
      discount_type: found.discount_type,
      discount_value: found.discount_value,
      discount_amount: discountAmount,
      max_discount_amount: found.max_discount_amount,
      min_order_amount: found.min_order_amount,
    };
  }

  try {
    const { data, error } = await supabase.rpc('validate_discount_code', {
      code: code.trim(),
    });

    if (error) throw error;
    if (!data || !data.valid) {
      return { valid: false, error: data?.error || 'Invalid or expired discount code.' };
    }

    if (orderTotal < (data.min_order_amount || 0)) {
      return { valid: false, error: `Minimum order amount: ₹${data.min_order_amount}` };
    }

    let discountAmount = 0;
    if (data.discount_type === 'percentage') {
      discountAmount = Math.round(orderTotal * (data.discount_value / 100));
      if (data.max_discount_amount && discountAmount > data.max_discount_amount) {
        discountAmount = data.max_discount_amount;
      }
    } else {
      discountAmount = data.discount_value;
    }

    return {
      valid: true,
      code: data.code,
      discount_type: data.discount_type,
      discount_value: data.discount_value,
      discount_amount: discountAmount,
      max_discount_amount: data.max_discount_amount,
      min_order_amount: data.min_order_amount,
    };
  } catch (err: any) {
    console.error('[ownerService] Error validating discount:', err);
    return { valid: false, error: 'Unable to validate discount code.' };
  }
};

export const incrementDiscountUsage = async (code: string): Promise<void> => {
  if (!supabase || !isSupabaseConfigured) return;
  try {
    await supabase.rpc('increment_discount_usage', { code_text: code });
  } catch (err) {
    console.warn('[ownerService] Failed to increment discount usage:', err);
  }
};

// ============================================================
// HAPPY HOUR SCHEDULES
// ============================================================

export const fetchHappyHourSchedules = async (): Promise<HappyHourSchedule[]> => {
  if (!supabase || !isSupabaseConfigured) {
    return getDemoHappyHours();
  }

  try {
    const { data, error } = await supabase
      .from('happy_hour_schedules')
      .select('*')
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) throw error;
    return (data || []) as HappyHourSchedule[];
  } catch (err) {
    console.error('[ownerService] Failed to fetch happy hours:', err);
    return [];
  }
};

export const saveHappyHourSchedule = async (
  schedule: Partial<HappyHourSchedule>
): Promise<{ success: boolean; data?: HappyHourSchedule; error?: string }> => {
  if (!supabase || !isSupabaseConfigured) {
    const schedules = getDemoHappyHours();
    if (schedule.id) {
      const updated = schedules.map((s) => (s.id === schedule.id ? { ...s, ...schedule, updated_at: new Date().toISOString() } : s));
      saveDemoHappyHours(updated);
      return { success: true, data: updated.find((s) => s.id === schedule.id) };
    } else {
      const newSchedule: HappyHourSchedule = {
        id: `hh-${Date.now()}`,
        label: schedule.label || 'Happy Hour',
        day_of_week: schedule.day_of_week ?? 0,
        start_time: schedule.start_time || '15:00',
        end_time: schedule.end_time || '17:00',
        discount_percentage: schedule.discount_percentage || 10,
        category_id: schedule.category_id || null,
        active: schedule.active ?? true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      saveDemoHappyHours([...schedules, newSchedule]);
      return { success: true, data: newSchedule };
    }
  }

  try {
    if (schedule.id) {
      const { data, error } = await supabase
        .from('happy_hour_schedules')
        .update({
          label: schedule.label,
          day_of_week: schedule.day_of_week,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          discount_percentage: schedule.discount_percentage,
          category_id: schedule.category_id,
          active: schedule.active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', schedule.id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data: data as HappyHourSchedule };
    } else {
      const { data, error } = await supabase
        .from('happy_hour_schedules')
        .insert({
          label: schedule.label || 'Happy Hour',
          day_of_week: schedule.day_of_week ?? 0,
          start_time: schedule.start_time || '15:00',
          end_time: schedule.end_time || '17:00',
          discount_percentage: schedule.discount_percentage || 10,
          category_id: schedule.category_id,
          active: schedule.active ?? true,
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data: data as HappyHourSchedule };
    }
  } catch (err: any) {
    console.error('[ownerService] Error saving happy hour:', err);
    return { success: false, error: err.message || 'Failed to save schedule.' };
  }
};

export const deleteHappyHourSchedule = async (
  id: string
): Promise<{ success: boolean; error?: string }> => {
  if (!supabase || !isSupabaseConfigured) {
    const schedules = getDemoHappyHours();
    saveDemoHappyHours(schedules.filter((s) => s.id !== id));
    return { success: true };
  }

  try {
    const { error } = await supabase.from('happy_hour_schedules').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete schedule.' };
  }
};

export const getActiveHappyHour = async (): Promise<ActiveHappyHour | null> => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  if (!supabase || !isSupabaseConfigured) {
    const schedules = getDemoHappyHours();
    const active = schedules.find(
      (s) => s.active && s.day_of_week === dayOfWeek && s.start_time <= currentTime && s.end_time > currentTime
    );
    return active
      ? { label: active.label, discount_percentage: active.discount_percentage, category_id: active.category_id, end_time: active.end_time }
      : null;
  }

  try {
    const { data, error } = await supabase
      .from('happy_hour_schedules')
      .select('*')
      .eq('active', true)
      .eq('day_of_week', dayOfWeek)
      .lte('start_time', currentTime)
      .gt('end_time', currentTime)
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    const s = data as HappyHourSchedule;
    return { label: s.label, discount_percentage: s.discount_percentage, category_id: s.category_id, end_time: s.end_time };
  } catch {
    return null;
  }
};

// ============================================================
// STOCK ALERTS
// ============================================================

export interface StockAlertItem {
  id: string;
  name: string;
  stock_count: number;
  category_id?: string;
}

export const fetchLowStockItems = async (threshold: number = 5): Promise<StockAlertItem[]> => {
  if (!supabase || !isSupabaseConfigured) {
    // Demo data
    return [
      { id: 'item-low-1', name: 'Truffle Margherita', stock_count: 3, category_id: 'burgers-pizzas' },
      { id: 'item-low-2', name: 'Peri-Peri Fries', stock_count: 0, category_id: 'starters-momos' },
    ];
  }

  try {
    const { data, error } = await supabase
      .from('menu_items')
      .select('id, name, stock_count, category_id')
      .not('stock_count', 'is', null)
      .lte('stock_count', threshold)
      .order('stock_count', { ascending: true });

    if (error) throw error;
    return (data || []) as StockAlertItem[];
  } catch (err) {
    console.error('[ownerService] Failed to fetch low stock items:', err);
    return [];
  }
};
