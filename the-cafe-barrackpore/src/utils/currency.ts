/**
 * Centralized Currency & Monetary Formatting Utility
 * Uses native Intl.NumberFormat for standards-compliant international representation.
 */

export interface CurrencyFormatOptions {
  currency?: string;
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

/**
 * Formats a monetary amount into a clean, localized string.
 * Examples:
 * - formatCurrency(620, 'INR', 'en-IN') => '₹620'
 * - formatCurrency(62, 'USD', 'en-US') => '$62.00'
 * - formatCurrency(48, 'GBP', 'en-GB') => '£48.00'
 * - formatCurrency(228, 'AED', 'en-AE') => 'AED 228.00'
 * - formatCurrency(82, 'CAD', 'en-CA') => 'CA$82.00'
 * - formatCurrency(95, 'AUD', 'en-AU') => 'A$95.00'
 */
export function formatCurrency(
  amount: number,
  currency = 'INR',
  locale = 'en-IN',
  options?: CurrencyFormatOptions
): string {
  const numericAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  const isFractional = numericAmount % 1 !== 0;

  // By default in India, whole-rupee prices on menus are written without trailing .00 (e.g. ₹620)
  // For international currencies (USD, GBP, EUR, AED, CAD, AUD), standard is 2 decimal places.
  const defaultMinDigits =
    currency.toUpperCase() === 'INR'
      ? (isFractional ? 2 : 0)
      : 2;

  const minDigits = options?.minimumFractionDigits !== undefined ? options.minimumFractionDigits : defaultMinDigits;
  const maxDigits = options?.maximumFractionDigits !== undefined ? options.maximumFractionDigits : 2;

  try {
    let formatted = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: minDigits,
      maximumFractionDigits: maxDigits,
    }).format(numericAmount);

    // Normalize non-breaking spaces (\u00A0 and \u202F) to standard ASCII spaces
    formatted = formatted.replace(/[\u00A0\u202F]/g, ' ');

    // Standards enhancement for CA$ and A$ display
    if (currency.toUpperCase() === 'CAD' && formatted.startsWith('$')) {
      formatted = 'CA' + formatted;
    } else if (currency.toUpperCase() === 'AUD' && formatted.startsWith('$')) {
      formatted = 'A' + formatted;
    }

    return formatted;
  } catch (err) {
    // Graceful fallback if an invalid currency or locale is supplied
    console.warn(`[formatCurrency] Error formatting ${amount} with ${currency}/${locale}:`, err);
    return `${currency} ${numericAmount.toFixed(2)}`;
  }
}

/**
 * Resolves the primary currency symbol for a given currency code.
 */
export function getCurrencySymbol(currency = 'INR', locale = 'en-IN'): string {
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).formatToParts(0);

    const symbolPart = parts.find((p) => p.type === 'currency');
    let symbol = symbolPart ? symbolPart.value.replace(/[\u00A0\u202F]/g, ' ').trim() : currency;

    if (currency.toUpperCase() === 'CAD' && symbol === '$') {
      symbol = 'CA$';
    } else if (currency.toUpperCase() === 'AUD' && symbol === '$') {
      symbol = 'A$';
    }

    return symbol;
  } catch {
    return currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency === 'GBP' ? '£' : currency;
  }
}
