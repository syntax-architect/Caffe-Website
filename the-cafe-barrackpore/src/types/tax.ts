/**
 * International Tax Engine — Type Definitions
 * Global Restaurant Platform — Production-Grade Tax Architecture
 *
 * Supports:
 * - VAT / GST / Sales Tax / Consumption Tax across 20+ countries
 * - Inclusive (menu price includes tax) vs Exclusive (tax added at checkout)
 * - Service Charge (mandatory or optional)
 * - Split tax display (e.g. India: CGST + SGST)
 * - Per-item tax categories (food vs alcohol)
 * - Compound taxes (tax-on-service-charge)
 * - Zero-tax jurisdictions (Qatar)
 *
 * Tax Rate Research Sources (2025–2026):
 * - India: GST 5% (inclusive), restaurants without AC/alcohol
 * - US: Sales Tax 5–10.25% (exclusive), varies by state/city
 * - UK: VAT 20% (inclusive), standard rate for restaurant food & drink
 * - UAE: VAT 5% (inclusive), uniform across emirates
 * - Saudi: VAT 15% (inclusive)
 * - Qatar: No VAT
 * - France: TVA 10% food (inclusive), 20% alcohol
 * - Germany: MwSt. 7% food (inclusive since 2024 extension), 19% alcohol
 * - Italy: IVA 10% restaurant food (inclusive), 22% alcohol
 * - Spain: IVA 10% restaurant food (inclusive), 21% alcohol
 * - Japan: Consumption Tax 10% (inclusive)
 * - Singapore: GST 9% (inclusive)
 * - Thailand: VAT 7% (inclusive)
 * - Australia: GST 10% (inclusive)
 * - New Zealand: GST 15% (inclusive)
 * - Canada: HST 13% (exclusive) Ontario; varies by province
 * - Mexico: IVA 16% (inclusive)
 * - South Africa: VAT 15% (inclusive)
 * - Turkey: KDV 8% food (inclusive), 20% alcohol
 * - Netherlands: BTW 9% food (inclusive), 21% alcohol
 */

/** Tax calculation mode */
export type TaxMode = 'inclusive' | 'exclusive';

/** Menu item tax category — determines which tax rate applies */
export type TaxCategory =
  | 'food'
  | 'hot_drink'
  | 'soft_drink'
  | 'bottled_water'
  | 'alcohol'
  | 'tobacco'
  | 'packaged_goods'
  | 'service'
  | 'exempt';

/** Verification status for dated tax rules */
export type TaxRuleStatus = 'verified' | 'unverified' | 'conflict';

/** Order channel filter for tax rules */
export type TaxOrderType = 'all' | 'dine_in' | 'takeaway' | 'delivery';

/**
 * Rates across key restaurant product categories.
 * Values can be numbers (decimal like 0.20) or strings like "not found" / "prohibited".
 */
export interface CategoryTaxRates {
  food: number | string;
  hotDrink: number | string;
  softDrink: number | string;
  bottledWater: number | string;
  alcohol: number | string;
  tobacco: number | string;
}

/**
 * Rates across dining channels.
 */
export interface FulfillmentTaxRates {
  dineIn: number | string;
  takeaway: number | string;
  delivery: number | string;
}

/**
 * Service charge, tip, and cover charge regulations.
 */
export interface ServiceChargeTaxRules {
  policy: 'prohibited_mandatory' | 'included' | 'standard' | 'optional' | 'customary';
  standardRate: number;
  isTaxable: boolean;
  coverChargeAllowed: boolean;
  coverChargeTaxable: boolean;
  notes: string;
}

/**
 * Official invoice and hardware/e-invoicing legal requirements.
 */
export interface InvoiceLegalRequirements {
  fiscalDeviceRequired: boolean;
  fiscalDeviceType?: string; // e.g. "TSE (Germany)", "NF525 (France)", "Registratore Telematico (Italy)", "KSeF (Poland)"
  eInvoiceMandatory: boolean;
  eInvoiceFramework?: string; // e.g. "Peppol", "SDI", "ZATCA Phase 2", "CFDI 4.0", "MyInvois", "DIAN"
  supportedByApp: boolean;
  notes: string;
}

/**
 * Regional rule for federal/multi-level tax jurisdictions (US, CA, IN, AE, BR, AU).
 */
export interface RegionalTaxRule {
  code: string;
  name: string;
  standardRate: number;
  restaurantRate: number;
  taxMode: TaxMode;
  taxLabel: string;
  notes?: string;
  categoryRates?: Partial<Record<TaxCategory, number | string>>;
  localFees?: Array<{ name: string; rate: number; taxable: boolean }>;
}

/**
 * Research and authority verification source.
 */
export interface TaxSourceCitation {
  title: string;
  url: string;
  official: boolean;
  conflictNotes?: string;
}

/**
 * Master Country Tax Registry Entry.
 * Complete legal and calculation profile for one national jurisdiction.
 */
export interface CountryTaxRegistryEntry {
  countryCode: string; // ISO 3166-1 alpha-2
  countryName: string;
  tier: 1 | 2 | 3;
  currency: string; // ISO 4217
  currencySymbol: string;
  currencyDecimals: number; // 0, 2, or 3
  status: TaxRuleStatus; // 'verified' | 'unverified' | 'conflict'
  standardRate: number;
  restaurantRate: number;
  taxMode: TaxMode;
  taxLabel: string;
  taxIdLabel: string;
  taxIdFormat: string;
  requiresTaxId: boolean;
  categoryRates: CategoryTaxRates;
  fulfillmentRates: FulfillmentTaxRates;
  serviceChargeRules: ServiceChargeTaxRules;
  invoiceRequirements: InvoiceLegalRequirements;
  complianceWarnings: string[];
  datedRules: Array<{
    effectiveFrom: string;
    effectiveTo?: string | null;
    rate: number;
    label: string;
    description: string;
  }>;
  isFederalOrMultiLevel: boolean;
  regions?: RegionalTaxRule[];
  sources: TaxSourceCitation[];
  lastVerified: string; // YYYY-MM-DD
  canGoLiveWithoutAccountantConfirmation: boolean;
}

/**
 * Custom country configuration created via manual wizard.
 */
export interface CustomCountryConfig {
  countryCode: string;
  countryName: string;
  currency: string;
  currencySymbol: string;
  currencyDecimals: number;
  taxMode: TaxMode;
  taxLabel: string;
  standardRate: number;
  restaurantRate: number;
  categoryRates: Record<string, number>;
  serviceChargeRate: number;
  serviceChargeTaxable: boolean;
  taxIdLabel: string;
  taxIdFormat: string;
  accountantConfirmed: boolean;
  accountantName?: string;
  accountantLicense?: string;
  confirmationDate?: string;
}

/**
 * Dated, verifiable tax rule record.
 * Mirrors public.tax_rules database table.
 */
export interface DatedTaxRule {
  id?: string;
  country: string; // ISO 3166-1 alpha-2 (e.g. 'IE', 'GB', 'IN', 'US')
  region: string; // Region/state code or 'ALL'
  rule_label: string; // Receipt display label (e.g. 'VAT Food & Hot Drinks')
  rate: number; // Decimal: 0.09 = 9%
  mode: TaxMode; // 'inclusive' | 'exclusive'
  applies_to: TaxCategory[]; // Which item categories this rule applies to
  order_type: TaxOrderType; // Dining channel filter
  effective_from: string; // ISO date 'YYYY-MM-DD'
  effective_to?: string | null; // ISO date 'YYYY-MM-DD' or null if open-ended
  source_url: string; // Official tax authority or Big-4 citation
  last_verified_at: string; // ISO timestamp
  status: TaxRuleStatus; // 'verified' | 'unverified'
  created_at?: string;
  updated_at?: string;
}

/**
 * Country policy defining service charge, cover charge, tips and legal rules.
 */
export interface CountryServiceChargePolicy {
  countryCode: string;
  countryName: string;
  defaultMode: TaxMode;
  taxIdLabel: string;
  taxIdFormat?: string;
  serviceChargePolicy: 'prohibited_mandatory' | 'included' | 'standard' | 'optional' | 'customary';
  serviceChargeDefaultRate: number;
  serviceChargeTaxable: boolean;
  coverChargeAllowed: boolean;
  coverChargeTaxable: boolean;
  tipsTaxable: false; // Invariant: tips are NEVER taxed
  edgeCases: string[];
}

/**
 * Individual tax rule — one line on the receipt.
 * Example: { label: 'CGST', rate: 0.025, mode: 'inclusive' }
 */
export interface TaxRule {
  /** Display label: "VAT", "GST", "CGST", "SGST", "Sales Tax", "TVA" */
  label: string;
  /** Decimal rate: 0.05 = 5%, 0.20 = 20% */
  rate: number;
  /** Whether tax is included in the listed menu price or added on top */
  mode: TaxMode;
  /** Optional: only apply to specific item categories */
  appliesTo?: TaxCategory[];
  /** 
   * If true, this tax compounds on top of other taxes + service charge.
   * Default: false (tax applies to base subtotal only)
   */
  compound?: boolean;
}

/**
 * Service charge configuration.
 * In many countries (Singapore, UAE, Thailand), a 10% service charge is standard.
 */
export interface ServiceChargeConfig {
  /** Whether service charge is enabled */
  enabled: boolean;
  /** Display label: "Service Charge", "Cargo de Servicio" */
  label: string;
  /** Decimal rate: 0.10 = 10% */
  rate: number;
  /** Whether service charge is taxable (tax applies on top of it) */
  taxable: boolean;
  /** Whether customer can opt out */
  optional: boolean;
}

/**
 * Complete tax configuration for a restaurant.
 * This is the single source of truth that drives all financial calculations.
 */
export interface TaxConfiguration {
  /** Master switch */
  enabled: boolean;
  /** Primary tax display mode for the country */
  mode: TaxMode;
  /** Primary tax label shown on receipts */
  label: string;
  /** Primary tax rate (used when rules[] is not specified) */
  rate: number;

  /**
   * Advanced: Multiple tax rules for split tax display.
   * If provided, these override the simple rate/label above.
   *
   * Example (India GST split):
   * rules: [
   *   { label: 'CGST', rate: 0.025, mode: 'inclusive' },
   *   { label: 'SGST', rate: 0.025, mode: 'inclusive' },
   * ]
   *
   * Example (France food + alcohol):
   * rules: [
   *   { label: 'TVA', rate: 0.10, mode: 'inclusive', appliesTo: ['food', 'beverage'] },
   *   { label: 'TVA', rate: 0.20, mode: 'inclusive', appliesTo: ['alcohol'] },
   * ]
   */
  rules?: TaxRule[];

  /** Service charge configuration */
  serviceCharge?: ServiceChargeConfig;

  /**
   * Country-specific tax registration number label.
   * Displayed on invoices/receipts next to the business tax ID.
   * Examples: "GSTIN" (India), "VAT No." (UK/EU), "TIN" (US), "Tax ID" (generic)
   */
  taxIdLabel?: string;

  /**
   * Whether to show tax breakdown on customer receipts.
   * Some countries legally require itemized tax display.
   * Default: true
   */
  showBreakdown?: boolean;

  /**
   * Rounding rule for tax calculations.
   * 'line' = round per line item (common in US)
   * 'total' = round on subtotal (common in EU/India)
   * Default: 'total'
   */
  roundingMode?: 'line' | 'total';

  /**
   * Currency code (ISO 4217, e.g. 'INR', 'USD', 'JPY', 'KWD') for minor-unit rounding.
   */
  currency?: string;

  /**
   * Discount amount to apply to subtotal before service charge and tax.
   */
  discountAmount?: number;
}

/**
 * Result of a tax calculation — full breakdown for receipt display.
 */
export interface TaxBreakdown {
  /** Individual tax lines for receipt display */
  lines: TaxBreakdownLine[];
  /** Total tax amount across all rules */
  totalTax: number;
  /** Service charge amount (0 if not applicable) */
  serviceCharge: number;
  /** Service charge label */
  serviceChargeLabel?: string;
  /** Net subtotal (excluding tax in inclusive mode, base in exclusive mode) */
  netSubtotal: number;
  /** Raw subtotal before discount */
  subtotal?: number;
  /** Discount applied before service charge and tax */
  discountAmount?: number;
  /** Subtotal after discount, upon which service charge and taxes were computed */
  discountedSubtotal?: number;
  /** Grand total payable by customer */
  grandTotal: number;
  /** Date string of the tax rates applied (e.g. '2026-01-01' or '1 Jan 2026') */
  ratesAsOf?: string;
  /** Tax registration number (GSTIN, VAT No., EIN) */
  taxId?: string;
  /** Label for tax registration number */
  taxIdLabel?: string;
}

/**
 * One line in the tax breakdown — appears on the receipt.
 */
export interface TaxBreakdownLine {
  label: string;
  rate: number;
  mode: TaxMode;
  amount: number;
  /** Which categories this tax applied to */
  appliedTo?: TaxCategory[];
}

/**
 * Pre-configured tax profiles for common international setups.
 * Used by the country preset system for one-click tax configuration.
 */
export interface CountryTaxProfile {
  config: TaxConfiguration;
  /** Legal notes shown to restaurant owner during setup */
  legalNote?: string;
  /** Whether invoices must show tax registration number */
  requiresTaxId?: boolean;
  /** Common tax registration number format */
  taxIdFormat?: string;
}
