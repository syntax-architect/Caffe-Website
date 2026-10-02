/**
 * Restaurant Localization and International Configuration Types
 * The Café Barrackpore — Global Restaurant Platform Foundation
 */
import type { PaymentProvider, PaymentMode } from './payment';
import type { TaxRule, ServiceChargeConfig } from './tax';

export type DietarySystem = 'india' | 'international';
export type PrimaryContactMethod = 'whatsapp' | 'phone' | 'email';
export type TaxMode = 'inclusive' | 'exclusive';

export interface TaxConfiguration {
  enabled: boolean;
  mode: TaxMode;
  label: string;
  rate: number; // e.g. 0.05 for 5%, 0.0825 for 8.25%
  /** Advanced: split tax rules (e.g. CGST + SGST for India) */
  rules?: TaxRule[];
  /** Service charge configuration */
  serviceCharge?: ServiceChargeConfig;
  /** Tax registration ID label (e.g. "GSTIN", "VAT No.") */
  taxIdLabel?: string;
  /** Whether to show tax breakdown on receipts */
  showBreakdown?: boolean;
  /** Rounding: 'line' (US) or 'total' (EU/India). Default: 'total' */
  roundingMode?: 'line' | 'total';
}

export interface DietaryConfiguration {
  system: DietarySystem;
}

export interface ContactConfiguration {
  primaryMethod: PrimaryContactMethod;
  phone: string;
  displayPhone: string;
  whatsapp: string;
  email: string;
}

export interface AddressConfiguration {
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

export interface PaymentConfiguration {
  enabled: boolean;
  payments_enabled?: boolean;
  provider: PaymentProvider;
  mode: PaymentMode;
  allow_pay_at_counter?: boolean;
  publishableKey?: string;
}

export interface RestaurantLocalizationConfig {
  country: string; // ISO 3166-1 alpha-2: "IN", "US", "GB", "AE", etc.
  businessName: string;
  shortName: string;
  currency: string; // ISO 4217: "INR", "USD", "GBP", "AED", etc.
  currencySymbol: string; // "₹", "$", "£", "AED", etc.
  locale: string; // BCP 47: "en-IN", "en-US", "en-GB", "en-AE", etc.
  timezone: string; // IANA: "Asia/Kolkata", "America/New_York", etc.
  phoneCountryCode: string; // "+91", "+1", "+44", "+971", etc.
  phoneValidationMode?: 'country' | 'international';
  openingTime: string;
  closingTime: string;
  isOrderingEnabled: boolean;
  isTableBookingEnabled: boolean;
  announcementBanner?: string | null;

  tax: TaxConfiguration;
  dietary: DietaryConfiguration;
  contact: ContactConfiguration;
  address: AddressConfiguration;
  payments: PaymentConfiguration;
}

export interface CountryPreset {
  country: string;
  name: string;
  currency: string;
  currencySymbol: string;
  locale: string;
  timezone: string;
  phoneCountryCode: string;
  taxLabel: string;
  taxRate: number;
  taxMode: TaxMode;
  dietarySystem: DietarySystem;
  primaryContactMethod: PrimaryContactMethod;
  paymentProvider: PaymentProvider;
  paymentMode: PaymentMode;
  payments?: PaymentConfiguration;
  addressSample: {
    city: string;
    region: string;
    postalCode: string;
  };
}
