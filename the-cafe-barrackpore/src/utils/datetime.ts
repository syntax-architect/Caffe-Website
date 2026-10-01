/**
 * Restaurant Date & Time Localization Utility
 * Ensures all customer and kitchen time displays respect the configured restaurant timezone and locale.
 */

/**
 * Formats a date into a localized date string in the restaurant's timezone.
 * Examples:
 * - IN: 24 May 2026
 * - US: May 24, 2026
 * - GB: 24 May 2026
 */
export function formatRestaurantDate(
  dateInput: string | number | Date,
  locale = 'en-IN',
  timeZone = 'Asia/Kolkata',
  options?: Intl.DateTimeFormatOptions
): string {
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '';

    return new Intl.DateTimeFormat(locale, {
      timeZone,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      ...options,
    }).format(d);
  } catch (err) {
    console.warn('[formatRestaurantDate] Error formatting date:', err);
    return String(dateInput);
  }
}

/**
 * Formats a time string or timestamp into the restaurant's local time.
 * Examples:
 * - 07:30 PM
 */
export function formatRestaurantTime(
  dateInput: string | number | Date,
  locale = 'en-IN',
  timeZone = 'Asia/Kolkata',
  options?: Intl.DateTimeFormatOptions
): string {
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '';

    return new Intl.DateTimeFormat(locale, {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      ...options,
    }).format(d);
  } catch (err) {
    console.warn('[formatRestaurantTime] Error formatting time:', err);
    return String(dateInput);
  }
}

/**
 * Formats both date and time into a single localized string.
 */
export function formatRestaurantDateTime(
  dateInput: string | number | Date,
  locale = 'en-IN',
  timeZone = 'Asia/Kolkata'
): string {
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '';

    return new Intl.DateTimeFormat(locale, {
      timeZone,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch (err) {
    console.warn('[formatRestaurantDateTime] Error formatting date-time:', err);
    return String(dateInput);
  }
}
