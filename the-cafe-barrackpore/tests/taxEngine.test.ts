import {
  calculateTaxBreakdown,
  calculateQuickTotal,
  extractInclusiveTax,
  formatTaxRate,
  getTaxSummaryText,
  roundCurrency,
} from '../src/utils/taxEngine';
import {
  COUNTRY_TAX_PROFILES,
  getCountryTaxProfile,
  listAvailableTaxProfiles,
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
// Tax embedded in 550 with CGST 2.5% + SGST 2.5%:
// CGST = round(550 * (0.025 / 1.05)) = 13.10
// SGST = round(550 * (0.025 / 1.05)) = 13.10
// totalTax = 13.10 + 13.10 = 26.20
if (indiaBreakdown.totalTax !== 26.20) {
  throw new Error(`India totalTax failed: expected 26.20, got ${indiaBreakdown.totalTax}`);
}
// Split into CGST (2.5%) and SGST (2.5%): each should be 13.10
if (indiaBreakdown.lines.length !== 2) {
  throw new Error(`India split tax lines expected 2 (CGST + SGST), got ${indiaBreakdown.lines.length}`);
}
if (indiaBreakdown.netSubtotal !== 523.80) {
  throw new Error(`India netSubtotal failed: expected 523.80, got ${indiaBreakdown.netSubtotal}`);
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
// 11. Registry Validation for ALL 20 Country Tax Profiles
// -------------------------------------------------------------
console.log('Test 11: Validating All 20 Country Tax Profiles');
const allProfiles = listAvailableTaxProfiles();
if (allProfiles.length < 20) {
  throw new Error(`Expected at least 20 country tax profiles, found ${allProfiles.length}`);
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

console.log('\n=== ALL 13 TAX ENGINE TESTS PASSED WITH 100% SUCCESS! ===\n');
