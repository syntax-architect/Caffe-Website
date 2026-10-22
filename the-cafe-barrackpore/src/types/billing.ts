/**
 * Billing, Split Bills, Tenders, Cash Drawer & Z-Report Types
 * The Café Barrackpore — Commercial POS Operations
 * Strict Integer Minor Units (Paise/Cents)
 */

export type SplitType = 'equal' | 'item' | 'custom';

export type TenderType =
  | 'cash'
  | 'card'
  | 'upi'
  | 'stripe'
  | 'other'
  | 'counter'
  | 'demo';

export const toMinorUnits = (major: number): number => Math.round((Number(major) || 0) * 100);
export const toMajorUnits = (minor: number): number => (Number(minor) || 0) / 100;
export const formatMinorUnits = (minor: number, currency = ''): string => `${currency ? currency + ' ' : ''}${(toMajorUnits(minor)).toFixed(2)}`;

export interface SplitItemAllocation {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  unit_price_minor?: number;
  line_total_minor?: number;
  tax_amount?: number;
  tax_amount_minor?: number;
}

export interface BillSplitPart {
  id: string;
  restaurant_id?: string;
  order_id?: string;
  order_ref?: string;
  bill_id?: string;
  bill_number?: string;
  part_number: number;
  total_parts: number;
  payer_label: string;
  split_type: SplitType;
  items?: SplitItemAllocation[];
  subtotal_minor?: number;
  tax_amount_minor?: number;
  tip_amount_minor?: number;
  amount_minor?: number; // total due in minor units
  total_paid_minor?: number; // total paid in minor units
  subtotal?: number;
  tax_amount?: number;
  tip_amount?: number;
  amount?: number;
  total_paid?: number;
  status: 'pending' | 'processing' | 'paid' | 'refunded' | 'cancelled';
  tender_type?: TenderType | null;
  payment_reference?: string | null;
  tendered_amount_minor?: number;
  change_due_minor?: number;
  tendered_amount?: number;
  change_due?: number;
  paid_at?: string | null;
  idempotency_key?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillSplitSummary {
  orderRef?: string;
  billNumber?: string;
  orderTotal: number;
  orderSubtotal: number;
  orderTax: number;
  orderTotalMinor?: number;
  isSplit: boolean;
  splitType: SplitType | null;
  totalAmount: number;
  totalPaid: number;
  totalTips: number;
  remainingBalance: number;
  totalAmountMinor?: number;
  totalPaidMinor?: number;
  remainingBalanceMinor?: number;
  isFullyPaid: boolean;
  parts: BillSplitPart[];
}

export interface CreateSplitPartInput {
  payer_label?: string;
  amount: number;
  amount_minor?: number;
  subtotal?: number;
  tax_amount?: number;
  items?: SplitItemAllocation[];
}

export interface TenderPaymentInput {
  orderRef?: string;
  billNumber?: string;
  splitId?: string;
  tenderType: TenderType;
  amount: number;
  amountMinor?: number;
  tipAmount?: number;
  tipMinor?: number;
  tenderedAmount?: number;
  tenderedMinor?: number;
  paymentReference?: string;
  idempotencyKey: string;
  shiftId?: string;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
}

export interface TenderPaymentResult {
  success: boolean;
  paymentId?: string;
  orderRef?: string;
  billNumber?: string;
  splitId?: string;
  tenderType: TenderType;
  amount: number;
  amountMinor?: number;
  tipAmount: number;
  tenderedAmount: number;
  changeDue: number;
  changeDueMinor?: number;
  remainingBalance: number;
  isBillClosed: boolean;
  idempotencyKey?: string;
  isDuplicate?: boolean;
  error?: string;
}

export interface CashShift {
  id: string;
  restaurant_id: string;
  shift_number: number;
  opened_by_id: string;
  opened_by_name: string;
  opening_float_minor?: number;
  opening_float?: number; // major units
  opened_at: string;
  status: 'open' | 'closed';
  closed_by_id?: string | null;
  closed_by_name?: string | null;
  closed_at?: string | null;
  counted_cash_minor?: number | null;
  expected_cash_minor?: number | null;
  difference_minor?: number | null;
  counted_cash?: number | null;
  expected_cash?: number | null;
  difference?: number | null;
  z_report_summary?: ZReportData | null;
  closing_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CashDrawerTransaction {
  id: string;
  restaurant_id?: string;
  shift_id: string;
  type: 'cash_in' | 'cash_out' | 'sale' | 'refund' | 'drawer_open';
  amount: number;
  amount_minor?: number;
  reason: string;
  order_ref?: string | null;
  bill_number?: string | null;
  actor_id: string;
  actor_name: string;
  actor_role?: string;
  idempotency_key?: string | null;
  created_at: string;
}

export interface ZReportTenderSummary {
  cash: number;
  card: number;
  upi: number;
  stripe: number;
  other: number;
}

export interface ZReportData {
  restaurantName: string;
  currency?: string;
  shiftId: string;
  shiftNumber: number;
  openedAt: string;
  closedAt: string;
  openedByName: string;
  closedByName: string;
  openingFloat: number;
  openingFloatMinor?: number;
  tenderBreakdown: ZReportTenderSummary;
  tenderCounts: {
    cash: number;
    card: number;
    upi: number;
    stripe: number;
    other: number;
  };
  totalGrossSales: number;
  totalNetSales: number;
  totalTaxes: number;
  totalTips: number;
  totalDiscounts: number;
  totalRefunds: number;
  totalVoids: number;
  grossSalesMinor?: number;
  cashInTotal: number;
  cashOutTotal: number;
  cashSales: number;
  cashRefunds: number;
  expectedCashInDrawer: number;
  countedCashInDrawer: number;
  variance: number; // positive: over, negative: short
  totalTransactionCount: number;
  generatedAt: string;
}
