import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { OrderStatus, OrderType } from '../types/order';

export interface KitchenOrderItem {
  id: string;
  item_name: string;
  quantity: number;
  unit_price?: number;
  line_total?: number;
  selected_options?: Record<string, unknown>;
}

export interface KitchenOrder {
  id: string;
  order_ref: string;
  customer_name: string;
  customer_phone?: string;
  order_type: OrderType;
  table_number: string | null;
  special_requests: string | null;
  subtotal?: number;
  total?: number;
  status: OrderStatus;
  source: string;
  created_at: string;
  updated_at: string;
  items: KitchenOrderItem[];
}

export type KitchenFilter = 'all' | 'dine_in' | 'takeaway';
export type KitchenConnectionStatus = 'live' | 'reconnecting' | 'offline';

export const ALLOWED_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['preparing', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['completed', 'cancelled'],
  completed: ['ready'], // Recall if accidentally completed
  cancelled: [],
};

export const isValidStatusTransition = (current: OrderStatus, target: OrderStatus): boolean => {
  return ALLOWED_STATUS_TRANSITIONS[current]?.includes(target) ?? false;
};

/**
 * Default sample orders for demo mode & local testing
 */
export const SAMPLE_KITCHEN_ORDERS: KitchenOrder[] = [
  {
    id: 'demo-order-1',
    order_ref: 'CB-2026-X104',
    customer_name: 'Ananya Roy',
    customer_phone: '9830111222',
    order_type: 'dine_in',
    table_number: '07',
    special_requests: 'Less spicy pasta. Extra chili flakes on the side.',
    subtotal: 680,
    total: 680,
    status: 'pending',
    source: 'qr',
    created_at: new Date(Date.now() - 2.5 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2.5 * 60 * 1000).toISOString(),
    items: [
      { id: 'item-1a', item_name: 'Alfredo Pasta', quantity: 1, unit_price: 380, line_total: 380 },
      { id: 'item-1b', item_name: 'Cold Coffee', quantity: 2, unit_price: 150, line_total: 300 },
    ],
  },
  {
    id: 'demo-order-2',
    order_ref: 'CB-2026-M821',
    customer_name: 'Rajesh Sen',
    customer_phone: '9830222333',
    order_type: 'dine_in',
    table_number: '03',
    special_requests: 'Extra crispy wood-fired pizza crust please.',
    subtotal: 580,
    total: 580,
    status: 'preparing',
    source: 'qr',
    created_at: new Date(Date.now() - 7.5 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 5.0 * 60 * 1000).toISOString(),
    items: [
      { id: 'item-2a', item_name: 'Wood-fired Margherita', quantity: 1, unit_price: 420, line_total: 420 },
      { id: 'item-2b', item_name: 'Peri-Peri Fries', quantity: 1, unit_price: 160, line_total: 160 },
    ],
  },
  {
    id: 'demo-order-3',
    order_ref: 'CB-2026-T409',
    customer_name: 'Priya Sharma',
    customer_phone: '9830333444',
    order_type: 'takeaway',
    table_number: null,
    special_requests: 'Pack iced drinks separately with spill-proof lids.',
    subtotal: 540,
    total: 540,
    status: 'ready',
    source: 'website',
    created_at: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    items: [
      { id: 'item-3a', item_name: 'Iced Caramel Macchiato', quantity: 2, unit_price: 180, line_total: 360 },
      { id: 'item-3b', item_name: 'Classic Club Sandwich', quantity: 1, unit_price: 180, line_total: 180 },
    ],
  },
  {
    id: 'demo-order-4',
    order_ref: 'CB-2026-H312',
    customer_name: 'Vikram Mehta',
    customer_phone: '9830444555',
    order_type: 'dine_in',
    table_number: '05',
    special_requests: null,
    subtotal: 420,
    total: 420,
    status: 'completed',
    source: 'website',
    created_at: new Date(Date.now() - 38 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    items: [
      { id: 'item-4a', item_name: 'Espresso Tonic', quantity: 1, unit_price: 180, line_total: 180 },
      { id: 'item-4b', item_name: 'Lemon Cheesecake', quantity: 1, unit_price: 240, line_total: 240 },
    ],
  },
];

/**
 * Initializes or reads demo orders from local storage
 */
export const getDemoOrders = (): KitchenOrder[] => {
  if (typeof window === 'undefined') return SAMPLE_KITCHEN_ORDERS;
  try {
    const raw = localStorage.getItem('cafe_demo_orders');
    if (!raw) {
      localStorage.setItem('cafe_demo_orders', JSON.stringify(SAMPLE_KITCHEN_ORDERS));
      return SAMPLE_KITCHEN_ORDERS;
    }
    const parsed = JSON.parse(raw) as KitchenOrder[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : SAMPLE_KITCHEN_ORDERS;
  } catch (err) {
    console.warn('[kitchenService] Error reading demo orders:', err);
    return SAMPLE_KITCHEN_ORDERS;
  }
};

/**
 * Saves updated demo orders back to local storage and dispatches sync events
 */
export const saveDemoOrders = (orders: KitchenOrder[]): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('cafe_demo_orders', JSON.stringify(orders));
  } catch (err) {
    console.warn('[kitchenService] Error saving demo orders:', err);
  }
};

/**
 * Fetches all orders required for the Kitchen Display System (active + recent history)
 */
export const fetchKitchenOrders = async (): Promise<{
  activeOrders: KitchenOrder[];
  completedOrders: KitchenOrder[];
  isDemo: boolean;
}> => {
  if (!supabase || !isSupabaseConfigured) {
    const all = getDemoOrders();
    const active = all.filter((o) => ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status));
    const completed = all.filter((o) => o.status === 'completed');
    return {
      activeOrders: active,
      completedOrders: completed.slice(0, 15),
      isDemo: true,
    };
  }

  try {
    // 1. Fetch active orders
    const { data: rawOrders, error: orderErr } = await supabase
      .from('orders')
      .select('*')
      .in('status', ['pending', 'confirmed', 'preparing', 'ready', 'completed'])
      .order('created_at', { ascending: true });

    if (orderErr) throw orderErr;

    const allOrders = (rawOrders || []) as KitchenOrder[];
    const activeOrders = allOrders.filter((o) => ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status));
    const completedOrders = allOrders
      .filter((o) => o.status === 'completed')
      .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
      .slice(0, 15);

    // 2. Fetch line items for active + recent completed orders
    const orderIds = [...activeOrders, ...completedOrders].map((o) => o.id);

    if (orderIds.length > 0) {
      const { data: rawItems, error: itemsErr } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', orderIds);

      if (!itemsErr && rawItems) {
        const itemsByOrderId: Record<string, KitchenOrderItem[]> = {};
        rawItems.forEach((item) => {
          if (!itemsByOrderId[item.order_id]) itemsByOrderId[item.order_id] = [];
          itemsByOrderId[item.order_id].push({
            id: item.id,
            item_name: item.item_name,
            quantity: Number(item.quantity) || 1,
            unit_price: Number(item.unit_price) || 0,
            line_total: Number(item.line_total) || 0,
            selected_options: item.selected_options || {},
          });
        });

        activeOrders.forEach((o) => {
          o.items = itemsByOrderId[o.id] || [];
        });
        completedOrders.forEach((o) => {
          o.items = itemsByOrderId[o.id] || [];
        });
      }
    }

    return {
      activeOrders,
      completedOrders,
      isDemo: false,
    };
  } catch (error) {
    console.warn('[kitchenService] Error fetching live kitchen orders, falling back to local dataset:', error);
    const all = getDemoOrders();
    return {
      activeOrders: all.filter((o) => ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status)),
      completedOrders: all.filter((o) => o.status === 'completed').slice(0, 15),
      isDemo: true,
    };
  }
};

/**
 * Transitions an order status with concurrency protection and state machine enforcement
 */
export const transitionOrderStatus = async (
  orderId: string,
  currentStatus: OrderStatus,
  newStatus: OrderStatus
): Promise<{ success: boolean; error?: string; conflict?: boolean }> => {
  // 1. Validate state machine
  if (!isValidStatusTransition(currentStatus, newStatus)) {
    return {
      success: false,
      error: `Invalid transition: Cannot move order from "${currentStatus}" to "${newStatus}".`,
    };
  }

  // 2. Live Supabase Mutation
  if (supabase && isSupabaseConfigured) {
    try {
      // First attempt atomic RPC with expected status concurrency check
      const { data: rpcData, error: rpcErr } = await supabase.rpc('update_order_status_kitchen', {
        p_order_id: orderId,
        p_new_status: newStatus,
        p_expected_current_status: currentStatus,
      });

      if (!rpcErr && rpcData) {
        if (!rpcData.success) {
          return {
            success: false,
            conflict: Boolean(rpcData.conflict),
            error: rpcData.error || 'Server rejected transition.',
          };
        }
        return { success: true };
      }

      // Fallback: direct update with optimistic check
      const { data: updated, error: updateErr } = await supabase
        .from('orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId)
        .eq('status', currentStatus)
        .select('id, status');

      if (updateErr) throw updateErr;

      if (!updated || updated.length === 0) {
        return {
          success: false,
          conflict: true,
          error: 'This order was already updated by another staff member. Screen has refreshed.',
        };
      }

      return { success: true };
    } catch (err) {
      console.error('[kitchenService] Transition failure on Supabase:', err);
      return { success: false, error: 'Network failure while updating order status.' };
    }
  }

  // 3. Demo Mode Local Storage Mutation
  try {
    const all = getDemoOrders();
    const targetIdx = all.findIndex((o) => o.id === orderId);

    if (targetIdx === -1) {
      return { success: false, error: 'Order not found.' };
    }

    if (all[targetIdx].status !== currentStatus) {
      return {
        success: false,
        conflict: true,
        error: `This order was already moved to "${all[targetIdx].status}".`,
      };
    }

    all[targetIdx].status = newStatus;
    all[targetIdx].updated_at = new Date().toISOString();
    saveDemoOrders(all);

    if (typeof window !== 'undefined') {
      const eventPayload = { orderId, newStatus, order: all[targetIdx], ts: Date.now() };
      localStorage.setItem('cafe_latest_order_event', JSON.stringify({ event: 'status_changed', ...eventPayload }));
      window.dispatchEvent(new CustomEvent('cafe:order-status-changed', { detail: eventPayload }));
    }

    return { success: true };
  } catch (err) {
    console.error('[kitchenService] Demo transition error:', err);
    return { success: false, error: 'Failed to update local order state.' };
  }
};

/**
 * Web Audio API synthesized kitchen alert chime (pleasant dual-tone chime: D5 -> A5)
 * Requires no external audio files and triggers reliably upon user interaction.
 */
let sharedAudioCtx: AudioContext | null = null;

export const unlockAudioContext = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false;
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return false;
    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioContextClass();
    }
    if (sharedAudioCtx.state === 'suspended') {
      await sharedAudioCtx.resume();
    }
    return sharedAudioCtx.state === 'running';
  } catch (err) {
    console.warn('[kitchenService] AudioContext unlock error:', err);
    return false;
  }
};

export const playKitchenChime = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return false;

    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioContextClass();
    }

    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }

    const ctx = sharedAudioCtx;
    const now = ctx.currentTime;

    // Tone 1: 587.33 Hz (D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Tone 2: 880 Hz (A5, harmonious chime)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.0, now + 0.12);
    gain2.gain.setValueAtTime(0.3, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.65);

    return true;
  } catch (err) {
    console.warn('[kitchenService] Sound notification prevented by browser:', err);
    return false;
  }
};

/**
 * Sound Preference Management
 */
const SOUND_PREF_KEY = 'cafe_kds_sound_enabled';

export const getSoundPreference = (): boolean => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SOUND_PREF_KEY) === 'true';
};

export const setSoundPreference = (enabled: boolean): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SOUND_PREF_KEY, enabled ? 'true' : 'false');
};

/**
 * Density Preference Management ('comfortable' | 'compact')
 */
const DENSITY_PREF_KEY = 'cafe_kds_density';

export const getDensityPreference = (): 'comfortable' | 'compact' => {
  if (typeof window === 'undefined') return 'comfortable';
  return (localStorage.getItem(DENSITY_PREF_KEY) as 'comfortable' | 'compact') || 'comfortable';
};

export const setDensityPreference = (density: 'comfortable' | 'compact'): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DENSITY_PREF_KEY, density);
};
