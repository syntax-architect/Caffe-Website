import type { OrderItemInput, OrderCalculationSummary } from '../types/order';

/**
 * Rounds numbers to 2 decimal places safely to prevent floating point inaccuracies.
 */
export const roundCurrency = (amount: number): number => {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};

/**
 * Single source of truth for order financial calculations.
 * Always recalculates unit prices, line totals, and final order sum from raw items.
 */
export const calculateOrderTotals = (items: OrderItemInput[]): OrderCalculationSummary => {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      subtotal: 0,
      total: 0,
      itemCount: 0,
      lineItems: [],
    };
  }

  let subtotal = 0;
  let itemCount = 0;

  const lineItems = items.map((item) => {
    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
    const unit_price = Math.max(0, roundCurrency(Number(item.price) || 0));
    const line_total = roundCurrency(quantity * unit_price);

    subtotal += line_total;
    itemCount += quantity;

    return {
      menu_item_id: String(item.id || ''),
      item_name: String(item.name || 'Unnamed Item').trim(),
      quantity,
      unit_price,
      line_total,
    };
  });

  const roundedSubtotal = roundCurrency(subtotal);
  // Final total (prepared for future discounts, taxes, or service charges)
  const roundedTotal = roundedSubtotal;

  return {
    subtotal: roundedSubtotal,
    total: roundedTotal,
    itemCount,
    lineItems,
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
