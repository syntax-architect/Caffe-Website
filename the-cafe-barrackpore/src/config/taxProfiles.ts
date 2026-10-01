/**
 * International Tax Profiles — Researched Country-Specific Tax Configurations
 * Global Restaurant Platform — Production Tax Registry
 *
 * Each profile contains legally-accurate tax rates, modes, labels, service charge
 * norms, and compliance metadata for restaurant businesses.
 *
 * Sources: National tax authority websites, OECD VAT/GST database,
 * PwC Worldwide Tax Summaries 2025–2026, Deloitte Tax Guides.
 *
 * DISCLAIMER: Tax rates change. These are accurate as of mid-2026 but should be
 * verified against official national tax authority guidance before production use
 * in any specific jurisdiction.
 */

import type { TaxConfiguration } from '../types/tax';

export interface CountryTaxProfile {
  /** Full country name */
  name: string;
  /** ISO 3166-1 alpha-2 */
  code: string;
  /** Tax configuration ready to use */
  config: TaxConfiguration;
  /** Legal advisory for restaurant owners */
  legalNote: string;
  /** Whether the country requires a tax registration number on invoices */
  requiresTaxId: boolean;
  /** Example tax ID format */
  taxIdFormat?: string;
}

/**
 * Master registry of country-specific tax profiles.
 * Keyed by ISO 3166-1 alpha-2 country code.
 */
export const COUNTRY_TAX_PROFILES: Record<string, CountryTaxProfile> = {
  // ═══════════════════════════════════════════════════════
  //  ASIA-PACIFIC
  // ═══════════════════════════════════════════════════════

  IN: {
    name: 'India',
    code: 'IN',
    config: {
      enabled: true,
      mode: 'inclusive',
      label: 'GST',
      rate: 0.05,
      rules: [
        { label: 'CGST', rate: 0.025, mode: 'inclusive' },
        { label: 'SGST', rate: 0.025, mode: 'inclusive' },
      ],
      serviceCharge: {
        enabled: false,
        label: 'Service Charge',
        rate: 0.10,
        taxable: false,
        optional: true, // CCPA India: service charge must be optional
      },
      taxIdLabel: 'GSTIN',
      showBreakdown: true,
      roundingMode: 'total',
    },
    legalNote: 'GST 5% for restaurants without AC/liquor license (no input tax credit). 18% for AC restaurants. Service charge is voluntary per CCPA guidelines.',
    requiresTaxId: true,
    taxIdFormat: '22AAAAA0000A1Z5',
  },

  AU: {
    name: 'Australia',
    code: 'AU',
    config: {
      enabled: true,
      mode: 'inclusive',
      label: 'GST',
      rate: 0.10,
      serviceCharge: {
        enabled: false,
        label: 'Service Charge',
        rate: 0,
        taxable: false,
        optional: true,
      },
      taxIdLabel: 'ABN',
      showBreakdown: true,
      roundingMode: 'total',
    },
    legalNote: 'GST 10% inclusive on all restaurant food and beverages. Businesses with turnover > A$75,000 must register for GST.',
    requiresTaxId: true,
    taxIdFormat: '12 345 678 901',
  },

  NZ: {
    name: 'New Zealand',
    code: 'NZ',
    config: {
      enabled: true,
      mode: 'inclusive',
      label: 'GST',
      rate: 0.15,
      serviceCharge: {
        enabled: false,
        label: 'Service Charge',
        rate: 0,
        taxable: false,
        optional: true,
      },
      taxIdLabel: 'GST No.',
      showBreakdown: true,
      roundingMode: 'total',
    },
    legalNote: 'GST 15% on all goods and services. Registration mandatory above NZD 60,000 turnover.',
    requiresTaxId: true,
    taxIdFormat: '12-345-678',
  },

  SG: {
    name: 'Singapore',
    code: 'SG',
    config: {
      enabled: true,
      mode: 'inclusive',
      label: 'GST',
      rate: 0.09,
      serviceCharge: {
        enabled: true,
        label: 'Service Charge',
        rate: 0.10,
        taxable: true, // GST applies on service charge in Singapore
        optional: false,
      },
      taxIdLabel: 'GST Reg. No.',
      showBreakdown: true,
      roundingMode: 'total',
    },
    legalNote: 'GST 9% (increased from 8% on 1 Jan 2024). 10% service charge is industry standard and GST-taxable. Total effective surcharge: ~19.7% on menu prices.',
    requiresTaxId: true,
    taxIdFormat: 'M1-2345678-A',
  },

  JP: {
    name: 'Japan',
    code: 'JP',
    config: {
      enabled: true,
      mode: 'inclusive',
      label: '消費税',
      rate: 0.10,
      serviceCharge: {
        enabled: false,
        label: 'サービス料',
        rate: 0.10,
        taxable: true,
        optional: false, // Fine dining hotels may charge; fast food does not
      },
      taxIdLabel: 'Invoice Reg. No.',
      showBreakdown: true,
      roundingMode: 'total',
    },
    legalNote: 'Consumption Tax 10% for dine-in. Takeaway food qualifies for reduced 8% rate. Qualified Invoice System (インボイス制度) required since Oct 2023.',
    requiresTaxId: true,
    taxIdFormat: 'T1234567890123',
  },

  TH: {
    name: 'Thailand',
    code: 'TH',
    config: {
      enabled: true,
      mode: 'inclusive',
      label: 'VAT',
      rate: 0.07,
      serviceCharge: {
        enabled: true,
        label: 'Service Charge',
        rate: 0.10,
        taxable: true, // VAT applies on service charge in Thailand
        optional: false,
      },
      taxIdLabel: 'Tax ID',
      showBreakdown: true,
      roundingMode: 'total',
    },
    legalNote: 'VAT 7% on restaurant services. 10% service charge is standard in upscale restaurants and hotels. Combined effective surcharge: ~17.7%.',
    requiresTaxId: true,
    taxIdFormat: '0-1234-56789-01-2',
  },

  // ═══════════════════════════════════════════════════════
  //  NORTH AMERICA
  // ═══════════════════════════════════════════════════════

  US: {
    name: 'United States',
    code: 'US',
    config: {
      enabled: true,
      mode: 'exclusive',
      label: 'Sales Tax',
      rate: 0.0825, // NYC default; varies by state/city
      serviceCharge: {
        enabled: false,
        label: 'Service Charge',
        rate: 0,
        taxable: false,
        optional: true,
      },
      taxIdLabel: 'EIN',
      showBreakdown: true,
      roundingMode: 'line', // US standard: round per line item
    },
    legalNote: 'Sales Tax varies by state, county, and city (range: 0%–10.25%). Configure the exact combined rate for your jurisdiction. No federal VAT.',
    requiresTaxId: true,
    taxIdFormat: '12-3456789',
  },

  CA: {
    name: 'Canada',
    code: 'CA',
    config: {
      enabled: true,
      mode: 'exclusive',
      label: 'HST',
      rate: 0.13, // Ontario; varies by province
      serviceCharge: {
        enabled: false,
        label: 'Service Charge',
        rate: 0,
        taxable: false,
        optional: true,
      },
      taxIdLabel: 'BN/GST No.',
      showBreakdown: true,
      roundingMode: 'total',
    },
    legalNote: 'HST 13% (Ontario), GST 5% + PST varies by province. Alberta: GST 5% only. British Columbia: GST 5% + PST 7%. Quebec: GST 5% + QST 9.975%.',
    requiresTaxId: true,
    taxIdFormat: '123456789RT0001',
  },

  MX: {
    name: 'Mexico',
    code: 'MX',
    config: {
      enabled: true,
      mode: 'inclusive',
      label: 'IVA',
      rate: 0.16,
      serviceCharge: {
        enabled: false,
        label: 'Cargo de Servicio',
        rate: 0,
        taxable: false,
        optional: true,
      },
      taxIdLabel: 'RFC',
      showBreakdown: true,
      roundingMode: 'total',
    },
    legalNote: 'IVA 16% on all restaurant food and beverages. Electronic invoicing (CFDI) mandatory. Propinas (tips) are voluntary and not taxed as part of the sale.',
    requiresTaxId: true,
    taxIdFormat: 'ABCD123456XYZ',
  },

  // ═══════════════════════════════════════════════════════
  //  EUROPE
  // ═══════════════════════════════════════════════════════

  GB: {
    name: 'United Kingdom',
    code: 'GB',
    config: {
      enabled: true,
      mode: 'inclusive',
      label: 'VAT',
      rate: 0.20,
      serviceCharge: {
        enabled: false,
        label: 'Service Charge',
        rate: 0.125, // 12.5% is common in UK restaurants
        taxable: true, // VAT applies on compulsory service charges
        optional: true, // Legally must be optional if stated
      },
      taxIdLabel: 'VAT No.',
      showBreakdown: true,
      roundingMode: 'total',
    },
    legalNote: 'VAT 20% standard rate on all restaurant food and drink. Registration mandatory above £90,000 turnover. Discretionary service charges are subject to VAT.',
    requiresTaxId: true,
    taxIdFormat: 'GB 123 4567 89',
  },

  DE: {
    name: 'Germany',
    code: 'DE',
    config: {
      enabled: true,
      mode: 'inclusive',
      label: 'MwSt.',
      rate: 0.19,
      rules: [
        { label: 'MwSt.', rate: 0.07, mode: 'inclusive', appliesTo: ['food'] },
        { label: 'MwSt.', rate: 0.19, mode: 'inclusive', appliesTo: ['alcohol', 'beverage'] },
      ],
      serviceCharge: {
        enabled: false,
        label: 'Servicegebühr',
        rate: 0,
        taxable: false,
        optional: true,
      },
      taxIdLabel: 'USt-IdNr.',
      showBreakdown: true,
      roundingMode: 'total',
    },
    legalNote: 'Reduced rate 7% for prepared food (extended through 2026). Standard 19% for beverages and alcohol. Electronic cash register (TSE) mandatory.',
    requiresTaxId: true,
    taxIdFormat: 'DE123456789',
  },

  FR: {
    name: 'France',
    code: 'FR',
    config: {
      enabled: true,
      mode: 'inclusive',
      label: 'TVA',
      rate: 0.10,
      rules: [
        { label: 'TVA', rate: 0.10, mode: 'inclusive', appliesTo: ['food', 'beverage'] },
        { label: 'TVA', rate: 0.20, mode: 'inclusive', appliesTo: ['alcohol'] },
      ],
      serviceCharge: {
        enabled: true,
        label: 'Service compris',
        rate: 0.15, // "Service compris" 15% is standard
        taxable: true,
        optional: false, // Legally included in France
      },
      taxIdLabel: 'N° TVA',
      showBreakdown: true,
      roundingMode: 'total',
    },
    legalNote: 'TVA 10% for restaurant food and non-alcoholic drinks (reduced rate). 20% for alcoholic beverages. Service is legally included in prices ("service compris"). Electronic ticketing systems (NF525) required.',
    requiresTaxId: true,
    taxIdFormat: 'FR12 345678901',
  },

  IT: {
    name: 'Italy',
    code: 'IT',
    config: {
      enabled: true,
      mode: 'inclusive',
      label: 'IVA',
      rate: 0.10,
      rules: [
        { label: 'IVA', rate: 0.10, mode: 'inclusive', appliesTo: ['food', 'beverage'] },
        { label: 'IVA', rate: 0.22, mode: 'inclusive', appliesTo: ['alcohol'] },
      ],
      serviceCharge: {
        enabled: true,
        label: 'Coperto',
        rate: 0.0, // Coperto is a fixed amount, not percentage
        taxable: true,
        optional: false,
      },
      taxIdLabel: 'P.IVA',
      showBreakdown: true,
      roundingMode: 'total',
    },
    legalNote: 'IVA 10% for restaurant food services (reduced rate). 22% for alcohol. "Coperto" (cover charge) ranges €1–€5 fixed per person and is legal in most regions except Lazio. Electronic invoicing (fattura elettronica) mandatory.',
    requiresTaxId: true,
    taxIdFormat: 'IT12345678901',
  },

  ES: {
    name: 'Spain',
    code: 'ES',
    config: {
      enabled: true,
      mode: 'inclusive',
      label: 'IVA',
      rate: 0.10,
      rules: [
        { label: 'IVA', rate: 0.10, mode: 'inclusive', appliesTo: ['food', 'beverage'] },
        { label: 'IVA', rate: 0.21, mode: 'inclusive', appliesTo: ['alcohol'] },
      ],
      serviceCharge: {
        enabled: false,
        label: 'Servicio',
        rate: 0,
        taxable: false,
        optional: true,
      },
      taxIdLabel: 'NIF/CIF',
      showBreakdown: true,
      roundingMode: 'total',
    },
    legalNote: 'IVA 10% for restaurant services (reduced rate). 21% for alcoholic beverages. Electronic billing systems required in many autonomous communities.',
    requiresTaxId: true,
    taxIdFormat: 'ES B12345678',
  },

  NL: {
    name: 'Netherlands',
    code: 'NL',
    config: {
      enabled: true,
      mode: 'inclusive',
      label: 'BTW',
      rate: 0.09,
      rules: [
        { label: 'BTW', rate: 0.09, mode: 'inclusive', appliesTo: ['food', 'beverage'] },
        { label: 'BTW', rate: 0.21, mode: 'inclusive', appliesTo: ['alcohol'] },
      ],
      serviceCharge: {
        enabled: false,
        label: 'Servicekosten',
        rate: 0,
        taxable: false,
        optional: true,
      },
      taxIdLabel: 'BTW-nummer',
      showBreakdown: true,
      roundingMode: 'total',
    },
    legalNote: 'BTW 9% reduced rate for food and non-alcoholic drinks in restaurants. 21% for alcoholic beverages. Service included in prices by convention.',
    requiresTaxId: true,
    taxIdFormat: 'NL123456789B01',
  },

  TR: {
    name: 'Turkey',
    code: 'TR',
    config: {
      enabled: true,
      mode: 'inclusive',
      label: 'KDV',
      rate: 0.08,
      rules: [
        { label: 'KDV', rate: 0.08, mode: 'inclusive', appliesTo: ['food', 'beverage'] },
        { label: 'KDV', rate: 0.20, mode: 'inclusive', appliesTo: ['alcohol'] },
      ],
      serviceCharge: {
        enabled: false,
        label: 'Servis Ücreti',
        rate: 0.10,
        taxable: true,
        optional: true,
      },
      taxIdLabel: 'Vergi No.',
      showBreakdown: true,
      roundingMode: 'total',
    },
    legalNote: 'KDV 8% for restaurant food services. 20% for alcoholic beverages. ÖTV (special consumption tax) may also apply to certain alcohol. Electronic fiscal devices required.',
    requiresTaxId: true,
    taxIdFormat: '1234567890',
  },

  // ═══════════════════════════════════════════════════════
  //  MIDDLE EAST & AFRICA
  // ═══════════════════════════════════════════════════════

  AE: {
    name: 'United Arab Emirates',
    code: 'AE',
    config: {
      enabled: true,
      mode: 'inclusive',
      label: 'VAT',
      rate: 0.05,
      serviceCharge: {
        enabled: true,
        label: 'Service Charge',
        rate: 0.10,
        taxable: true, // VAT applies on service charge
        optional: false,
      },
      taxIdLabel: 'TRN',
      showBreakdown: true,
      roundingMode: 'total',
    },
    legalNote: 'VAT 5% on all goods and services. TRN (Tax Registration Number) mandatory on invoices. 10% service charge and 7% municipality fee common in Dubai restaurants. No alcohol tax via VAT, but license fees apply.',
    requiresTaxId: true,
    taxIdFormat: '100123456700003',
  },

  SA: {
    name: 'Saudi Arabia',
    code: 'SA',
    config: {
      enabled: true,
      mode: 'inclusive',
      label: 'VAT',
      rate: 0.15,
      serviceCharge: {
        enabled: false,
        label: 'Service Charge',
        rate: 0,
        taxable: false,
        optional: true,
      },
      taxIdLabel: 'VAT No.',
      showBreakdown: true,
      roundingMode: 'total',
    },
    legalNote: 'VAT 15% (increased from 5% in July 2020). Electronic invoicing (FATOORA) Phase 2 compliance mandatory. No alcohol is served in Saudi restaurants.',
    requiresTaxId: true,
    taxIdFormat: '300012345600003',
  },

  QA: {
    name: 'Qatar',
    code: 'QA',
    config: {
      enabled: false,
      mode: 'inclusive',
      label: 'No Tax',
      rate: 0,
      serviceCharge: {
        enabled: true,
        label: 'Service Charge',
        rate: 0.10,
        taxable: false,
        optional: false,
      },
      taxIdLabel: 'Tax Card No.',
      showBreakdown: false,
      roundingMode: 'total',
    },
    legalNote: 'Qatar has NO VAT or sales tax. Service charges of 10% may be applied by some restaurants. No plans for VAT introduction announced as of 2026.',
    requiresTaxId: false,
  },

  ZA: {
    name: 'South Africa',
    code: 'ZA',
    config: {
      enabled: true,
      mode: 'inclusive',
      label: 'VAT',
      rate: 0.15,
      serviceCharge: {
        enabled: false,
        label: 'Service Charge',
        rate: 0,
        taxable: false,
        optional: true,
      },
      taxIdLabel: 'VAT No.',
      showBreakdown: true,
      roundingMode: 'total',
    },
    legalNote: 'VAT 15% on all restaurant goods and services. Registration mandatory above ZAR 1 million turnover. Tips are customary (10–15%) but not mandatory.',
    requiresTaxId: true,
    taxIdFormat: '4123456789',
  },
};

/**
 * Get the tax profile for a given country code.
 * Falls back to a generic 0% profile for unknown countries.
 */
export function getCountryTaxProfile(countryCode: string): CountryTaxProfile {
  const profile = COUNTRY_TAX_PROFILES[countryCode.toUpperCase()];
  if (profile) return profile;

  // Generic fallback for unknown countries
  return {
    name: 'Unknown Country',
    code: countryCode.toUpperCase(),
    config: {
      enabled: false,
      mode: 'inclusive',
      label: 'Tax',
      rate: 0,
      showBreakdown: false,
      roundingMode: 'total',
    },
    legalNote: 'Tax configuration not available for this country. Please configure manually.',
    requiresTaxId: false,
  };
}

/**
 * List all available country tax profiles.
 */
export function listAvailableTaxProfiles(): Array<{ code: string; name: string; rate: number; label: string }> {
  return Object.entries(COUNTRY_TAX_PROFILES).map(([code, profile]) => ({
    code,
    name: profile.name,
    rate: profile.config.rate,
    label: profile.config.label,
  }));
}
