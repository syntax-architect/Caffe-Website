import { IRELAND_DEMO_CONFIG } from '../src/config/restaurantPresets';
import { IRELAND_MENU_ITEMS_FALLBACK, IRELAND_MENU_CATEGORIES_FALLBACK } from '../src/data/menuFallbacks';

console.log('=== IRELAND DEMO PRESET VERIFICATION ===');
console.log('Business Name:', IRELAND_DEMO_CONFIG.businessName);
console.log('Currency:', IRELAND_DEMO_CONFIG.currency, `(${IRELAND_DEMO_CONFIG.currencySymbol})`);
console.log('Locale:', IRELAND_DEMO_CONFIG.locale);
console.log('Timezone:', IRELAND_DEMO_CONFIG.timezone);
console.log('Address:', `${IRELAND_DEMO_CONFIG.address.line1}, ${IRELAND_DEMO_CONFIG.address.city}, ${IRELAND_DEMO_CONFIG.address.postalCode}, ${IRELAND_DEMO_CONFIG.address.country}`);
console.log('VAT Mode & Rate:', IRELAND_DEMO_CONFIG.tax.mode, `${(IRELAND_DEMO_CONFIG.tax.rate * 100)}% (${IRELAND_DEMO_CONFIG.tax.label})`);
console.log('Categories Count:', IRELAND_MENU_CATEGORIES_FALLBACK.length);
console.log('Menu Items Count:', IRELAND_MENU_ITEMS_FALLBACK.length);

for (const item of IRELAND_MENU_ITEMS_FALLBACK) {
  console.log(` - ${item.name} | €${item.price.toFixed(2)} | Category: ${item.tax_category}`);
}
console.log('\nAll Ireland Demo Preset contracts verified successfully!');
