import * as fs from 'fs';
import * as path from 'path';
import { MASTER_TAX_REGISTRY } from '../src/config/taxRegistry';

const metadataMap: Record<string, {
  locale: string;
  timezone: string;
  phoneCountryCode: string;
  dietarySystem: 'india' | 'international';
  primaryContactMethod: 'whatsapp' | 'phone' | 'email';
  paymentProvider: 'stripe' | 'razorpay' | 'none';
  city: string;
  region: string;
  postalCode: string;
}> = {
  // Tier 1
  IE: { locale: 'en-IE', timezone: 'Europe/Dublin', phoneCountryCode: '+353', dietarySystem: 'international', primaryContactMethod: 'phone', paymentProvider: 'stripe', city: 'Dublin', region: 'Leinster', postalCode: 'D02 X285' },
  GB: { locale: 'en-GB', timezone: 'Europe/London', phoneCountryCode: '+44', dietarySystem: 'international', primaryContactMethod: 'phone', paymentProvider: 'stripe', city: 'London', region: 'Greater London', postalCode: 'EC1A 1BB' },
  US: { locale: 'en-US', timezone: 'America/New_York', phoneCountryCode: '+1', dietarySystem: 'international', primaryContactMethod: 'phone', paymentProvider: 'stripe', city: 'New York', region: 'NY', postalCode: '10001' },
  CA: { locale: 'en-CA', timezone: 'America/Toronto', phoneCountryCode: '+1', dietarySystem: 'international', primaryContactMethod: 'phone', paymentProvider: 'stripe', city: 'Toronto', region: 'Ontario', postalCode: 'M5V 2T6' },
  AU: { locale: 'en-AU', timezone: 'Australia/Sydney', phoneCountryCode: '+61', dietarySystem: 'international', primaryContactMethod: 'phone', paymentProvider: 'stripe', city: 'Sydney', region: 'NSW', postalCode: '2000' },
  NZ: { locale: 'en-NZ', timezone: 'Pacific/Auckland', phoneCountryCode: '+64', dietarySystem: 'international', primaryContactMethod: 'phone', paymentProvider: 'stripe', city: 'Auckland', region: 'Auckland', postalCode: '1010' },
  SG: { locale: 'en-SG', timezone: 'Asia/Singapore', phoneCountryCode: '+65', dietarySystem: 'international', primaryContactMethod: 'whatsapp', paymentProvider: 'stripe', city: 'Singapore', region: 'Central', postalCode: '018956' },
  AE: { locale: 'en-AE', timezone: 'Asia/Dubai', phoneCountryCode: '+971', dietarySystem: 'international', primaryContactMethod: 'whatsapp', paymentProvider: 'stripe', city: 'Dubai', region: 'Dubai', postalCode: '00000' },

  // Tier 2
  DE: { locale: 'de-DE', timezone: 'Europe/Berlin', phoneCountryCode: '+49', dietarySystem: 'international', primaryContactMethod: 'phone', paymentProvider: 'stripe', city: 'Berlin', region: 'Berlin', postalCode: '10115' },
  FR: { locale: 'fr-FR', timezone: 'Europe/Paris', phoneCountryCode: '+33', dietarySystem: 'international', primaryContactMethod: 'phone', paymentProvider: 'stripe', city: 'Paris', region: 'Île-de-France', postalCode: '75001' },
  ES: { locale: 'es-ES', timezone: 'Europe/Madrid', phoneCountryCode: '+34', dietarySystem: 'international', primaryContactMethod: 'phone', paymentProvider: 'stripe', city: 'Madrid', region: 'Comunidad de Madrid', postalCode: '28001' },
  IT: { locale: 'it-IT', timezone: 'Europe/Rome', phoneCountryCode: '+39', dietarySystem: 'international', primaryContactMethod: 'phone', paymentProvider: 'stripe', city: 'Roma', region: 'Lazio', postalCode: '00100' },
  NL: { locale: 'nl-NL', timezone: 'Europe/Amsterdam', phoneCountryCode: '+31', dietarySystem: 'international', primaryContactMethod: 'phone', paymentProvider: 'stripe', city: 'Amsterdam', region: 'Noord-Holland', postalCode: '1011 AB' },
  PT: { locale: 'pt-PT', timezone: 'Europe/Lisbon', phoneCountryCode: '+351', dietarySystem: 'international', primaryContactMethod: 'phone', paymentProvider: 'stripe', city: 'Lisboa', region: 'Lisboa', postalCode: '1100-001' },
  BE: { locale: 'fr-BE', timezone: 'Europe/Brussels', phoneCountryCode: '+32', dietarySystem: 'international', primaryContactMethod: 'phone', paymentProvider: 'stripe', city: 'Bruxelles', region: 'Bruxelles', postalCode: '1000' },
  AT: { locale: 'de-AT', timezone: 'Europe/Vienna', phoneCountryCode: '+43', dietarySystem: 'international', primaryContactMethod: 'phone', paymentProvider: 'stripe', city: 'Wien', region: 'Wien', postalCode: '1010' },
  SE: { locale: 'sv-SE', timezone: 'Europe/Stockholm', phoneCountryCode: '+46', dietarySystem: 'international', primaryContactMethod: 'phone', paymentProvider: 'stripe', city: 'Stockholm', region: 'Stockholm', postalCode: '111 22' },
  DK: { locale: 'da-DK', timezone: 'Europe/Copenhagen', phoneCountryCode: '+45', dietarySystem: 'international', primaryContactMethod: 'phone', paymentProvider: 'stripe', city: 'København', region: 'Hovedstaden', postalCode: '1050' },
  NO: { locale: 'nb-NO', timezone: 'Europe/Oslo', phoneCountryCode: '+47', dietarySystem: 'international', primaryContactMethod: 'phone', paymentProvider: 'stripe', city: 'Oslo', region: 'Oslo', postalCode: '0150' },
  CH: { locale: 'de-CH', timezone: 'Europe/Zurich', phoneCountryCode: '+41', dietarySystem: 'international', primaryContactMethod: 'phone', paymentProvider: 'stripe', city: 'Zürich', region: 'Zürich', postalCode: '8001' },
  PL: { locale: 'pl-PL', timezone: 'Europe/Warsaw', phoneCountryCode: '+48', dietarySystem: 'international', primaryContactMethod: 'phone', paymentProvider: 'stripe', city: 'Warszawa', region: 'Mazowieckie', postalCode: '00-001' },

  // Tier 3
  IN: { locale: 'en-IN', timezone: 'Asia/Kolkata', phoneCountryCode: '+91', dietarySystem: 'india', primaryContactMethod: 'whatsapp', paymentProvider: 'razorpay', city: 'Barrackpore', region: 'West Bengal', postalCode: '700120' },
  JP: { locale: 'ja-JP', timezone: 'Asia/Tokyo', phoneCountryCode: '+81', dietarySystem: 'international', primaryContactMethod: 'phone', paymentProvider: 'stripe', city: 'Tokyo', region: 'Tokyo', postalCode: '100-0001' },
  KR: { locale: 'ko-KR', timezone: 'Asia/Seoul', phoneCountryCode: '+82', dietarySystem: 'international', primaryContactMethod: 'phone', paymentProvider: 'stripe', city: 'Seoul', region: 'Seoul', postalCode: '03141' },
  TH: { locale: 'th-TH', timezone: 'Asia/Bangkok', phoneCountryCode: '+66', dietarySystem: 'international', primaryContactMethod: 'whatsapp', paymentProvider: 'stripe', city: 'Bangkok', region: 'Bangkok', postalCode: '10110' },
  MY: { locale: 'en-MY', timezone: 'Asia/Kuala_Lumpur', phoneCountryCode: '+60', dietarySystem: 'international', primaryContactMethod: 'whatsapp', paymentProvider: 'stripe', city: 'Kuala Lumpur', region: 'Wilayah Persekutuan', postalCode: '50088' },
  ID: { locale: 'id-ID', timezone: 'Asia/Jakarta', phoneCountryCode: '+62', dietarySystem: 'international', primaryContactMethod: 'whatsapp', paymentProvider: 'stripe', city: 'Jakarta', region: 'DKI Jakarta', postalCode: '10110' },
  PH: { locale: 'en-PH', timezone: 'Asia/Manila', phoneCountryCode: '+63', dietarySystem: 'international', primaryContactMethod: 'phone', paymentProvider: 'stripe', city: 'Manila', region: 'Metro Manila', postalCode: '1000' },
  VN: { locale: 'vi-VN', timezone: 'Asia/Ho_Chi_Minh', phoneCountryCode: '+84', dietarySystem: 'international', primaryContactMethod: 'whatsapp', paymentProvider: 'stripe', city: 'Ho Chi Minh City', region: 'Ho Chi Minh', postalCode: '700000' },
  HK: { locale: 'zh-HK', timezone: 'Asia/Hong_Kong', phoneCountryCode: '+852', dietarySystem: 'international', primaryContactMethod: 'phone', paymentProvider: 'stripe', city: 'Hong Kong', region: 'Hong Kong', postalCode: '999077' },
  SA: { locale: 'ar-SA', timezone: 'Asia/Riyadh', phoneCountryCode: '+966', dietarySystem: 'international', primaryContactMethod: 'whatsapp', paymentProvider: 'stripe', city: 'Riyadh', region: 'Riyadh', postalCode: '11564' },
  QA: { locale: 'ar-QA', timezone: 'Asia/Qatar', phoneCountryCode: '+974', dietarySystem: 'international', primaryContactMethod: 'whatsapp', paymentProvider: 'stripe', city: 'Doha', region: 'Doha', postalCode: '00000' },
  KW: { locale: 'ar-KW', timezone: 'Asia/Kuwait', phoneCountryCode: '+965', dietarySystem: 'international', primaryContactMethod: 'whatsapp', paymentProvider: 'stripe', city: 'Kuwait City', region: 'Al Asimah', postalCode: '13001' },
  BH: { locale: 'ar-BH', timezone: 'Asia/Bahrain', phoneCountryCode: '+973', dietarySystem: 'international', primaryContactMethod: 'whatsapp', paymentProvider: 'stripe', city: 'Manama', region: 'Capital Governorate', postalCode: '316' },
  TR: { locale: 'tr-TR', timezone: 'Europe/Istanbul', phoneCountryCode: '+90', dietarySystem: 'international', primaryContactMethod: 'whatsapp', paymentProvider: 'stripe', city: 'Istanbul', region: 'Istanbul', postalCode: '34000' },
  IL: { locale: 'he-IL', timezone: 'Asia/Jerusalem', phoneCountryCode: '+972', dietarySystem: 'international', primaryContactMethod: 'phone', paymentProvider: 'stripe', city: 'Tel Aviv', region: 'Tel Aviv', postalCode: '61000' },
  ZA: { locale: 'en-ZA', timezone: 'Africa/Johannesburg', phoneCountryCode: '+27', dietarySystem: 'international', primaryContactMethod: 'whatsapp', paymentProvider: 'stripe', city: 'Cape Town', region: 'Western Cape', postalCode: '8001' },
  NG: { locale: 'en-NG', timezone: 'Africa/Lagos', phoneCountryCode: '+234', dietarySystem: 'international', primaryContactMethod: 'whatsapp', paymentProvider: 'stripe', city: 'Lagos', region: 'Lagos', postalCode: '100001' },
  KE: { locale: 'en-KE', timezone: 'Africa/Nairobi', phoneCountryCode: '+254', dietarySystem: 'international', primaryContactMethod: 'whatsapp', paymentProvider: 'stripe', city: 'Nairobi', region: 'Nairobi', postalCode: '00100' },
  EG: { locale: 'ar-EG', timezone: 'Africa/Cairo', phoneCountryCode: '+20', dietarySystem: 'international', primaryContactMethod: 'whatsapp', paymentProvider: 'stripe', city: 'Cairo', region: 'Cairo', postalCode: '11511' },
  MX: { locale: 'es-MX', timezone: 'America/Mexico_City', phoneCountryCode: '+52', dietarySystem: 'international', primaryContactMethod: 'whatsapp', paymentProvider: 'stripe', city: 'Ciudad de México', region: 'CDMX', postalCode: '06600' },
  BR: { locale: 'pt-BR', timezone: 'America/Sao_Paulo', phoneCountryCode: '+55', dietarySystem: 'international', primaryContactMethod: 'whatsapp', paymentProvider: 'stripe', city: 'São Paulo', region: 'SP', postalCode: '01000-000' },
  CL: { locale: 'es-CL', timezone: 'America/Santiago', phoneCountryCode: '+56', dietarySystem: 'international', primaryContactMethod: 'phone', paymentProvider: 'stripe', city: 'Santiago', region: 'Región Metropolitana', postalCode: '8320000' },
  CO: { locale: 'es-CO', timezone: 'America/Bogota', phoneCountryCode: '+57', dietarySystem: 'international', primaryContactMethod: 'whatsapp', paymentProvider: 'stripe', city: 'Bogotá', region: 'Bogotá D.C.', postalCode: '110111' },
};

let content = `import type { CountryPreset, RestaurantLocalizationConfig } from '../types/restaurantConfig';

/**
 * Standard international presets for the platform.
 * Covers 44 key restaurant markets across Tier 1, Tier 2, and Tier 3.
 *
 * Each preset provides turnkey localization: currency, tax regime, timezone,
 * phone format, dietary labeling system, and default payment provider.
 */
export const RESTAURANT_PRESETS: Record<string, CountryPreset> = {\n`;

for (const [code, entry] of Object.entries(MASTER_TAX_REGISTRY)) {
  const meta = metadataMap[code] || {
    locale: 'en-US',
    timezone: 'UTC',
    phoneCountryCode: '+1',
    dietarySystem: 'international',
    primaryContactMethod: 'email',
    paymentProvider: 'stripe',
    city: 'Capital City',
    region: 'Central',
    postalCode: '00000',
  };

  content += `  ${code}: {
    country: '${code}',
    name: '${entry.countryName}',
    currency: '${entry.currency}',
    currencySymbol: '${entry.currencySymbol}',
    locale: '${meta.locale}',
    timezone: '${meta.timezone}',
    phoneCountryCode: '${meta.phoneCountryCode}',
    taxLabel: '${entry.taxLabel}',
    taxRate: ${entry.restaurantRate},
    taxMode: '${entry.taxMode}',
    dietarySystem: '${meta.dietarySystem}',
    primaryContactMethod: '${meta.primaryContactMethod}',
    paymentProvider: '${meta.paymentProvider}',
    paymentMode: 'disabled',
    addressSample: {
      city: '${meta.city}',
      region: '${meta.region}',
      postalCode: '${meta.postalCode}',
    },
  },\n`;
}

content += `};\n\n`;

content += `/**
 * Country names grouped by official compliance tiers and geographic economic zones
 */
export const PRESET_REGIONS: Record<string, string[]> = {
  'Tier 1 (Core International Hubs)': ['IE', 'GB', 'US', 'CA', 'AU', 'NZ', 'SG', 'AE'],
  'Tier 2 (European Union & EFTA)': ['DE', 'FR', 'ES', 'IT', 'NL', 'PT', 'BE', 'AT', 'SE', 'DK', 'NO', 'CH', 'PL'],
  'Tier 3 (Asia-Pacific & Middle East)': ['IN', 'JP', 'KR', 'TH', 'MY', 'ID', 'PH', 'VN', 'HK', 'SA', 'QA', 'KW', 'BH', 'TR', 'IL'],
  'Tier 3 (Americas & Africa)': ['ZA', 'NG', 'KE', 'EG', 'MX', 'BR', 'CL', 'CO'],
};\n\n`;

content += `/**
 * Default configuration for The Café Barrackpore (India 🇮🇳)
 * When sold to a foreign client, the admin reconfigures via Settings → Country Preset
 */
export const DEFAULT_RESTAURANT_CONFIG: RestaurantLocalizationConfig = {
  country: 'IN',
  businessName: 'The Café Barrackpore',
  shortName: 'Barrackpore',
  currency: 'INR',
  currencySymbol: '₹',
  locale: 'en-IN',
  timezone: 'Asia/Kolkata',
  phoneCountryCode: '+91',
  phoneValidationMode: 'country',
  openingTime: '11:00 AM',
  closingTime: '11:00 PM',
  isOrderingEnabled: true,
  isTableBookingEnabled: true,
  announcementBanner: null,

  tax: {
    enabled: true,
    mode: 'inclusive',
    label: 'GST',
    rate: 0.05,
  },

  dietary: {
    system: 'india',
  },

  contact: {
    primaryMethod: 'whatsapp',
    phone: '+918420507105',
    displayPhone: '084205 07105',
    whatsapp: '+918420507105',
    email: 'contact@thecafe.com',
  },

  address: {
    line1: '14, Riverside Road, Cantonment',
    city: 'Barrackpore',
    region: 'West Bengal',
    postalCode: '700120',
    country: 'India',
  },

  payments: {
    enabled: false,
    provider: 'razorpay',
    mode: 'disabled',
  },

  features: {
    enable_delivery: false,
    enable_takeaway: true,
    enable_dine_in: true,
    enable_table_reservations: true,
    enable_online_payment: false,
    enable_counter_payment: true,
    enable_promotions: true,
    enable_reviews: true,
  },
};\n`;

fs.writeFileSync(path.resolve(process.cwd(), 'src/config/restaurantPresets.ts'), content, 'utf-8');
console.log('Successfully written src/config/restaurantPresets.ts for all 44 countries!');
