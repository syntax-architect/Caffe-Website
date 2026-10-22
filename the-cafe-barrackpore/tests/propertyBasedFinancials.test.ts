/**
 * Property-Based Randomized Tests for Financial Calculations
 * Runs 10,000+ randomized iterations using fast-check to prove mathematical invariants:
 * 1. Bill Split Invariants (zero penny leakage, integer minor unit summation, remainder bounds)
 * 2. Tax & Discount Invariants (discount clamping, inclusive net+tax parity, exclusive summation, split GST parity)
 * 3. Currency Minor Unit Roundtrips (0-decimal JPY, 3-decimal KWD, 2-decimal USD/INR)
 */

import assert from 'node:assert';
import * as fc from 'fast-check';
import { calculateEqualSplit, calculateEqualSplitMinor, roundToCents } from '../src/utils/billSplitCalculations';
import { calculateTaxBreakdown, roundCurrency } from '../src/utils/taxEngine';
import { toMinorUnits, fromMinorUnits, getCurrencyMultiplier, getCurrencyDecimalDigits } from '../src/utils/currencyMinorUnits';
import type { TaxConfiguration } from '../src/types/tax';

console.log('=== RUNNING PROPERTY-BASED FINANCIAL INVARIANTS TEST SUITE (10,000+ ITERATIONS) ===\n');

// -------------------------------------------------------------
// 1. Equal Split: Sum of parts strictly equals total with zero penny leakage
// -------------------------------------------------------------
console.log('Test 1: Verifying Equal Split zero-penny leakage property across 2,500 random bills & parties...');
fc.assert(
  fc.property(
    fc.float({ min: Math.fround(0.01), max: Math.fround(100000.0), noNaN: true }),
    fc.integer({ min: 1, max: 100 }),
    (total, numPeople) => {
      const roundedTotal = roundToCents(total);
      const subtotal = roundToCents(roundedTotal * 0.95);
      const tax = roundToCents(roundedTotal - subtotal);

      const result = calculateEqualSplit(roundedTotal, subtotal, tax, numPeople);

      // Invariant 1: Sum of parts must exactly equal roundedTotal
      const sumParts = roundToCents(result.parts.reduce((sum, p) => sum + p.amount, 0));
      assert.strictEqual(sumParts, roundedTotal, `Sum of parts (${sumParts}) must equal total (${roundedTotal})`);

      // Invariant 2: Result totalAmount must equal roundedTotal
      assert.strictEqual(result.totalAmount, roundedTotal);

      // Invariant 3: Parts count must equal numPeople
      assert.strictEqual(result.parts.length, numPeople);

      // Invariant 4: No part can differ from any other part by more than 1 cent (0.01)
      const amounts = result.parts.map((p) => p.amount);
      const maxPart = Math.max(...amounts);
      const minPart = Math.min(...amounts);
      assert.ok(
        roundToCents(maxPart - minPart) <= 0.01,
        `Difference between parts (${maxPart - minPart}) exceeds 0.01`
      );
    }
  ),
  { numRuns: 2500 }
);
console.log('✓ PASS: Test 1 - Equal split zero-penny leakage passed for 2,500 executions.\n');

// -------------------------------------------------------------
// 2. Equal Split Minor: Integer minor-unit arithmetic guarantees exact summation
// -------------------------------------------------------------
console.log('Test 2: Verifying Equal Split Minor integer invariants across 2,500 executions...');
fc.assert(
  fc.property(
    fc.integer({ min: 1, max: 100000000 }), // 1 paise/cent to 1,000,000.00
    fc.integer({ min: 1, max: 100 }),       // 1 to 100 people
    (totalMinor, numPeople) => {
      const subtotalMinor = Math.floor(totalMinor * 0.95);
      const taxMinor = totalMinor - subtotalMinor;

      const result = calculateEqualSplitMinor(totalMinor, subtotalMinor, taxMinor, numPeople);

      // Invariant 1: Sum of amount_minor must equal totalMinor exactly
      const sumMinor = result.parts.reduce((acc, p) => acc + p.amount_minor, 0);
      assert.strictEqual(sumMinor, totalMinor);

      // Invariant 2: Sum of subtotal_minor must equal subtotalMinor exactly
      const sumSubtotalMinor = result.parts.reduce((acc, p) => acc + p.subtotal_minor, 0);
      assert.strictEqual(sumSubtotalMinor, subtotalMinor);

      // Invariant 3: Sum of tax_amount_minor must equal taxMinor exactly
      const sumTaxMinor = result.parts.reduce((acc, p) => acc + p.tax_amount_minor, 0);
      assert.strictEqual(sumTaxMinor, taxMinor);

      // Invariant 4: For every single part, subtotal + tax === amount
      for (const part of result.parts) {
        assert.strictEqual(part.subtotal_minor + part.tax_amount_minor, part.amount_minor);
      }
    }
  ),
  { numRuns: 2500 }
);
console.log('✓ PASS: Test 2 - Equal split minor integer arithmetic passed for 2,500 executions.\n');

// -------------------------------------------------------------
// 3. Inclusive Tax: netSubtotal + totalTax === discountedSubtotal
// -------------------------------------------------------------
console.log('Test 3: Verifying Inclusive Tax invariants across 2,000 randomized orders...');
fc.assert(
  fc.property(
    fc.array(
      fc.record({
        amount: fc.float({ min: Math.fround(1.0), max: Math.fround(5000.0), noNaN: true }),
        quantity: fc.integer({ min: 1, max: 20 }),
      }),
      { minLength: 1, maxLength: 10 }
    ),
    fc.float({ min: Math.fround(0.0), max: Math.fround(10000.0), noNaN: true }),
    fc.float({ min: Math.fround(0.01), max: Math.fround(0.30), noNaN: true }),
    (rawItems, discount, taxRate) => {
      const items = rawItems.map((it) => ({
        amount: roundCurrency(it.amount),
        quantity: it.quantity,
        category: 'food' as const,
      }));

      const taxConfig: TaxConfiguration = {
        enabled: true,
        mode: 'inclusive',
        label: 'VAT',
        rate: roundCurrency(taxRate, 4),
      };

      const breakdown = calculateTaxBreakdown(items, taxConfig, { discountAmount: discount });

      // Invariant 1: discountAmount is clamped between 0 and subtotal
      assert.ok(breakdown.discountAmount >= 0);
      assert.ok(breakdown.discountAmount <= breakdown.subtotal);

      // Invariant 2: discountedSubtotal is non-negative and subtotal - discountAmount
      assert.strictEqual(breakdown.discountedSubtotal, roundCurrency(breakdown.subtotal - breakdown.discountAmount));
      assert.ok(breakdown.discountedSubtotal >= 0);

      // Invariant 3: In inclusive mode, grandTotal equals discountedSubtotal + serviceCharge
      assert.strictEqual(breakdown.grandTotal, roundCurrency(breakdown.discountedSubtotal + breakdown.serviceCharge));

      // Invariant 4: netSubtotal + totalTax === discountedSubtotal (within 0.01 tolerance)
      const sumNetPlusTax = roundCurrency(breakdown.netSubtotal + breakdown.totalTax);
      assert.ok(
        Math.abs(sumNetPlusTax - breakdown.discountedSubtotal) <= 0.015,
        `Net (${breakdown.netSubtotal}) + Tax (${breakdown.totalTax}) = ${sumNetPlusTax} vs discountedSubtotal (${breakdown.discountedSubtotal})`
      );
    }
  ),
  { numRuns: 2000 }
);
console.log('✓ PASS: Test 3 - Inclusive tax net + tax parity passed for 2,000 executions.\n');

// -------------------------------------------------------------
// 4. Exclusive Tax: grandTotal === discountedSubtotal + serviceCharge + totalTax
// -------------------------------------------------------------
console.log('Test 4: Verifying Exclusive Tax grand total invariant across 2,000 randomized orders...');
fc.assert(
  fc.property(
    fc.array(
      fc.record({
        amount: fc.float({ min: Math.fround(1.0), max: Math.fround(5000.0), noNaN: true }),
        quantity: fc.integer({ min: 1, max: 20 }),
      }),
      { minLength: 1, maxLength: 10 }
    ),
    fc.float({ min: Math.fround(0.0), max: Math.fround(10000.0), noNaN: true }),
    fc.float({ min: Math.fround(0.01), max: Math.fround(0.30), noNaN: true }),
    (rawItems, discount, taxRate) => {
      const items = rawItems.map((it) => ({
        amount: roundCurrency(it.amount),
        quantity: it.quantity,
        category: 'food' as const,
      }));

      const taxConfig: TaxConfiguration = {
        enabled: true,
        mode: 'exclusive',
        label: 'Sales Tax',
        rate: roundCurrency(taxRate, 4),
      };

      const breakdown = calculateTaxBreakdown(items, taxConfig, { discountAmount: discount });

      const expectedTotal = roundCurrency(breakdown.discountedSubtotal + breakdown.serviceCharge + breakdown.totalTax);
      assert.strictEqual(breakdown.grandTotal, expectedTotal);
      assert.strictEqual(breakdown.netSubtotal, breakdown.discountedSubtotal);
    }
  ),
  { numRuns: 2000 }
);
console.log('✓ PASS: Test 4 - Exclusive tax grand total invariant passed for 2,000 executions.\n');

// -------------------------------------------------------------
// 5. Split Tax (CGST + SGST): sum strictly equals single GST
// -------------------------------------------------------------
console.log('Test 5: Verifying Split Tax (CGST + SGST) single GST parity across 1,000 executions...');
fc.assert(
  fc.property(
    fc.float({ min: Math.fround(10.0), max: Math.fround(50000.0), noNaN: true }),
    (subtotal) => {
      const roundedSubtotal = roundCurrency(subtotal);
      const items = [{ amount: roundedSubtotal, quantity: 1, category: 'food' as const }];

      const splitConfig: TaxConfiguration = {
        enabled: true,
        mode: 'inclusive',
        label: 'GST',
        rate: 0.05,
        rules: [
          { label: 'CGST', rate: 0.025, mode: 'inclusive' },
          { label: 'SGST', rate: 0.025, mode: 'inclusive' },
        ],
      };

      const singleConfig: TaxConfiguration = {
        enabled: true,
        mode: 'inclusive',
        label: 'GST',
        rate: 0.05,
      };

      const splitBreakdown = calculateTaxBreakdown(items, splitConfig);
      const singleBreakdown = calculateTaxBreakdown(items, singleConfig);

      assert.strictEqual(splitBreakdown.totalTax, singleBreakdown.totalTax);
      const sumSplitLines = roundCurrency(splitBreakdown.lines.reduce((s, l) => s + l.amount, 0));
      assert.strictEqual(sumSplitLines, splitBreakdown.totalTax);
    }
  ),
  { numRuns: 1000 }
);
console.log('✓ PASS: Test 5 - Split tax parity passed for 1,000 executions.\n');

// -------------------------------------------------------------
// 6. Currency Minor Units: Round-trips across 0-decimal, 3-decimal, 2-decimal currencies
// -------------------------------------------------------------
console.log('Test 6: Verifying Currency Minor Units ISO 4217 roundtrip properties across 3,000 executions...');
fc.assert(
  fc.property(
    fc.constantFrom('JPY', 'KRW', 'VND', 'CLP'),
    fc.integer({ min: 1, max: 10000000 }),
    (currency, amount) => {
      assert.strictEqual(getCurrencyMultiplier(currency), 1);
      assert.strictEqual(getCurrencyDecimalDigits(currency), 0);
      const minor = toMinorUnits(amount, currency);
      assert.strictEqual(minor, amount);
      assert.strictEqual(fromMinorUnits(minor, currency), amount);
    }
  ),
  { numRuns: 1000 }
);

fc.assert(
  fc.property(
    fc.constantFrom('KWD', 'BHD', 'OMR'),
    fc.integer({ min: 1, max: 10000000 }),
    (currency, minorUnits) => {
      assert.strictEqual(getCurrencyMultiplier(currency), 1000);
      assert.strictEqual(getCurrencyDecimalDigits(currency), 3);
      const major = fromMinorUnits(minorUnits, currency);
      const backToMinor = toMinorUnits(major, currency);
      assert.strictEqual(backToMinor, minorUnits);
    }
  ),
  { numRuns: 1000 }
);

fc.assert(
  fc.property(
    fc.constantFrom('USD', 'EUR', 'INR', 'GBP'),
    fc.integer({ min: 1, max: 10000000 }),
    (currency, minorUnits) => {
      assert.strictEqual(getCurrencyMultiplier(currency), 100);
      assert.strictEqual(getCurrencyDecimalDigits(currency), 2);
      const major = fromMinorUnits(minorUnits, currency);
      const backToMinor = toMinorUnits(major, currency);
      assert.strictEqual(backToMinor, minorUnits);
    }
  ),
  { numRuns: 1000 }
);
console.log('✓ PASS: Test 6 - Currency minor units ISO 4217 properties passed for 3,000 executions.\n');

console.log('=============================================================================');
console.log('ALL PROPERTY-BASED TESTS PASSED: 13,000 RANDOMIZED INVARIANT CHECKS VERIFIED!');
console.log('=============================================================================');
