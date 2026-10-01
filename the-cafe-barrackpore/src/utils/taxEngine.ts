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
 * - Service charge with optional taxability
 * - Split tax display (CGST + SGST for India)
 * - Multi-rate taxes (food vs alcohol in EU countries)
 * - Zero-rated items and tax-exempt categories
 * - Line-level or total-level rounding
 */

import type {
  TaxConfiguration,
  TaxRule,
  TaxBreakdown,
  TaxBreakdownLine,
  TaxCategory,
} from '../types/tax';

/**
 * Rounds to 2 decimal places using banker's rounding to prevent
 * floating-point accumulation errors in currency calculations.
 */
export const roundCurrency = (amount: number): number => {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};

/**
 * Core tax calculation interface — each item must specify its amount
 * and optionally its tax category.
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
 * Calculate the complete tax breakdown for a set of items.
 *
 * @param items - Array of taxable items with amounts and categories
 * @param taxConfig - The restaurant's tax configuration
 * @returns Full tax breakdown with line-by-line details for receipt display
 *
 * @example
 * // Simple Indian GST 5% inclusive
 * calculateTaxBreakdown(items, {
 *   enabled: true, mode: 'inclusive', label: 'GST', rate: 0.05
 * });
 *
 * @example
 * // US Sales Tax 8.25% exclusive
 * calculateTaxBreakdown(items, {
 *   enabled: true, mode: 'exclusive', label: 'Sales Tax', rate: 0.0825
 * });
 *
 * @example
 * // India GST split (CGST + SGST)
 * calculateTaxBreakdown(items, {
 *   enabled: true, mode: 'inclusive', label: 'GST', rate: 0.05,
 *   rules: [
 *     { label: 'CGST', rate: 0.025, mode: 'inclusive' },
 *     { label: 'SGST', rate: 0.025, mode: 'inclusive' },
 *   ]
 * });
 */
export function calculateTaxBreakdown(
  items: TaxableItem[],
  taxConfig: TaxConfiguration
): TaxBreakdown {
  // Empty order
  if (!items || items.length === 0) {
    return {
      lines: [],
      totalTax: 0,
      serviceCharge: 0,
      netSubtotal: 0,
      grandTotal: 0,
    };
  }

  // Calculate raw item subtotal (sum of quantity × price)
  let rawSubtotal = 0;
  for (const item of items) {
    rawSubtotal += roundCurrency(item.amount * item.quantity);
  }
  rawSubtotal = roundCurrency(rawSubtotal);

  // If tax is disabled, return simple totals
  if (!taxConfig.enabled) {
    // Service charge still applies even if tax is disabled
    const sc = taxConfig.serviceCharge?.enabled
      ? roundCurrency(rawSubtotal * (taxConfig.serviceCharge.rate || 0))
      : 0;

    return {
      lines: [],
      totalTax: 0,
      serviceCharge: sc,
      serviceChargeLabel: taxConfig.serviceCharge?.label || 'Service Charge',
      netSubtotal: rawSubtotal,
      grandTotal: roundCurrency(rawSubtotal + sc),
    };
  }

  // Determine which tax rules to use
  const rules: TaxRule[] = taxConfig.rules && taxConfig.rules.length > 0
    ? taxConfig.rules
    : [{ label: taxConfig.label, rate: taxConfig.rate, mode: taxConfig.mode }];

  const roundingMode = taxConfig.roundingMode || 'total';

  // Calculate tax for each rule
  const taxLines: TaxBreakdownLine[] = [];
  let totalTax = 0;

  for (const rule of rules) {
    if (rule.rate <= 0) continue;

    // Filter items by category if rule has appliesTo
    let applicableSubtotal = rawSubtotal;
    if (rule.appliesTo && rule.appliesTo.length > 0) {
      applicableSubtotal = 0;
      for (const item of items) {
        const itemCategory = item.category || 'food';
        if (rule.appliesTo.includes(itemCategory)) {
          if (roundingMode === 'line') {
            applicableSubtotal += roundCurrency(roundCurrency(item.amount * item.quantity));
          } else {
            applicableSubtotal += item.amount * item.quantity;
          }
        }
      }
      applicableSubtotal = roundCurrency(applicableSubtotal);
    }

    if (applicableSubtotal <= 0) continue;

    // Determine total inclusive rate across all co-applicable inclusive rules
    // so split taxes (e.g. CGST 2.5% + SGST 2.5% = 5%) divide by (1 + 0.05), not (1 + 0.025)
    const combinedInclusiveRate = rules
      .filter((r) => r.mode === 'inclusive')
      .reduce((sum, r) => sum + r.rate, 0);

    let taxAmount: number;
    if (rule.mode === 'exclusive') {
      // Exclusive: tax is added ON TOP of the listed price
      // tax = subtotal × rate
      taxAmount = roundCurrency(applicableSubtotal * rule.rate);
    } else {
      // Inclusive: tax is already INSIDE the listed price
      // tax = subtotal × (rate / (1 + combinedInclusiveRate))
      const divisor = 1 + (combinedInclusiveRate > 0 ? combinedInclusiveRate : rule.rate);
      taxAmount = roundCurrency(applicableSubtotal * (rule.rate / divisor));
    }

    taxLines.push({
      label: rule.label,
      rate: rule.rate,
      mode: rule.mode,
      amount: taxAmount,
      appliedTo: rule.appliesTo,
    });

    totalTax += taxAmount;
  }

  totalTax = roundCurrency(totalTax);

  // Calculate service charge
  let serviceCharge = 0;
  const scConfig = taxConfig.serviceCharge;

  if (scConfig?.enabled && scConfig.rate > 0) {
    serviceCharge = roundCurrency(rawSubtotal * scConfig.rate);

    // If service charge is taxable, calculate tax on it
    if (scConfig.taxable) {
      // Use the primary tax rate (first rule or config rate) for service charge tax
      const primaryRate = rules[0]?.rate || taxConfig.rate;
      const primaryMode = rules[0]?.mode || taxConfig.mode;

      let scTax: number;
      if (primaryMode === 'exclusive') {
        scTax = roundCurrency(serviceCharge * primaryRate);
      } else {
        // For inclusive markets, the service charge itself is treated as inclusive of tax
        scTax = roundCurrency(serviceCharge * (primaryRate / (1 + primaryRate)));
      }

      // Add service charge tax to the total
      totalTax = roundCurrency(totalTax + scTax);

      // Add a breakdown line for service charge tax
      if (scTax > 0) {
        // Find the matching tax line and add to it, or create new
        const existingLine = taxLines.find(l => l.label === (rules[0]?.label || taxConfig.label));
        if (existingLine) {
          existingLine.amount = roundCurrency(existingLine.amount + scTax);
        } else {
          taxLines.push({
            label: rules[0]?.label || taxConfig.label,
            rate: primaryRate,
            mode: primaryMode,
            amount: scTax,
          });
        }
      }
    }
  }

  // Calculate net subtotal (the pre-tax amount the restaurant actually receives)
  let netSubtotal: number;
  const primaryMode = rules[0]?.mode || taxConfig.mode;

  if (primaryMode === 'inclusive') {
    // In inclusive mode, the net is the raw minus the embedded tax
    netSubtotal = roundCurrency(rawSubtotal - totalTax);
  } else {
    // In exclusive mode, the net IS the raw subtotal
    netSubtotal = rawSubtotal;
  }

  // Grand total = what the customer pays
  let grandTotal: number;
  if (primaryMode === 'inclusive') {
    // Inclusive: raw subtotal already contains tax, add service charge on top
    grandTotal = roundCurrency(rawSubtotal + serviceCharge);
  } else {
    // Exclusive: raw + tax + service charge
    grandTotal = roundCurrency(rawSubtotal + totalTax + serviceCharge);
  }

  return {
    lines: taxLines,
    totalTax,
    serviceCharge,
    serviceChargeLabel: scConfig?.label || 'Service Charge',
    netSubtotal,
    grandTotal,
  };
}

/**
 * Quick helper: calculate the customer-payable total for a given subtotal.
 * Use when you just need the final number, not the full breakdown.
 */
export function calculateQuickTotal(
  subtotal: number,
  taxConfig: TaxConfiguration
): number {
  if (!taxConfig.enabled || taxConfig.rate <= 0) {
    const sc = taxConfig.serviceCharge?.enabled
      ? roundCurrency(subtotal * (taxConfig.serviceCharge.rate || 0))
      : 0;
    return roundCurrency(subtotal + sc);
  }

  if (taxConfig.mode === 'exclusive') {
    const tax = roundCurrency(subtotal * taxConfig.rate);
    const sc = taxConfig.serviceCharge?.enabled
      ? roundCurrency(subtotal * (taxConfig.serviceCharge.rate || 0))
      : 0;
    return roundCurrency(subtotal + tax + sc);
  } else {
    // Inclusive: subtotal already has tax
    const sc = taxConfig.serviceCharge?.enabled
      ? roundCurrency(subtotal * (taxConfig.serviceCharge.rate || 0))
      : 0;
    return roundCurrency(subtotal + sc);
  }
}

/**
 * Extract the tax amount from a tax-inclusive price.
 * Useful for displaying "incl. ₹X tax" on menu items.
 */
export function extractInclusiveTax(
  inclusivePrice: number,
  rate: number
): number {
  if (rate <= 0) return 0;
  return roundCurrency(inclusivePrice * (rate / (1 + rate)));
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
 * Example: "Incl. GST 5%" or "Sales Tax 8.25% added"
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
