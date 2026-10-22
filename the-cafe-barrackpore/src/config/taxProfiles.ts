/**
 * International Tax Profiles — Master Registry Connector
 * Global Restaurant Platform — Production Tax Profiles
 *
 * Exposes turnkey country tax profiles for all 44 jurisdictions across
 * Tier 1, Tier 2, and Tier 3, powered by MASTER_TAX_REGISTRY.
 */

import type { TaxConfiguration, TaxRule, CountryTaxRegistryEntry } from '../types/tax';
import {
  MASTER_TAX_REGISTRY,
  getCountryTaxRegistryEntry,
  listTaxRegistryEntries,
  canJurisdictionGoLive,
  getEffectiveTaxRate,
  createCustomCountryProfile,
  CURRENCY_DECIMALS,
  getCurrencyDecimals,
  DATED_TAX_RULES,
  COUNTRY_POLICIES,
  isRuleStale,
  getStaleRules,
  getSubRegionsForCountry,
  resolveDatedRules,
} from './taxRegistry';

export {
  MASTER_TAX_REGISTRY,
  getCountryTaxRegistryEntry,
  listTaxRegistryEntries,
  canJurisdictionGoLive,
  getEffectiveTaxRate,
  createCustomCountryProfile,
  CURRENCY_DECIMALS,
  getCurrencyDecimals,
  DATED_TAX_RULES,
  COUNTRY_POLICIES,
  isRuleStale,
  getStaleRules,
  getSubRegionsForCountry,
  resolveDatedRules,
};

export interface CountryTaxProfile {
  /** Full country name */
  name: string;
  /** ISO 3166-1 alpha-2 */
  code: string;
  /** Tax configuration ready to use with calculateTaxBreakdown */
  config: TaxConfiguration;
  /** Legal advisory for restaurant owners */
  legalNote: string;
  /** Whether the country requires a tax registration number on invoices */
  requiresTaxId: boolean;
  /** Example tax ID format */
  taxIdFormat?: string;
  /** Direct link to master registry entry */
  registryEntry?: CountryTaxRegistryEntry;
}

/**
 * Helper to construct specialized TaxRules based on category splits in each country.
 */
function buildCountryTaxRules(entry: CountryTaxRegistryEntry): TaxRule[] | undefined {
  // India GST intra-state split (CGST 2.5% + SGST 2.5%)
  if (entry.countryCode === 'IN') {
    return [
      { label: 'CGST', rate: 0.025, mode: 'inclusive' },
      { label: 'SGST', rate: 0.025, mode: 'inclusive' },
    ];
  }

  // Dual rates for food vs alcohol / soft drinks (Europe & Asia)
  const foodRate = typeof entry.categoryRates.food === 'number' ? entry.categoryRates.food : entry.restaurantRate;
  const alcoholRate = typeof entry.categoryRates.alcohol === 'number' ? entry.categoryRates.alcohol : entry.standardRate;

  if (foodRate !== alcoholRate && typeof foodRate === 'number' && typeof alcoholRate === 'number') {
    const rules: TaxRule[] = [
      {
        label: entry.taxLabel,
        rate: foodRate,
        mode: entry.taxMode,
        appliesTo: ['food', 'hot_drink'],
      },
      {
        label: entry.taxLabel,
        rate: alcoholRate,
        mode: entry.taxMode,
        appliesTo: ['alcohol'],
      },
    ];

    const softDrinkRate = typeof entry.categoryRates.softDrink === 'number' ? entry.categoryRates.softDrink : foodRate;
    if (softDrinkRate !== foodRate && softDrinkRate === alcoholRate) {
      rules[1].appliesTo?.push('soft_drink', 'bottled_water');
    } else if (softDrinkRate !== foodRate) {
      rules.push({
        label: entry.taxLabel,
        rate: softDrinkRate,
        mode: entry.taxMode,
        appliesTo: ['soft_drink', 'bottled_water'],
      });
    } else {
      rules[0].appliesTo?.push('soft_drink', 'bottled_water');
    }

    return rules;
  }

  return undefined;
}

/**
 * Generates turnkey CountryTaxProfiles for all jurisdictions in the master registry.
 */
function buildAllTaxProfiles(): Record<string, CountryTaxProfile> {
  const profiles: Record<string, CountryTaxProfile> = {};

  for (const [code, entry] of Object.entries(MASTER_TAX_REGISTRY)) {
    const hasTax = entry.restaurantRate > 0 || entry.standardRate > 0;
    const rules = buildCountryTaxRules(entry);

    profiles[code] = {
      name: entry.countryName,
      code: entry.countryCode,
      config: {
        enabled: hasTax,
        mode: entry.taxMode,
        label: entry.taxLabel,
        rate: entry.restaurantRate,
        rules,
        serviceCharge: entry.serviceChargeRules.standardRate > 0
          ? {
              enabled: entry.serviceChargeRules.policy === 'included' || entry.serviceChargeRules.policy === 'standard',
              label: 'Service Charge',
              rate: entry.serviceChargeRules.standardRate,
              taxable: entry.serviceChargeRules.isTaxable,
              optional: entry.serviceChargeRules.policy === 'optional',
            }
          : undefined,
        taxIdLabel: entry.taxIdLabel,
        showBreakdown: true,
        roundingMode: entry.taxMode === 'exclusive' ? 'line' : 'total',
      },
      legalNote: entry.complianceWarnings.join(' ') || `${entry.taxLabel} ${Math.round(entry.restaurantRate * 100)}% applies.`,
      requiresTaxId: entry.requiresTaxId,
      taxIdFormat: entry.taxIdFormat,
      registryEntry: entry,
    };
  }

  return profiles;
}

/**
 * Master registry of country-specific tax profiles covering all 44 countries.
 */
export const COUNTRY_TAX_PROFILES: Record<string, CountryTaxProfile> = buildAllTaxProfiles();

/**
 * Get the tax profile for a given country code.
 * Supports country codes and regional overrides (e.g. 'US-CA', 'CA-QC').
 * Falls back to generic profile for unknown countries.
 */
export function getCountryTaxProfile(countryCode: string, regionCode?: string): CountryTaxProfile {
  const cleanCode = (countryCode || 'IN').toUpperCase().trim();
  const profile = COUNTRY_TAX_PROFILES[cleanCode];

  if (profile) {
    // If a regional override is requested for a federal country
    if (regionCode && profile.registryEntry?.regions) {
      const cleanSub = regionCode.replace(/^[A-Z]{2}-/i, '').toUpperCase();
      const region = profile.registryEntry.regions.find(
        (r) => r.code.toUpperCase() === regionCode.toUpperCase() || r.code.toUpperCase() === cleanSub
      );
      if (region) {
        return {
          ...profile,
          name: `${profile.name} (${region.name})`,
          config: {
            ...profile.config,
            rate: region.restaurantRate,
            label: region.taxLabel,
            mode: region.taxMode,
          },
          legalNote: region.notes || profile.legalNote,
        };
      }
    }
    return profile;
  }

  // Generic fallback for unknown jurisdictions
  return {
    name: 'Unknown Country',
    code: cleanCode,
    config: {
      enabled: false,
      mode: 'inclusive',
      label: 'Tax',
      rate: 0,
      showBreakdown: false,
      roundingMode: 'total',
    },
    legalNote: 'Tax configuration not verified for this country. Please configure manually via the Custom Country Setup Wizard.',
    requiresTaxId: false,
  };
}

/**
 * List all available country tax profiles with summary details.
 */
export function listAvailableTaxProfiles(): Array<{
  code: string;
  name: string;
  rate: number;
  label: string;
  tier: 1 | 2 | 3;
  status: 'verified' | 'unverified' | 'conflict';
  currency: string;
  currencyDecimals: number;
}> {
  return Object.entries(COUNTRY_TAX_PROFILES).map(([code, profile]) => {
    const entry = profile.registryEntry;
    return {
      code,
      name: profile.name,
      rate: profile.config.rate,
      label: profile.config.label,
      tier: entry?.tier || 3,
      status: entry?.status || 'unverified',
      currency: entry?.currency || 'USD',
      currencyDecimals: entry?.currencyDecimals !== undefined ? entry.currencyDecimals : 2,
    };
  });
}
