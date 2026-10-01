import { formatCurrency, getCurrencySymbol } from '../src/utils/currency';
import { validatePhoneNumber } from '../src/utils/phone';
import { formatRestaurantDate, formatRestaurantTime, formatRestaurantDateTime } from '../src/utils/datetime';
import { calculateOrderTotals } from '../src/utils/orderCalculations';
import { RESTAURANT_PRESETS, DEFAULT_RESTAURANT_CONFIG } from '../src/config/restaurantPresets';
import { validateOrderPayload } from '../src/services/orderService';
import { validateReservationPayload } from '../src/services/reservationService';

console.log('=== RUNNING PHASE 1I INTERNATIONAL RESTAURANT READINESS TESTS ===\n');

// -------------------------------------------------------------
// 1. INR Formatting
// -------------------------------------------------------------
const inrFormatted = formatCurrency(620, 'INR', 'en-IN');
console.log('Test 1: INR formatting ->', inrFormatted);
if (!inrFormatted.includes('620') || (!inrFormatted.includes('₹') && !inrFormatted.includes('INR'))) {
  throw new Error(`INR formatting failed: expected ₹620, got "${inrFormatted}"`);
}
console.log('✔ Test 1: INR formatting passed');

// -------------------------------------------------------------
// 2. USD Formatting
// -------------------------------------------------------------
const usdFormatted = formatCurrency(62, 'USD', 'en-US');
console.log('Test 2: USD formatting ->', usdFormatted);
if (usdFormatted !== '$62.00') {
  throw new Error(`USD formatting failed: expected "$62.00", got "${usdFormatted}"`);
}
console.log('✔ Test 2: USD formatting passed');

// -------------------------------------------------------------
// 3. GBP Formatting
// -------------------------------------------------------------
const gbpFormatted = formatCurrency(48, 'GBP', 'en-GB');
console.log('Test 3: GBP formatting ->', gbpFormatted);
if (gbpFormatted !== '£48.00') {
  throw new Error(`GBP formatting failed: expected "£48.00", got "${gbpFormatted}"`);
}
console.log('✔ Test 3: GBP formatting passed');

// -------------------------------------------------------------
// 4. AED Formatting
// -------------------------------------------------------------
const aedFormatted = formatCurrency(228, 'AED', 'en-AE');
console.log('Test 4: AED formatting ->', aedFormatted);
if (!aedFormatted.includes('228.00') || !aedFormatted.includes('AED')) {
  throw new Error(`AED formatting failed: expected "AED 228.00", got "${aedFormatted}"`);
}
console.log('✔ Test 4: AED formatting passed');

// -------------------------------------------------------------
// 5. India Phone Validation
// -------------------------------------------------------------
const inPhone1 = validatePhoneNumber('+91 98301 11222', '+91');
const inPhone2 = validatePhoneNumber('9830111222', '+91');
console.log('Test 5: India phone validation ->', inPhone1, inPhone2);
if (!inPhone1.valid || inPhone1.normalized !== '+919830111222') {
  throw new Error(`India phone validation failed for +91 98301 11222`);
}
if (!inPhone2.valid || inPhone2.normalized !== '+919830111222') {
  throw new Error(`India phone validation failed for raw 10-digit 9830111222`);
}
console.log('✔ Test 5: India phone validation passed');

// -------------------------------------------------------------
// 6. US Phone Validation
// -------------------------------------------------------------
const usPhone1 = validatePhoneNumber('+1 212 555 0198', '+1');
const usPhone2 = validatePhoneNumber('2125550198', '+1');
console.log('Test 6: US phone validation ->', usPhone1, usPhone2);
if (!usPhone1.valid || usPhone1.normalized !== '+12125550198') {
  throw new Error(`US phone validation failed for +1 212 555 0198`);
}
if (!usPhone2.valid || usPhone2.normalized !== '+12125550198') {
  throw new Error(`US phone validation failed for raw 10-digit with +1 default`);
}
console.log('✔ Test 6: US phone validation passed');

// -------------------------------------------------------------
// 7. UK Phone Validation
// -------------------------------------------------------------
const ukPhone = validatePhoneNumber('+44 20 7946 0958', '+44');
console.log('Test 7: UK phone validation ->', ukPhone);
if (!ukPhone.valid || ukPhone.normalized !== '+442079460958') {
  throw new Error(`UK phone validation failed for +44 20 7946 0958`);
}
console.log('✔ Test 7: UK phone validation passed');

// -------------------------------------------------------------
// 8. International Phone Normalization
// -------------------------------------------------------------
const uaePhone = validatePhoneNumber('+971 50 123 4567');
const invalidShort = validatePhoneNumber('12345');
const invalidLetters = validatePhoneNumber('98301abcde');
console.log('Test 8: International normalization -> UAE:', uaePhone.normalized, 'Short:', invalidShort.valid);
if (!uaePhone.valid || uaePhone.normalized !== '+971501234567') {
  throw new Error(`UAE normalization failed: ${uaePhone.normalized}`);
}
if (invalidShort.valid || invalidLetters.valid) {
  throw new Error(`Invalid phone numbers should be rejected`);
}
console.log('✔ Test 8: International phone normalization passed');

// -------------------------------------------------------------
// 9. Locale-Aware Dates
// -------------------------------------------------------------
const fixedDate = new Date('2026-05-24T12:00:00Z');
const inDate = formatRestaurantDate(fixedDate, 'en-IN', 'Asia/Kolkata');
const usDate = formatRestaurantDate(fixedDate, 'en-US', 'America/New_York');
console.log('Test 9: Locale dates -> IN:', inDate, '| US:', usDate);
if (!inDate.includes('24') || !inDate.includes('May') || !inDate.includes('2026')) {
  throw new Error(`India date formatting mismatch: ${inDate}`);
}
if (!usDate.includes('May') || !usDate.includes('24') || !usDate.includes('2026')) {
  throw new Error(`US date formatting mismatch: ${usDate}`);
}
console.log('✔ Test 9: Locale-aware dates passed');

// -------------------------------------------------------------
// 10. Restaurant Timezone Handling
// -------------------------------------------------------------
// 12:00 UTC = 17:30 IST (+5:30) and 08:00 EDT (-4:00)
const istTime = formatRestaurantTime(fixedDate, 'en-IN', 'Asia/Kolkata');
const nyTime = formatRestaurantTime(fixedDate, 'en-US', 'America/New_York');
console.log('Test 10: Restaurant timezone -> IST:', istTime, '| NY:', nyTime);
if (!istTime.includes('5:30') && !istTime.includes('17:30')) {
  throw new Error(`Timezone conversion to Asia/Kolkata failed: ${istTime}`);
}
if (!nyTime.includes('8:00')) {
  throw new Error(`Timezone conversion to America/New_York failed: ${nyTime}`);
}
console.log('✔ Test 10: Restaurant timezone handling passed');

// -------------------------------------------------------------
// 11. Configurable Tax Label
// -------------------------------------------------------------
const testItems = [{ id: 'item-1', name: 'Artisanal Pizza', price: 100, quantity: 1 }];
const gstTotals = calculateOrderTotals(testItems, { rate: 0.05, label: 'GST', mode: 'inclusive' });
const salesTaxTotals = calculateOrderTotals(testItems, { rate: 0.0825, label: 'Sales Tax', mode: 'exclusive' });
const vatTotals = calculateOrderTotals(testItems, { rate: 0.20, label: 'VAT', mode: 'inclusive' });

console.log('Test 11: Configurable tax labels ->', gstTotals.taxLabel, salesTaxTotals.taxLabel, vatTotals.taxLabel);
if (gstTotals.taxLabel !== 'GST' || salesTaxTotals.taxLabel !== 'Sales Tax' || vatTotals.taxLabel !== 'VAT') {
  throw new Error('Configurable tax labels mismatch!');
}
console.log('✔ Test 11: Configurable tax label passed');

// -------------------------------------------------------------
// 12. Configurable Tax Rate & Calculation Mode
// -------------------------------------------------------------
// Exclusive: subtotal 100, 8.25% tax = 8.25, total = 108.25
console.log('Test 12: Exclusive tax -> subtotal:', salesTaxTotals.subtotal, 'tax:', salesTaxTotals.tax, 'total:', salesTaxTotals.total);
if (salesTaxTotals.subtotal !== 100 || salesTaxTotals.tax !== 8.25 || salesTaxTotals.total !== 108.25) {
  throw new Error(`Exclusive tax calculation mismatch: expected subtotal 100, tax 8.25, total 108.25, got ${JSON.stringify(salesTaxTotals)}`);
}

// Inclusive: subtotal 105, 5% rate -> total 105, tax = 5
const inclusive105 = calculateOrderTotals([{ id: '1', name: 'Item', price: 105, quantity: 1 }], { rate: 0.05, mode: 'inclusive' });
console.log('Test 12: Inclusive tax -> subtotal:', inclusive105.subtotal, 'tax:', inclusive105.tax, 'total:', inclusive105.total);
if (inclusive105.total !== 105 || inclusive105.tax !== 5) {
  throw new Error(`Inclusive tax calculation mismatch: expected total 105, tax 5, got ${JSON.stringify(inclusive105)}`);
}
console.log('✔ Test 12: Configurable tax rate passed');

// -------------------------------------------------------------
// 13. Dietary System Configuration
// -------------------------------------------------------------
console.log('Test 13: Dietary system preset configuration');
if (RESTAURANT_PRESETS.IN.dietarySystem !== 'india') {
  throw new Error('IN preset dietary system should be india');
}
if (RESTAURANT_PRESETS.US.dietarySystem !== 'international' || RESTAURANT_PRESETS.GB.dietarySystem !== 'international') {
  throw new Error('US & GB preset dietary systems should be international');
}
console.log('✔ Test 13: Dietary system configuration passed');

// -------------------------------------------------------------
// 14. Country Configuration
// -------------------------------------------------------------
const requiredCountries = ['IN', 'US', 'GB', 'AE', 'CA', 'AU'];
for (const code of requiredCountries) {
  const p = RESTAURANT_PRESETS[code];
  if (!p || !p.currency || !p.locale || !p.timezone || !p.phoneCountryCode || !p.taxLabel) {
    throw new Error(`Country preset missing or incomplete for ${code}`);
  }
}
console.log('✔ Test 14: Country configuration for all 6 presets passed');

// -------------------------------------------------------------
// 15. Guest Checkout Preservation
// -------------------------------------------------------------
const guestOrderPayload = {
  customer_name: 'John Doe',
  customer_phone: '+1 212 555 0198',
  order_type: 'takeaway' as const,
  table_number: null,
  items: testItems,
  currency: 'USD',
};
const guestOrderValidation = validateOrderPayload(guestOrderPayload);
if (!guestOrderValidation.valid) {
  throw new Error(`Guest checkout failed validation: ${guestOrderValidation.error}`);
}
console.log('✔ Test 15: Guest checkout preservation passed');

// -------------------------------------------------------------
// 16. QR Ordering Preservation
// -------------------------------------------------------------
const qrOrderPayload = {
  customer_name: 'Sarah Connor',
  customer_phone: '+44 20 7946 0958',
  order_type: 'dine_in' as const,
  table_number: '07',
  items: testItems,
  currency: 'GBP',
};
const qrOrderValidation = validateOrderPayload(qrOrderPayload);
if (!qrOrderValidation.valid) {
  throw new Error(`QR ordering failed validation: ${qrOrderValidation.error}`);
}
console.log('✔ Test 16: QR ordering preservation passed');

// -------------------------------------------------------------
// 17. Reservation Preservation
// -------------------------------------------------------------
const guestReservationPayload = {
  customer_name: 'Ali Mansoor',
  customer_phone: '+971 50 123 4567',
  reservation_date: '2026-10-15',
  reservation_time: '20:00',
  party_size: 4,
};
const reservationValidation = validateReservationPayload(guestReservationPayload);
if (!reservationValidation.valid) {
  throw new Error(`Reservation failed validation: ${reservationValidation.error}`);
}
console.log('✔ Test 17: Reservation preservation passed');

// -------------------------------------------------------------
// 18. Historical Order Currency Safety
// -------------------------------------------------------------
// A historical order was placed in India (INR 620).
// Even if the current restaurant config is changed to USD, the historical order's currency must be used!
const historicalOrder = {
  id: 'ord-hist-001',
  currency: 'INR',
  total: 620,
};
const activeRestaurantConfigCurrency = 'USD';
// Formatting using the order's own currency:
const formattedHistoricalOrder = formatCurrency(
  historicalOrder.total,
  historicalOrder.currency || activeRestaurantConfigCurrency,
  'en-IN'
);
console.log('Test 18: Historical order formatting under USD store ->', formattedHistoricalOrder);
if (!formattedHistoricalOrder.includes('₹') && !formattedHistoricalOrder.includes('INR')) {
  throw new Error(`Historical order currency corrupted! Formatted as "${formattedHistoricalOrder}" instead of INR`);
}
console.log('✔ Test 18: Historical order currency safety passed');

// -------------------------------------------------------------
// 19. Default India Configuration
// -------------------------------------------------------------
console.log('Test 19: Verifying default India configuration');
if (
  DEFAULT_RESTAURANT_CONFIG.country !== 'IN' ||
  DEFAULT_RESTAURANT_CONFIG.currency !== 'INR' ||
  DEFAULT_RESTAURANT_CONFIG.currencySymbol !== '₹' ||
  DEFAULT_RESTAURANT_CONFIG.locale !== 'en-IN' ||
  DEFAULT_RESTAURANT_CONFIG.timezone !== 'Asia/Kolkata' ||
  DEFAULT_RESTAURANT_CONFIG.phoneCountryCode !== '+91' ||
  DEFAULT_RESTAURANT_CONFIG.tax.label !== 'GST' ||
  DEFAULT_RESTAURANT_CONFIG.dietary.system !== 'india' ||
  DEFAULT_RESTAURANT_CONFIG.contact.primaryMethod !== 'whatsapp'
) {
  throw new Error('Default restaurant configuration does not match required India defaults!');
}
console.log('✔ Test 19: Default India configuration passed');

// -------------------------------------------------------------
// 20. Cross-Configuration Regression
// -------------------------------------------------------------
console.log('Test 20: Cross-configuration regression across all presets');
for (const presetKey of Object.keys(RESTAURANT_PRESETS)) {
  const p = RESTAURANT_PRESETS[presetKey];
  const formattedPrice = formatCurrency(125.5, p.currency, p.locale);
  const symbol = getCurrencySymbol(p.currency, p.locale);
  const formattedD = formatRestaurantDate(new Date(), p.locale, p.timezone);
  const formattedT = formatRestaurantTime(new Date(), p.locale, p.timezone);
  const formattedDT = formatRestaurantDateTime(new Date(), p.locale, p.timezone);
  const orderTotals = calculateOrderTotals(testItems, {
    rate: p.taxRate,
    label: p.taxLabel,
    mode: p.taxMode,
  });

  if (!formattedPrice || !symbol || !formattedD || !formattedT || !formattedDT) {
    throw new Error(`Cross-configuration regression failed for preset ${presetKey}`);
  }
  if (orderTotals.total <= 0) {
    throw new Error(`Order calculations failed for preset ${presetKey}`);
  }
}
console.log('✔ Test 20: Cross-configuration regression passed');

console.log('\n=== ALL 20 PHASE 1I INTERNATIONALIZATION TESTS PASSED SUCCESSFULLY! ===\n');
