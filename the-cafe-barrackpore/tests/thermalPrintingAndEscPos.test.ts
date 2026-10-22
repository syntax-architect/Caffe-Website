import {
  EscPosBuilder,
  createEscPos,
  sanitizeThermalText,
  formatTwoColumns,
  formatThreeColumns,
} from '../src/utils/escpos';
import {
  DEFAULT_STATION_PRINTER_SETTINGS,
  routeItemToStation,
  detectPrinterCapabilities,
  getStationPrinterSettings,
  saveStationPrinterSettings,
} from '../src/config/printerSettings';
import {
  buildKotEscPos,
  buildKotHtml,
  buildBillEscPos,
  buildBillHtml,
  buildTestSlipEscPos,
} from '../src/utils/printReceipt';

console.log('=== RUNNING THERMAL PRINTING & ESC/POS ENGINE TESTS ===\n');

// Mock localStorage for node environment if not present
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] || null,
    get length() {
      return store.size;
    },
  };
}

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${testName}`);
  } else {
    console.error(`  ✗ ${testName}`);
    if (details) console.error(`    Details: ${details}`);
    throw new Error(`Test failed: ${testName} - ${details || ''}`);
  }
}

// ============================================================================
// SUITE 1: ESC/POS Command Byte Sequences
// ============================================================================
console.log('--- 1. ESC/POS Command Builder Tests ---');

// 1.1 Init command (ESC @ => 0x1B, 0x40)
const initBytes = createEscPos('80mm').init().build();
assert(
  initBytes.length >= 2 && initBytes[0] === 0x1b && initBytes[1] === 0x40,
  'createEscPos.init emits [0x1B, 0x40]'
);

// 1.2 Bold toggle (ESC E 1 => 0x1B, 0x45, 0x01 / ESC E 0 => 0x1B, 0x45, 0x00)
const boldBytes = createEscPos('80mm').bold(true).bold(false).build();
assert(
  boldBytes[0] === 0x1b &&
    boldBytes[1] === 0x45 &&
    boldBytes[2] === 0x01 &&
    boldBytes[3] === 0x1b &&
    boldBytes[4] === 0x45 &&
    boldBytes[5] === 0x00,
  'createEscPos.bold emits ESC E 1 and ESC E 0'
);

// 1.3 Alignment commands (ESC a 0, 1, 2)
const alignBytes = createEscPos('80mm').align('left').align('center').align('right').build();
assert(
  alignBytes[0] === 0x1b && alignBytes[1] === 0x61 && alignBytes[2] === 0 &&
  alignBytes[3] === 0x1b && alignBytes[4] === 0x61 && alignBytes[5] === 1 &&
  alignBytes[6] === 0x1b && alignBytes[7] === 0x61 && alignBytes[8] === 2,
  'createEscPos.align emits ESC a n (0=left, 1=center, 2=right)'
);

// 1.4 Paper cut (GS V 0 => 0x1D, 0x56, 0x00 and partial GS V 66 0 => 0x1D, 0x56, 0x42, 0x00)
const cutBytes = createEscPos('80mm').cut(false, 0).cut(true, 0).build();
assert(
  cutBytes[0] === 0x1d && cutBytes[1] === 0x56 && cutBytes[2] === 0 &&
  cutBytes[3] === 0x1d && cutBytes[4] === 0x56 && cutBytes[5] === 66 && cutBytes[6] === 0,
  'createEscPos.cut emits full [0x1D, 0x56, 0] and partial [0x1D, 0x56, 66, 0]'
);

// 1.5 Cash Drawer Kick Pulse (ESC p m t1 t2)
const drawerBytesPin0 = createEscPos('80mm').cashDrawerPulse(0, 25, 250).build();
assert(
  drawerBytesPin0[0] === 0x1b &&
    drawerBytesPin0[1] === 0x70 &&
    drawerBytesPin0[2] === 0 &&
    drawerBytesPin0[3] === 25 &&
    drawerBytesPin0[4] === 250,
  'createEscPos.cashDrawerPulse emits ESC p 0 25 250 for pin 0'
);

const drawerBytesPin1 = createEscPos('80mm').cashDrawerPulse(1, 25, 250).build();
assert(
  drawerBytesPin1[0] === 0x1b &&
    drawerBytesPin1[1] === 0x70 &&
    drawerBytesPin1[2] === 1 &&
    drawerBytesPin1[3] === 25 &&
    drawerBytesPin1[4] === 250,
  'createEscPos.cashDrawerPulse emits ESC p 1 25 250 for pin 1'
);

// 1.6 QR Code Generation (GS ( k ...)
const qrBytes = createEscPos('80mm').qrCode('upi://pay?pa=test@upi&am=450.00', 6).build();
// Must include Epson Model 2 initialization sequences
const hasQrFunctionHeaders =
  qrBytes.includes(0x1d) && qrBytes.includes(0x28) && qrBytes.includes(0x6b);
assert(hasQrFunctionHeaders, 'createEscPos.qrCode generates native Epson GS ( k QR sequences');

// 1.7 Width and Column Layout for 80mm (48 cols) and 58mm (32 cols)
const row80 = formatTwoColumns('Subtotal', 'Rs. 450.00', 48);
assert(row80.length === 48, `80mm formatTwoColumns length is exactly 48 (got ${row80.length})`);
assert(row80.startsWith('Subtotal') && row80.endsWith('Rs. 450.00'), '80mm 2-column justification correct');

const row58 = formatTwoColumns('Subtotal', 'Rs. 450.00', 32);
assert(row58.length === 32, `58mm formatTwoColumns length is exactly 32 (got ${row58.length})`);

const threeCol80 = formatThreeColumns('2x', 'Cappuccino Coffee', 'Rs. 240.00', 48);
assert(threeCol80.length === 48, `80mm formatThreeColumns length is exactly 48 (got ${threeCol80.length})`);

const threeCol58 = formatThreeColumns('2x', 'Cappuccino', 'Rs. 240.00', 32);
assert(threeCol58.length === 32, `58mm formatThreeColumns length is exactly 32 (got ${threeCol58.length})`);

// 1.8 Text sanitization for currency and diacritics
const sanitized = sanitizeThermalText('Total: ₹ 500.00 café résumé');
assert(
  sanitized.includes('Rs. 500.00') && !sanitized.includes('₹'),
  'sanitizeThermalText converts ₹ glyph to standard ASCII "Rs. " for thermal codepages'
);

// ============================================================================
// SUITE 2: Station Printer Configuration & Category Routing
// ============================================================================
console.log('\n--- 2. Station Printer Routing & Capabilities Tests ---');

// 2.1 Default configuration integrity
const defaults = { ...DEFAULT_STATION_PRINTER_SETTINGS };
assert(defaults.receipt.paperWidth === '80mm', 'Default receipt printer is 80mm');
assert(defaults.kitchen.paperWidth === '80mm', 'Default kitchen printer is 80mm');
assert(defaults.bar.paperWidth === '58mm', 'Default bar printer is 58mm compact roll');
assert(defaults.enableCategoryRouting === false, 'Category routing disabled by default until bar printer enabled');

// 2.2 Category routing engine
const activeRoutingConfig = {
  ...defaults,
  enableCategoryRouting: true,
  bar: { ...defaults.bar, enabled: true },
};
assert(routeItemToStation('beverages', activeRoutingConfig) === 'bar', 'Beverages category routes to bar');
assert(routeItemToStation('coffee', activeRoutingConfig) === 'bar', 'Coffee category routes to bar');
assert(routeItemToStation('mocktails', activeRoutingConfig) === 'bar', 'Mocktails category routes to bar');
assert(routeItemToStation('sips-desserts', activeRoutingConfig) === 'bar', 'Sips category routes to bar');
assert(routeItemToStation('starters', activeRoutingConfig) === 'kitchen', 'Starters category routes to kitchen');
assert(routeItemToStation('main course', activeRoutingConfig) === 'kitchen', 'Main course routes to kitchen');
assert(routeItemToStation('burgers & pizzas', activeRoutingConfig) === 'kitchen', 'Burgers & pizzas routes to kitchen');

// 2.3 Routing fallback when routing disabled
assert(
  routeItemToStation('coffee', defaults) === 'kitchen',
  'Routes to kitchen when category routing disabled or bar printer inactive'
);

// 2.4 Persistence roundtrip
const testSettings = { ...defaults, bar: { ...defaults.bar, paperWidth: '58mm' as const } };
saveStationPrinterSettings(testSettings);
const loadedSettings = getStationPrinterSettings();
assert(loadedSettings.bar.paperWidth === '58mm', 'Station printer settings persist and reload from storage');

// 2.5 Hardware capabilities detection
const caps = detectPrinterCapabilities();
assert(typeof caps.hasWebUsb === 'boolean', 'WebUSB capability detection returns boolean');
assert(typeof caps.hasWebSerial === 'boolean', 'Web Serial capability detection returns boolean');
assert(typeof caps.isIosSafari === 'boolean', 'iOS Safari detection returns boolean');
assert(caps.recommendedTarget === 'browser', 'Default recommended target is browser');

// ============================================================================
// SUITE 3: Kitchen Order Ticket (KOT) Generation
// ============================================================================
console.log('\n--- 3. KOT Print Generation Tests ---');

const mockOrder = {
  order_ref: 'ORD-9821',
  order_type: 'dine_in' as const,
  table_number: 'T-04',
  customer_name: 'Aditi Sharma',
  customer_phone: '+91 98765 43210',
  created_at: new Date('2026-10-22T14:30:00Z').toISOString(),
  notes: 'Extra napkins and less ice in drinks',
  items: [
    { item_name: 'Crispy Veg Burger', quantity: 2, isNew: false },
    { item_name: 'Cold Coffee with Ice Cream', quantity: 1, isNew: true, category: 'Beverages' },
  ],
};

// 3.1 Initial KOT ESC/POS generation
const kotEscPosInitial = buildKotEscPos(mockOrder, mockOrder.items, {
  paperWidth: '80mm',
  isDuplicate: false,
});
assert(kotEscPosInitial instanceof Uint8Array, 'KOT ESC/POS returns valid Uint8Array buffer');
assert(kotEscPosInitial.length > 50, 'KOT ESC/POS buffer has substantial payload');

const initialKotText = new TextDecoder('latin1').decode(kotEscPosInitial);
assert(initialKotText.includes('ORD-9821'), 'KOT ESC/POS includes order reference');
assert(initialKotText.includes('TABLE: T-04') || initialKotText.includes('T-04'), 'KOT ESC/POS includes table number');
assert(initialKotText.includes('Crispy Veg Burger'), 'KOT ESC/POS includes item name');
assert(initialKotText.includes('[NEW/ADDED]'), 'KOT ESC/POS includes [NEW/ADDED] marker for newly added items');
assert(!initialKotText.includes('*** DUPLICATE'), 'Initial KOT does not include duplicate banner');

// 3.2 Duplicate / Reprint KOT ESC/POS generation
const kotEscPosDuplicate = buildKotEscPos(mockOrder, mockOrder.items, {
  paperWidth: '80mm',
  isDuplicate: true,
  isReprint: true,
});
const duplicateKotText = new TextDecoder('latin1').decode(kotEscPosDuplicate);
assert(
  duplicateKotText.includes('DUPLICATE / REPRINT'),
  'Reprinted KOT includes prominent DUPLICATE / REPRINT banner'
);

// 3.3 HTML KOT Generation
const kotHtml = buildKotHtml(mockOrder, mockOrder.items, {
  paperWidth: '80mm',
  isDuplicate: true,
});
assert(kotHtml.includes('@page'), 'KOT HTML contains @page CSS formatting');
assert(kotHtml.includes('T-04'), 'KOT HTML contains table number');
assert(kotHtml.includes('DUPLICATE / REPRINT'), 'KOT HTML contains duplicate tag');

// ============================================================================
// SUITE 4: Customer Bill & Tax Invoice Generation
// ============================================================================
console.log('\n--- 4. Customer Bill & Tax Invoice Tests ---');

const billItems = [
  { item_name: 'Crispy Veg Burger', quantity: 2, unit_price: 180, line_total: 360 },
  { item_name: 'Cold Coffee', quantity: 1, unit_price: 120, line_total: 120 },
];

const mockBillOrder = {
  ...mockOrder,
  subtotal: 480,
  tax_amount: 24,
  total: 504,
  payment_status: 'paid',
  payment_provider: 'UPI',
  paid_at: new Date().toISOString(),
};

// 4.1 Bill ESC/POS generation
const billEscPos = buildBillEscPos(mockBillOrder, billItems, {
  paperWidth: '80mm',
  businessName: 'The Cafe Barrackpore',
  taxId: '19ABCDE1234F1Z5',
  taxIdLabel: 'GSTIN',
  address: '14 Riverside Road, Barrackpore',
  phone: '+91 98765 00000',
  openCashDrawer: true,
});
assert(billEscPos instanceof Uint8Array, 'Bill ESC/POS returns valid Uint8Array buffer');

const billText = new TextDecoder('latin1').decode(billEscPos);
assert(billText.includes('The Cafe Barrackpore'), 'Bill ESC/POS includes business name');
assert(billText.includes('GSTIN: 19ABCDE1234F1Z5'), 'Bill ESC/POS includes GSTIN');
assert(billText.includes('Crispy Veg Burger'), 'Bill ESC/POS includes itemized items');
assert(billText.includes('Rs. 480.00') || billText.includes('480.00'), 'Bill ESC/POS includes subtotal');
assert(billText.includes('PAID'), 'Bill ESC/POS displays payment status');

// 4.2 Bill HTML generation
const billHtml = buildBillHtml(mockBillOrder, billItems, {
  paperWidth: '80mm',
  businessName: 'The Cafe Barrackpore',
  taxId: '19ABCDE1234F1Z5',
});
assert(billHtml.includes('TAX INVOICE'), 'Bill HTML contains TAX INVOICE title');
assert(billHtml.includes('19ABCDE1234F1Z5'), 'Bill HTML contains tax ID');
assert(billHtml.includes('Crispy Veg Burger'), 'Bill HTML contains line items');

// ============================================================================
// SUITE 5: Diagnostic Test Page
// ============================================================================
console.log('\n--- 5. Hardware Test Page Tests ---');

const testSlip80 = buildTestSlipEscPos('80mm');
assert(testSlip80.length > 100, '80mm Test slip generates comprehensive test payload');
const testSlip80Text = new TextDecoder('latin1').decode(testSlip80);
assert(testSlip80Text.includes('HARDWARE DIAGNOSTIC TEST'), 'Test slip includes diagnostic header');
assert(testSlip80Text.includes('48 Columns'), '80mm test slip includes 48-column specification');

const testSlip58 = buildTestSlipEscPos('58mm');
const testSlip58Text = new TextDecoder('latin1').decode(testSlip58);
assert(testSlip58Text.includes('32 Columns'), '58mm test slip includes 32-column specification');

console.log(`\n======================================================`);
console.log(`ALL THERMAL PRINTING TESTS PASSED: ${passedTests}/${totalTests}`);
console.log(`======================================================\n`);
