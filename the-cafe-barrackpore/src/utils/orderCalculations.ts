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
  return {
    enabled: opts.enabled ?? true,
    mode: opts.mode || 'inclusive',
    label: opts.label || 'Tax',
    rate: typeof opts.rate === 'number' ? opts.rate : 0,
    serviceCharge: opts.serviceCharge
      ? {
          enabled: Boolean(opts.serviceCharge.enabled),
          label: opts.serviceCharge.label || 'Service Charge',
          rate: typeof opts.serviceCharge.rate === 'number' ? opts.serviceCharge.rate : 0,
          taxable: Boolean(opts.serviceCharge.taxable),
          optional: Boolean(opts.serviceCharge.optional),
        }
      : undefined,
    rules: opts.rules,
    taxIdLabel: opts.taxIdLabel,
    showBreakdown: opts.showBreakdown,
    roundingMode: opts.roundingMode,
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
  items: OrderItemInput[],
  taxOptions?: TaxCalculationOptions
): OrderCalculationSummary => {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      subtotal: 0,
      tax: 0,
      total: 0,
      taxLabel: taxOptions?.label || 'Tax',
      taxRate: taxOptions?.rate || 0,
      taxMode: taxOptions?.mode || 'inclusive',
      itemCount: 0,
      lineItems: [],
    };
  }

  let subtotal = 0;
  let itemCount = 0;

  const lineItems = items.map((item) => {
    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
    const rawPrice = item.price !== undefined ? item.price : (item as any).unit_price;
    const unit_price = Math.max(0, roundCurrency(Number(rawPrice) || 0));
    const line_total = roundCurrency(quantity * unit_price);

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
    };
  });

  const roundedSubtotal = roundCurrency(subtotal);

  // Convert legacy options to full TaxConfiguration
  const taxConfig = legacyToTaxConfig(taxOptions);

  // Use the international tax engine for calculation
  const taxableItems = items.map((item) => ({
    amount: Math.max(0, roundCurrency(Number(item.price ?? (item as any).unit_price) || 0)),
    quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
    category: (item as any).taxCategory || 'food' as const,
  }));

  const breakdown = calculateTaxBreakdown(taxableItems, taxConfig);

  return {
    subtotal: roundedSubtotal,
    tax: breakdown.totalTax,
    total: breakdown.grandTotal,
    taxLabel: taxConfig.label,
    taxRate: taxConfig.rate,
    taxMode: taxConfig.mode,
    itemCount,
    lineItems,
    netSubtotal: breakdown.netSubtotal,
    // Extended properties for advanced UI (optional consumption)
    ...(breakdown.serviceCharge > 0 && {
      serviceCharge: breakdown.serviceCharge,
      serviceChargeLabel: breakdown.serviceChargeLabel,
    }),
    ...(breakdown.lines.length > 1 && {
      taxBreakdownLines: breakdown.lines,
    }),
  };
};

/**
 * Extended order calculation that accepts the full TaxConfiguration object.
 * Use this for new code paths that need service charge and multi-rate tax support.
 */
export const calculateOrderTotalsAdvanced = (
  items: OrderItemInput[],
  taxConfig: TaxConfiguration
): OrderCalculationSummary & {
  serviceCharge?: number;
  serviceChargeLabel?: string;
  taxBreakdownLines?: Array<{ label: string; rate: number; mode: string; amount: number }>;
  netSubtotal?: number;
} => {
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

  let subtotal = 0;
  let itemCount = 0;

  const lineItems = items.map((item) => {
    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
    const rawPrice = item.price !== undefined ? item.price : (item as any).unit_price;
    const unit_price = Math.max(0, roundCurrency(Number(rawPrice) || 0));
    const line_total = roundCurrency(quantity * unit_price);

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
    };
  });

  const roundedSubtotal = roundCurrency(subtotal);

  const taxableItems = items.map((item) => ({
    amount: Math.max(0, roundCurrency(Number(item.price ?? (item as any).unit_price) || 0)),
    quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
    category: (item as any).taxCategory || 'food' as const,
  }));

  const breakdown = calculateTaxBreakdown(taxableItems, taxConfig);

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
  };
};

/**
 * Generates human-friendly order reference (e.g. CB-2026-X8K9).
 */
export const generateClientOrderRef = (): string => {
  const year = new Date().getFullYear();
  const randomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CB-${year}-${randomCode}`;
};

/**
 * Generates human-friendly reservation reference (e.g. RS-2026-7K2P).
 */
export const generateClientReservationRef = (): string => {
  const year = new Date().getFullYear();
  const randomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `RS-${year}-${randomCode}`;
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
