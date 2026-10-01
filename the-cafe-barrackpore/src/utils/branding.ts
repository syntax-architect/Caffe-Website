/**
 * White-Label Branding Configuration
 * Global Restaurant Platform — Dynamic Brand Resolution
 *
 * Centralizes all brand-dependent strings and assets so that
 * a new client deployment requires ZERO source code changes.
 * All branding flows from the restaurant configuration in Settings.
 *
 * Usage:
 * ```tsx
 * const { restaurantConfig } = useSiteConfig();
 * const brand = getBrandConfig(restaurantConfig);
 * ```
 */
import type { RestaurantLocalizationConfig } from '../types/restaurantConfig';

export interface BrandConfig {
  /** Full business name: "The Café Barrackpore" */
  name: string;
  /** Short display name: "Barrackpore" */
  shortName: string;
  /** SEO page title */
  seoTitle: string;
  /** SEO meta description */
  seoDescription: string;
  /** Order reference prefix: "CB" → "CB-2026-X8K9" */
  orderRefPrefix: string;
  /** Reservation reference prefix: "RS" */
  reservationRefPrefix: string;
  /** Copyright line */
  copyright: string;
  /** Support email */
  supportEmail: string;
  /** WhatsApp concierge number (digits only for wa.me) */
  whatsappNumber: string;
  /** Full address one-liner for footer / invoices */
  fullAddress: string;
  /** Operating hours display */
  operatingHours: string;
}

/**
 * Derives all branding from the live restaurant configuration.
 * No hardcoded references to "The Café Barrackpore" or "Barrackpore" remain.
 */
export function getBrandConfig(config: RestaurantLocalizationConfig): BrandConfig {
  const currentYear = new Date().getFullYear();

  // Generate a 2-letter order prefix from the business name
  const words = config.businessName.split(/\s+/).filter(w => w.length > 1);
  let orderRefPrefix = 'OR';
  if (words.length >= 2) {
    // Take first letter of first significant word and first letter of last word
    orderRefPrefix = (words[0][0] + words[words.length - 1][0]).toUpperCase();
  } else if (words.length === 1) {
    orderRefPrefix = words[0].substring(0, 2).toUpperCase();
  }

  const fullAddress = [
    config.address.line1,
    config.address.line2,
    config.address.city,
    config.address.region,
    config.address.postalCode,
    config.address.country,
  ]
    .filter(Boolean)
    .join(', ');

  return {
    name: config.businessName,
    shortName: config.shortName || config.businessName,
    seoTitle: `${config.businessName} | Best Restaurant & Dining`,
    seoDescription: `Experience premium dining at ${config.businessName}. Online ordering, table reservations, and a curated menu — all in one seamless experience.`,
    orderRefPrefix,
    reservationRefPrefix: 'RS',
    copyright: `© ${currentYear} ${config.businessName}. All rights reserved.`,
    supportEmail: config.contact.email,
    whatsappNumber: config.contact.whatsapp.replace(/\D/g, ''),
    fullAddress,
    operatingHours: `${config.openingTime} – ${config.closingTime}`,
  };
}

/**
 * Generates a branded order reference code.
 * Uses the business-name-derived prefix instead of hardcoded "CB".
 */
export function generateBrandedOrderRef(config: RestaurantLocalizationConfig): string {
  const brand = getBrandConfig(config);
  const year = new Date().getFullYear();
  const randomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${brand.orderRefPrefix}-${year}-${randomCode}`;
}

/**
 * Generates a branded reservation reference code.
 */
export function generateBrandedReservationRef(_config?: RestaurantLocalizationConfig): string {
  const year = new Date().getFullYear();
  const randomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `RS-${year}-${randomCode}`;
}
