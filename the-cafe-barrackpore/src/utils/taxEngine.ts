/**
 * International Tax Engine — Calculation Module
 * Global Restaurant Platform — Production-Grade Tax Calculations
 *
 * This module is the single source of truth for all financial calculations.
 * It processes menu item prices through the configured tax regime and produces
 * a complete breakdown suitable for receipts and invoices.
 *
 * Supports:
 * - VAT/GST/Sales Tax inclusive and exclusive modes
 * - Currency minor units (ISO 4217: JPY 0, KWD 3, standard 2)
 * - Strict financial order of operations: Discount -> Service Charge -> Tax
 * - Multi-rate tax by category: each inclusive rule divides by (1 + its own rate)
 * - Split tax display (CGST + SGST): sum strictly equals single GST
 * - Mixed inclusive/exclusive rules: exclusive taxes added to the total
 * - Service charge with optional taxability
 * - Line-level or total-level rounding
 */

import type {
  TaxConfiguration,
  TaxRule,
  TaxBreakdown,
  TaxBreakdownLine,
  TaxCategory,
} from '../types/tax';
import { getCurrencyDecimals } from './currency';

/**
 * Rounds a monetary amount using the currency's ISO 4217 minor units.
 * Supports passing currency code ('JPY' => 0, 'KWD' => 3, 'USD' => 2) or explicit decimal count.
 */
export const roundCurrency = (
  amount: number,
  currencyOrDecimals: string | number = 2
): number => {
  const decimals = typeof currencyOrDecimals === 'number'
    ? currencyOrDecimals
    : getCurrencyDecimals(currencyOrDecimals);
  const factor = Math.pow(10, decimals);
  return Math.round((amount + Number.EPSILON) * factor) / factor;
};

/**
 * Core tax calculation interface — each item specifies its amount,
 * quantity, and optional tax category.
 */
export interface TaxableItem {
  /** Pre-tax or tax-included price depending on tax mode */
  amount: number;
  /** Number of units */
  quantity: number;
  /** Tax category for per-item tax routing */
  category?: TaxCategory;
}

/**
 * Calculation options for tax breakdown.
 */
export interface TaxCalculationDetailOptions {
  /** Discount amount to apply to subtotal before service charge and taxes */
  discountAmount?: number;
  /** Currency code for ISO 4217 minor-unit rounding (e.g. 'JPY', 'KWD', 'INR') */
  currency?: string;
}

/**
 * Computes a unique scope key for grouping split rules.
 * Two rules share a scope if their mode is identical and their appliesTo targets match.
 */
function getRuleGroupKey(rule: TaxRule): string {
  const mode = rule.mode;
  const categories = rule.appliesTo && rule.appliesTo.length > 0
    ? [...rule.appliesTo].sort().join(',')
    : '__ALL__';
  return `${mode}::${categories}`;
}

/**
 * Calculate the complete tax breakdown for a set of items.
 *
 * Financial Order of Operations:
 * 1. Subtotal: Sum of item price × quantity.
 * 2. Discount: Applied to subtotal first (clamped between 0 and subtotal).
 * 3. Service Charge: Calculated on the discounted subtotal.
 * 4. Taxes: Multi-rate & split taxes calculated on discounted item amounts.
 *    - Inclusive multi-rate rules divide by (1 + rate).
 *    - Split rules (e.g. CGST + SGST) are balanced so sum equals single combined tax.
 *    - Mixed inclusive/exclusive rules: exclusive tax is added to grand total.
 * 5. Grand Total: discountedSubtotal + serviceCharge + exclusiveTaxes.
 */
export function calculateTaxBreakdown(
  items: TaxableItem[],
  taxConfig: TaxConfiguration,
  options?: TaxCalculationDetailOptions
): TaxBreakdown {
  const currency = options?.currency || taxConfig.currency || 'INR';
  const decimals = getCurrencyDecimals(currency);

  // Empty order
  if (!items || items.length === 0) {
    return {
      lines: [],
      totalTax: 0,
      serviceCharge: 0,
      netSubtotal: 0,
      subtotal: 0,
      discountAmount: 0,
      discountedSubtotal: 0,
      grandTotal: 0,
    };
  }

  // 1. Calculate raw item subtotal (sum of quantity × unit price rounded to currency decimals)
  let rawSubtotal = 0;
  for (const item of items) {
    const unitPrice = roundCurrency(item.amount, decimals);
    const lineTotal = roundCurrency(unitPrice * item.quantity, decimals);
    rawSubtotal = roundCurrency(rawSubtotal + lineTotal, decimals);
  }
  rawSubtotal = roundCurrency(rawSubtotal, decimals);

  // 2. DISCOUNT: Applied first
  const rawDiscount = options?.discountAmount !== undefined
    ? options.discountAmount
    : (taxConfig.discountAmount ?? 0);
  const discountAmount = Math.max(0, Math.min(rawSubtotal, roundCurrency(Number(rawDiscount) || 0, decimals)));
  const discountedSubtotal = roundCurrency(rawSubtotal - discountAmount, decimals);
  const discountRatio = rawSubtotal > 0 ? (discountedSubtotal / rawSubtotal) : 1;

  // 3. SERVICE CHARGE: Calculated on discounted subtotal
  const scConfig = taxConfig.serviceCharge;
  let serviceCharge = 0;
  if (scConfig?.enabled && scConfig.rate > 0) {
    serviceCharge = roundCurrency(discountedSubtotal * scConfig.rate, decimals);
  }

  // If tax is disabled, return simple totals with service charge on discounted subtotal
  if (!taxConfig.enabled) {
    return {
      lines: [],
      totalTax: 0,
      serviceCharge,
      serviceChargeLabel: scConfig?.label || 'Service Charge',
      netSubtotal: discountedSubtotal,
      subtotal: rawSubtotal,
      discountAmount,
      discountedSubtotal,
      grandTotal: roundCurrency(discountedSubtotal + serviceCharge, decimals),
    };
  }

  // Determine tax rules to use
  const rules: TaxRule[] = taxConfig.rules && taxConfig.rules.length > 0
    ? taxConfig.rules
    : [{ label: taxConfig.label, rate: taxConfig.rate, mode: taxConfig.mode }];

  const roundingMode = taxConfig.roundingMode || 'total';

  // Group rules into split groups (e.g. CGST + SGST co-applying to same scope)
  const groupMap = new Map<string, TaxRule[]>();
  for (const rule of rules) {
    if (rule.rate <= 0) continue;
    const key = getRuleGroupKey(rule);
    if (!groupMap.has(key)) {
      groupMap.set(key, []);
    }
    groupMap.get(key)!.push(rule);
  }

  const taxLines: TaxBreakdownLine[] = [];
  let totalExclusiveTax = 0;
  let totalInclusiveTax = 0;

  for (const [, groupRules] of groupMap.entries()) {
    if (groupRules.length === 0) continue;

    // Filter items applicable to this group
    const sampleRule = groupRules[0];
    let applicableSubtotal = discountedSubtotal;

    if (sampleRule.appliesTo && sampleRule.appliesTo.length > 0) {
      applicableSubtotal = 0;
      for (const item of items) {
        const itemCategory = item.category || 'food';
        if (sampleRule.appliesTo.includes(itemCategory)) {
          const unitPrice = roundCurrency(item.amount, decimals);
          const rawItemLine = roundCurrency(unitPrice * item.quantity, decimals);
          const discountedLine = rawItemLine * discountRatio;
          if (roundingMode === 'line') {
            applicableSubtotal += roundCurrency(discountedLine, decimals);
          } else {
            applicableSubtotal += discountedLine;
          }
        }
      }
      applicableSubtotal = roundCurrency(applicableSubtotal, decimals);
    }

    if (applicableSubtotal <= 0) continue;

    const groupCombinedRate = groupRules.reduce((sum, r) => sum + r.rate, 0);
    if (groupCombinedRate <= 0) continue;

    const isInclusive = sampleRule.mode === 'inclusive';

    // Calculate total tax for this group on the applicable subtotal
    let groupTotalTax: number;
    if (isInclusive) {
      // Inclusive: tax is already INSIDE the listed price.
      // For multi-rate (single rule in group), divides by (1 + its own rate).
      // For split rules (CGST + SGST), divides by (1 + combinedRate) so single GST is exact.
      groupTotalTax = roundCurrency(
        applicableSubtotal * (groupCombinedRate / (1 + groupCombinedRate)),
        decimals
      );
    } else {
      // Exclusive: tax is added ON TOP of the price.
      groupTotalTax = roundCurrency(applicableSubtotal * groupCombinedRate, decimals);
    }

    // Calculate rule tax lines
    let allocatedTax = 0;
    for (let i = 0; i < groupRules.length; i++) {
      const rule = groupRules[i];
      let ruleTax: number;

      if (i === groupRules.length - 1) {
        // Last rule absorbs rounding residual so sum of rules strictly equals groupTotalTax (single GST parity)
        ruleTax = roundCurrency(groupTotalTax - allocatedTax, decimals);
      } else {
        ruleTax = roundCurrency(
          groupTotalTax * (rule.rate / groupCombinedRate),
          decimals
        );
        allocatedTax = roundCurrency(allocatedTax + ruleTax, decimals);
      }

      taxLines.push({
        label: rule.label,
        rate: rule.rate,
        mode: rule.mode,
        amount: ruleTax,
        appliedTo: rule.appliesTo,
      });

      if (isInclusive) {
        totalInclusiveTax = roundCurrency(totalInclusiveTax + ruleTax, decimals);
      } else {
        totalExclusiveTax = roundCurrency(totalExclusiveTax + ruleTax, decimals);
      }
    }
  }

  // 4. TAX ON SERVICE CHARGE (if service charge is taxable)
  if (scConfig?.enabled && scConfig.taxable && serviceCharge > 0) {
    const primaryRule = rules[0] || { label: taxConfig.label, rate: taxConfig.rate, mode: taxConfig.mode };
    const scTaxRate = primaryRule.rate || taxConfig.rate;
    const scTaxMode = primaryRule.mode || taxConfig.mode;

    if (scTaxRate > 0) {
      let scTaxAmount: number;
      if (scTaxMode === 'exclusive') {
        scTaxAmount = roundCurrency(serviceCharge * scTaxRate, decimals);
        totalExclusiveTax = roundCurrency(totalExclusiveTax + scTaxAmount, decimals);
      } else {
        scTaxAmount = roundCurrency(serviceCharge * (scTaxRate / (1 + scTaxRate)), decimals);
        totalInclusiveTax = roundCurrency(totalInclusiveTax + scTaxAmount, decimals);
      }

      if (scTaxAmount > 0) {
        const existingLine = taxLines.find((l) => l.label === primaryRule.label && l.mode === scTaxMode);
        if (existingLine) {
          existingLine.amount = roundCurrency(existingLine.amount + scTaxAmount, decimals);
        } else {
          taxLines.push({
            label: `${primaryRule.label || taxConfig.label} (Service)`,
            rate: scTaxRate,
            mode: scTaxMode,
            amount: scTaxAmount,
          });
        }
      }
    }
  }

  const totalTax = roundCurrency(totalInclusiveTax + totalExclusiveTax, decimals);

  // Net subtotal: what the restaurant receives before tax
  // In inclusive mode, net is discounted subtotal minus embedded inclusive tax.
  // In exclusive mode, net IS discounted subtotal.
  const netSubtotal = roundCurrency(discountedSubtotal - totalInclusiveTax, decimals);

  // Grand total payable by customer:
  // discountedSubtotal + serviceCharge + exclusive taxes (inclusive tax is already inside discountedSubtotal)
  const grandTotal = roundCurrency(discountedSubtotal + serviceCharge + totalExclusiveTax, decimals);

  return {
    lines: taxLines,
    totalTax,
    serviceCharge,
    serviceChargeLabel: scConfig?.label || 'Service Charge',
    netSubtotal,
    subtotal: rawSubtotal,
    discountAmount,
    discountedSubtotal,
    grandTotal,
  };
}

/**
 * Quick helper: calculate customer-payable total for a given subtotal.
 */
export function calculateQuickTotal(
  subtotal: number,
  taxConfig: TaxConfiguration,
  currency = 'INR'
): number {
  const decimals = getCurrencyDecimals(currency || taxConfig.currency);
  const scRate = (taxConfig.serviceCharge?.enabled && taxConfig.serviceCharge.rate) || 0;
  const sc = roundCurrency(subtotal * scRate, decimals);

  if (!taxConfig.enabled || taxConfig.rate <= 0) {
    return roundCurrency(subtotal + sc, decimals);
  }

  if (taxConfig.mode === 'exclusive') {
    const tax = roundCurrency(subtotal * taxConfig.rate, decimals);
    const scTax = (taxConfig.serviceCharge?.taxable && sc > 0)
      ? roundCurrency(sc * taxConfig.rate, decimals)
      : 0;
    return roundCurrency(subtotal + tax + sc + scTax, decimals);
  } else {
    // Inclusive: subtotal already contains tax
    return roundCurrency(subtotal + sc, decimals);
  }
}

/**
 * Extract tax amount from a tax-inclusive price.
 */
export function extractInclusiveTax(
  inclusivePrice: number,
  rate: number,
  currency = 'INR'
): number {
  if (rate <= 0) return 0;
  const decimals = getCurrencyDecimals(currency);
  return roundCurrency(inclusivePrice * (rate / (1 + rate)), decimals);
}

/**
 * Format a tax rate for display: 0.05 → "5%", 0.0825 → "8.25%"
 */
export function formatTaxRate(rate: number): string {
  const percent = rate * 100;
  if (percent === Math.floor(percent)) {
    return `${Math.floor(percent)}%`;
  }
  return `${percent.toFixed(percent * 10 % 1 === 0 ? 1 : 2)}%`;
}

/**
 * Generate a human-readable tax summary for receipts.
 */
export function getTaxSummaryText(taxConfig: TaxConfiguration): string {
  if (!taxConfig.enabled || taxConfig.rate <= 0) return '';
  const rateStr = formatTaxRate(taxConfig.rate);
  if (taxConfig.mode === 'inclusive') {
    return `Incl. ${taxConfig.label} ${rateStr}`;
  } else {
    return `${taxConfig.label} ${rateStr} added`;
  }
}
