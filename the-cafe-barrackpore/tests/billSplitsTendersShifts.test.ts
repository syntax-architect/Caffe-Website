import {
  calculateEqualSplit,
  calculateItemSplit,
  calculateCustomSplit,
  calculateCashChange,
  roundToCents,
} from '../src/utils/billSplitCalculations';
import {
  createBillSplit,
  getBillSplits,
  processTenderPayment,
  voidOrRefundOrderSecure,
  generateIdempotencyKey,
} from '../src/services/billingService';
import {
  openShift,
  getCurrentShift,
  recordCashTransaction,
  closeShift,
  generateZReport,
  getShiftHistory,
} from '../src/services/cashDrawerService';
import { buildZReportHtml, buildZReportEscPos } from '../src/utils/printReceipt';
import type { ZReportData } from '../src/types/billing';

console.log('=== RUNNING BILL SPLITS, TENDERS, CASH DRAWER & IDEMPOTENCY TESTS ===\n');

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
// TEST 1: Equal Share Split (N People) — Tax & Rounding Exact to the Cent
// -----------------------------------------------------------------------------
console.log('Test 1: Equal Share Split (N People) exact cent arithmetic...');

// 1a: Split 100.00 among 3 people (33.34, 33.33, 33.33)
const split3 = calculateEqualSplit(100.0, 95.24, 4.76, 3);
if (split3.parts.length !== 3) {
  throw new Error(`Test 1a failed: Expected 3 parts, got ${split3.parts.length}`);
}
if (split3.totalAmount !== 100.0) {
  throw new Error(`Test 1a failed: Total amounts must sum to 100.00, got ${split3.totalAmount}`);
}
if (split3.parts[0].amount !== 33.34 || split3.parts[1].amount !== 33.33 || split3.parts[2].amount !== 33.33) {
  throw new Error(
    `Test 1a failed: Cent allocation incorrect: ${split3.parts.map((p) => p.amount).join(', ')}`
  );
}
const sumTax3 = roundToCents(split3.parts.reduce((s, p) => s + p.tax_amount, 0));
if (sumTax3 !== 4.76) {
  throw new Error(`Test 1a failed: Taxes must sum to 4.76, got ${sumTax3}`);
}

// 1b: Split 495.77 among 4 people
const split4 = calculateEqualSplit(495.77, 472.16, 23.61, 4);
if (split4.totalAmount !== 495.77) {
  throw new Error(`Test 1b failed: Total must sum to 495.77, got ${split4.totalAmount}`);
}
const sumSub4 = roundToCents(split4.parts.reduce((s, p) => s + p.subtotal, 0));
if (sumSub4 !== 472.16) {
  throw new Error(`Test 1b failed: Subtotals must sum to 472.16, got ${sumSub4}`);
}
const sumTax4 = roundToCents(split4.parts.reduce((s, p) => s + p.tax_amount, 0));
if (sumTax4 !== 23.61) {
  throw new Error(`Test 1b failed: Taxes must sum to 23.61, got ${sumTax4}`);
}
console.log('✔ Test 1: Equal Share Split exact cent arithmetic verified');

// -----------------------------------------------------------------------------
// TEST 2: Item-based Split with Proportional Tax Allocation
// -----------------------------------------------------------------------------
console.log('Test 2: Item-based Split with Proportional Tax...');

const itemGroups = [
  {
    payer_label: 'Alice',
    items: [
      { id: 'item-1', name: 'Truffle Pizza', quantity: 1, unit_price: 495, line_total: 495 },
      { id: 'item-2', name: 'Vanilla Cold Brew', quantity: 1, unit_price: 240, line_total: 240 },
    ],
  },
  {
    payer_label: 'Bob',
    items: [
      { id: 'item-3', name: 'Alfredo Pasta', quantity: 1, unit_price: 380, line_total: 380 },
    ],
  },
];
// Order: Subtotal 1115.00, Tax 5% (55.75), Total 1170.75
const itemSplitResult = calculateItemSplit(1170.75, 1115.0, 55.75, itemGroups);

if (itemSplitResult.parts.length !== 2) {
  throw new Error(`Test 2 failed: Expected 2 parts, got ${itemSplitResult.parts.length}`);
}
if (itemSplitResult.totalAmount !== 1170.75) {
  throw new Error(`Test 2 failed: Total amounts must sum to 1170.75, got ${itemSplitResult.totalAmount}`);
}
if (itemSplitResult.totalSubtotal !== 1115.0) {
  throw new Error(`Test 2 failed: Subtotals must sum to 1115.00, got ${itemSplitResult.totalSubtotal}`);
}
if (itemSplitResult.totalTax !== 55.75) {
  throw new Error(`Test 2 failed: Taxes must sum to 55.75, got ${itemSplitResult.totalTax}`);
}
// Alice subtotal = 735.00, Bob subtotal = 380.00
if (itemSplitResult.parts[0].subtotal !== 735.0 || itemSplitResult.parts[1].subtotal !== 380.0) {
  throw new Error(`Test 2 failed: Individual item subtotals incorrect.`);
}
console.log('✔ Test 2: Item-based Split with proportional tax verified');

// -----------------------------------------------------------------------------
// TEST 3: Custom Amount Split & Cent Discrepancy Detection
// -----------------------------------------------------------------------------
console.log('Test 3: Custom Amount Split & Validation...');

const validCustom = calculateCustomSplit(600.0, 571.43, 28.57, [
  { payer_label: 'Guest 1', amount: 250.0 },
  { payer_label: 'Guest 2', amount: 350.0 },
]);
if (validCustom.totalAmount !== 600.0) {
  throw new Error(`Test 3 failed: Custom amounts must sum to 600.00, got ${validCustom.totalAmount}`);
}

let threwDiscrepancy = false;
try {
  calculateCustomSplit(600.0, 571.43, 28.57, [
    { payer_label: 'Guest 1', amount: 250.0 },
    { payer_label: 'Guest 2', amount: 349.0 }, // 1 dollar/rupee short
  ]);
} catch (e: any) {
  threwDiscrepancy = true;
  if (!e.message.includes('does not equal')) {
    throw new Error(`Test 3 failed: Expected discrepancy error, got: ${e.message}`);
  }
}
if (!threwDiscrepancy) {
  throw new Error('Test 3 failed: Custom split failed to reject mismatched sum.');
}
console.log('✔ Test 3: Custom Amount Split validation verified');

// -----------------------------------------------------------------------------
// TEST 4: Cash Change Calculation (Cash Tender)
// -----------------------------------------------------------------------------
console.log('Test 4: Cash Change Calculation...');

// Due 480, Tendered 500 -> Change 20
const change1 = calculateCashChange(480, 500);
if (change1.changeDue !== 20 || !change1.isSufficient || change1.shortfall !== 0) {
  throw new Error(`Test 4 failed: Expected change 20, got ${change1.changeDue}`);
}

// Due 480, Tendered 480 -> Exact Change 0
const change2 = calculateCashChange(480, 480);
if (change2.changeDue !== 0 || !change2.isSufficient) {
  throw new Error(`Test 4 failed: Expected exact change 0, got ${change2.changeDue}`);
}

// Due 480, Tendered 400 -> Shortfall 80
const change3 = calculateCashChange(480, 400);
if (change3.isSufficient || change3.shortfall !== 80 || change3.changeDue !== 0) {
  throw new Error(`Test 4 failed: Expected shortfall 80, got ${change3.shortfall}`);
}
console.log('✔ Test 4: Cash Change Calculation verified');

// -----------------------------------------------------------------------------
// TEST 5: Split Bill Lifecycle & Closing ONLY when all parts are paid
// -----------------------------------------------------------------------------
async function runAsyncTests() {
  console.log('Test 5: Bill settlement lifecycle — Closed ONLY when all parts paid...');

  const orderRef = `CB-TEST-${Date.now()}`;
  const total = 1000.0;
  const subtotal = 952.38;
  const tax = 47.62;

  // Set up mock order in localStorage
  localStorage.setItem(
    'cafe_demo_orders',
    JSON.stringify([
      {
        id: `ord_${orderRef}`,
        order_ref: orderRef,
        total,
        subtotal,
        status: 'confirmed',
        payment_status: 'pending',
      },
    ])
  );

  // Split into 3 parts: Part 1 = 400, Part 2 = 350, Part 3 = 250
  const splitRes = await createBillSplit(orderRef, total, subtotal, tax, 'custom', [
    { payer_label: 'Priya', amount: 400 },
    { payer_label: 'Rahul', amount: 350 },
    { payer_label: 'Ananya', amount: 250 },
  ]);

  if (!splitRes.success || !splitRes.summary) {
    throw new Error(`Test 5 failed: Could not create split bill: ${splitRes.error}`);
  }
  if (splitRes.summary.parts.length !== 3) {
    throw new Error(`Test 5 failed: Expected 3 parts, got ${splitRes.summary.parts.length}`);
  }
  if (splitRes.summary.isFullyPaid) {
    throw new Error('Test 5 failed: Split bill should not be fully paid initially.');
  }

  // Pay Part 1 (Cash: 400 with tip 50, tendered 500 -> change 50)
  const p1 = splitRes.summary.parts[0];
  const p1Res = await processTenderPayment({
    orderRef,
    splitId: p1.id,
    tenderType: 'cash',
    amount: p1.amount,
    tipAmount: 50,
    tenderedAmount: 500,
    idempotencyKey: generateIdempotencyKey('p1'),
  });

  if (!p1Res.success || p1Res.isBillClosed) {
    throw new Error(`Test 5 failed: Bill must NOT be closed after only 1 of 3 parts is paid.`);
  }
  if (p1Res.changeDue !== 50) {
    throw new Error(`Test 5 failed: Expected changeDue 50, got ${p1Res.changeDue}`);
  }

  // Pay Part 2 (Card with POS Terminal Reference)
  const p2 = splitRes.summary.parts[1];
  const p2Res = await processTenderPayment({
    orderRef,
    splitId: p2.id,
    tenderType: 'card',
    amount: p2.amount,
    paymentReference: 'AUTH-99128',
    idempotencyKey: generateIdempotencyKey('p2'),
  });

  if (!p2Res.success || p2Res.isBillClosed) {
    throw new Error(`Test 5 failed: Bill must NOT be closed after only 2 of 3 parts are paid.`);
  }

  // Pay Part 3 (UPI)
  const p3 = splitRes.summary.parts[2];
  const p3Res = await processTenderPayment({
    orderRef,
    splitId: p3.id,
    tenderType: 'upi',
    amount: p3.amount,
    paymentReference: 'UPI-884920491',
    idempotencyKey: generateIdempotencyKey('p3'),
  });

  if (!p3Res.success) {
    throw new Error(`Test 5 failed: Part 3 payment failed: ${p3Res.error}`);
  }
  if (!p3Res.isBillClosed) {
    throw new Error('Test 5 failed: Bill MUST be marked closed when all 3 parts are paid!');
  }

  const finalSummary = await getBillSplits(orderRef, total, subtotal, tax);
  if (!finalSummary.isFullyPaid || finalSummary.remainingBalance !== 0) {
    throw new Error(`Test 5 failed: Expected fully paid bill with 0 remaining balance.`);
  }
  console.log('✔ Test 5: Bill settlement lifecycle and closing only when all parts paid verified');

  // -----------------------------------------------------------------------------
  // TEST 6: Payment Idempotency — Double Tap Protection
  // -----------------------------------------------------------------------------
  console.log('Test 6: Payment Idempotency — Double Tap Protection...');

  const idempotencyKey = `double_tap_test_${Date.now()}`;
  const firstAttempt = await processTenderPayment({
    orderRef: `ORD-${Date.now()}`,
    tenderType: 'card',
    amount: 150,
    paymentReference: 'SLIP-001',
    idempotencyKey,
  });

  if (!firstAttempt.success) {
    throw new Error(`Test 6 failed: Initial payment failed: ${firstAttempt.error}`);
  }

  // Second attempt with identical idempotency key
  const secondAttempt = await processTenderPayment({
    orderRef: firstAttempt.orderRef,
    tenderType: 'card',
    amount: 150,
    paymentReference: 'SLIP-001',
    idempotencyKey,
  });

  if (!secondAttempt.success || !secondAttempt.isDuplicate) {
    throw new Error('Test 6 failed: Duplicate payment with same idempotency key was not flagged as duplicate.');
  }
  console.log('✔ Test 6: Payment Idempotency double-tap protection verified');

  // -----------------------------------------------------------------------------
  // TEST 7: Cash Drawer Shift Lifecycle & Z-Report
  // -----------------------------------------------------------------------------
  console.log('Test 7: Cash Drawer Shift Lifecycle & Z-Report...');

  // Ensure clean state
  localStorage.removeItem('cafe_demo_cash_shifts');
  localStorage.removeItem('cafe_demo_cash_txs');
  localStorage.removeItem('cafe_demo_payments_ledger');

  // 1. Open shift with 2000.00 float
  const openRes = await openShift({
    openingFloat: 2000.0,
    openedById: 'staff_1',
    openedByName: 'Ramesh Sen',
  });

  if (!openRes.success || !openRes.shift) {
    throw new Error(`Test 7 failed: Could not open shift: ${openRes.error}`);
  }
  const shift = openRes.shift;
  if (shift.status !== 'open' || shift.opening_float !== 2000.0) {
    throw new Error(`Test 7 failed: Invalid opened shift attributes.`);
  }

  // 2. Cannot open second concurrent shift
  const duplicateShift = await openShift({
    openingFloat: 1000.0,
    openedById: 'staff_2',
    openedByName: 'Priya M',
  });
  if (duplicateShift.success) {
    throw new Error('Test 7 failed: Second concurrent open shift should have been blocked.');
  }

  // 3. Record Cash In (+500.00 bank change delivery)
  const cashInRes = await recordCashTransaction({
    shiftId: shift.id,
    type: 'cash_in',
    amount: 500.0,
    reason: 'Bank change delivery',
    actorId: 'staff_1',
    actorName: 'Ramesh Sen',
  });
  if (!cashInRes.success) {
    throw new Error(`Test 7 failed: Cash in failed: ${cashInRes.error}`);
  }

  // 4. Record Cash Out (-200.00 petty cash for lemons)
  const cashOutRes = await recordCashTransaction({
    shiftId: shift.id,
    type: 'cash_out',
    amount: 200.0,
    reason: 'Petty cash for lemons & mint',
    actorId: 'staff_1',
    actorName: 'Ramesh Sen',
  });
  if (!cashOutRes.success) {
    throw new Error(`Test 7 failed: Cash out failed: ${cashOutRes.error}`);
  }

  // 5. Record a cash sale of 480.00 + 20.00 tip = 500.00
  await processTenderPayment({
    orderRef: 'CB-CASH-SALE',
    tenderType: 'cash',
    amount: 480.0,
    tipAmount: 20.0,
    tenderedAmount: 500.0,
    idempotencyKey: generateIdempotencyKey('shift_sale'),
    shiftId: shift.id,
  });

  // Expected Cash = 2000 (float) + 500 (in) - 200 (out) + 480 (cash sale) + 20 (tip) = 2800.00
  const zReportPreview = await generateZReport(shift.id);
  if (zReportPreview.expectedCashInDrawer !== 2800.0) {
    throw new Error(`Test 7 failed: Expected 2800.00 in drawer, got ${zReportPreview.expectedCashInDrawer}`);
  }

  // 6. Close shift with counted cash = 2850.00 (Variance = +50.00 over)
  const closeRes = await closeShift({
    shiftId: shift.id,
    countedCash: 2850.0,
    closedById: 'staff_1',
    closedByName: 'Ramesh Sen',
    closingNotes: 'Shift reconciled cleanly, 50 rupee cash overage from tips change left by customer.',
  });

  if (!closeRes.success || !closeRes.shift || !closeRes.zReport) {
    throw new Error(`Test 7 failed: Could not close shift: ${closeRes.error}`);
  }
  if (closeRes.shift.status !== 'closed') {
    throw new Error(`Test 7 failed: Shift must be marked closed.`);
  }
  if (closeRes.zReport.variance !== 50.0) {
    throw new Error(`Test 7 failed: Variance must be +50.00, got ${closeRes.zReport.variance}`);
  }

  // 7. Verify Z-Report printable HTML & ESC/POS Byte generation
  const zReportHtml = buildZReportHtml(closeRes.zReport);
  if (!zReportHtml.includes('DAILY FINANCIAL Z-REPORT') || !zReportHtml.includes('CASH DRAWER RECONCILIATION')) {
    throw new Error('Test 7 failed: Z-Report HTML missing core financial sections.');
  }

  const zReportEscpos = buildZReportEscPos(closeRes.zReport);
  if (!zReportEscpos || zReportEscpos.length === 0) {
    throw new Error('Test 7 failed: Z-Report ESC/POS byte array is empty.');
  }
  console.log('✔ Test 7: Cash Drawer Shift lifecycle, variance balancing & printable Z-Report verified');

  // -----------------------------------------------------------------------------
  // TEST 8: Manager Role Guard on Refunds & Voids with Audit Log
  // -----------------------------------------------------------------------------
  console.log('Test 8: Manager Role Guard on Refunds & Voids...');

  const refundOrderRef = `CB-REFUND-${Date.now()}`;

  // 8a: Standard Staff Role MUST BE REJECTED
  const staffAttempt = await voidOrRefundOrderSecure({
    orderRef: refundOrderRef,
    reason: 'Customer cancelled after payment',
    actorId: 'staff_guest',
    actorName: 'Junior Staff',
    actorRole: 'staff',
    isPaid: true,
  });

  if (staffAttempt.success) {
    throw new Error('Test 8a failed: Standard staff was able to refund a paid order! Security violation.');
  }
  if (!staffAttempt.error?.includes('Manager or Owner role')) {
    throw new Error(`Test 8a failed: Expected role authorization error, got: ${staffAttempt.error}`);
  }

  // 8b: Manager Role MUST SUCCEED and record Audit Log
  const managerAttempt = await voidOrRefundOrderSecure({
    orderRef: refundOrderRef,
    reason: 'Guest spilled coffee, manager authorized refund',
    amount: 240,
    actorId: 'mgr_01',
    actorName: 'Manager Rahul',
    actorRole: 'manager',
    isPaid: true,
  });

  if (!managerAttempt.success) {
    throw new Error(`Test 8b failed: Manager refund failed: ${managerAttempt.error}`);
  }

  // Check audit log
  const rawAudit = localStorage.getItem('cafe_demo_audit_log');
  const auditEntries = rawAudit ? JSON.parse(rawAudit) : [];
  const refundAudit = auditEntries.find((a: any) => a.target_id === refundOrderRef);

  if (!refundAudit || refundAudit.action !== 'ORDER_REFUND') {
    throw new Error('Test 8b failed: Audit log entry for manager refund was not recorded.');
  }
  if (refundAudit.actor_role !== 'manager') {
    throw new Error('Test 8b failed: Audit log actor_role must record manager.');
  }
  console.log('✔ Test 8: Manager Role Guard and immutable audit log for refunds verified');

  console.log('\n======================================================================');
  console.log('🎉 ALL BILL SPLITS, TENDERS, SHIFTS & IDEMPOTENCY TESTS PASSED (8/8)!');
  console.log('======================================================================\n');
}

runAsyncTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
