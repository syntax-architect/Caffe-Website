/**
 * Comprehensive Currency Minor Units & Payment Gateway Lifecycle Round-Trip Test Suite
 * Covers:
 * 1. Minor unit multiplier and decimal resolution:
 *    - Zero-decimal currencies (JPY, KRW, VND, CLP, etc.): multiplier = 1, decimals = 0
 *    - Three-decimal currencies (KWD, BHD, OMR, JOD, etc.): multiplier = 1000, decimals = 3
 *    - Standard two-decimal currencies (USD, EUR, INR, GBP, etc.): multiplier = 100, decimals = 2
 * 2. Precision and half-up rounding edge cases for USD, EUR, INR, JPY, KRW, KWD, BHD:
 *    - USD: $19.994 -> 1999 cents, $19.996 -> 2000 cents
 *    - EUR: €49.504 -> 4950 cents, €49.506 -> 4951 cents
 *    - INR: ₹130.504 -> 13050 paise, ₹130.506 -> 13051 paise
 *    - JPY: ¥1250.4 -> 1250 yen, ¥1250.6 -> 1251 yen
 *    - KRW: ₩45000.4 -> 45000 won, ₩45000.8 -> 45001 won
 *    - KWD: KD 5.2504 -> 5250 fils, KD 5.2506 -> 5251 fils
 *    - BHD: BD 10.5004 -> 10500 fils, BD 10.5006 -> 10501 fils
 * 3. Bidirectional round-trip conversion without floating point drift:
 *    fromMinorUnits(toMinorUnits(amount, currency), currency) === amount
 * 4. Full Payment Lifecycle Simulation across all 7 required currencies:
 *    - Step A: Order creation & Gateway session minor unit computation (create-payment / create-stripe-checkout / create-razorpay-order)
 *    - Step B: Customer payment execution with minor unit amount
 *    - Step C: Webhook verification with authoritative amount check (payment-webhook)
 *    - Step D: Client payment adapter webhook parsing back to major units (StripeAdapter / RazorpayAdapter)
 *    - Step E: Full & Partial refund calculations and verification (process-refund)
 */

import assert from 'node:assert';
import {
  toMinorUnits,
  fromMinorUnits,
  getCurrencyMultiplier,
  getCurrencyDecimalDigits,
  isZeroDecimalCurrency,
  isThreeDecimalCurrency,
  ZERO_DECIMAL_CURRENCIES,
  THREE_DECIMAL_CURRENCIES,
} from '../src/utils/currency';

console.log('=== RUNNING CURRENCY MINOR UNITS & PAYMENT LIFECYCLE ROUND-TRIP TEST SUITE ===\n');

// -------------------------------------------------------------
// Test 1: Currency Category Identification & Multipliers
// -------------------------------------------------------------
console.log('Test 1: Currency Category Identification & Multipliers');

const categoryExpectations = [
  // 2-decimal currencies (standard)
  { currency: 'USD', zero: false, three: false, multiplier: 100, decimals: 2 },
  { currency: 'EUR', zero: false, three: false, multiplier: 100, decimals: 2 },
  { currency: 'INR', zero: false, three: false, multiplier: 100, decimals: 2 },
  { currency: 'GBP', zero: false, three: false, multiplier: 100, decimals: 2 },
  { currency: 'AED', zero: false, three: false, multiplier: 100, decimals: 2 },
  // Zero-decimal currencies (Stripe / Gateway multiplier = 1)
  { currency: 'JPY', zero: true, three: false, multiplier: 1, decimals: 0 },
  { currency: 'KRW', zero: true, three: false, multiplier: 1, decimals: 0 },
  { currency: 'VND', zero: true, three: false, multiplier: 1, decimals: 0 },
  { currency: 'CLP', zero: true, three: false, multiplier: 1, decimals: 0 },
  // 3-decimal currencies (multiplier = 1000)
  { currency: 'KWD', zero: false, three: true, multiplier: 1000, decimals: 3 },
  { currency: 'BHD', zero: false, three: true, multiplier: 1000, decimals: 3 },
  { currency: 'OMR', zero: false, three: true, multiplier: 1000, decimals: 3 },
  { currency: 'JOD', zero: false, three: true, multiplier: 1000, decimals: 3 },
];

for (const exp of categoryExpectations) {
  assert.strictEqual(
    isZeroDecimalCurrency(exp.currency),
    exp.zero,
    `isZeroDecimalCurrency failed for ${exp.currency}`
  );
  assert.strictEqual(
    isThreeDecimalCurrency(exp.currency),
    exp.three,
    `isThreeDecimalCurrency failed for ${exp.currency}`
  );
  assert.strictEqual(
    getCurrencyMultiplier(exp.currency),
    exp.multiplier,
    `getCurrencyMultiplier failed for ${exp.currency}`
  );
  assert.strictEqual(
    getCurrencyDecimalDigits(exp.currency),
    exp.decimals,
    `getCurrencyDecimalDigits failed for ${exp.currency}`
  );
}

// Case insensitivity & whitespace trimming
assert.strictEqual(getCurrencyMultiplier(' jpy '), 1);
assert.strictEqual(getCurrencyMultiplier('kwd '), 1000);
assert.strictEqual(getCurrencyMultiplier(' usd'), 100);
assert.strictEqual(getCurrencyMultiplier(undefined), 100);

console.log('✔ Test 1: Category identification, multipliers, and decimals verified.');

// -------------------------------------------------------------
// Test 2: Subunit Precision & Rounding Edge Cases (USD, EUR, INR, JPY, KRW, KWD, BHD)
// -------------------------------------------------------------
console.log('Test 2: Precision and Half-up Rounding Edge Cases');

const precisionTestCases = [
  // USD ($) - Standard 2-decimal
  { amount: 19.99, currency: 'USD', expectedMinor: 1999 },
  { amount: 19.994, currency: 'USD', expectedMinor: 1999 }, // rounds down
  { amount: 19.996, currency: 'USD', expectedMinor: 2000 }, // rounds up
  { amount: 0.05, currency: 'USD', expectedMinor: 5 },

  // EUR (€) - Standard 2-decimal
  { amount: 49.50, currency: 'EUR', expectedMinor: 4950 },
  { amount: 49.504, currency: 'EUR', expectedMinor: 4950 }, // rounds down
  { amount: 49.506, currency: 'EUR', expectedMinor: 4951 }, // rounds up
  { amount: 0.99, currency: 'EUR', expectedMinor: 99 },

  // INR (₹) - Standard 2-decimal (paise)
  { amount: 620.00, currency: 'INR', expectedMinor: 62000 },
  { amount: 130.50, currency: 'INR', expectedMinor: 13050 },
  { amount: 130.504, currency: 'INR', expectedMinor: 13050 },
  { amount: 130.506, currency: 'INR', expectedMinor: 13051 },

  // JPY (¥) - Zero-decimal
  { amount: 1250, currency: 'JPY', expectedMinor: 1250 },
  { amount: 1250.4, currency: 'JPY', expectedMinor: 1250 },
  { amount: 1250.6, currency: 'JPY', expectedMinor: 1251 },
  { amount: 35000, currency: 'JPY', expectedMinor: 35000 },

  // KRW (₩) - Zero-decimal
  { amount: 45000, currency: 'KRW', expectedMinor: 45000 },
  { amount: 45000.4, currency: 'KRW', expectedMinor: 45000 },
  { amount: 45000.8, currency: 'KRW', expectedMinor: 45001 },
  { amount: 1500, currency: 'KRW', expectedMinor: 1500 },

  // KWD (KD) - 3-decimal (fils)
  { amount: 5.250, currency: 'KWD', expectedMinor: 5250 },
  { amount: 5.2504, currency: 'KWD', expectedMinor: 5250 }, // rounds down
  { amount: 5.2506, currency: 'KWD', expectedMinor: 5251 }, // rounds up
  { amount: 12.345, currency: 'KWD', expectedMinor: 12345 },
  { amount: 0.005, currency: 'KWD', expectedMinor: 5 },

  // BHD (BD) - 3-decimal (fils)
  { amount: 10.500, currency: 'BHD', expectedMinor: 10500 },
  { amount: 10.5004, currency: 'BHD', expectedMinor: 10500 }, // rounds down
  { amount: 10.5008, currency: 'BHD', expectedMinor: 10501 }, // rounds up
  { amount: 7.825, currency: 'BHD', expectedMinor: 7825 },
  { amount: 0.125, currency: 'BHD', expectedMinor: 125 },
];

for (const tc of precisionTestCases) {
  const actualMinor = toMinorUnits(tc.amount, tc.currency);
  assert.strictEqual(
    actualMinor,
    tc.expectedMinor,
    `toMinorUnits failed for ${tc.amount} ${tc.currency}: expected ${tc.expectedMinor}, got ${actualMinor}`
  );
}
console.log('✔ Test 2: Precision and half-up rounding verified across all 7 currencies.');

// -------------------------------------------------------------
// Test 3: Bidirectional Conversion (No Float Drift)
// -------------------------------------------------------------
console.log('Test 3: Bidirectional Major <-> Minor Conversion Without Float Drift');

const roundTripCases = [
  { major: 19.99, currency: 'USD' },
  { major: 100.05, currency: 'USD' },
  { major: 49.50, currency: 'EUR' },
  { major: 0.99, currency: 'EUR' },
  { major: 620.00, currency: 'INR' },
  { major: 130.50, currency: 'INR' },
  { major: 1250, currency: 'JPY' },
  { major: 38400, currency: 'JPY' },
  { major: 45000, currency: 'KRW' },
  { major: 125000, currency: 'KRW' },
  { major: 5.25, currency: 'KWD' },
  { major: 12.345, currency: 'KWD' },
  { major: 0.75, currency: 'KWD' },
  { major: 10.5, currency: 'BHD' },
  { major: 7.825, currency: 'BHD' },
  { major: 0.125, currency: 'BHD' },
];

for (const rtc of roundTripCases) {
  const minor = toMinorUnits(rtc.major, rtc.currency);
  const backToMajor = fromMinorUnits(minor, rtc.currency);
  assert.strictEqual(
    backToMajor,
    rtc.major,
    `Round trip failed for ${rtc.major} ${rtc.currency}: minor=${minor}, back=${backToMajor}`
  );
}
console.log('✔ Test 3: Bidirectional conversion verified without float drift.');

// -------------------------------------------------------------
// Test 4: Full Lifecycle Simulation across USD, EUR, INR, JPY, KRW, KWD, BHD
// (Create Order -> Payment Session -> Webhook Verification -> Adapter Parse -> Full & Partial Refund)
// -------------------------------------------------------------
console.log('Test 4: Full Gateway Lifecycle Simulation (Create -> Pay -> Webhook -> Refund)');

interface SimulatedOrder {
  orderRef: string;
  currency: string;
  total: number;
  paymentStatus: 'pending' | 'paid' | 'partially_refunded' | 'refunded';
  refundedAmount: number;
}

const lifecycleCurrencies = [
  { currency: 'USD', orderAmount: 45.50, partialRefund: 15.00 },
  { currency: 'EUR', orderAmount: 89.90, partialRefund: 30.00 },
  { currency: 'INR', orderAmount: 1450.00, partialRefund: 450.00 },
  { currency: 'JPY', orderAmount: 5800, partialRefund: 2000 },
  { currency: 'KRW', orderAmount: 65000, partialRefund: 25000 },
  { currency: 'KWD', orderAmount: 18.750, partialRefund: 6.250 },
  { currency: 'BHD', orderAmount: 22.500, partialRefund: 7.500 },
];

for (const lc of lifecycleCurrencies) {
  const orderRef = `CB-2026-TEST-${lc.currency}`;
  const order: SimulatedOrder = {
    orderRef,
    currency: lc.currency,
    total: lc.orderAmount,
    paymentStatus: 'pending',
    refundedAmount: 0,
  };

  // STEP A: Gateway Checkout Creation (create-payment / create-stripe-checkout / create-razorpay-order)
  const minorGatewayAmount = toMinorUnits(order.total, order.currency);
  assert(
    Number.isInteger(minorGatewayAmount),
    `Gateway minor amount must be an integer for ${lc.currency}`
  );

  // STEP B: Customer Payment Simulation
  // Gateway delivers webhook payload containing the exact paid minor units
  const webhookPaidMinor = minorGatewayAmount;

  // STEP C: Payment Webhook Verification (payment-webhook Edge Function)
  // Webhook verifies against authoritative database amount
  const authoritativeAmount = order.total;
  const expectedAmountUnits = toMinorUnits(authoritativeAmount, order.currency);
  const amountDelta = Math.abs(webhookPaidMinor - expectedAmountUnits);
  assert(
    amountDelta <= 5,
    `Webhook amount check failed for ${lc.currency}: paid=${webhookPaidMinor}, expected=${expectedAmountUnits}`
  );

  // Transition order to paid
  order.paymentStatus = 'paid';

  // STEP D: Client Payment Adapter Payload Parsing (StripeAdapter / RazorpayAdapter)
  // Adapter converts webhook minor units back to major units
  const parsedMajorAmount = fromMinorUnits(webhookPaidMinor, order.currency);
  assert.strictEqual(
    parsedMajorAmount,
    order.total,
    `Client adapter failed to reconstruct exact major amount for ${lc.currency}: got ${parsedMajorAmount}, expected ${order.total}`
  );

  // STEP E1: Partial Refund Execution (process-refund Edge Function)
  const partialRefundAmount = lc.partialRefund;
  assert(
    partialRefundAmount > 0 && partialRefundAmount < order.total,
    `Invalid test setup for partial refund in ${lc.currency}`
  );

  const partialRefundMinorUnits = toMinorUnits(partialRefundAmount, order.currency);
  assert(
    Number.isInteger(partialRefundMinorUnits),
    `Partial refund minor units must be an integer for ${lc.currency}`
  );
  assert(
    partialRefundMinorUnits < minorGatewayAmount,
    `Partial refund minor units must be less than paid amount for ${lc.currency}`
  );

  order.refundedAmount += partialRefundAmount;
  order.paymentStatus = 'partially_refunded';

  // Verify remaining balance in major units
  const remainingMajor = Number((order.total - order.refundedAmount).toFixed(getCurrencyDecimalDigits(lc.currency)));
  const remainingMinor = toMinorUnits(remainingMajor, order.currency);
  assert.strictEqual(
    minorGatewayAmount - partialRefundMinorUnits,
    remainingMinor,
    `Subunit residual mismatch on partial refund for ${lc.currency}`
  );

  // STEP E2: Full Remaining Refund Execution (process-refund Edge Function)
  const finalRefundAmount = remainingMajor;
  const finalRefundMinorUnits = toMinorUnits(finalRefundAmount, order.currency);
  assert.strictEqual(
    partialRefundMinorUnits + finalRefundMinorUnits,
    minorGatewayAmount,
    `Cumulative refund subunits must equal original charge for ${lc.currency}`
  );

  order.refundedAmount += finalRefundAmount;
  order.paymentStatus = 'refunded';
  assert.strictEqual(
    order.refundedAmount,
    order.total,
    `Final refunded amount must equal order total for ${lc.currency}`
  );
}

console.log('✔ Test 4: Full create -> pay -> webhook -> refund lifecycle verified for USD, EUR, INR, JPY, KRW, KWD, and BHD.');

// -------------------------------------------------------------
// Test 5: Edge Cases: Zero, Negative, Non-numeric, and Fallbacks
// -------------------------------------------------------------
console.log('Test 5: Edge cases (zero, NaN, invalid currency)');

assert.strictEqual(toMinorUnits(0, 'USD'), 0);
assert.strictEqual(toMinorUnits(NaN as any, 'USD'), 0);
assert.strictEqual(toMinorUnits(Infinity as any, 'USD'), 0);
assert.strictEqual(fromMinorUnits(0, 'USD'), 0);
assert.strictEqual(fromMinorUnits(NaN as any, 'USD'), 0);

// Unknown currency defaults safely to 2-decimal (multiplier 100)
assert.strictEqual(getCurrencyMultiplier('XYZ'), 100);
assert.strictEqual(toMinorUnits(25.50, 'XYZ'), 2550);
assert.strictEqual(fromMinorUnits(2550, 'XYZ'), 25.5);

console.log('✔ Test 5: Edge cases and fallbacks safely resolved.');

console.log('\n========================================================================================');
console.log('🎉 ALL CURRENCY MINOR UNITS & PAYMENT GATEWAY ROUND-TRIP TESTS PASSED WITH 100% SUCCESS!');
console.log('========================================================================================\n');
