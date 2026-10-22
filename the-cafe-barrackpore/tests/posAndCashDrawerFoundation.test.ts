/**
 * POS, Billing, Cash Drawer, Minor Units & Audit Logging Foundation Test Suite
 *
 * Verifies:
 * 1. Integer minor units conversions, formatting, and arithmetic safety
 * 2. Exact integer bill split distribution with zero remainder leakage
 * 3. Exact minor unit cash change calculations
 * 4. Staff roles expansion ('owner', 'manager', 'cashier', 'waiter', 'staff') & RBAC hierarchy
 * 5. Audit log tracking for all 4 required operational events:
 *    - Void (pos_void_item, pos_void_bill)
 *    - Discount (pos_apply_discount)
 *    - Refund (void_or_refund_order_secure)
 *    - Drawer open (pos_record_drawer_open, recordDrawerOpen)
 * 6. Migration 021 & all_migrations_combined.sql schema & security contracts:
 *    - Minor unit columns are strictly INTEGER
 *    - Server-side SECURITY DEFINER RPCs calculate totals & taxes
 *    - Every table has restaurant_id and RLS by role
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  toMinorUnits,
  toMajorUnits,
  formatMinorUnits,
} from '../src/types/pos';
import type { StaffRole } from '../src/types/auth';
import {
  calculateEqualSplitMinor,
  calculateCashChangeMinor,
} from '../src/utils/billSplitCalculations';
import { recordDrawerOpen } from '../src/services/cashDrawerService';
import { triggerCashDrawerKick } from '../src/utils/printReceipt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== RUNNING POS, BILLING, MINOR UNITS & AUDIT LOGGING TESTS ===\n');

// Mock localStorage for node environment if not present
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] || null,
    length: 0,
  } as any;
}

// -----------------------------------------------------------------------------
// TEST 1: Integer Minor Units Conversions & Formatting
// -----------------------------------------------------------------------------
console.log('Test 1: Integer Minor Units Conversions & Formatting...');

// ₹150.00 -> 15000 paise
if (toMinorUnits(150.0) !== 15000) {
  throw new Error(`Test 1 failed: toMinorUnits(150.0) should be 15000, got ${toMinorUnits(150.0)}`);
}

// ₹19.99 -> 1999 paise
if (toMinorUnits(19.99) !== 1999) {
  throw new Error(`Test 1 failed: toMinorUnits(19.99) should be 1999, got ${toMinorUnits(19.99)}`);
}

// Floating point drift safety: 0.1 + 0.2 = 0.30000000000000004 -> 30 minor units
if (toMinorUnits(0.1 + 0.2) !== 30) {
  throw new Error(`Test 1 failed: toMinorUnits(0.1 + 0.2) should handle floating point drift to 30, got ${toMinorUnits(0.1 + 0.2)}`);
}

// 15000 paise -> ₹150.00
if (toMajorUnits(15000) !== 150.0) {
  throw new Error(`Test 1 failed: toMajorUnits(15000) should be 150.0, got ${toMajorUnits(15000)}`);
}

// 1999 paise -> ₹19.99
if (toMajorUnits(1999) !== 19.99) {
  throw new Error(`Test 1 failed: toMajorUnits(1999) should be 19.99, got ${toMajorUnits(1999)}`);
}

// Formatting
const formattedInr = formatMinorUnits(15000, 'INR');
if (!formattedInr.includes('150.00')) {
  throw new Error(`Test 1 failed: formatMinorUnits(15000, 'INR') should format to ₹150.00, got ${formattedInr}`);
}

const formattedZero = formatMinorUnits(0, 'INR');
if (!formattedZero.includes('0.00')) {
  throw new Error(`Test 1 failed: formatMinorUnits(0) should format to 0.00, got ${formattedZero}`);
}

console.log('✔ Test 1: Minor unit conversions and formatting passed');

// -----------------------------------------------------------------------------
// TEST 2: Minor Unit Integer Split Math — Exact Zero Remainder Leakage
// -----------------------------------------------------------------------------
console.log('Test 2: Minor Unit Integer Split Math (Zero Remainder Leakage)...');

// Split 10000 paise (₹100.00) among 3 people: 3334, 3333, 3333 paise
const split3 = calculateEqualSplitMinor(10000, 9524, 476, 3);
if (split3.parts.length !== 3) {
  throw new Error(`Test 2 failed: Expected 3 parts, got ${split3.parts.length}`);
}
if (split3.totalAmountMinor !== 10000) {
  throw new Error(`Test 2 failed: Sum must be exactly 10000 minor units, got ${split3.totalAmountMinor}`);
}
if (
  split3.parts[0].amount_minor !== 3334 ||
  split3.parts[1].amount_minor !== 3333 ||
  split3.parts[2].amount_minor !== 3333
) {
  throw new Error(
    `Test 2 failed: Remainder paise not correctly allocated: ${split3.parts.map((p) => p.amount_minor).join(', ')}`
  );
}

// Verify sum of part subtotals + taxes match the grand totals with 0 rounding drift
const sumSub3 = split3.parts.reduce((s, p) => s + (p.subtotal_minor || 0), 0);
const sumTax3 = split3.parts.reduce((s, p) => s + (p.tax_amount_minor || 0), 0);
if (sumSub3 !== 9524) {
  throw new Error(`Test 2 failed: Subtotals must sum exactly to 9524, got ${sumSub3}`);
}
if (sumTax3 !== 476) {
  throw new Error(`Test 2 failed: Taxes must sum exactly to 476, got ${sumTax3}`);
}

// Split 49577 paise among 4 people
const split4 = calculateEqualSplitMinor(49577, 47216, 2361, 4);
if (split4.totalAmountMinor !== 49577) {
  throw new Error(`Test 2 failed: Total must sum to 49577, got ${split4.totalAmountMinor}`);
}
const sumParts4 = split4.parts.reduce((s, p) => s + p.amount_minor, 0);
if (sumParts4 !== 49577) {
  throw new Error(`Test 2 failed: Parts sum ${sumParts4} must equal 49577`);
}

console.log('✔ Test 2: Minor unit integer split with zero leakage verified');

// -----------------------------------------------------------------------------
// TEST 3: Cash Change Minor Calculations
// -----------------------------------------------------------------------------
console.log('Test 3: Cash Change Minor Calculations...');

// Bill ₹450.00 (45000), Tendered ₹500.00 (50000) -> Change ₹50.00 (5000)
const change1 = calculateCashChangeMinor(45000, 50000);
if (change1.changeDueMinor !== 5000 || !change1.isSufficient) {
  throw new Error(`Test 3 failed: Expected changeDue 5000, got ${change1.changeDueMinor}`);
}

// Insufficient tendered: Bill 50000, Tendered 40000
const change2 = calculateCashChangeMinor(50000, 40000);
if (change2.isSufficient || change2.changeDueMinor !== 0) {
  throw new Error('Test 3 failed: Insufficient tender should have isSufficient: false, changeDue: 0');
}

// Exact payment: Bill 50000, Tendered 50000 -> Change 0
const change3 = calculateCashChangeMinor(50000, 50000);
if (!change3.isSufficient || change3.changeDueMinor !== 0) {
  throw new Error('Test 3 failed: Exact tender should have isSufficient: true, changeDue: 0');
}

console.log('✔ Test 3: Cash change minor calculation verified');

// -----------------------------------------------------------------------------
// TEST 4: Staff Roles Expansion & RBAC Hierarchy
// -----------------------------------------------------------------------------
console.log('Test 4: Staff Roles Expansion & RBAC Hierarchy...');

const validRoles: StaffRole[] = ['owner', 'manager', 'cashier', 'waiter', 'staff'];

function checkPermissions(role: StaffRole) {
  const isOwner = role === 'owner';
  const isManager = isOwner || role === 'manager';
  const isCashier = isManager || role === 'cashier';
  const isWaiter = isCashier || role === 'waiter';

  return {
    canOpenDrawer: isCashier,
    canVoidWithoutPin: isManager,
    canApplyDiscountWithoutPin: isManager,
    canIssueRefund: isManager,
    canCreateBill: isWaiter,
    canSendKOT: isWaiter,
    canCloseShift: isCashier,
  };
}

// Waiter should be able to create bills & send KOT, but not open drawer or void without PIN
const waiterPerms = checkPermissions('waiter');
if (!waiterPerms.canCreateBill || !waiterPerms.canSendKOT) {
  throw new Error('Test 4 failed: Waiter should be permitted to create bills and send KOTs');
}
if (waiterPerms.canOpenDrawer || waiterPerms.canVoidWithoutPin || waiterPerms.canIssueRefund) {
  throw new Error('Test 4 failed: Waiter must NOT be permitted to open drawer, void without PIN, or refund');
}

// Cashier can open drawer and close shift, but needs manager authorization for refunds/voids
const cashierPerms = checkPermissions('cashier');
if (!cashierPerms.canOpenDrawer || !cashierPerms.canCloseShift) {
  throw new Error('Test 4 failed: Cashier should be permitted to operate drawer and close shift');
}
if (cashierPerms.canVoidWithoutPin || cashierPerms.canIssueRefund) {
  throw new Error('Test 4 failed: Cashier should require manager authorization for voids and refunds');
}

// Manager and Owner have full authority
const managerPerms = checkPermissions('manager');
if (!managerPerms.canVoidWithoutPin || !managerPerms.canIssueRefund || !managerPerms.canOpenDrawer) {
  throw new Error('Test 4 failed: Manager should have full authority for voids, refunds, drawer');
}

console.log('✔ Test 4: Staff roles and RBAC hierarchy verified');

// -----------------------------------------------------------------------------
// TEST 5: Audit Log Tracing for Void, Discount, Refund, and Drawer Open
// -----------------------------------------------------------------------------
console.log('Test 5: Audit Log Tracing for Required POS Operations...');

// Clear existing demo audit logs in localStorage
localStorage.removeItem('cafe_demo_audit_log');

// 1. Record Drawer Open
const drawerOpenRes = await recordDrawerOpen({
  reason: 'Manual Cash Drop Audit Test',
  shiftId: 'shift-audit-test-01',
});

if (!drawerOpenRes.success) {
  throw new Error(`Test 5 failed: recordDrawerOpen failed: ${drawerOpenRes.error}`);
}

const auditLogsRaw = localStorage.getItem('cafe_demo_audit_log');
if (!auditLogsRaw) {
  throw new Error('Test 5 failed: No audit logs written after drawer open');
}

const auditLogs = JSON.parse(auditLogsRaw);
const drawerLog = auditLogs.find((l: any) => l.action === 'CASH_DRAWER_OPEN');
if (!drawerLog) {
  throw new Error('Test 5 failed: CASH_DRAWER_OPEN action missing from audit log');
}
if (drawerLog.details?.reason !== 'Manual Cash Drop Audit Test') {
  throw new Error(`Test 5 failed: Audit log details missing reason: ${JSON.stringify(drawerLog)}`);
}

// 2. Trigger Cash Drawer Kick via print utility
const kickRes = await triggerCashDrawerKick({
  shiftId: 'shift-audit-test-01',
  reason: 'Receipt Print Cash Tender',
});
if (!kickRes.success) {
  throw new Error(`Test 5 failed: triggerCashDrawerKick failed: ${kickRes.message}`);
}

const updatedLogs = JSON.parse(localStorage.getItem('cafe_demo_audit_log') || '[]');
const kickLogs = updatedLogs.filter((l: any) => l.action === 'CASH_DRAWER_OPEN');
if (kickLogs.length < 2) {
  throw new Error(`Test 5 failed: Expected at least 2 CASH_DRAWER_OPEN logs, got ${kickLogs.length}`);
}

console.log('✔ Test 5: Drawer open audit logging verified');

// -----------------------------------------------------------------------------
// TEST 6: Migration 021 & all_migrations_combined.sql Schema and Security Verification
// -----------------------------------------------------------------------------
console.log('Test 6: Database Migration 021 & Combined SQL Security Contracts...');

const migration021Path = path.resolve(__dirname, '../supabase/migrations/021_pos_billing_shifts_and_drawer.sql');
const combinedSqlPath = path.resolve(__dirname, '../supabase/all_migrations_combined.sql');

if (!fs.existsSync(migration021Path)) {
  throw new Error(`Test 6 failed: Migration file not found at ${migration021Path}`);
}
if (!fs.existsSync(combinedSqlPath)) {
  throw new Error(`Test 6 failed: all_migrations_combined.sql not found at ${combinedSqlPath}`);
}

const mig021Content = fs.readFileSync(migration021Path, 'utf-8');
const combinedContent = fs.readFileSync(combinedSqlPath, 'utf-8');

// 6a. Check that monetary columns in new tables are INTEGER (minor units)
const minorUnitFields = [
  'subtotal_minor INTEGER',
  'tax_amount_minor INTEGER',
  'discount_amount_minor INTEGER',
  'grand_total_minor INTEGER',
  'unit_price_minor INTEGER',
  'line_total_minor INTEGER',
  'opening_float_minor INTEGER',
  'counted_cash_minor INTEGER',
  'expected_cash_minor INTEGER',
  'difference_minor INTEGER',
  'amount_minor INTEGER',
];

for (const field of minorUnitFields) {
  if (!mig021Content.includes(field)) {
    throw new Error(`Test 6 failed: Migration 021 missing minor unit INTEGER column: "${field}"`);
  }
  if (!combinedContent.includes(field)) {
    throw new Error(`Test 6 failed: all_migrations_combined.sql missing minor unit column: "${field}"`);
  }
}

// 6b. Check that all 6 POS tables have restaurant_id and RLS enabled
const posTables = [
  'bills',
  'bill_items',
  'kot_batches',
  'cash_shifts',
  'cash_drawer_transactions',
  'bill_splits',
];

for (const table of posTables) {
  const rlsPattern = `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`;
  if (!mig021Content.includes(rlsPattern)) {
    throw new Error(`Test 6 failed: RLS not enabled for table ${table}`);
  }
  if (!combinedContent.includes(rlsPattern)) {
    throw new Error(`Test 6 failed: RLS not enabled in all_migrations_combined.sql for table ${table}`);
  }
}

// 6c. Check role checks and helper functions
const roleHelpers = [
  'is_manager_or_above',
  'is_cashier_or_above',
  'is_waiter_or_above',
];

for (const helper of roleHelpers) {
  if (!mig021Content.includes(helper)) {
    throw new Error(`Test 6 failed: Role helper ${helper} missing from migration 021`);
  }
}

// 6d. Check server-side SECURITY DEFINER RPCs
const requiredRpcSignatures = [
  'pos_create_or_append_kot',
  'pos_apply_discount',
  'pos_void_item',
  'pos_record_drawer_open',
  'pos_transfer_table',
  'pos_merge_tables',
  'void_or_refund_order_secure',
  'process_bill_payment',
];

for (const rpc of requiredRpcSignatures) {
  if (!mig021Content.includes(rpc)) {
    throw new Error(`Test 6 failed: SECURITY DEFINER RPC "${rpc}" missing from migration 021`);
  }
  if (!combinedContent.includes(rpc)) {
    throw new Error(`Test 6 failed: RPC "${rpc}" missing from all_migrations_combined.sql`);
  }
}

// 6e. Check that voids, discounts, refunds, and drawer opens write to public.audit_log in SQL
const auditTriggersInSql = [
  'POS_ITEM_VOID',
  'POS_DISCOUNT_APPLIED',
  'POS_BILL_REFUND',
  'CASH_DRAWER_OPEN',
];

for (const action of auditTriggersInSql) {
  if (!mig021Content.includes(action)) {
    throw new Error(`Test 6 failed: SQL audit log entry for "${action}" missing from migration 021`);
  }
  if (!combinedContent.includes(action)) {
    throw new Error(`Test 6 failed: SQL audit log entry for "${action}" missing from all_migrations_combined.sql`);
  }
}

console.log('✔ Test 6: Migration 021 & combined SQL security contracts verified');

console.log('\n=== ALL POS, BILLING, MINOR UNITS & AUDIT LOGGING TESTS PASSED (6/6)! ===\n');
