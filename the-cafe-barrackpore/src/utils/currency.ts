/**
 * Centralized Currency & Monetary Formatting Utility
 * Uses native Intl.NumberFormat for standards-compliant international representation.
 * Supports ISO 4217 currency minor units (e.g. JPY 0, KWD 3, standard 2).
 */

export interface CurrencyFormatOptions {
  currency?: string;
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

/**
 * ISO 4217 Currency Minor Units (decimal places).
 * 0 decimals: JPY, KRW, VND, CLP, PYG, ISK, etc.
 * 3 decimals: KWD, BHD, OMR, JOD, TND, IQD, LYD.
 * Default: 2 decimals.
 */
export const CURRENCY_DECIMALS: Record<string, number> = {
  // 0 decimals (no minor unit)
  BIF: 0,
  CLP: 0,
  DJF: 0,
  GNF: 0,
  ISK: 0,
  JPY: 0,
  KMF: 0,
  KRW: 0,
  PYG: 0,
  RWF: 0,
  UGX: 0,
  VND: 0,
  VUV: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,

  // 3 decimals (1/1000 minor unit)
  BHD: 3,
  IQD: 3,
  JOD: 3,
  KWD: 3,
  LYD: 3,
  OMR: 3,
  TND: 3,
};

/**
 * Resolves the standard minor unit (decimal places) for a given currency code.
 * Follows ISO 4217 standard (e.g. JPY => 0, KWD => 3, USD/INR/EUR => 2).
 */
export function getCurrencyDecimals(currency = 'INR'): number {
  if (!currency || typeof currency !== 'string') return 2;
  const code = currency.trim().toUpperCase();
  if (code in CURRENCY_DECIMALS) {
    return CURRENCY_DECIMALS[code];
  }
  try {
    const digits = new Intl.NumberFormat('en', {
      style: 'currency',
      currency: code,
    }).resolvedOptions().maximumFractionDigits;
    if (typeof digits === 'number' && !isNaN(digits)) {
      return digits;
    }
  } catch {
    // Unsupported currency code fallback
  }
  return 2;
}

/**
 * Formats a monetary amount into a clean, localized string.
 * Examples:
 * - formatCurrency(620, 'INR', 'en-IN') => '₹620'
 * - formatCurrency(62.5, 'USD', 'en-US') => '$62.50'
 * - formatCurrency(1500, 'JPY', 'ja-JP') => '¥1,500'
 * - formatCurrency(12.345, 'KWD', 'ar-KW') => 'KWD 12.345'
 */
export function formatCurrency(
  amount: number,
  currency = 'INR',
  locale = 'en-IN',
  options?: CurrencyFormatOptions
): string {
  const numericAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  const currencyCode = (currency || 'INR').trim().toUpperCase();
  const minorUnits = getCurrencyDecimals(currencyCode);
  const isFractional = numericAmount % 1 !== 0;

  // By default in India, whole-rupee prices on menus are written without trailing .00 (e.g. ₹620)
  // For 0-decimal currencies (JPY), minDigits is 0.
  // For standard currencies (USD, EUR, KWD), standard is the minor unit count.
  let defaultMinDigits = minorUnits;
  if (minorUnits === 0) {
    defaultMinDigits = 0;
  } else if (currencyCode === 'INR') {
    defaultMinDigits = isFractional ? 2 : 0;
  }

  const minDigits = options?.minimumFractionDigits !== undefined
    ? options.minimumFractionDigits
    : defaultMinDigits;
  const maxDigits = options?.maximumFractionDigits !== undefined
    ? options.maximumFractionDigits
    : minorUnits;

  try {
    let formatted = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: minDigits,
      maximumFractionDigits: maxDigits,
    }).format(numericAmount);

    // Normalize non-breaking spaces (\u00A0 and \u202F) to standard ASCII spaces
    formatted = formatted.replace(/[\u00A0\u202F]/g, ' ');

    // Standards enhancement for CA$ and A$ display
    if (currencyCode === 'CAD' && formatted.startsWith('$')) {
      formatted = 'CA' + formatted;
    } else if (currencyCode === 'AUD' && formatted.startsWith('$')) {
      formatted = 'A' + formatted;
    }

    return formatted;
  } catch (err) {
    // Graceful fallback if an invalid currency or locale is supplied
    console.warn(`[formatCurrency] Error formatting ${amount} with ${currencyCode}/${locale}:`, err);
    return `${currencyCode} ${numericAmount.toFixed(minorUnits)}`;
  }
}

/**
 * Resolves the primary currency symbol for a given currency code.
 */
export function getCurrencySymbol(currency = 'INR', locale = 'en-IN'): string {
  const currencyCode = (currency || 'INR').trim().toUpperCase();
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).formatToParts(0);

    const symbolPart = parts.find((p) => p.type === 'currency');
    let symbol = symbolPart ? symbolPart.value.replace(/[\u00A0\u202F]/g, ' ').trim() : currencyCode;

    if (currencyCode === 'CAD' && symbol === '$') {
      symbol = 'CA$';
    } else if (currencyCode === 'AUD' && symbol === '$') {
      symbol = 'A$';
    }

    return symbol;
  } catch {
    switch (currencyCode) {
      case 'INR': return '₹';
      case 'USD': return '$';
      case 'GBP': return '£';
      case 'EUR': return '€';
      case 'JPY': return '¥';
      case 'AED': return 'AED';
      case 'SAR': return 'SAR';
      case 'KWD': return 'KWD';
      default: return currencyCode;
    }
  }
}

// Re-export currency minor unit utilities and constants
export * from './currencyMinorUnits';
