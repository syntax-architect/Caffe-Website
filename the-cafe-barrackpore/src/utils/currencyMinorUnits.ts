/**
 * Centralized Currency Minor Units Conversion Utility
 * Used across client payment adapters, CartDrawer, and services.
 *
 * Handles:
 * - Stripe zero-decimal currencies (JPY, KRW, VND, CLP, etc.): multiplier = 1
 * - Three-decimal currencies (KWD, BHD, OMR, JOD, etc.): multiplier = 1000
 * - Standard two-decimal currencies (USD, EUR, INR, GBP, etc.): multiplier = 100
 * - Bidirectional conversions (amount to minor units and back) with exact rounding
 *   and floating-point drift prevention.
 */

/**
 * Stripe zero-decimal currencies (multiplier = 1).
 * In Stripe and payment gateways, these currencies have no minor subunits (1 unit = 1 subunit).
 */
export const ZERO_DECIMAL_CURRENCIES: ReadonlySet<string> = new Set([
  'BIF', // Burundian Franc
  'CLP', // Chilean Peso
  'DJF', // Djiboutian Franc
  'GNF', // Guinean Franc
  'JPY', // Japanese Yen
  'KMF', // Comorian Franc
  'KRW', // South Korean Won
  'MGA', // Malagasy Ariary
  'PYG', // Paraguayan Guaraní
  'RWF', // Rwandan Franc
  'UGX', // Ugandan Shilling
  'VND', // Vietnamese Đồng
  'VUV', // Vanuatu Vatu
  'XAF', // Central African CFA Franc
  'XOF', // West African CFA Franc
  'XPF', // CFP Franc
]);

/**
 * Three-decimal currencies (multiplier = 1000).
 * In Stripe, ISO 4217, and international banking, these currencies have 3 decimal places (1 unit = 1000 subunits).
 */
export const THREE_DECIMAL_CURRENCIES: ReadonlySet<string> = new Set([
  'BHD', // Bahraini Dinar
  'IQD', // Iraqi Dinar
  'JOD', // Jordanian Dinar
  'KWD', // Kuwaiti Dinar
  'LYD', // Libyan Dinar
  'OMR', // Omani Rial
  'TND', // Tunisian Dinar
]);

/**
 * Determines if a given currency code is a zero-decimal currency.
 */
export function isZeroDecimalCurrency(currency?: string): boolean {
  if (!currency) return false;
  return ZERO_DECIMAL_CURRENCIES.has(currency.trim().toUpperCase());
}

/**
 * Determines if a given currency code is a three-decimal currency.
 */
export function isThreeDecimalCurrency(currency?: string): boolean {
  if (!currency) return false;
  return THREE_DECIMAL_CURRENCIES.has(currency.trim().toUpperCase());
}

/**
 * Returns the minor unit multiplier factor for a given currency:
 * - Zero-decimal currencies (JPY, KRW, VND, CLP, etc.) -> 1
 * - Three-decimal currencies (KWD, BHD, OMR, JOD, etc.) -> 1000
 * - Standard two-decimal currencies (USD, EUR, INR, GBP, etc.) -> 100
 */
export function getCurrencyMultiplier(currency?: string): number {
  if (!currency) return 100;
  const upper = currency.trim().toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(upper)) return 1;
  if (THREE_DECIMAL_CURRENCIES.has(upper)) return 1000;
  return 100;
}

/**
 * Returns the number of decimal digits for a given currency.
 * - Zero-decimal currencies -> 0
 * - Three-decimal currencies -> 3
 * - Standard two-decimal currencies -> 2
 */
export function getCurrencyDecimalDigits(currency?: string): number {
  if (!currency) return 2;
  const upper = currency.trim().toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(upper)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(upper)) return 3;
  return 2;
}

/**
 * Converts a major currency amount (e.g. 19.99 USD, 1250 JPY, 5.250 KWD)
 * to provider minor units (e.g. 1999 cents, 1250 yen, 5250 fils), with rounding.
 *
 * @param amount - Monetary amount in major units
 * @param currency - ISO 4217 currency code (e.g. 'USD', 'JPY', 'KWD', 'INR')
 * @returns Minor units integer (e.g. 1999, 1250, 5250)
 */
export function toMinorUnits(amount: number, currency?: string): number {
  if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) return 0;
  const multiplier = getCurrencyMultiplier(currency);
  return Math.round(amount * multiplier);
}

/**
 * Converts a provider minor unit amount (e.g. 1999 cents, 1250 yen, 5250 fils)
 * back to major currency units (e.g. 19.99 USD, 1250 JPY, 5.25 KWD), preventing float drift.
 *
 * @param minorUnits - Monetary amount in provider minor units
 * @param currency - ISO 4217 currency code (e.g. 'USD', 'JPY', 'KWD', 'INR')
 * @returns Amount in major units (e.g. 19.99, 1250, 5.25)
 */
export function fromMinorUnits(minorUnits: number, currency?: string): number {
  if (typeof minorUnits !== 'number' || isNaN(minorUnits) || !isFinite(minorUnits)) return 0;
  const multiplier = getCurrencyMultiplier(currency);
  const decimals = getCurrencyDecimalDigits(currency);
  const roundedMinor = Math.round(minorUnits);
  return Number((roundedMinor / multiplier).toFixed(decimals));
}

// Aliases for clear expressiveness across codebases
export const amountToMinorUnits = toMinorUnits;
export const minorUnitsToAmount = fromMinorUnits;
