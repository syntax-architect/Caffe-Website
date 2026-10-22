/**
 * Order Financial Calculations — International Tax-Aware
 * Global Restaurant Platform — Single Source of Truth
 *
 * Handles:
 * - Line item totals with currency-safe rounding
 * - Tax calculation via the international tax engine
 * - Service charge computation
 * - Backward-compatible API (existing callers work without changes)
 * - Full tax breakdown for receipt display
 */

import type { OrderItemInput, OrderCalculationSummary, TaxCalculationOptions } from '../types/order';
import type { TaxConfiguration } from '../types/tax';
import { calculateTaxBreakdown, formatTaxRate, roundCurrency as roundCurrencyFromEngine } from './taxEngine';
import { MASTER_TAX_REGISTRY } from '../config/taxRegistry';

export type { TaxCalculationOptions };

/**
 * Rounds numbers to 2 decimal places safely to prevent floating point inaccuracies.
 */
export const roundCurrency = roundCurrencyFromEngine;

/**
 * Convert legacy TaxCalculationOptions to the new TaxConfiguration format.
 * Ensures backward compatibility with existing callers.
 */
function legacyToTaxConfig(opts?: TaxCalculationOptions): TaxConfiguration {
  if (!opts) {
    return { enabled: false, mode: 'inclusive', label: 'Tax', rate: 0 };
  }

  let mappedRules = opts.rules;
  if (!mappedRules && opts.datedRules && opts.datedRules.length > 0) {
    let candidateRules = opts.datedRules;
    if (opts.country) {
      const countryMatches = opts.datedRules.filter(
        (r) => r.country.toUpperCase() === opts.country!.toUpperCase()
      );
      if (countryMatches.length > 0) {
        if (opts.region && opts.region !== 'ALL') {
          const regionMatches = countryMatches.filter(
            (r) => r.region.toUpperCase() === opts.region!.toUpperCase()
          );
          candidateRules = regionMatches.length > 0 ? regionMatches : countryMatches.filter((r) => r.region.toUpperCase() === 'ALL');
        } else {
          candidateRules = countryMatches.filter((r) => r.region.toUpperCase() === 'ALL');
        }
      }
    }
    mappedRules = candidateRules.map((r) => ({
      label: r.rule_label,
      rate: r.rate,
      mode: r.mode,
      appliesTo: r.applies_to,
    }));
  }

  let mode = opts.mode;
  let rate = typeof opts.rate === 'number' ? opts.rate : 0;
  let label = opts.label || 'Tax';
  if (mappedRules && mappedRules.length > 0) {
    mode = mode || mappedRules[0].mode;
    rate = rate || mappedRules.reduce((acc, r) => acc + r.rate, 0);
    label = opts.label || mappedRules[0].label;
  }

  return {
    enabled: opts.enabled ?? true,
    mode: mode || 'inclusive',
    label,
    rate,
    serviceCharge: opts.serviceCharge
      ? {
          enabled: Boolean(opts.serviceCharge.enabled),
          label: opts.serviceCharge.label || 'Service Charge',
          rate: typeof opts.serviceCharge.rate === 'number' ? opts.serviceCharge.rate : 0,
          taxable: Boolean(opts.serviceCharge.taxable),
          optional: Boolean(opts.serviceCharge.optional),
        }
      : undefined,
    rules: mappedRules,
    taxIdLabel: opts.taxIdLabel,
    showBreakdown: opts.showBreakdown,
    roundingMode: opts.roundingMode,
    currency: opts.currency,
    discountAmount: opts.discountAmount,
  };
}

/**
 * Single source of truth for order financial calculations.
 * Always recalculates unit prices, line totals, and final order sum from raw items.
 * Supports configurable international tax modes (inclusive vs exclusive).
 *
 * This function maintains full backward compatibility with the original API.
 * It now delegates tax calculation to the international tax engine for
 * accurate VAT/GST/Sales Tax handling across 20+ countries.
 */
export const calculateOrderTotals = (
  itemsOrOpts: OrderItemInput[] | (TaxCalculationOptions & { items: OrderItemInput[] }),
  taxOptions?: TaxCalculationOptions
): OrderCalculationSummary => {
  let items: OrderItemInput[];
  let effectiveOpts: TaxCalculationOptions | undefined;
  let hasDatedRulesPassedDirectly = false;

  if (Array.isArray(itemsOrOpts)) {
    items = itemsOrOpts;
    effectiveOpts = taxOptions;
  } else if (itemsOrOpts && typeof itemsOrOpts === 'object' && Array.isArray((itemsOrOpts as any).items)) {
    items = (itemsOrOpts as any).items;
    const { items: _extractedItems, ...restOpts } = itemsOrOpts as any;
    effectiveOpts = { ...restOpts, ...taxOptions };
    if ((itemsOrOpts as any).datedRules && (itemsOrOpts as any).datedRules.length > 0) {
      hasDatedRulesPassedDirectly = true;
    }
  } else {
    items = [];
    effectiveOpts = taxOptions;
  }

  if (!Array.isArray(items) || items.length === 0) {
    return {
      subtotal: 0,
      tax: 0,
      total: 0,
      taxLabel: effectiveOpts?.label || 'Tax',
      taxRate: effectiveOpts?.rate || 0,
      taxMode: effectiveOpts?.mode || 'inclusive',
      itemCount: 0,
      lineItems: [],
      taxBreakdownLines: [],
    };
  }

  const countryCode = effectiveOpts?.country?.toUpperCase();
  const currency = effectiveOpts?.currency || (countryCode && MASTER_TAX_REGISTRY[countryCode]?.currency) || 'INR';

  let subtotal = 0;
  let itemCount = 0;

  const lineItems = items.map((item) => {
    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
    const rawPrice = item.price !== undefined ? item.price : (item as any).unit_price;
    const unit_price = Math.max(0, roundCurrency(Number(rawPrice) || 0, currency));
    const line_total = roundCurrency(quantity * unit_price, currency);

    subtotal += line_total;
    itemCount += quantity;

    const rawId = item.id !== undefined ? item.id : (item as any).item_id;
    const rawName = item.name !== undefined ? item.name : (item as any).item_name;

    return {
      menu_item_id: String(rawId || ''),
      item_name: String(rawName || 'Unnamed Item').trim(),
      quantity,
      unit_price,
      line_total,
      tax_category: item.tax_category || (item as any).taxCategory || 'food',
    };
  });

  const roundedSubtotal = roundCurrency(subtotal, currency);

  // Convert legacy options to full TaxConfiguration
  const taxConfig = legacyToTaxConfig({ ...effectiveOpts, currency });

  // Use the international tax engine for calculation
  const taxableItems = items.map((item) => ({
    amount: Math.max(0, roundCurrency(Number(item.price ?? (item as any).unit_price) || 0, currency)),
    quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
    category: (item.tax_category || (item as any).taxCategory || 'food') as any,
  }));

  const breakdown = calculateTaxBreakdown(taxableItems, taxConfig, {
    discountAmount: effectiveOpts?.discountAmount,
    currency,
  });

  const tipAmount = Math.max(0, roundCurrency(Number(effectiveOpts?.tipAmount) || 0, currency));
  const finalTotal = roundCurrency(breakdown.grandTotal + tipAmount, currency);

  const displaySubtotal = (hasDatedRulesPassedDirectly && taxConfig.mode === 'inclusive')
    ? breakdown.netSubtotal
    : roundedSubtotal;

  return {
    subtotal: displaySubtotal,
    tax: breakdown.totalTax,
    total: finalTotal,
    taxLabel: taxConfig.label,
    taxRate: taxConfig.rate,
    taxMode: taxConfig.mode,
    itemCount,
    lineItems,
    netSubtotal: breakdown.netSubtotal,
    discountAmount: breakdown.discountAmount,
    discountedSubtotal: breakdown.discountedSubtotal,
    ratesAsOf: effectiveOpts?.ratesAsOf || breakdown.ratesAsOf,
    taxId: effectiveOpts?.taxId || breakdown.taxId,
    taxIdLabel: effectiveOpts?.taxIdLabel || breakdown.taxIdLabel,
    ...(tipAmount > 0 && { tipAmount }),
    // Extended properties for advanced UI (optional consumption)
    ...(breakdown.serviceCharge > 0 && {
      serviceCharge: breakdown.serviceCharge,
      serviceChargeLabel: breakdown.serviceChargeLabel,
    }),
    taxBreakdownLines: breakdown.lines,
  };
};

/**
 * Extended order calculation that accepts the full TaxConfiguration object.
 * Use this for new code paths that need service charge and multi-rate tax support.
 */
export const calculateOrderTotalsAdvanced = (
  items: OrderItemInput[],
  taxConfig: TaxConfiguration,
  runtimeOpts?: {
    orderDate?: string | Date;
    orderType?: 'all' | 'dine_in' | 'takeaway' | 'delivery';
    country?: string;
    region?: string;
    taxId?: string;
    taxIdLabel?: string;
  }
): OrderCalculationSummary => {
  void runtimeOpts;
  if (!Array.isArray(items) || items.length === 0) {
    return {
      subtotal: 0,
      tax: 0,
      total: 0,
      taxLabel: taxConfig.label,
      taxRate: taxConfig.rate,
      taxMode: taxConfig.mode,
      itemCount: 0,
      lineItems: [],
    };
  }

  const currency = taxConfig.currency || 'INR';

  let subtotal = 0;
  let itemCount = 0;

  const lineItems = items.map((item) => {
    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
    const rawPrice = item.price !== undefined ? item.price : (item as any).unit_price;
    const unit_price = Math.max(0, roundCurrency(Number(rawPrice) || 0, currency));
    const line_total = roundCurrency(quantity * unit_price, currency);

    subtotal += line_total;
    itemCount += quantity;

    const rawId = item.id !== undefined ? item.id : (item as any).item_id;
    const rawName = item.name !== undefined ? item.name : (item as any).item_name;

    return {
      menu_item_id: String(rawId || ''),
      item_name: String(rawName || 'Unnamed Item').trim(),
      quantity,
      unit_price,
      line_total,
      tax_category: item.tax_category || (item as any).taxCategory || 'food',
    };
  });

  const roundedSubtotal = roundCurrency(subtotal, currency);

  const taxableItems = items.map((item) => ({
    amount: Math.max(0, roundCurrency(Number(item.price ?? (item as any).unit_price) || 0, currency)),
    quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
    category: item.tax_category || (item as any).taxCategory || 'food' as const,
  }));

  const breakdown = calculateTaxBreakdown(taxableItems, taxConfig, {
    discountAmount: taxConfig.discountAmount,
    currency,
    ...runtimeOpts,
  });

  return {
    subtotal: roundedSubtotal,
    tax: breakdown.totalTax,
    total: breakdown.grandTotal,
    taxLabel: taxConfig.label,
    taxRate: taxConfig.rate,
    taxMode: taxConfig.mode,
    itemCount,
    lineItems,
    serviceCharge: breakdown.serviceCharge > 0 ? breakdown.serviceCharge : undefined,
    serviceChargeLabel: breakdown.serviceCharge > 0 ? breakdown.serviceChargeLabel : undefined,
    taxBreakdownLines: breakdown.lines.length > 0 ? breakdown.lines : undefined,
    netSubtotal: breakdown.netSubtotal,
    discountAmount: breakdown.discountAmount,
    discountedSubtotal: breakdown.discountedSubtotal,
    ratesAsOf: breakdown.ratesAsOf,
    taxId: breakdown.taxId,
    taxIdLabel: breakdown.taxIdLabel,
  };
};

/**
 * Generates human-friendly order reference (e.g. CB-2026-X8K9).
 */
const generatedOrderCodes = new Set<string>();

export const generateClientOrderRef = (): string => {
  const year = new Date().getFullYear();
  let code = '';
  do {
    code = Math.random().toString(36).substring(2, 6).toUpperCase();
    if (code.length < 4) {
      code = code.padEnd(4, 'X');
    }
  } while (generatedOrderCodes.has(code));

  generatedOrderCodes.add(code);
  if (generatedOrderCodes.size > 2000) {
    generatedOrderCodes.clear();
  }

  return `CB-${year}-${code}`;
};

/**
 * Generates human-friendly reservation reference (e.g. RS-2026-7K2P).
 */
const generatedReservationCodes = new Set<string>();

export const generateClientReservationRef = (): string => {
  const year = new Date().getFullYear();
  let code = '';
  do {
    code = Math.random().toString(36).substring(2, 6).toUpperCase();
    if (code.length < 4) {
      code = code.padEnd(4, 'X');
    }
  } while (generatedReservationCodes.has(code));

  generatedReservationCodes.add(code);
  if (generatedReservationCodes.size > 2000) {
    generatedReservationCodes.clear();
  }

  return `RS-${year}-${code}`;
};

/**
 * Format a tax summary string for display.
 * @example getTaxDisplayString('GST', 0.05, 'inclusive') → "GST 5% incl."
 */
export const getTaxDisplayString = (
  label: string,
  rate: number,
  mode: 'inclusive' | 'exclusive'
): string => {
  const rateStr = formatTaxRate(rate);
  return mode === 'inclusive'
    ? `${label} ${rateStr} incl.`
    : `${label} ${rateStr}`;
};
