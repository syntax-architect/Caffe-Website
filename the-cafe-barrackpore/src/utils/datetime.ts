/**
 * Restaurant Date & Time Localization Utility
 * Ensures all customer and kitchen time displays respect the configured restaurant timezone and locale.
 */

import { getLocaleForCountry } from './currency';

export function getRestaurantTimezone(country?: string): string {
  if (country) {
    const c = country.trim().toUpperCase();
    if (c === 'US') return 'America/New_York';
    if (c === 'GB') return 'Europe/London';
    if (c === 'IE') return 'Europe/Dublin';
    if (c === 'JP') return 'Asia/Tokyo';
    if (c === 'KW') return 'Asia/Kuwait';
    if (c === 'IN') return 'Asia/Kolkata';
  }
  const detected = ((globalThis as any).process?.env?.VITE_RESTAURANT_COUNTRY || (globalThis as any).process?.env?.VITE_CLIENT_COUNTRY)
    || ((import.meta as any).env?.VITE_RESTAURANT_COUNTRY || (import.meta as any).env?.VITE_CLIENT_COUNTRY);
  if (detected?.toUpperCase() === 'US') return 'America/New_York';
  if (detected?.toUpperCase() === 'GB') return 'Europe/London';
  if (detected?.toUpperCase() === 'IN') return 'Asia/Kolkata';
  return 'UTC';
}

/**
 * Formats a date into a localized date string in the restaurant's timezone.
 * Examples:
 * - IN: 24 May 2026
 * - US: May 24, 2026
 * - GB: 24 May 2026
 */
function resolveLocaleAndTimeZone(
  localeCandidate?: string,
  timeZoneCandidate?: string
): { locale: string; timeZone: string } {
  const defaultLocale = getLocaleForCountry();
  const defaultTz = getRestaurantTimezone();

  // If the first argument contains a slash, it is a timezone identifier (e.g. 'Asia/Kolkata')
  if (typeof localeCandidate === 'string' && localeCandidate.includes('/')) {
    return {
      timeZone: localeCandidate,
      locale: typeof timeZoneCandidate === 'string' && !timeZoneCandidate.includes('/')
        ? timeZoneCandidate
        : defaultLocale,
    };
  }
  return {
    locale: localeCandidate || defaultLocale,
    timeZone: timeZoneCandidate || defaultTz,
  };
}

export function formatRestaurantDate(
  dateInput: string | number | Date,
  locale?: string,
  timeZone?: string,
  options?: Intl.DateTimeFormatOptions
): string {
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '';

    const resolved = resolveLocaleAndTimeZone(locale, timeZone);
    return new Intl.DateTimeFormat(resolved.locale, {
      timeZone: resolved.timeZone,
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
  locale?: string,
  timeZone?: string,
  options?: Intl.DateTimeFormatOptions
): string {
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '';

    const resolved = resolveLocaleAndTimeZone(locale, timeZone);
    return new Intl.DateTimeFormat(resolved.locale, {
      timeZone: resolved.timeZone,
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
  locale?: string,
  timeZone?: string,
  options?: Intl.DateTimeFormatOptions
): string {
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '';

    const resolved = resolveLocaleAndTimeZone(locale, timeZone);
    return new Intl.DateTimeFormat(resolved.locale, {
      timeZone: resolved.timeZone,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      ...options,
    }).format(d);
  } catch (err) {
    console.warn('[formatRestaurantDateTime] Error formatting date-time:', err);
    return String(dateInput);
  }
}
