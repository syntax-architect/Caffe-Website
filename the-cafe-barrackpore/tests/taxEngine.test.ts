import {
  calculateTaxBreakdown,
  calculateQuickTotal,
  extractInclusiveTax,
  formatTaxRate,
  getTaxSummaryText,
  roundCurrency,
} from '../src/utils/taxEngine';
import {
  getCountryTaxProfile,
  listAvailableTaxProfiles,
  MASTER_TAX_REGISTRY,
  getCountryTaxRegistryEntry,
  canJurisdictionGoLive,
  getEffectiveTaxRate,
  createCustomCountryProfile,
  getCurrencyDecimals,
  CURRENCY_DECIMALS,
} from '../src/config/taxProfiles';
import { calculateOrderTotals } from '../src/utils/orderCalculations';

console.log('=== RUNNING COMPREHENSIVE INTERNATIONAL TAX ENGINE TEST SUITE ===\n');

// -------------------------------------------------------------
// 1. Banker's Rounding & Currency Safety
// -------------------------------------------------------------
console.log('Test 1: Currency Rounding Safety');
if (roundCurrency(0.1 + 0.2) !== 0.3) {
  throw new Error(`roundCurrency failed on 0.1 + 0.2: expected 0.3, got ${roundCurrency(0.1 + 0.2)}`);
}
if (roundCurrency(10.555) !== 10.56 || roundCurrency(10.554) !== 10.55) {
  throw new Error('roundCurrency rounding precision failed');
}
console.log('✔ Test 1: Currency Rounding Safety passed');

// -------------------------------------------------------------
// 2. India GST 5% Inclusive (Standard Cafe Dine-In / Takeaway)
// -------------------------------------------------------------
console.log('Test 2: India GST 5% Inclusive');
const indiaItems = [
  { amount: 200, quantity: 2 }, // 400
  { amount: 150, quantity: 1 }, // 150
]; // raw subtotal = 550
const indiaProfile = getCountryTaxProfile('IN');
const indiaBreakdown = calculateTaxBreakdown(indiaItems, indiaProfile.config);

console.log('India breakdown:', {
  grandTotal: indiaBreakdown.grandTotal,
  totalTax: indiaBreakdown.totalTax,
  netSubtotal: indiaBreakdown.netSubtotal,
  lines: indiaBreakdown.lines,
});

// For inclusive 5%: grandTotal must be exactly 550.00
if (indiaBreakdown.grandTotal !== 550) {
  throw new Error(`India inclusive grandTotal failed: expected 550, got ${indiaBreakdown.grandTotal}`);
}
// Tax embedded in 550 with CGST 2.5% + SGST 2.5% (Single GST parity rule):
// Single GST = round(550 * (0.05 / 1.05)) = 26.19
// CGST = round(26.19 * (0.025 / 0.05)) = 13.10
// SGST = 26.19 - 13.10 = 13.09
// totalTax = 13.10 + 13.09 = 26.19
if (indiaBreakdown.totalTax !== 26.19) {
  throw new Error(`India totalTax failed: expected 26.19, got ${indiaBreakdown.totalTax}`);
}
// Split into CGST (2.5%) and SGST (2.5%): 13.10 and 13.09
if (indiaBreakdown.lines.length !== 2) {
  throw new Error(`India split tax lines expected 2 (CGST + SGST), got ${indiaBreakdown.lines.length}`);
}
if (indiaBreakdown.lines[0].amount !== 13.10 || indiaBreakdown.lines[1].amount !== 13.09) {
  throw new Error(`India split tax lines expected 13.10 and 13.09, got ${indiaBreakdown.lines[0].amount} and ${indiaBreakdown.lines[1].amount}`);
}
if (indiaBreakdown.netSubtotal !== 523.81) {
  throw new Error(`India netSubtotal failed: expected 523.81, got ${indiaBreakdown.netSubtotal}`);
}
console.log('✔ Test 2: India GST 5% Inclusive passed');

// -------------------------------------------------------------
// 3. US Sales Tax 8.25% Exclusive (Typical Texas / NY Restaurant)
// -------------------------------------------------------------
console.log('Test 3: US Sales Tax 8.25% Exclusive');
const usItems = [
  { amount: 25.00, quantity: 2 }, // 50.00
  { amount: 12.50, quantity: 2 }, // 25.00
]; // raw subtotal = 75.00
const usProfile = getCountryTaxProfile('US');
const usBreakdown = calculateTaxBreakdown(usItems, usProfile.config);

console.log('US breakdown:', {
  grandTotal: usBreakdown.grandTotal,
  totalTax: usBreakdown.totalTax,
  netSubtotal: usBreakdown.netSubtotal,
});

// For exclusive 8.25%: tax = 75.00 * 0.0825 = 6.19. grandTotal = 75.00 + 6.19 = 81.19
if (usBreakdown.totalTax !== 6.19) {
  throw new Error(`US totalTax failed: expected 6.19, got ${usBreakdown.totalTax}`);
}
if (usBreakdown.grandTotal !== 81.19) {
  throw new Error(`US grandTotal failed: expected 81.19, got ${usBreakdown.grandTotal}`);
}
if (usBreakdown.netSubtotal !== 75.00) {
  throw new Error(`US netSubtotal failed: expected 75.00, got ${usBreakdown.netSubtotal}`);
}
console.log('✔ Test 3: US Sales Tax 8.25% Exclusive passed');

// -------------------------------------------------------------
// 4. UK VAT 20% Inclusive (Standard UK Hospitality)
// -------------------------------------------------------------
console.log('Test 4: UK VAT 20% Inclusive');
const ukItems = [{ amount: 60.00, quantity: 1 }];
const ukProfile = getCountryTaxProfile('GB');
const ukBreakdown = calculateTaxBreakdown(ukItems, ukProfile.config);

// 60.00 inclusive of 20% VAT: tax = 60 * (0.20 / 1.20) = 10.00. grandTotal = 60.00
if (ukBreakdown.grandTotal !== 60.00) {
  throw new Error(`UK grandTotal failed: expected 60.00, got ${ukBreakdown.grandTotal}`);
}
if (ukBreakdown.totalTax !== 10.00) {
  throw new Error(`UK totalTax failed: expected 10.00, got ${ukBreakdown.totalTax}`);
}
if (ukBreakdown.netSubtotal !== 50.00) {
  throw new Error(`UK netSubtotal failed: expected 50.00, got ${ukBreakdown.netSubtotal}`);
}
console.log('✔ Test 4: UK VAT 20% Inclusive passed');

// -------------------------------------------------------------
// 5. Singapore 9% GST + 10% Service Charge
// -------------------------------------------------------------
console.log('Test 5: Singapore 9% GST + 10% Service Charge');
const sgItems = [{ amount: 100.00, quantity: 1 }];
const sgProfile = getCountryTaxProfile('SG');
const sgBreakdown = calculateTaxBreakdown(sgItems, sgProfile.config);

console.log('SG breakdown:', {
  grandTotal: sgBreakdown.grandTotal,
  totalTax: sgBreakdown.totalTax,
  serviceCharge: sgBreakdown.serviceCharge,
});

// Subtotal = 100. Service charge 10% = 10.00.
// In SG profile: tax is inclusive 9%. Service charge is 10%.
if (sgBreakdown.serviceCharge !== 10.00) {
  throw new Error(`SG serviceCharge failed: expected 10.00, got ${sgBreakdown.serviceCharge}`);
}
if (sgBreakdown.grandTotal !== 110.00) {
  throw new Error(`SG grandTotal failed: expected 110.00, got ${sgBreakdown.grandTotal}`);
}
console.log('✔ Test 5: Singapore GST + Service Charge passed');

// -------------------------------------------------------------
// 6. Taxable Service Charge (Exclusive Tax on Both Subtotal and Service Charge)
// -------------------------------------------------------------
console.log('Test 6: Taxable Service Charge');
const taxableSCConfig = {
  enabled: true,
  mode: 'exclusive' as const,
  label: 'Sales Tax',
  rate: 0.10,
  serviceCharge: {
    enabled: true,
    label: 'Gratuity',
    rate: 0.15,
    taxable: true,
  },
};
// Subtotal: 100. Service Charge 15% = 15.00.
// Tax on subtotal: 10.00. Tax on SC: 15 * 0.10 = 1.50. Total tax = 11.50.
// Grand total: 100 + 15 + 11.50 = 126.50
const taxableSCBreakdown = calculateTaxBreakdown([{ amount: 100, quantity: 1 }], taxableSCConfig);
if (taxableSCBreakdown.serviceCharge !== 15.00) {
  throw new Error(`Taxable SC serviceCharge failed: expected 15.00, got ${taxableSCBreakdown.serviceCharge}`);
}
if (taxableSCBreakdown.totalTax !== 11.50) {
  throw new Error(`Taxable SC totalTax failed: expected 11.50, got ${taxableSCBreakdown.totalTax}`);
}
if (taxableSCBreakdown.grandTotal !== 126.50) {
  throw new Error(`Taxable SC grandTotal failed: expected 126.50, got ${taxableSCBreakdown.grandTotal}`);
}
console.log('✔ Test 6: Taxable Service Charge passed');

// -------------------------------------------------------------
// 7. Disabled Tax Mode (Tax Exempt / Tax Disabled)
// -------------------------------------------------------------
console.log('Test 7: Tax Disabled Mode');
const disabledConfig = {
  enabled: false,
  mode: 'inclusive' as const,
  label: 'Tax',
  rate: 0.05,
};
const disabledBreakdown = calculateTaxBreakdown([{ amount: 50, quantity: 2 }], disabledConfig);
if (disabledBreakdown.totalTax !== 0 || disabledBreakdown.grandTotal !== 100.00) {
  throw new Error('Disabled tax mode failed to produce 0 tax');
}
console.log('✔ Test 7: Tax Disabled Mode passed');

// -------------------------------------------------------------
// 8. calculateQuickTotal Helper Consistency
// -------------------------------------------------------------
console.log('Test 8: calculateQuickTotal Consistency');
const quickUS = calculateQuickTotal(100, usProfile.config);
if (quickUS !== 108.25) {
  throw new Error(`calculateQuickTotal US failed: expected 108.25, got ${quickUS}`);
}
const quickIndia = calculateQuickTotal(500, indiaProfile.config);
if (quickIndia !== 500) {
  throw new Error(`calculateQuickTotal India failed: expected 500, got ${quickIndia}`);
}
console.log('✔ Test 8: calculateQuickTotal Consistency passed');

// -------------------------------------------------------------
// 9. extractInclusiveTax Helper
// -------------------------------------------------------------
console.log('Test 9: extractInclusiveTax');
// ₹105 with 5% inclusive tax -> tax = 5.00
const extracted5 = extractInclusiveTax(105, 0.05);
if (extracted5 !== 5.00) {
  throw new Error(`extractInclusiveTax failed: expected 5.00, got ${extracted5}`);
}
// £120 with 20% inclusive tax -> tax = 20.00
const extracted20 = extractInclusiveTax(120, 0.20);
if (extracted20 !== 20.00) {
  throw new Error(`extractInclusiveTax failed: expected 20.00, got ${extracted20}`);
}
console.log('✔ Test 9: extractInclusiveTax passed');

// -------------------------------------------------------------
// 10. formatTaxRate and getTaxSummaryText
// -------------------------------------------------------------
console.log('Test 10: Formatting Helpers');
if (formatTaxRate(0.05) !== '5%') throw new Error(`formatTaxRate(0.05) failed: ${formatTaxRate(0.05)}`);
if (formatTaxRate(0.0825) !== '8.25%') throw new Error(`formatTaxRate(0.0825) failed: ${formatTaxRate(0.0825)}`);
if (formatTaxRate(0.125) !== '12.5%') throw new Error(`formatTaxRate(0.125) failed: ${formatTaxRate(0.125)}`);

const summaryIndia = getTaxSummaryText(indiaProfile.config);
if (summaryIndia !== 'Incl. GST 5%') {
  throw new Error(`getTaxSummaryText India failed: expected "Incl. GST 5%", got "${summaryIndia}"`);
}
const summaryUS = getTaxSummaryText(usProfile.config);
if (summaryUS !== 'Sales Tax 8.25% added') {
  throw new Error(`getTaxSummaryText US failed: expected "Sales Tax 8.25% added", got "${summaryUS}"`);
}
console.log('✔ Test 10: Formatting Helpers passed');

// -------------------------------------------------------------
// 11. Registry Validation for ALL 44 Country Tax Profiles
// -------------------------------------------------------------
console.log('Test 11: Validating All 44 Country Tax Profiles');
const allProfiles = listAvailableTaxProfiles();
if (allProfiles.length !== 44) {
  throw new Error(`Expected exactly 44 country tax profiles, found ${allProfiles.length}`);
}

for (const profileSummary of allProfiles) {
  const profile = getCountryTaxProfile(profileSummary.code);
  if (!profile) {
    throw new Error(`Profile not found for code: ${profileSummary.code}`);
  }
  if (!['inclusive', 'exclusive'].includes(profile.config.mode)) {
    throw new Error(`Invalid tax mode for ${profileSummary.code}: ${profile.config.mode}`);
  }
  if (profile.config.rate < 0 || profile.config.rate > 0.50) {
    throw new Error(`Unreasonable tax rate for ${profileSummary.code}: ${profile.config.rate}`);
  }
  if (!profile.legalNote || profile.legalNote.length < 10) {
    throw new Error(`Missing legal note for ${profileSummary.code}`);
  }

  // Run calculation test on each profile with sample order
  const testBreakdown = calculateTaxBreakdown([{ amount: 100, quantity: 1 }], profile.config);
  if (testBreakdown.grandTotal <= 0) {
    throw new Error(`Calculation resulted in 0 or negative total for ${profileSummary.code}`);
  }
}
console.log(`✔ Test 11: All ${allProfiles.length} country profiles validated successfully`);

// -------------------------------------------------------------
// 12. calculateOrderTotals End-to-End Integration with Service Charge
// -------------------------------------------------------------
console.log('Test 12: calculateOrderTotals Integration');
const orderWithServiceCharge = calculateOrderTotals(
  [
    { id: '1', name: 'Pizza', price: 200, quantity: 1 },
    { id: '2', name: 'Coffee', price: 100, quantity: 1 },
  ],
  {
    enabled: true,
    mode: 'inclusive',
    label: 'GST',
    rate: 0.05,
    serviceCharge: {
      enabled: true,
      label: 'Service Charge',
      rate: 0.10,
    },
  }
);

// Subtotal = 300. Service charge = 30.00. Grand total = 330.00.
if (orderWithServiceCharge.subtotal !== 300) {
  throw new Error(`Subtotal failed: expected 300, got ${orderWithServiceCharge.subtotal}`);
}
if (orderWithServiceCharge.serviceCharge !== 30.00) {
  throw new Error(`Service charge failed: expected 30.00, got ${orderWithServiceCharge.serviceCharge}`);
}
if (orderWithServiceCharge.total !== 330.00) {
  throw new Error(`Total payable failed: expected 330.00, got ${orderWithServiceCharge.total}`);
}
if (orderWithServiceCharge.netSubtotal === undefined) {
  throw new Error('netSubtotal was not populated on OrderCalculationSummary');
}
console.log('✔ Test 12: calculateOrderTotals Integration passed');

// -------------------------------------------------------------
// 13. Empty Cart & Edge Cases
// -------------------------------------------------------------
console.log('Test 13: Empty Cart & Edge Cases');
const emptyBreakdown = calculateTaxBreakdown([], indiaProfile.config);
if (emptyBreakdown.grandTotal !== 0 || emptyBreakdown.totalTax !== 0) {
  throw new Error('Empty items did not return 0 totals');
}
const emptyOrderTotals = calculateOrderTotals([], indiaProfile.config);
if (emptyOrderTotals.total !== 0 || emptyOrderTotals.itemCount !== 0) {
  throw new Error('Empty order totals failed');
}
console.log('✔ Test 13: Empty Cart & Edge Cases passed');

// -------------------------------------------------------------
// 14. Comprehensive 44-Country Master Tax Registry Verification
// -------------------------------------------------------------
console.log('Test 14: Comprehensive 44-Country Master Registry Verification');
const expectedTiers = {
  tier1: ['IE', 'GB', 'US', 'CA', 'AU', 'NZ', 'SG', 'AE'],
  tier2: ['DE', 'FR', 'ES', 'IT', 'NL', 'PT', 'BE', 'AT', 'SE', 'DK', 'NO', 'CH', 'PL'],
  tier3: ['IN', 'JP', 'KR', 'TH', 'MY', 'ID', 'PH', 'VN', 'HK', 'SA', 'QA', 'KW', 'BH', 'TR', 'IL', 'ZA', 'NG', 'KE', 'EG', 'MX', 'BR', 'CL', 'CO'],
};

const allRegistryCodes = Object.keys(MASTER_TAX_REGISTRY);
if (allRegistryCodes.length !== 44) {
  throw new Error(`Expected exactly 44 countries in MASTER_TAX_REGISTRY, found ${allRegistryCodes.length}`);
}

for (const code of [...expectedTiers.tier1, ...expectedTiers.tier2, ...expectedTiers.tier3]) {
  const entry = getCountryTaxRegistryEntry(code);
  if (!entry) {
    throw new Error(`Missing country registry entry for ${code}`);
  }
  if (!entry.countryName || !entry.currency) {
    throw new Error(`Incomplete country data for ${code}`);
  }
  if (!['verified', 'unverified', 'conflict'].includes(entry.status)) {
    throw new Error(`Invalid verification status for ${code}: ${entry.status}`);
  }
  if (!Array.isArray(entry.sources) || entry.sources.length === 0) {
    throw new Error(`Missing sources array for ${code}`);
  }
  const officialSource = entry.sources.find((s) => s.official);
  if (!officialSource || !officialSource.url) {
    throw new Error(`Missing official source for ${code}`);
  }
  if (!entry.lastVerified) {
    throw new Error(`Missing lastVerified date in ${code}`);
  }
  if (entry.status === 'conflict') {
    const hasConflict = entry.sources.some((s) => s.conflictNotes) || entry.sources.length >= 2;
    if (!hasConflict) {
      throw new Error(`Conflict status for ${code} must list conflicting sources`);
    }
  }
  if (!entry.categoryRates || typeof entry.categoryRates.food !== 'number') {
    throw new Error(`Missing category rate food for ${code}`);
  }
}
console.log('✔ Test 14: All 44 Countries across Tiers 1, 2, and 3 loaded and validated');

// -------------------------------------------------------------
// 15. Currency Decimals Precision Standards
// -------------------------------------------------------------
console.log('Test 15: Currency Decimals Precision Standards');
const zeroDecimalCurrencies = ['JPY', 'KRW', 'VND', 'CLP', 'IDR'];
for (const curr of zeroDecimalCurrencies) {
  const decimals = getCurrencyDecimals(curr);
  if (decimals !== 0) {
    throw new Error(`Expected 0 decimals for ${curr}, got ${decimals}`);
  }
}
// 0 decimals in country entries
const zeroDecimalCountries = ['JP', 'KR', 'VN', 'CL', 'ID'];
for (const cCode of zeroDecimalCountries) {
  const entry = getCountryTaxRegistryEntry(cCode);
  if (entry?.currencyDecimals !== 0) {
    throw new Error(`Expected 0 currency decimals in registry for ${cCode}, got ${entry?.currencyDecimals}`);
  }
}

// 3 decimals for Bahrain Dinar (BHD) and Kuwait Dinar (KWD)
const threeDecimalCurrencies = ['BHD', 'KWD'];
for (const curr of threeDecimalCurrencies) {
  const decimals = getCurrencyDecimals(curr);
  if (decimals !== 3) {
    throw new Error(`Expected 3 decimals for ${curr}, got ${decimals}`);
  }
}
const threeDecimalCountries = ['BH', 'KW'];
for (const cCode of threeDecimalCountries) {
  const entry = getCountryTaxRegistryEntry(cCode);
  if (entry?.currencyDecimals !== 3) {
    throw new Error(`Expected 3 currency decimals in registry for ${cCode}, got ${entry?.currencyDecimals}`);
  }
}

// 2 decimals for standard currencies
const twoDecimalCurrencies = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'SGD', 'AED'];
for (const curr of twoDecimalCurrencies) {
  const decimals = getCurrencyDecimals(curr);
  if (decimals !== 2) {
    throw new Error(`Expected 2 decimals for ${curr}, got ${decimals}`);
  }
}
console.log('✔ Test 15: Currency Decimals Precision (0, 2, 3) verified strictly');

// -------------------------------------------------------------
// 16. Dated Rate Switch Engine Verification
// -------------------------------------------------------------
console.log('Test 16: Dated Rate Switch Engine Verification');
// Germany (DE): Dine-in was 19% in 2024-2025; switches to 7% permanently on 2026-01-01
const deRate2025 = getEffectiveTaxRate('DE', { date: '2025-06-01', category: 'food', fulfillment: 'dineIn' }).rate;
const deRate2026 = getEffectiveTaxRate('DE', { date: '2026-02-01', category: 'food', fulfillment: 'dineIn' }).rate;
if (deRate2025 !== 0.19) {
  throw new Error(`Germany 2025 dine-in food rate expected 0.19, got ${deRate2025}`);
}
if (deRate2026 !== 0.07) {
  throw new Error(`Germany 2026 dine-in food rate expected 0.07, got ${deRate2026}`);
}
// Alcohol in Germany remains standard 19%
const deAlcohol2026 = getEffectiveTaxRate('DE', { date: '2026-02-01', category: 'alcohol', fulfillment: 'dineIn' }).rate;
if (deAlcohol2026 !== 0.19) {
  throw new Error(`Germany 2026 alcohol rate expected 0.19, got ${deAlcohol2026}`);
}

// Ireland (IE): 13.5% hospitality reduced rate switches to 9% on 2026-07-01
const ieRateEarly2026 = getEffectiveTaxRate('IE', { date: '2026-03-01', category: 'food', fulfillment: 'dineIn' }).rate;
const ieRateLate2026 = getEffectiveTaxRate('IE', { date: '2026-08-01', category: 'food', fulfillment: 'dineIn' }).rate;
if (ieRateEarly2026 !== 0.135) {
  throw new Error(`Ireland early 2026 food rate expected 0.135, got ${ieRateEarly2026}`);
}
if (ieRateLate2026 !== 0.09) {
  throw new Error(`Ireland post July 2026 food rate expected 0.09, got ${ieRateLate2026}`);
}

// Switzerland (CH): 7.7% standard rate switched to 8.1% on 2024-01-01
const chRate2023 = getEffectiveTaxRate('CH', { date: '2023-06-01', category: 'food', fulfillment: 'dineIn' }).rate;
const chRate2024 = getEffectiveTaxRate('CH', { date: '2024-06-01', category: 'food', fulfillment: 'dineIn' }).rate;
if (chRate2023 !== 0.077) {
  throw new Error(`Switzerland 2023 rate expected 0.077, got ${chRate2023}`);
}
if (chRate2024 !== 0.081) {
  throw new Error(`Switzerland 2024 rate expected 0.081, got ${chRate2024}`);
}

// Singapore (SG): 8% GST in 2023, 9% GST in 2024+
const sgRate2023 = getEffectiveTaxRate('SG', { date: '2023-06-01', category: 'food', fulfillment: 'dineIn' }).rate;
const sgRate2024 = getEffectiveTaxRate('SG', { date: '2024-06-01', category: 'food', fulfillment: 'dineIn' }).rate;
if (sgRate2023 !== 0.08) {
  throw new Error(`Singapore 2023 rate expected 0.08, got ${sgRate2023}`);
}
if (sgRate2024 !== 0.09) {
  throw new Error(`Singapore 2024 rate expected 0.09, got ${sgRate2024}`);
}

// Bahrain (BH): 5% VAT before 2022, 10% VAT in 2022+
const bhRate2021 = getEffectiveTaxRate('BH', { date: '2021-06-01', category: 'food', fulfillment: 'dineIn' }).rate;
const bhRate2022 = getEffectiveTaxRate('BH', { date: '2022-06-01', category: 'food', fulfillment: 'dineIn' }).rate;
if (bhRate2021 !== 0.05) {
  throw new Error(`Bahrain 2021 rate expected 0.05, got ${bhRate2021}`);
}
if (bhRate2022 !== 0.10) {
  throw new Error(`Bahrain 2022 rate expected 0.10, got ${bhRate2022}`);
}
console.log('✔ Test 16: Dated Rate Switch Engine (DE, IE, CH, SG, BH) verified');

// -------------------------------------------------------------
// 17. Honesty Go-Live Gating & Fiscal Device Hard Block Verification
// -------------------------------------------------------------
console.log('Test 17: Honesty Go-Live Gating & Fiscal Hardware Block');
// Fully verified country without fiscal hardware requirements (IE, GB, NZ, SG, IN)
const ieGoLive = canJurisdictionGoLive('IE', false);
if (!ieGoLive.allowed) {
  throw new Error(`Ireland should allow go-live without accountant block: ${ieGoLive.reason}`);
}

// Germany requires TSE certified fiscal device (KassenSichV)
const deGoLiveBlocked = canJurisdictionGoLive('DE', false);
if (deGoLiveBlocked.allowed || !deGoLiveBlocked.requiresFiscalHardware) {
  throw new Error('Germany must block go-live without accountant confirmation due to TSE requirement');
}
const deGoLiveApproved = canJurisdictionGoLive('DE', true);
if (!deGoLiveApproved.allowed) {
  throw new Error('Germany should allow go-live once accountant confirms');
}

// France requires NF525 / LNE certified cash register
const frGoLiveBlocked = canJurisdictionGoLive('FR', false);
if (frGoLiveBlocked.allowed || !frGoLiveBlocked.requiresFiscalHardware) {
  throw new Error('France must block go-live without accountant confirmation due to NF525 requirement');
}

// Italy requires Registratore Telematico (RT)
const itGoLiveBlocked = canJurisdictionGoLive('IT', false);
if (itGoLiveBlocked.allowed || !itGoLiveBlocked.requiresFiscalHardware) {
  throw new Error('Italy must block go-live without accountant confirmation due to RT requirement');
}

// Unverified / Conflict country (Brazil BR or custom) must block go-live
const brGoLiveBlocked = canJurisdictionGoLive('BR', false);
if (brGoLiveBlocked.allowed || !brGoLiveBlocked.requiresAccountant) {
  throw new Error('Brazil must block go-live without accountant confirmation');
}
const brGoLiveApproved = canJurisdictionGoLive('BR', true);
if (!brGoLiveApproved.allowed) {
  throw new Error('Brazil should allow go-live once accountant confirms');
}

// Unknown country code
const unknownGoLive = canJurisdictionGoLive('XYZ', false);
if (unknownGoLive.allowed || !unknownGoLive.requiresAccountant) {
  throw new Error('Unknown country must block go-live');
}
console.log('✔ Test 17: Honesty Go-Live Gating (Hardware & Status) verified');

// -------------------------------------------------------------
// 18. Multi-Level Federal Country Regional Pickers
// -------------------------------------------------------------
console.log('Test 18: Multi-Level Federal Country Regional Pickers');
const federalCountries = ['US', 'CA', 'IN', 'AE', 'BR', 'AU'];
for (const fed of federalCountries) {
  const entry = getCountryTaxRegistryEntry(fed);
  if (!entry?.isFederalOrMultiLevel) {
    throw new Error(`Expected isFederalOrMultiLevel=true for ${fed}`);
  }
  if (!entry?.regions || entry.regions.length === 0) {
    throw new Error(`Expected regional rules list for federal country ${fed}`);
  }
}

// Check US States (California vs Texas vs New York)
const usProfileCA = getCountryTaxProfile('US', 'US-CA');
if (usProfileCA.config.rate !== 0.095) {
  throw new Error(`US-CA rate expected 0.095, got ${usProfileCA.config.rate}`);
}
const usProfileTX = getCountryTaxProfile('US', 'US-TX');
if (usProfileTX.config.rate !== 0.0825) {
  throw new Error(`US-TX rate expected 0.0825, got ${usProfileTX.config.rate}`);
}

// Check Canada Provinces (Ontario 13% vs Quebec 14.975% vs BC)
const caProfileON = getCountryTaxProfile('CA', 'CA-ON');
if (caProfileON.config.rate !== 0.13) {
  throw new Error(`Canada Ontario HST expected 0.13, got ${caProfileON.config.rate}`);
}
const caProfileQC = getCountryTaxProfile('CA', 'CA-QC');
if (caProfileQC.config.rate !== 0.14975) {
  throw new Error(`Canada Quebec GST+QST expected 0.14975, got ${caProfileQC.config.rate}`);
}

// Check UAE Emirates (Abu Dhabi 5% vs Dubai 5% + municipality local fee)
const aeProfileAUH = getCountryTaxProfile('AE', 'AUH');
if (aeProfileAUH.config.rate !== 0.05) {
  throw new Error(`UAE Abu Dhabi rate expected 0.05, got ${aeProfileAUH.config.rate}`);
}
const aeProfileDXB = getCountryTaxProfile('AE', 'DXB');
if (aeProfileDXB.config.rate !== 0.05) {
  throw new Error(`UAE Dubai base VAT expected 0.05, got ${aeProfileDXB.config.rate}`);
}
console.log('✔ Test 18: Multi-Level Federal Regional Rules (US, CA, UAE, AU, IN, BR) verified');

// -------------------------------------------------------------
// 19. Category-Specific Tax Rate Splits
// -------------------------------------------------------------
console.log('Test 19: Category-Specific Tax Rate Splits');
// Portugal (PT): food 13%, alcohol 23%
const ptEntry = getCountryTaxRegistryEntry('PT');
if (ptEntry?.categoryRates.food !== 0.13 || ptEntry?.categoryRates.alcohol !== 0.23) {
  throw new Error('Portugal category rates expected 13% food and 23% alcohol');
}

// Malaysia (MY): food 6% service tax, alcohol 8% service tax
const myEntry = getCountryTaxRegistryEntry('MY');
if (myEntry?.categoryRates.food !== 0.06 || myEntry?.categoryRates.alcohol !== 0.08) {
  throw new Error('Malaysia category rates expected 6% food and 8% alcohol');
}

// Colombia (CO): Impoconsumo 8% on restaurant food & beverage
const coEntry = getCountryTaxRegistryEntry('CO');
if (coEntry?.categoryRates.food !== 0.08 || coEntry?.restaurantRate !== 0.08) {
  throw new Error('Colombia restaurant rate expected 8% Impoconsumo (INC)');
}

// Indonesia (ID): PBJT 10%
const idEntry = getCountryTaxRegistryEntry('ID');
if (idEntry?.restaurantRate !== 0.10) {
  throw new Error('Indonesia restaurant rate expected 10% PBJT');
}
console.log('✔ Test 19: Category-Specific Tax Rates (PT, MY, CO, ID) verified');

// -------------------------------------------------------------
// 20. Custom Country Profile Creation Wizard
// -------------------------------------------------------------
console.log('Test 20: Custom Country Profile Creation Wizard');
const customProfile = createCustomCountryProfile({
  countryCode: 'IS',
  countryName: 'Iceland',
  currency: 'ISK',
  currencySymbol: 'kr',
  currencyDecimals: 0,
  standardRate: 0.24,
  restaurantRate: 0.11,
  taxMode: 'inclusive',
  taxLabel: 'VSK',
  categoryRates: {
    food: 0.11,
    alcohol: 0.24,
  },
  serviceChargeRate: 0,
  serviceChargeTaxable: false,
  taxIdLabel: 'VSK-numer',
  taxIdFormat: 'XXXXX',
  accountantConfirmed: true,
  accountantName: 'Gunnar Jonsson & Associates, CPA',
  accountantLicense: 'IS-CPA-9941',
  confirmationDate: '2026-10-22',
});

if (customProfile.countryCode !== 'IS' || customProfile.restaurantRate !== 0.11) {
  throw new Error('Custom country profile creation failed');
}
if (customProfile.currencyDecimals !== 0) {
  throw new Error('Custom country currencyDecimals expected 0 for ISK');
}
if (customProfile.status !== 'verified') {
  throw new Error('Accountant-confirmed custom country should be marked verified');
}
const isGoLive = canJurisdictionGoLive('IS', true);
if (!isGoLive.allowed) {
  throw new Error(`Custom country IS should allow go-live once confirmed: ${isGoLive.reason}`);
}
console.log('✔ Test 20: Custom Country Profile Creation Wizard passed');

console.log('\n=== ALL 20 TAX ENGINE TESTS PASSED WITH 100% SUCCESS! ===\n');
