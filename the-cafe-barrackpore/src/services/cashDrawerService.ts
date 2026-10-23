/**
 * Cash Drawer & Shift Management Service
 * Handles shift lifecycle (opening float, cash in/out, shift closing with counted vs expected cash),
 * and Z-report financial summaries.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { CashShift, CashDrawerTransaction, ZReportData } from '../types/billing';
import { roundToCents } from '../utils/billSplitCalculations';
import { toMinorUnits, toMajorUnits } from '../utils/currencyMinorUnits';
import { clientDetails } from '../config/client';

const SHIFTS_STORAGE_KEY = 'cafe_demo_cash_shifts';
const TXS_STORAGE_KEY = 'cafe_demo_cash_txs';

function getDemoShifts(): CashShift[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SHIFTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDemoShifts(shifts: CashShift[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SHIFTS_STORAGE_KEY, JSON.stringify(shifts));
  } catch (err) {
    console.warn('[cashDrawerService] Failed to save demo shifts:', err);
  }
}

function getDemoTxs(): CashDrawerTransaction[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(TXS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDemoTxs(txs: CashDrawerTransaction[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(TXS_STORAGE_KEY, JSON.stringify(txs));
  } catch (err) {
    console.warn('[cashDrawerService] Failed to save demo transactions:', err);
  }
}

/**
 * Returns the currently open shift, or null if no shift is currently open.
 */
export async function getCurrentShift(): Promise<CashShift | null> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('cash_shifts')
        .select('*')
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        return data as CashShift;
      }
    } catch (e) {
      console.warn('[cashDrawerService] Supabase getCurrentShift error, falling back:', e);
    }
  }

  // Demo Fallback
  const shifts = getDemoShifts();
  return shifts.find((s) => s.status === 'open') || null;
}

/**
 * Opens a new shift with an opening float
 */
export async function openShift(params: {
  openingFloat: number;
  openedById: string;
  openedByName: string;
}): Promise<{ success: boolean; shift?: CashShift; error?: string }> {
  const { openingFloat, openedById, openedByName } = params;
  const floatAmount = roundToCents(openingFloat);

  if (floatAmount < 0) {
    return { success: false, error: 'Opening float cannot be negative.' };
  }

  // Check if an existing shift is already open
  const current = await getCurrentShift();
  if (current) {
    return {
      success: false,
      error: `Shift #${current.shift_number} opened by ${current.opened_by_name} is already active. Please close it before opening a new shift.`,
    };
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('cash_shifts')
        .insert({
          opened_by_id: openedById,
          opened_by_name: openedByName,
          opening_float: floatAmount,
          status: 'open',
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, shift: data as CashShift };
    } catch (e: any) {
      console.warn('[cashDrawerService] Supabase openShift error, using demo fallback:', e);
    }
  }

  // Demo Fallback
  const shifts = getDemoShifts();
  const nextNum = shifts.length > 0 ? Math.max(...shifts.map((s) => s.shift_number || 0)) + 1 : 1;
  const now = new Date().toISOString();

  const newShift: CashShift = {
    id: `shift_${Date.now()}`,
    restaurant_id: 'the-cafe-barrackpore',
    shift_number: nextNum,
    opened_by_id: openedById,
    opened_by_name: openedByName,
    opening_float: floatAmount,
    opening_float_minor: toMinorUnits(floatAmount),
    opened_at: now,
    status: 'open',
    closed_by_id: null,
    closed_by_name: null,
    closed_at: null,
    counted_cash: null,
    expected_cash: null,
    difference: null,
    z_report_summary: null,
    closing_notes: null,
    created_at: now,
    updated_at: now,
  };

  saveDemoShifts([newShift, ...shifts]);
  return { success: true, shift: newShift };
}

/**
 * Records Cash In (Paid In) or Cash Out (Paid Out) with reason
 */
export async function recordCashTransaction(params: {
  shiftId: string;
  type: 'cash_in' | 'cash_out';
  amount: number;
  reason: string;
  actorId: string;
  actorName: string;
}): Promise<{ success: boolean; transaction?: CashDrawerTransaction; error?: string }> {
  const { shiftId, type, amount, reason, actorId, actorName } = params;
  const pAmount = roundToCents(amount);

  if (pAmount <= 0) {
    return { success: false, error: 'Transaction amount must be greater than zero.' };
  }

  if (!reason || reason.trim().length < 2) {
    return { success: false, error: 'A specific reason is required for cash drawer transactions.' };
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('cash_drawer_transactions')
        .insert({
          shift_id: shiftId,
          type,
          amount: pAmount,
          reason: reason.trim(),
          actor_id: actorId,
          actor_name: actorName,
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, transaction: data as CashDrawerTransaction };
    } catch (e: any) {
      console.warn('[cashDrawerService] Supabase recordCashTransaction error, falling back:', e);
    }
  }

  // Demo Fallback
  const txs = getDemoTxs();
  const newTx: CashDrawerTransaction = {
    id: `tx_${Date.now()}`,
    restaurant_id: 'the-cafe-barrackpore',
    shift_id: shiftId,
    type,
    amount_minor: toMinorUnits(pAmount),
    amount: pAmount,
    reason: reason.trim(),
    actor_id: actorId,
    actor_name: actorName,
    created_at: new Date().toISOString(),
  };

  saveDemoTxs([newTx, ...txs]);
  return { success: true, transaction: newTx };
}

/**
 * Fetches transactions recorded in a shift
 */
export async function getShiftTransactions(shiftId: string): Promise<CashDrawerTransaction[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('cash_drawer_transactions')
        .select('*')
        .eq('shift_id', shiftId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data as CashDrawerTransaction[];
      }
    } catch (e) {
      console.warn('[cashDrawerService] Supabase getShiftTransactions error:', e);
    }
  }

  return getDemoTxs().filter((t) => t.shift_id === shiftId);
}

/**
 * Generates Z-Report Financial Summary for a Shift
 */
export async function generateZReport(shiftId: string): Promise<ZReportData> {
  let shift: CashShift | null = null;

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: rpcData, error } = await supabase.rpc('get_shift_z_report', {
        p_shift_id: shiftId,
      });

      if (!error && rpcData && rpcData.success) {
        const cur = rpcData.currency || 'INR';
        return {
          restaurantName: clientDetails.businessName || 'The Cafe',
          shiftId: rpcData.shift_id,
          shiftNumber: rpcData.shift_number,
          openedAt: rpcData.opened_at,
          closedAt: rpcData.closed_at || new Date().toISOString(),
          openedByName: rpcData.opened_by_name,
          closedByName: rpcData.closed_by_name || 'Active Shift',
          openingFloat: Number(rpcData.opening_float ?? (rpcData.opening_float_minor !== undefined ? toMajorUnits(rpcData.opening_float_minor, cur) : 0)),
          tenderBreakdown: {
            cash: Number(rpcData.tender_breakdown?.cash ?? (rpcData.cash_sales_minor !== undefined ? toMajorUnits(rpcData.cash_sales_minor, cur) : rpcData.cash_sales || 0)),
            card: Number(rpcData.tender_breakdown?.card ?? (rpcData.card_sales_minor !== undefined ? toMajorUnits(rpcData.card_sales_minor, cur) : rpcData.card_sales || 0)),
            upi: Number(rpcData.tender_breakdown?.upi ?? (rpcData.upi_sales_minor !== undefined ? toMajorUnits(rpcData.upi_sales_minor, cur) : rpcData.upi_sales || 0)),
            stripe: Number(rpcData.tender_breakdown?.stripe || 0),
            other: Number(rpcData.tender_breakdown?.other ?? (rpcData.other_sales_minor !== undefined ? toMajorUnits(rpcData.other_sales_minor, cur) : rpcData.other_sales || 0)),
          },
          tenderCounts: {
            cash: Number(rpcData.tender_counts?.cash || 0),
            card: Number(rpcData.tender_counts?.card || 0),
            upi: Number(rpcData.tender_counts?.upi || 0),
            stripe: Number(rpcData.tender_counts?.stripe || 0),
            other: Number(rpcData.tender_counts?.other || 0),
          },
          totalGrossSales: Number(rpcData.gross_sales ?? (rpcData.gross_sales_minor !== undefined ? toMajorUnits(rpcData.gross_sales_minor, cur) : 0)),
          totalNetSales: Number(rpcData.net_sales ?? (rpcData.net_sales_minor !== undefined ? toMajorUnits(rpcData.net_sales_minor, cur) : 0)),
          totalTaxes: Number(rpcData.total_taxes ?? (rpcData.total_taxes_minor !== undefined ? toMajorUnits(rpcData.total_taxes_minor, cur) : 0)),
          totalTips: Number(rpcData.total_tips ?? (rpcData.total_tips_minor !== undefined ? toMajorUnits(rpcData.total_tips_minor, cur) : 0)),
          totalDiscounts: Number(rpcData.total_discounts ?? (rpcData.total_discounts_minor !== undefined ? toMajorUnits(rpcData.total_discounts_minor, cur) : 0)),
          totalRefunds: Number(rpcData.total_refunds ?? (rpcData.total_refunds_minor !== undefined ? toMajorUnits(rpcData.total_refunds_minor, cur) : 0)),
          totalVoids: Number(rpcData.total_voids ?? (rpcData.total_voids_minor !== undefined ? toMajorUnits(rpcData.total_voids_minor, cur) : 0)),
          cashInTotal: Number(rpcData.cash_in_total ?? (rpcData.cash_in_minor !== undefined ? toMajorUnits(rpcData.cash_in_minor, cur) : 0)),
          cashOutTotal: Number(rpcData.cash_out_total ?? (rpcData.cash_out_minor !== undefined ? toMajorUnits(rpcData.cash_out_minor, cur) : 0)),
          cashSales: Number(rpcData.cash_sales ?? (rpcData.cash_sales_minor !== undefined ? toMajorUnits(rpcData.cash_sales_minor, cur) : 0)),
          cashRefunds: Number(rpcData.cash_refunds ?? (rpcData.cash_refunds_minor !== undefined ? toMajorUnits(rpcData.cash_refunds_minor, cur) : 0)),
          expectedCashInDrawer: Number(rpcData.expected_cash ?? (rpcData.expected_cash_minor !== undefined ? toMajorUnits(rpcData.expected_cash_minor, cur) : 0)),
          countedCashInDrawer: Number(rpcData.counted_cash ?? (rpcData.counted_cash_minor !== undefined ? toMajorUnits(rpcData.counted_cash_minor, cur) : rpcData.expected_cash ?? 0)),
          variance: Number(rpcData.variance ?? (rpcData.variance_minor !== undefined ? toMajorUnits(rpcData.variance_minor, cur) : 0)),
          totalTransactionCount: Number(rpcData.transaction_count ?? rpcData.tx_count ?? 0),
          generatedAt: new Date().toISOString(),
        };
      }
    } catch (e) {
      console.warn('[cashDrawerService] Supabase get_shift_z_report error, falling back:', e);
    }
  }

  // Demo Fallback Calculation
  const shifts = getDemoShifts();
  shift = shifts.find((s) => s.id === shiftId) || null;
  const openingFloat = shift?.opening_float || 0;

  // Transactions
  const txs = getDemoTxs().filter((t) => t.shift_id === shiftId);
  const cashInTotal = roundToCents(
    txs.filter((t) => t.type === 'cash_in').reduce((s, t) => s + (t.amount || 0), 0)
  );
  const cashOutTotal = roundToCents(
    txs.filter((t) => t.type === 'cash_out').reduce((s, t) => s + (t.amount || 0), 0)
  );
  const cashRefunds = roundToCents(
    txs.filter((t) => t.type === 'refund').reduce((s, t) => s + (t.amount || 0), 0)
  );

  // Payments
  let payments: any[] = [];
  try {
    const rawP = localStorage.getItem('cafe_demo_payments_ledger');
    payments = rawP ? JSON.parse(rawP) : [];
  } catch {
    // ignore
  }

  const shiftPayments = payments.filter((p) => p.shift_id === shiftId);
  const tenderBreakdown = {
    cash: roundToCents(shiftPayments.filter((p) => p.tender_type === 'cash').reduce((s, p) => s + p.amount, 0)),
    card: roundToCents(shiftPayments.filter((p) => p.tender_type === 'card').reduce((s, p) => s + p.amount, 0)),
    upi: roundToCents(shiftPayments.filter((p) => p.tender_type === 'upi').reduce((s, p) => s + p.amount, 0)),
    stripe: roundToCents(shiftPayments.filter((p) => p.tender_type === 'stripe').reduce((s, p) => s + p.amount, 0)),
    other: roundToCents(shiftPayments.filter((p) => !['cash', 'card', 'upi', 'stripe'].includes(p.tender_type)).reduce((s, p) => s + p.amount, 0)),
  };

  const tenderCounts = {
    cash: shiftPayments.filter((p) => p.tender_type === 'cash').length,
    card: shiftPayments.filter((p) => p.tender_type === 'card').length,
    upi: shiftPayments.filter((p) => p.tender_type === 'upi').length,
    stripe: shiftPayments.filter((p) => p.tender_type === 'stripe').length,
    other: shiftPayments.filter((p) => !['cash', 'card', 'upi', 'stripe'].includes(p.tender_type)).length,
  };

  const totalTips = roundToCents(shiftPayments.reduce((s, p) => s + (p.tip_amount || 0), 0));
  const totalGrossSales = roundToCents(
    tenderBreakdown.cash + tenderBreakdown.card + tenderBreakdown.upi + tenderBreakdown.stripe + tenderBreakdown.other
  );

  // Orders for taxes, discounts, voids
  let orders: any[] = [];
  try {
    const rawO = localStorage.getItem('cafe_demo_orders');
    orders = rawO ? JSON.parse(rawO) : [];
  } catch {
    // ignore
  }

  const shiftOrders = orders.filter((o) => o.shift_id === shiftId);
  const totalTaxes = roundToCents(
    shiftOrders.reduce((s, o) => s + Math.max(0, (o.total || 0) - (o.subtotal || 0)), 0)
  );
  const totalDiscounts = roundToCents(
    shiftOrders.reduce((s, o) => s + (o.discount_amount || 0), 0)
  );
  const totalVoids = roundToCents(
    shiftOrders.filter((o) => o.status === 'cancelled').reduce((s, o) => s + (o.total || 0), 0)
  );
  const totalRefunds = roundToCents(
    shiftOrders.filter((o) => o.payment_status === 'refunded').reduce((s, o) => s + (o.total || 0), 0)
  );

  const totalNetSales = Math.max(0, roundToCents(totalGrossSales - totalTaxes));
  const cashSales = tenderBreakdown.cash;

  // Expected Cash = Opening Float + Cash Sales + Cash Tips + Cash In - Cash Out - Cash Refunds
  const cashTips = roundToCents(shiftPayments.filter((p) => p.tender_type === 'cash').reduce((s, p) => s + (p.tip_amount || 0), 0));
  const expectedCashInDrawer = roundToCents(openingFloat + cashSales + cashTips + cashInTotal - cashOutTotal - cashRefunds);
  const countedCashInDrawer = shift?.counted_cash !== null && shift?.counted_cash !== undefined ? shift.counted_cash : expectedCashInDrawer;
  const variance = roundToCents(countedCashInDrawer - expectedCashInDrawer);

  return {
    restaurantName: clientDetails.businessName || 'The Cafe',
    shiftId: shift?.id || shiftId,
    shiftNumber: shift?.shift_number || 1,
    openedAt: shift?.opened_at || new Date().toISOString(),
    closedAt: shift?.closed_at || new Date().toISOString(),
    openedByName: shift?.opened_by_name || 'Cashier',
    closedByName: shift?.closed_by_name || 'Active Shift',
    openingFloat,
    tenderBreakdown,
    tenderCounts,
    totalGrossSales,
    totalNetSales,
    totalTaxes,
    totalTips,
    totalDiscounts,
    totalRefunds,
    totalVoids,
    cashInTotal,
    cashOutTotal,
    cashSales,
    cashRefunds,
    expectedCashInDrawer,
    countedCashInDrawer,
    variance,
    totalTransactionCount: shiftPayments.length,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Closes an open shift with physical counted cash, calculates difference / variance,
 * and saves immutable Z-Report snapshot.
 */
export async function closeShift(params: {
  shiftId: string;
  countedCash: number;
  closedById: string;
  closedByName: string;
  closingNotes?: string;
}): Promise<{ success: boolean; shift?: CashShift; zReport?: ZReportData; error?: string }> {
  const { shiftId, countedCash, closedById, closedByName, closingNotes } = params;
  const pCounted = roundToCents(countedCash);

  if (pCounted < 0) {
    return { success: false, error: 'Counted cash cannot be negative.' };
  }

  // Pre-calculate Z-report to freeze snapshot
  const zReport = await generateZReport(shiftId);
  const expected = zReport.expectedCashInDrawer;
  const variance = roundToCents(pCounted - expected);
  const now = new Date().toISOString();

  zReport.countedCashInDrawer = pCounted;
  zReport.variance = variance;
  zReport.closedByName = closedByName;
  zReport.closedAt = now;

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('cash_shifts')
        .update({
          status: 'closed',
          closed_by_id: closedById,
          closed_by_name: closedByName,
          closed_at: now,
          counted_cash: pCounted,
          expected_cash: expected,
          difference: variance,
          closing_notes: closingNotes || null,
          z_report_summary: zReport,
          updated_at: now,
        })
        .eq('id', shiftId)
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, shift: data as CashShift, zReport };
    } catch (e: any) {
      console.warn('[cashDrawerService] Supabase closeShift error, falling back:', e);
    }
  }

  // Demo Fallback
  const shifts = getDemoShifts();
  const idx = shifts.findIndex((s) => s.id === shiftId);
  if (idx === -1) {
    return { success: false, error: 'Shift not found.' };
  }

  shifts[idx] = {
    ...shifts[idx],
    status: 'closed',
    closed_by_id: closedById,
    closed_by_name: closedByName,
    closed_at: now,
    counted_cash: pCounted,
    expected_cash: expected,
    difference: variance,
    closing_notes: closingNotes || null,
    z_report_summary: zReport,
    updated_at: now,
  };

  saveDemoShifts(shifts);
  return { success: true, shift: shifts[idx], zReport };
}

/**
 * Returns past shifts history
 */
export async function getShiftHistory(limit = 20): Promise<CashShift[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('cash_shifts')
        .select('*')
        .order('opened_at', { ascending: false })
        .limit(limit);

      if (!error && data) {
        return data as CashShift[];
      }
    } catch (e) {
      console.warn('[cashDrawerService] Supabase getShiftHistory error:', e);
    }
  }

  return getDemoShifts().slice(0, limit);
}

/**
 * Records a drawer opening event (hardware pulse or manual kick)
 * Writes to both cash_drawer_transactions and audit_log via RPC pos_record_drawer_open.
 */
export async function recordDrawerOpen(params: {
  shiftId: string;
  reason?: string;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
}): Promise<{ success: boolean; error?: string }> {
  const {
    shiftId,
    reason = 'Manual Cash Drawer Pulse',
    actorId = 'staff',
    actorName = 'Staff Cashier',
    actorRole = 'cashier',
  } = params;

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.rpc('pos_record_drawer_open', {
        p_shift_id: shiftId,
        p_reason: reason,
        p_actor_id: actorId,
        p_actor_name: actorName,
        p_actor_role: actorRole,
      });

      if (!error && data?.success) {
        return { success: true };
      }
    } catch (e) {
      console.warn('[cashDrawerService] Supabase recordDrawerOpen error, fallback:', e);
    }
  }

  // Demo fallback
  try {
    const txs = getDemoTxs();
    const newTx: CashDrawerTransaction = {
      id: `tx_drawer_${Date.now()}`,
      restaurant_id: 'the-cafe-barrackpore',
      shift_id: shiftId,
      type: 'drawer_open',
      amount: 0,
      amount_minor: 0,
      reason,
      actor_id: actorId,
      actor_name: actorName,
      actor_role: actorRole,
      created_at: new Date().toISOString(),
    };
    saveDemoTxs([newTx, ...txs]);

    if (typeof localStorage !== 'undefined') {
      const rawAudit = localStorage.getItem('cafe_demo_audit_log');
      const audit = rawAudit ? JSON.parse(rawAudit) : [];
      audit.unshift({
        id: `audit_drawer_${Date.now()}`,
        restaurant_id: 'the-cafe-barrackpore',
        actor_id: actorId,
        actor_name: actorName,
        actor_role: actorRole,
        action: 'CASH_DRAWER_OPEN',
        target_type: 'cash_shifts',
        target_id: shiftId,
        details: {
          reason,
          timestamp: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      });
      localStorage.setItem('cafe_demo_audit_log', JSON.stringify(audit.slice(0, 100)));
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
