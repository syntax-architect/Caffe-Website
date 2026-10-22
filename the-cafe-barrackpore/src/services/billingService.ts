/**
 * Commercial Billing, Split Bill & Payment Settlement Service
 * Manages itemized, equal, and custom splits, mixed tenders, tips,
 * and double-tap idempotency enforcement.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type {
  BillSplitPart,
  BillSplitSummary,
  CreateSplitPartInput,
  SplitType,
  TenderPaymentInput,
  TenderPaymentResult,
  TenderType,
} from '../types/billing';
import { roundToCents, calculateCashChange } from '../utils/billSplitCalculations';

const toMinorUnits = (val: number): number => Math.round((Number(val) || 0) * 100);
const toMajorUnits = (val: number): number => (Number(val) || 0) / 100;

const SPLITS_STORAGE_KEY = 'cafe_demo_bill_splits';
const PAYMENTS_STORAGE_KEY = 'cafe_demo_payments_ledger';
const inFlightIdempotencyKeys = new Set<string>();

/**
 * Generate a unique idempotency key for transactions
 */
export function generateIdempotencyKey(prefix = 'pay'): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${ts}_${rand}`;
}

// Demo Local Storage Helpers
function getDemoSplits(): BillSplitPart[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SPLITS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDemoSplits(splits: BillSplitPart[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SPLITS_STORAGE_KEY, JSON.stringify(splits));
  } catch (err) {
    console.warn('[billingService] Failed to save demo splits:', err);
  }
}

interface DemoPaymentEntry {
  id: string;
  order_ref: string;
  split_id?: string;
  amount: number;
  tip_amount: number;
  tender_type: TenderType;
  tendered_amount: number;
  change_due: number;
  payment_reference?: string;
  idempotency_key: string;
  shift_id?: string;
  created_at: string;
}

function getDemoPayments(): DemoPaymentEntry[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PAYMENTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDemoPayment(entry: DemoPaymentEntry): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const existing = getDemoPayments();
    localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify([...existing, entry]));
  } catch (err) {
    console.warn('[billingService] Failed to save demo payment:', err);
  }
}

/**
 * Fetches bill split status for an order
 */
export async function getBillSplits(
  orderRef: string,
  orderTotal = 0,
  orderSubtotal = 0,
  orderTax = 0
): Promise<BillSplitSummary> {
  const cleanRef = trimRef(orderRef);

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('bill_splits')
        .select('*')
        .eq('order_ref', cleanRef)
        .order('part_number', { ascending: true });

      if (error) {
        console.warn('[billingService] Supabase getBillSplits error, falling back:', error.message);
      } else if (data && data.length > 0) {
        return buildSummaryFromParts(cleanRef, data as BillSplitPart[], orderTotal, orderSubtotal, orderTax);
      }
    } catch (e) {
      console.warn('[billingService] Exception reading bill_splits:', e);
    }
  }

  // Demo fallback
  const demoParts = getDemoSplits().filter((s) => s.order_ref === cleanRef);
  return buildSummaryFromParts(cleanRef, demoParts, orderTotal, orderSubtotal, orderTax);
}

function trimRef(ref: string): string {
  return String(ref || '').trim();
}

function buildSummaryFromParts(
  orderRef: string,
  parts: BillSplitPart[],
  orderTotal = 0,
  orderSubtotal = 0,
  orderTax = 0
): BillSplitSummary {
  const isSplit = parts.length > 0;
  const splitType = isSplit ? parts[0].split_type : null;
  const totalAmount = isSplit
    ? roundToCents(parts.reduce((sum, p) => sum + roundToCents(p.amount || 0), 0))
    : roundToCents(orderTotal);

  const totalPaid = isSplit
    ? roundToCents(
        parts.filter((p) => p.status === 'paid').reduce((sum, p) => sum + roundToCents(p.amount || 0), 0)
      )
    : 0;

  const totalTips = isSplit
    ? roundToCents(
        parts.filter((p) => p.status === 'paid').reduce((sum, p) => sum + roundToCents(p.tip_amount || 0), 0)
      )
    : 0;

  const remainingBalance = Math.max(0, roundToCents(totalAmount - totalPaid));
  const isFullyPaid = isSplit ? parts.length > 0 && parts.every((p) => p.status === 'paid') : false;

  return {
    orderRef,
    orderTotal,
    orderSubtotal,
    orderTax,
    isSplit,
    splitType,
    totalAmount,
    totalPaid,
    totalTips,
    remainingBalance,
    isFullyPaid,
    parts,
  };
}

/**
 * Creates an atomic bill split across N parts (equal, by-item, or custom)
 */
export async function createBillSplit(
  orderRef: string,
  orderTotal: number,
  orderSubtotal: number,
  orderTax: number,
  splitType: SplitType,
  partsInput: CreateSplitPartInput[]
): Promise<{ success: boolean; summary?: BillSplitSummary; error?: string }> {
  const cleanRef = trimRef(orderRef);
  const roundedOrderTotal = roundToCents(orderTotal);

  if (!partsInput || partsInput.length === 0) {
    return { success: false, error: 'Cannot split into zero parts' };
  }

  // Validate exact cent precision sum
  const sumParts = roundToCents(partsInput.reduce((s, p) => s + roundToCents(p.amount), 0));
  if (Math.abs(sumParts - roundedOrderTotal) > 0.009) {
    return {
      success: false,
      error: `Sum of split amounts (${sumParts}) does not equal the order total (${roundedOrderTotal}). Tax & amounts must add up to the cent.`,
    };
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.rpc('split_bill_atomic', {
        p_order_ref: cleanRef,
        p_split_type: splitType,
        p_splits: partsInput.map((p, idx) => ({
          part_number: idx + 1,
          payer_label: p.payer_label || `Guest ${idx + 1}`,
          amount: roundToCents(p.amount),
          subtotal: roundToCents(p.subtotal || 0),
          tax_amount: roundToCents(p.tax_amount || 0),
          items: p.items || [],
        })),
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data && !data.success) {
        return { success: false, error: data.error || 'Split bill RPC failed' };
      }

      const summary = await getBillSplits(cleanRef, orderTotal, orderSubtotal, orderTax);
      return { success: true, summary };
    } catch (e: any) {
      console.warn('[billingService] Supabase split_bill_atomic error, using demo fallback:', e);
    }
  }

  // Demo Fallback
  const allSplits = getDemoSplits().filter((s) => s.order_ref !== cleanRef);
  const now = new Date().toISOString();

  const newParts: BillSplitPart[] = partsInput.map((p, idx) => ({
    id: `split_${Date.now()}_${idx + 1}_${Math.random().toString(36).substring(2, 6)}`,
    order_id: `ord_${cleanRef}`,
    order_ref: cleanRef,
    part_number: idx + 1,
    total_parts: partsInput.length,
    payer_label: p.payer_label || `Guest ${idx + 1}`,
    split_type: splitType,
    items: p.items || [],
    subtotal: roundToCents(p.subtotal || 0),
    tax_amount: roundToCents(p.tax_amount || 0),
    tip_amount: 0,
    amount: roundToCents(p.amount),
    total_paid: 0,
    status: 'pending',
    tender_type: null,
    payment_reference: null,
    tendered_amount: 0,
    change_due: 0,
    paid_at: null,
    idempotency_key: null,
    created_at: now,
    updated_at: now,
  }));

  saveDemoSplits([...allSplits, ...newParts]);
  const summary = buildSummaryFromParts(cleanRef, newParts, orderTotal, orderSubtotal, orderTax);
  return { success: true, summary };
}

/**
 * Idempotent tender payment execution
 * Blocks double taps and handles cash change, card terminal references,
 * UPI references, and tips.
 */
export async function processTenderPayment(
  input: TenderPaymentInput
): Promise<TenderPaymentResult> {
  const {
    orderRef,
    splitId,
    tenderType,
    amount,
    tipAmount = 0,
    tenderedAmount = 0,
    paymentReference,
    idempotencyKey,
    shiftId,
    actorId,
    actorName,
  } = input;

  const cleanRef = trimRef(orderRef || '');
  const pAmount = roundToCents(amount);
  const pTip = roundToCents(tipAmount);
  const pTendered = roundToCents(tenderedAmount || (tenderType === 'cash' ? pAmount + pTip : 0));
  const changeCalc = calculateCashChange(pAmount + pTip, pTendered);
  const changeDue = tenderType === 'cash' ? changeCalc.changeDue : 0;

  if (!idempotencyKey) {
    return {
      success: false,
      orderRef: cleanRef,
      tenderType,
      amount: pAmount,
      tipAmount: pTip,
      tenderedAmount: pTendered,
      changeDue: 0,
      remainingBalance: pAmount,
      isBillClosed: false,
      error: 'Idempotency key is required to prevent double charging.',
    };
  }

  // Double-tap in-flight prevention
  if (inFlightIdempotencyKeys.has(idempotencyKey)) {
    return {
      success: true,
      isDuplicate: true,
      orderRef: cleanRef,
      splitId,
      tenderType,
      amount: pAmount,
      tipAmount: pTip,
      tenderedAmount: pTendered,
      changeDue,
      remainingBalance: 0,
      isBillClosed: true,
      idempotencyKey,
    };
  }

  inFlightIdempotencyKeys.add(idempotencyKey);

  try {
    if (isSupabaseConfigured && supabase) {
      try {
        const amountMinor = toMinorUnits(pAmount);
        const tipMinor = toMinorUnits(pTip);
        const tenderedMinor = toMinorUnits(pTendered);

        const { data, error } = await supabase.rpc('process_bill_payment', {
          p_bill_number: cleanRef,
          p_split_id: splitId || null,
          p_tender_type: tenderType,
          p_amount_minor: amountMinor,
          p_tip_minor: tipMinor,
          p_tendered_minor: tenderedMinor,
          p_payment_reference: paymentReference || null,
          p_idempotency_key: idempotencyKey,
          p_actor_id: actorId || null,
          p_actor_name: actorName || null,
          p_actor_role: (input as any).actorRole || 'cashier',
          p_shift_id: shiftId || null,
        });

        if (error) {
          return {
            success: false,
            orderRef: cleanRef,
            splitId,
            tenderType,
            amount: pAmount,
            tipAmount: pTip,
            tenderedAmount: pTendered,
            changeDue: 0,
            remainingBalance: pAmount,
            isBillClosed: false,
            error: error.message,
          };
        }

        if (data && !data.success) {
          return {
            success: false,
            orderRef: cleanRef,
            splitId,
            tenderType,
            amount: pAmount,
            tipAmount: pTip,
            tenderedAmount: pTendered,
            changeDue: 0,
            remainingBalance: pAmount,
            isBillClosed: false,
            error: data.error || 'Payment failed',
          };
        }

        return {
          success: true,
          paymentId: data.payment_id,
          orderRef: cleanRef,
          splitId,
          tenderType,
          amount: pAmount,
          tipAmount: pTip,
          tenderedAmount: pTendered,
          changeDue: data.change_due_minor !== undefined ? toMajorUnits(data.change_due_minor) : Number(data.change_due || changeDue),
          remainingBalance: data.remaining_minor !== undefined ? toMajorUnits(data.remaining_minor) : Number(data.remaining_balance || 0),
          isBillClosed: Boolean(data.is_bill_closed),
          idempotencyKey,
          isDuplicate: Boolean(data.is_duplicate),
        };
      } catch (e: any) {
        console.warn('[billingService] Supabase process_bill_payment error, using demo fallback:', e);
      }
    }

    // Demo Mode Payment Handling
    const existingPayments = getDemoPayments();
    const existing = existingPayments.find((p) => p.idempotency_key === idempotencyKey);
    if (existing) {
      return {
        success: true,
        isDuplicate: true,
        paymentId: existing.id,
        orderRef: cleanRef,
        splitId: existing.split_id,
        tenderType: existing.tender_type,
        amount: existing.amount,
        tipAmount: existing.tip_amount,
        tenderedAmount: existing.tendered_amount,
        changeDue: existing.change_due,
        remainingBalance: 0,
        isBillClosed: true,
        idempotencyKey,
      };
    }

    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const paymentEntry: DemoPaymentEntry = {
      id: paymentId,
      order_ref: cleanRef,
      split_id: splitId,
      amount: pAmount,
      tip_amount: pTip,
      tender_type: tenderType,
      tendered_amount: pTendered,
      change_due: changeDue,
      payment_reference: paymentReference,
      idempotency_key: idempotencyKey,
      shift_id: shiftId,
      created_at: new Date().toISOString(),
    };
    saveDemoPayment(paymentEntry);

    // Update split part if applicable
    const splits = getDemoSplits();
    let isBillClosed = false;

    if (splitId) {
      const idx = splits.findIndex((s) => s.id === splitId);
      if (idx !== -1) {
        splits[idx].status = 'paid';
        splits[idx].tender_type = tenderType;
        splits[idx].payment_reference = paymentReference || null;
        splits[idx].tip_amount = pTip;
        splits[idx].tendered_amount = pTendered;
        splits[idx].change_due = changeDue;
        splits[idx].total_paid = pAmount + pTip;
        splits[idx].paid_at = new Date().toISOString();
        splits[idx].idempotency_key = idempotencyKey;
        splits[idx].updated_at = new Date().toISOString();
        saveDemoSplits(splits);
      }

      const orderSplits = splits.filter((s) => s.order_ref === cleanRef);
      isBillClosed = orderSplits.length > 0 && orderSplits.every((s) => s.status === 'paid');
    } else {
      isBillClosed = true;
    }

    // Update demo order status
    try {
      const rawOrders = localStorage.getItem('cafe_demo_orders');
      if (rawOrders) {
        const orders = JSON.parse(rawOrders);
        const oIdx = orders.findIndex((o: any) => o.order_ref === cleanRef);
        if (oIdx !== -1) {
          if (isBillClosed) {
            orders[oIdx].payment_status = 'paid';
            orders[oIdx].paid_at = new Date().toISOString();
          } else {
            orders[oIdx].payment_status = 'processing';
          }
          orders[oIdx].tips = roundToCents((orders[oIdx].tips || 0) + pTip);
          localStorage.setItem('cafe_demo_orders', JSON.stringify(orders));
        }
      }
    } catch {
      // ignore
    }

    // Record cash in drawer if cash and shift active
    if (tenderType === 'cash' && shiftId && typeof localStorage !== 'undefined') {
      try {
        const rawDrawer = localStorage.getItem('cafe_demo_cash_txs');
        const txs = rawDrawer ? JSON.parse(rawDrawer) : [];
        txs.push({
          id: `tx_${Date.now()}`,
          shift_id: shiftId,
          type: 'sale',
          amount: pAmount + pTip,
          reason: `Bill settlement #${cleanRef} (Cash, tip ${pTip})`,
          order_ref: cleanRef,
          actor_id: actorId || 'cashier',
          actor_name: actorName || 'Cashier',
          idempotency_key: `${idempotencyKey}_drawer`,
          created_at: new Date().toISOString(),
        });
        localStorage.setItem('cafe_demo_cash_txs', JSON.stringify(txs));
      } catch {
        // ignore
      }
    }

    return {
      success: true,
      paymentId,
      orderRef: cleanRef,
      splitId,
      tenderType,
      amount: pAmount,
      tipAmount: pTip,
      tenderedAmount: pTendered,
      changeDue,
      remainingBalance: isBillClosed ? 0 : 0,
      isBillClosed,
      idempotencyKey,
    };
  } finally {
    // Keep key in flight set briefly to prevent rapid duplicate clicks
    setTimeout(() => {
      inFlightIdempotencyKeys.delete(idempotencyKey);
    }, 2000);
  }
}

/**
 * Manager-Gated Refund or Void-After-Payment with Mandatory Audit Log
 */
export async function voidOrRefundOrderSecure(params: {
  orderRef: string;
  reason: string;
  amount?: number;
  actorId: string;
  actorName: string;
  actorRole: string;
  shiftId?: string;
  isPaid: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const { orderRef, reason, amount, actorId, actorName, actorRole, shiftId, isPaid } = params;

  // STRICT RBAC: Only Managers and Owners can refund or void after payment
  if (actorRole !== 'owner' && actorRole !== 'manager') {
    return {
      success: false,
      error: 'Security Policy Violation: Only Manager or Owner roles can issue refunds or void tickets after payment.',
    };
  }

  if (!reason || reason.trim().length < 3) {
    return {
      success: false,
      error: 'A valid operational reason is required for refunds and voids.',
    };
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.rpc('void_or_refund_order_secure', {
        p_order_ref: orderRef,
        p_reason: reason.trim(),
        p_amount_minor: amount ? toMinorUnits(amount) : null,
        p_actor_id: actorId,
        p_actor_name: actorName,
        p_actor_role: actorRole,
        p_shift_id: shiftId || null,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data && !data.success) {
        return { success: false, error: data.error || 'Refund rejected by server.' };
      }

      return { success: true };
    } catch (e: any) {
      console.warn('[billingService] Supabase refund RPC error, falling back to demo:', e);
    }
  }

  // Demo Fallback: Update orders and splits, record in audit log
  if (typeof localStorage !== 'undefined') {
    try {
      const rawOrders = localStorage.getItem('cafe_demo_orders');
      if (rawOrders) {
        const orders = JSON.parse(rawOrders);
        const idx = orders.findIndex((o: any) => o.order_ref === orderRef);
        if (idx !== -1) {
          orders[idx].status = 'cancelled';
          orders[idx].payment_status = isPaid ? 'refunded' : 'cancelled';
          orders[idx].updated_at = new Date().toISOString();
          localStorage.setItem('cafe_demo_orders', JSON.stringify(orders));
        }
      }

      // Record in demo audit log
      const rawAudit = localStorage.getItem('cafe_demo_audit_log');
      const audit = rawAudit ? JSON.parse(rawAudit) : [];
      audit.unshift({
        id: `audit_${Date.now()}`,
        restaurant_id: 'the-cafe-barrackpore',
        actor_id: actorId,
        actor_name: actorName,
        actor_role: actorRole,
        action: isPaid ? 'ORDER_REFUND' : 'ORDER_VOID_AFTER_PAYMENT',
        target_type: 'orders',
        target_id: orderRef,
        details: {
          order_ref: orderRef,
          amount: amount || 0,
          reason,
          timestamp: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      });
      localStorage.setItem('cafe_demo_audit_log', JSON.stringify(audit.slice(0, 100)));

      // If cash refund and shift active, record cash out
      if (shiftId) {
        const rawDrawer = localStorage.getItem('cafe_demo_cash_txs');
        const txs = rawDrawer ? JSON.parse(rawDrawer) : [];
        txs.push({
          id: `tx_${Date.now()}`,
          shift_id: shiftId,
          type: 'refund',
          amount: amount || 0,
          reason: `Manager refund for #${orderRef}: ${reason}`,
          order_ref: orderRef,
          actor_id: actorId,
          actor_name: actorName,
          created_at: new Date().toISOString(),
        });
        localStorage.setItem('cafe_demo_cash_txs', JSON.stringify(txs));
      }
    } catch (e) {
      console.warn('[billingService] Demo refund error:', e);
    }
  }

  return { success: true };
}
