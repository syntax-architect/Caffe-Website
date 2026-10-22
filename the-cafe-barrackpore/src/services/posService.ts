import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type {
  POSBill,
  POSBillItem,
  POSKotBatch,
  POSTableMapItem,
  POSOrderType,
  POSPaymentMethod,
  POSModifier,
} from '../types/pos';
import { calculateTaxBreakdown, roundCurrency } from '../utils/taxEngine';
import type { TaxConfiguration } from '../types/tax';
import { fetchRestaurantTables } from './dashboardService';

const DEMO_BILLS_STORAGE_KEY = 'cafe_pos_demo_bills';
const DEMO_SETTINGS_PIN_KEY = 'cafe_pos_manager_pin';

export const DEFAULT_MODIFIERS: POSModifier[] = [
  { id: 'mod-espresso', name: 'Extra Espresso Shot', price: 50 },
  { id: 'mod-almond-milk', name: 'Almond / Oat Milk', price: 40 },
  { id: 'mod-vanilla-syrup', name: 'Vanilla Bean Syrup', price: 35 },
  { id: 'mod-extra-cheese', name: 'Extra Mozzarella Cheese', price: 60 },
  { id: 'mod-jalapeno', name: 'Spicy Jalapeños', price: 30 },
  { id: 'mod-gf-crust', name: 'Gluten-Free Base', price: 80 },
  { id: 'mod-truffle-dip', name: 'House Truffle Dip', price: 45 },
  { id: 'mod-less-ice', name: 'Less Ice / No Ice', price: 0 },
];

/**
 * Reads demo bills from local storage
 */
export const getDemoBills = (): POSBill[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DEMO_BILLS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[posService] Error reading demo bills:', err);
    return [];
  }
};

/**
 * Saves demo bills to local storage
 */
export const saveDemoBills = (bills: POSBill[]): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DEMO_BILLS_STORAGE_KEY, JSON.stringify(bills));
  } catch (err) {
    console.warn('[posService] Error saving demo bills:', err);
  }
};

/**
 * Recalculate bill subtotal, tax and grand total with discount applied
 */
export const recalculateBillFinancials = (
  bill: POSBill,
  taxConfig?: TaxConfiguration
): POSBill => {
  const activeItems = (bill.items || []).filter((it) => !it.is_voided);
  let subtotal = 0;

  for (const item of activeItems) {
    let itemPrice = Number(item.unit_price) || 0;
    if (item.modifiers && Array.isArray(item.modifiers)) {
      for (const mod of item.modifiers) {
        itemPrice += Number(mod.price) || 0;
      }
    }
    const lineTotal = roundCurrency(itemPrice * item.quantity);
    item.line_total = lineTotal;
    subtotal += lineTotal;
  }

  subtotal = roundCurrency(subtotal);

  // Compute discount
  let discountAmount = 0;
  if (bill.discount_type === 'percentage' && bill.discount_value) {
    discountAmount = roundCurrency(subtotal * (bill.discount_value / 100));
  } else if (bill.discount_type === 'flat' && bill.discount_value) {
    discountAmount = Math.min(subtotal, bill.discount_value);
  } else if (bill.discount_amount) {
    discountAmount = Math.min(subtotal, bill.discount_amount);
  }

  const netSubtotal = Math.max(0, roundCurrency(subtotal - discountAmount));

  // Default Tax Configuration (India GST 5% inclusive)
  const effectiveTaxConfig: TaxConfiguration = taxConfig || {
    enabled: true,
    mode: 'inclusive',
    label: 'GST',
    rate: 0.05,
    rules: [
      { label: 'CGST', rate: 0.025, mode: 'inclusive' },
      { label: 'SGST', rate: 0.025, mode: 'inclusive' },
    ],
  };

  const taxableItems = activeItems.map((it) => ({
    amount: (it.line_total ?? 0) / Math.max(1, it.quantity),
    quantity: it.quantity,
    category: (it.tax_category as any) || 'food',
  }));

  const breakdown = calculateTaxBreakdown(taxableItems, effectiveTaxConfig);

  return {
    ...bill,
    subtotal,
    discount_amount: discountAmount,
    tax_amount: breakdown.totalTax,
    tax_details: breakdown.lines,
    grand_total: netSubtotal,
    updated_at: new Date().toISOString(),
  };
};

/**
 * Fetches all restaurant tables with their real-time POS bill status.
 */
export const fetchPOSTablesAndBills = async (): Promise<{
  tables: POSTableMapItem[];
  counterBills: POSBill[];
}> => {
  // 1. Fetch tables catalog
  const rawTables = await fetchRestaurantTables();
  const tables = rawTables.filter((t) => t.active);

  // 2. Fetch active bills (running or printed)
  let activeBills: POSBill[] = [];

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: billsData, error: billsErr } = await supabase
        .from('bills')
        .select(`
          *,
          items:bill_items(*),
          kot_batches(*)
        `)
        .in('status', ['running', 'printed'])
        .order('created_at', { ascending: false });

      if (!billsErr && billsData) {
        activeBills = billsData as POSBill[];
      }
    } catch (err) {
      console.warn('[posService] Supabase bills fetch error, using local demo data:', err);
      activeBills = getDemoBills().filter((b) => ['running', 'printed'].includes(b.status));
    }
  } else {
    activeBills = getDemoBills().filter((b) => ['running', 'printed'].includes(b.status));
  }

  // Map tables to POSTableMapItem
  const tableMap: POSTableMapItem[] = tables.map((t) => {
    const matchingBill = activeBills.find(
      (b) => b.order_type === 'dine_in' && b.table_number === t.table_number
    );

    if (matchingBill) {
      const activeItems = (matchingBill.items || []).filter((it) => !it.is_voided);
      const itemCount = activeItems.reduce((acc, it) => acc + (it.quantity || 1), 0);
      return {
        id: t.id,
        table_number: t.table_number,
        label: t.label,
        capacity: t.capacity,
        active: t.active,
        status: matchingBill.status === 'printed' ? 'printed' : 'running',
        current_bill: matchingBill,
        running_total: matchingBill.grand_total,
        item_count: itemCount,
        occupied_since: matchingBill.created_at,
      };
    }

    return {
      id: t.id,
      table_number: t.table_number,
      label: t.label,
      capacity: t.capacity,
      active: t.active,
      status: 'free',
      current_bill: null,
      running_total: 0,
      item_count: 0,
      occupied_since: null,
    };
  });

  const counterBills = activeBills.filter((b) => b.order_type !== 'dine_in');

  return {
    tables: tableMap,
    counterBills,
  };
};

/**
 * Creates a new bill or appends a new KOT batch to an existing running bill.
 * Automatically pushes new batch items to KDS.
 */
export const createOrAppendKOT = async (params: {
  billId?: string;
  orderType: POSOrderType;
  tableNumber?: string | null;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  billNumber?: string;
  idempotencyKey?: string;
  items: {
    id: string;
    name: string;
    quantity: number;
    price: number;
    modifiers?: POSModifier[];
    notes?: string;
    taxCategory?: string;
  }[];
  specialInstructions?: string;
  taxConfig?: TaxConfiguration;
}): Promise<{
  success: boolean;
  bill: POSBill;
  kotBatch: POSKotBatch;
  error?: string;
}> => {
  const {
    billId,
    billNumber,
    idempotencyKey,
    orderType,
    tableNumber,
    customerName,
    customerPhone,
    deliveryAddress,
    items,
    specialInstructions,
    taxConfig,
  } = params;

  if (!items || items.length === 0) {
    return {
      success: false,
      bill: null as any,
      kotBatch: null as any,
      error: 'Cannot fire empty KOT ticket without items.',
    };
  }

  const kotIdempotencyKey = idempotencyKey || `kot_${billId || tableNumber || 'ctr'}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // 1. Supabase Connected Mode
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.rpc('pos_create_or_append_kot', {
        p_bill_id: billId || null,
        p_bill_number: billNumber || null,
        p_order_type: orderType,
        p_table_number: tableNumber || null,
        p_customer_name: customerName || null,
        p_customer_phone: customerPhone || null,
        p_delivery_address: deliveryAddress || null,
        p_items: items.map((it) => ({
          id: it.id,
          name: it.name,
          quantity: it.quantity,
          price: it.price,
          modifiers: it.modifiers || [],
          notes: it.notes || '',
        })),
        p_special_instructions: specialInstructions || null,
        p_idempotency_key: kotIdempotencyKey,
      });

      if (error) throw error;

      // Fetch the updated bill with its items
      const { data: updatedBillData, error: billFetchErr } = await supabase
        .from('bills')
        .select(`
          *,
          items:bill_items(*),
          kot_batches(*)
        `)
        .eq('id', data.bill_id)
        .single();

      if (billFetchErr || !updatedBillData) throw billFetchErr;

      const updatedBill = updatedBillData as POSBill;
      const latestBatch = (updatedBill.kot_batches || []).find(
        (b) => b.id === data.kot_batch_id
      ) || {
        id: data.kot_batch_id,
        bill_id: data.bill_id,
        kot_number: data.kot_number,
        batch_index: data.batch_index,
        order_id: null,
        status: 'sent',
        special_instructions: specialInstructions || null,
        created_at: new Date().toISOString(),
      };

      // Broadcast to local KDS in case tabs share same browser session
      syncToKDSLocal({
        orderRef: data.order_ref || `KOT-${data.batch_index}`,
        orderType,
        tableNumber: tableNumber || null,
        customerName: customerName || `Table ${tableNumber || '??'}`,
        customerPhone,
        items,
        specialInstructions,
      });

      return {
        success: true,
        bill: updatedBill,
        kotBatch: latestBatch,
      };
    } catch (err: any) {
      console.warn('[posService] Supabase KOT RPC failed, falling back to local demo:', err);
    }
  }

  // 2. Demo / Offline Mode
  const demoBills = getDemoBills();

  // Demo Idempotency Check: KOT sent exactly once
  for (const b of demoBills) {
    const existingBatch = (b.kot_batches || []).find(
      (kb: any) => kb.idempotency_key === kotIdempotencyKey
    );
    if (existingBatch) {
      return {
        success: true,
        bill: b,
        kotBatch: existingBatch,
      };
    }
  }

  let foundBill: POSBill | undefined;

  if (billId) {
    foundBill = demoBills.find((b) => b.id === billId);
  } else if (orderType === 'dine_in' && tableNumber) {
    foundBill = demoBills.find(
      (b) =>
        b.order_type === 'dine_in' &&
        b.table_number === tableNumber &&
        ['running', 'printed'].includes(b.status)
    );
  }

  const nowIso = new Date().toISOString();
  let activeBill: POSBill;

  if (!foundBill) {
    const yearStr = new Date().getFullYear();
    const randCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    const billNumber = `B-${yearStr}-${randCode}`;

    activeBill = {
      id: `bill-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      bill_number: billNumber,
      order_type: orderType,
      table_number: orderType === 'dine_in' ? tableNumber || null : null,
      customer_name: customerName || null,
      customer_phone: customerPhone || null,
      delivery_address: deliveryAddress || null,
      status: 'running',
      subtotal: 0,
      discount_amount: 0,
      tax_amount: 0,
      grand_total: 0,
      items: [],
      kot_batches: [],
      created_at: nowIso,
      updated_at: nowIso,
    };
    demoBills.unshift(activeBill);
  } else {
    activeBill = foundBill;
  }

  const batchIndex = (activeBill.kot_batches?.length || 0) + 1;
  const kotBatchId = `kot-${Date.now()}-${batchIndex}`;
  const kotNumber = `KOT-${batchIndex}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

  const newKotBatch: POSKotBatch = {
    id: kotBatchId,
    bill_id: activeBill.id,
    kot_number: kotNumber,
    batch_index: batchIndex,
    order_id: `ord-pos-${Date.now()}`,
    status: 'sent',
    special_instructions: specialInstructions || null,
    created_at: nowIso,
  };
  (newKotBatch as any).idempotency_key = kotIdempotencyKey;

  if (!activeBill.kot_batches) activeBill.kot_batches = [];
  activeBill.kot_batches.push(newKotBatch);

  if (!activeBill.items) activeBill.items = [];

  const createdBillItems: POSBillItem[] = items.map((it, idx) => {
    let price = Number(it.price) || 0;
    if (it.modifiers && Array.isArray(it.modifiers)) {
      for (const m of it.modifiers) {
        price += Number(m.price) || 0;
      }
    }
    const lineTotal = roundCurrency(price * (it.quantity || 1));
    return {
      id: `bitem-${Date.now()}-${idx}`,
      bill_id: activeBill.id,
      kot_batch_id: kotBatchId,
      menu_item_id: it.id,
      item_name: it.name,
      quantity: Math.max(1, it.quantity || 1),
      unit_price: Number(it.price) || 0,
      line_total: lineTotal,
      modifiers: it.modifiers || [],
      notes: it.notes || null,
      tax_category: it.taxCategory || 'food',
      is_voided: false,
      created_at: nowIso,
      updated_at: nowIso,
    };
  });

  activeBill.items.push(...createdBillItems);
  newKotBatch.items = createdBillItems;

  // Recalculate bill financials
  const updatedBill = recalculateBillFinancials(activeBill, taxConfig);
  const billIndex = demoBills.findIndex((b) => b.id === activeBill.id);
  if (billIndex >= 0) {
    demoBills[billIndex] = updatedBill;
  }
  saveDemoBills(demoBills);

  // Sync to KDS
  syncToKDSLocal({
    orderRef: `CB-${newKotBatch.kot_number}`,
    orderType,
    tableNumber: activeBill.table_number,
    customerName: customerName || (orderType === 'dine_in' ? `Table ${activeBill.table_number}` : 'Counter Guest'),
    customerPhone,
    items,
    specialInstructions,
  });

  return {
    success: true,
    bill: updatedBill,
    kotBatch: newKotBatch,
  };
};

/**
 * Pushes POS order to Kitchen Display System (KDS) via local storage and custom events
 */
const syncToKDSLocal = (payload: {
  orderRef: string;
  orderType: POSOrderType;
  tableNumber: string | null;
  customerName: string;
  customerPhone?: string;
  items: {
    id: string;
    name: string;
    quantity: number;
    price: number;
    modifiers?: POSModifier[];
    notes?: string;
  }[];
  specialInstructions?: string;
}) => {
  if (typeof window === 'undefined') return;

  try {
    const raw = localStorage.getItem('cafe_demo_orders');
    const existing = raw ? JSON.parse(raw) : [];

    const nowIso = new Date().toISOString();
    const demoOrder = {
      id: `ord-pos-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      order_ref: payload.orderRef,
      customer_name: payload.customerName,
      customer_phone: payload.customerPhone || '',
      order_type: payload.orderType,
      table_number: payload.tableNumber,
      special_requests: payload.specialInstructions || null,
      subtotal: payload.items.reduce((s, it) => s + it.price * it.quantity, 0),
      total: payload.items.reduce((s, it) => s + it.price * it.quantity, 0),
      status: 'pending',
      source: 'pos',
      payment_required: false,
      payment_status: 'pay_at_counter', // Eligible for KDS!
      created_at: nowIso,
      updated_at: nowIso,
      items: payload.items.map((it, idx) => ({
        id: `kitem-${Date.now()}-${idx}`,
        item_name: it.name,
        quantity: it.quantity,
        unit_price: it.price,
        line_total: it.price * it.quantity,
        selected_options: {
          notes: it.notes || '',
          modifiers: it.modifiers || [],
        },
      })),
    };

    existing.unshift(demoOrder);
    localStorage.setItem('cafe_demo_orders', JSON.stringify(existing.slice(0, 50)));
    localStorage.setItem(
      'cafe_latest_order_event',
      JSON.stringify({ event: 'created', order: demoOrder, ts: Date.now() })
    );

    // Fire custom event
    window.dispatchEvent(new CustomEvent('cafe:order-created', { detail: demoOrder }));
  } catch (err) {
    console.warn('[posService] Failed to sync order to KDS:', err);
  }
};

/**
 * Transfers a running bill from one table to another.
 */
export const transferTable = async (
  billId: string,
  toTableNumber: string
): Promise<{ success: boolean; error?: string }> => {
  const cleanTarget = toTableNumber.trim();

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.rpc('pos_transfer_table', {
        p_bill_id: billId,
        p_to_table: cleanTarget,
      });

      if (error) throw error;
      if (!data.success) return { success: false, error: data.error };

      return { success: true };
    } catch (err: any) {
      console.warn('[posService] Supabase transfer_table error, using local demo:', err);
    }
  }

  // Demo fallback
  const bills = getDemoBills();
  const targetOccupied = bills.some(
    (b) =>
      b.order_type === 'dine_in' &&
      b.table_number === cleanTarget &&
      ['running', 'printed'].includes(b.status) &&
      b.id !== billId
  );

  if (targetOccupied) {
    return { success: false, error: `Table ${cleanTarget} already has an active bill.` };
  }

  const bill = bills.find((b) => b.id === billId);
  if (!bill) return { success: false, error: 'Bill not found.' };

  bill.table_number = cleanTarget;
  bill.updated_at = new Date().toISOString();
  saveDemoBills(bills);

  return { success: true };
};

/**
 * Merges two tables by moving all items from sourceBill into targetBill.
 */
export const mergeTables = async (
  sourceBillId: string,
  targetBillId: string
): Promise<{ success: boolean; error?: string }> => {
  if (sourceBillId === targetBillId) {
    return { success: false, error: 'Cannot merge a table with itself.' };
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.rpc('pos_merge_tables', {
        p_source_bill_id: sourceBillId,
        p_target_bill_id: targetBillId,
      });

      if (error) throw error;
      if (!data.success) return { success: false, error: data.error };

      return { success: true };
    } catch (err: any) {
      console.warn('[posService] Supabase merge_tables error, using local demo:', err);
    }
  }

  // Demo fallback
  const bills = getDemoBills();
  const source = bills.find((b) => b.id === sourceBillId);
  const target = bills.find((b) => b.id === targetBillId);

  if (!source || !target) return { success: false, error: 'One or both bills could not be found.' };

  const sourceItems = (source.items || []).map((it) => ({
    ...it,
    bill_id: target.id,
    notes: `${it.notes ? `${it.notes} ` : ''}(Merged from Table ${source.table_number || '??'})`,
  }));

  if (!target.items) target.items = [];
  target.items.push(...sourceItems);

  if (!target.kot_batches) target.kot_batches = [];
  if (source.kot_batches) {
    target.kot_batches.push(
      ...source.kot_batches.map((kb) => ({ ...kb, bill_id: target.id }))
    );
  }

  source.status = 'merged';
  source.items = [];
  source.updated_at = new Date().toISOString();

  const updatedTarget = recalculateBillFinancials(target);
  const targetIdx = bills.findIndex((b) => b.id === target.id);
  const sourceIdx = bills.findIndex((b) => b.id === source.id);

  if (targetIdx >= 0) bills[targetIdx] = updatedTarget;
  if (sourceIdx >= 0) bills[sourceIdx] = source;

  saveDemoBills(bills);
  return { success: true };
};

/**
 * Moves specific items from source bill to target bill.
 */
export const moveItemsBetweenBills = async (
  sourceBillId: string,
  targetBillId: string,
  itemIds: string[]
): Promise<{ success: boolean; error?: string }> => {
  if (itemIds.length === 0) {
    return { success: false, error: 'No items selected to move.' };
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.rpc('pos_move_items', {
        p_source_bill_id: sourceBillId,
        p_target_bill_id: targetBillId,
        p_item_ids: itemIds,
      });

      if (error) throw error;
      if (!data.success) return { success: false, error: data.error };

      return { success: true };
    } catch (err: any) {
      console.warn('[posService] Supabase move_items error, using local demo:', err);
    }
  }

  // Demo fallback
  const bills = getDemoBills();
  const source = bills.find((b) => b.id === sourceBillId);
  const target = bills.find((b) => b.id === targetBillId);

  if (!source || !target) return { success: false, error: 'Source or target bill not found.' };

  const toMove = (source.items || []).filter((it) => itemIds.includes(it.id));
  source.items = (source.items || []).filter((it) => !itemIds.includes(it.id));

  if (!target.items) target.items = [];
  target.items.push(
    ...toMove.map((it) => ({
      ...it,
      bill_id: target.id,
      notes: `${it.notes ? `${it.notes} ` : ''}(Moved from Table ${source.table_number || '??'})`,
    }))
  );

  recalculateBillFinancials(source);
  recalculateBillFinancials(target);

  if ((source.items || []).filter((it) => !it.is_voided).length === 0) {
    source.status = 'voided';
  }

  saveDemoBills(bills);
  return { success: true };
};

/**
 * Voids an item on a bill with required reason and manager PIN verification if above limit.
 */
export const voidBillItem = async (params: {
  billId: string;
  itemId: string;
  reason: string;
  managerPin?: string;
  itemPrice: number;
}): Promise<{ success: boolean; error?: string }> => {
  const { billId, itemId, reason, managerPin, itemPrice } = params;

  if (!reason || !reason.trim()) {
    return { success: false, error: 'Void reason is strictly required.' };
  }

  const voidLimit = getManagerVoidLimit();
  if (itemPrice >= voidLimit) {
    const isPinValid = verifyManagerPinLocally(managerPin || '');
    if (!isPinValid) {
      return { success: false, error: 'Invalid Manager PIN. Authorization failed.' };
    }
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.rpc('pos_void_item', {
        p_bill_item_id: itemId,
        p_void_reason: reason.trim(),
        p_manager_pin: managerPin?.trim() || null,
      });

      if (error) throw error;
      if (!data.success) return { success: false, error: data.error };

      return { success: true };
    } catch (err: any) {
      console.warn('[posService] Supabase void_item error, using local demo:', err);
    }
  }

  // Demo fallback
  const bills = getDemoBills();
  const bill = bills.find((b) => b.id === billId);
  if (!bill) return { success: false, error: 'Bill not found.' };

  const item = (bill.items || []).find((it) => it.id === itemId);
  if (!item) return { success: false, error: 'Item not found on bill.' };

  item.is_voided = true;
  item.void_reason = reason.trim();
  item.void_approved_by = managerPin ? 'Manager (PIN Verified)' : 'Staff';
  item.voided_at = new Date().toISOString();

  recalculateBillFinancials(bill);
  saveDemoBills(bills);

  // Record in demo audit log
  if (typeof localStorage !== 'undefined') {
    try {
      const rawAudit = localStorage.getItem('cafe_demo_audit_log');
      const audit = rawAudit ? JSON.parse(rawAudit) : [];
      audit.unshift({
        id: `audit_${Date.now()}`,
        restaurant_id: 'the-cafe-barrackpore',
        actor_id: 'pos',
        actor_name: item.void_approved_by,
        actor_role: managerPin ? 'manager' : 'staff',
        action: 'POS_ITEM_VOIDED',
        target_type: 'bill_items',
        target_id: itemId,
        details: {
          bill_id: billId,
          bill_number: bill.bill_number,
          item_name: item.item_name,
          quantity: item.quantity,
          line_total: item.line_total,
          reason: reason.trim(),
        },
        created_at: new Date().toISOString(),
      });
      localStorage.setItem('cafe_demo_audit_log', JSON.stringify(audit.slice(0, 100)));
    } catch {
      // ignore
    }
  }

  return { success: true };
};

/**
 * Updates bill status to 'printed' and stamps timestamp.
 */
export const markBillPrinted = async (
  billId: string
): Promise<{ success: boolean; error?: string }> => {
  const nowIso = new Date().toISOString();

  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('bills')
        .update({ status: 'printed', printed_at: nowIso, updated_at: nowIso })
        .eq('id', billId);

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.warn('[posService] Supabase mark printed error:', err);
    }
  }

  const bills = getDemoBills();
  const bill = bills.find((b) => b.id === billId);
  if (bill) {
    bill.status = 'printed';
    bill.printed_at = nowIso;
    bill.updated_at = nowIso;
    saveDemoBills(bills);
  }

  return { success: true };
};

/**
 * Settles and marks a bill as paid.
 */
export const settleBill = async (params: {
  billId: string;
  paymentMethod: POSPaymentMethod;
  discountType?: 'percentage' | 'flat' | 'manual' | null;
  discountValue?: number;
  discountCode?: string | null;
  discountAmount?: number;
  discountApprovedBy?: string | null;
  taxConfig?: TaxConfiguration;
}): Promise<{ success: boolean; grandTotal: number; error?: string }> => {
  const {
    billId,
    paymentMethod,
    discountType,
    discountValue,
    discountCode,
    discountAmount,
    discountApprovedBy,
    taxConfig,
  } = params;

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.rpc('pos_settle_bill', {
        p_bill_id: billId,
        p_payment_method: paymentMethod,
        p_discount_type: discountType || null,
        p_discount_value: discountValue || 0,
        p_discount_code: discountCode || null,
        p_discount_amount: discountAmount || 0,
        p_discount_approved_by: discountApprovedBy || null,
      });

      if (error) throw error;
      if (!data.success) return { success: false, grandTotal: 0, error: data.error };

      return { success: true, grandTotal: data.grand_total };
    } catch (err: any) {
      console.warn('[posService] Supabase settle_bill error, using local demo:', err);
    }
  }

  // Demo fallback
  const bills = getDemoBills();
  const bill = bills.find((b) => b.id === billId);
  if (!bill) return { success: false, grandTotal: 0, error: 'Bill not found.' };

  bill.status = 'paid';
  bill.payment_status = 'paid';
  bill.payment_method = paymentMethod;
  bill.discount_type = discountType || null;
  bill.discount_value = discountValue || 0;
  bill.discount_code = discountCode || null;
  bill.discount_amount = discountAmount || 0;
  bill.discount_approved_by = discountApprovedBy || null;
  bill.paid_at = new Date().toISOString();

  const updated = recalculateBillFinancials(bill, taxConfig);
  saveDemoBills(bills);

  return { success: true, grandTotal: updated.grand_total ?? 0 };
};

/**
 * Verifies manager PIN against local storage or default '1234'.
 */
export const verifyManagerPinLocally = (pin: string): boolean => {
  if (!pin) return false;
  const cleanPin = pin.trim();
  if (typeof window !== 'undefined') {
    const configured = localStorage.getItem(DEMO_SETTINGS_PIN_KEY);
    if (configured) {
      return configured === cleanPin;
    }
  }
  return cleanPin === '1234';
};

/**
 * Gets configured manager void limit (defaults to 0: all voids require PIN authorization).
 */
export const getManagerVoidLimit = (): number => {
  return 0; // ₹0: reason required, manager PIN required
};
