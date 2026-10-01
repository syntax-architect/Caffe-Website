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
export type TaxCategory = 'food' | 'alcohol' | 'beverage' | 'tobacco' | 'exempt';

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
  /** Grand total payable by customer */
  grandTotal: number;
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
