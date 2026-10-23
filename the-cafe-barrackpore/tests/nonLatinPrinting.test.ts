import {
  createEscPos,
  containsNonLatinScript,
  renderTextToMonochromeRaster,
  renderTwoColumnRaster,
  renderThreeColumnRaster,
  hasCanvasSupport,
  PAPER_DOTS,
} from '../src/utils/escpos';
import {
  buildKotEscPos,
  buildBillEscPos,
} from '../src/utils/printReceipt';

console.log('=== RUNNING NON-LATIN SCRIPT THERMAL PRINTING TESTS ===\n');

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

/**
 * Searches for standard ESC/POS GS v 0 raster command: [0x1D, 0x76, 0x30]
 */
function hasRasterCommand(bytes: Uint8Array): boolean {
  for (let i = 0; i < bytes.length - 2; i++) {
    if (bytes[i] === 0x1d && bytes[i + 1] === 0x76 && bytes[i + 2] === 0x30) {
      return true;
    }
  }
  return false;
}

/**
 * Counts occurrences of ESC/POS GS v 0 raster command
 */
function countRasterCommands(bytes: Uint8Array): number {
  let count = 0;
  for (let i = 0; i < bytes.length - 2; i++) {
    if (bytes[i] === 0x1d && bytes[i + 1] === 0x76 && bytes[i + 2] === 0x30) {
      count++;
    }
  }
  return count;
}

// ============================================================================
// SUITE 1: Non-Latin Script Detection
// ============================================================================
console.log('--- 1. Non-Latin Script Detection Tests ---');

const sampleStrings = {
  japanese: {
    title: '領収証',
    dish: '抹茶パフェ',
    station: 'パティスリー厨房',
  },
  chinese: {
    title: '结账单',
    dish: '经典卡布奇诺',
    station: '厨房制作单',
  },
  korean: {
    title: '영수증',
    dish: '불고기 비빔밥',
    station: '주방 주문서',
  },
  arabic: {
    title: 'فاتورة',
    dish: 'شاورما دجاج',
    station: 'مطبخ الطلبات',
  },
  thai: {
    title: 'ใบเสร็จรับเงิน',
    dish: 'ต้มยำกุ้ง',
    station: 'ใบสั่งอาหารครัว',
  },
  hindi: {
    title: 'किचन आर्डर टिकट',
    dish: 'पनीर टिक्का मसाला',
    station: 'मुख्य रसोई',
  },
};

// 1.1 Non-Latin strings detected
assert(containsNonLatinScript(sampleStrings.japanese.dish), 'Japanese text detected as non-Latin (抹茶パフェ)');
assert(containsNonLatinScript(sampleStrings.chinese.dish), 'Chinese text detected as non-Latin (经典卡布奇诺)');
assert(containsNonLatinScript(sampleStrings.korean.dish), 'Korean text detected as non-Latin (불고기 비빔밥)');
assert(containsNonLatinScript(sampleStrings.arabic.dish), 'Arabic text detected as non-Latin (شاورما دجاج)');
assert(containsNonLatinScript(sampleStrings.thai.dish), 'Thai text detected as non-Latin (ต้มยำกุ้ง)');
assert(containsNonLatinScript(sampleStrings.hindi.dish), 'Hindi text detected as non-Latin (पनीर टिक्का मसाला)');

// 1.2 Latin strings not flagged as non-Latin
assert(!containsNonLatinScript('Cappuccino'), 'Latin text is NOT detected as non-Latin (Cappuccino)');
assert(!containsNonLatinScript('Table #12 - Takeaway'), 'Latin with symbols NOT detected as non-Latin');
assert(!containsNonLatinScript('Café au Lait Résumé'), 'Latin with European accents NOT detected as non-Latin');
assert(!containsNonLatinScript('Price: $12.50 / Rs. 450.00'), 'Currency strings NOT detected as non-Latin');
assert(!containsNonLatinScript(''), 'Empty string NOT detected as non-Latin');
assert(!containsNonLatinScript(null), 'Null string NOT detected as non-Latin');

// ============================================================================
// SUITE 2: Text Mode Preservation for Latin Tickets
// ============================================================================
console.log('\n--- 2. Native Text Mode Preservation for Latin Scripts ---');

const latinOrder = {
  order_ref: 'ORD-LATIN-001',
  order_type: 'dine_in' as const,
  table_number: '4',
  customer_name: 'John Doe',
  created_at: new Date().toISOString(),
  payment_status: 'paid',
  payment_provider: 'card',
};

const latinItems = [
  { item_name: 'Espresso Single', quantity: 2, unit_price: 120, line_total: 240 },
  { item_name: 'Chicken Club Sandwich', quantity: 1, unit_price: 320, line_total: 320 },
];

const latinKot = buildKotEscPos(latinOrder, latinItems, { paperWidth: '80mm' });
assert(!hasRasterCommand(latinKot), 'Latin KOT contains 0 raster commands (100% native fast text mode)');

const latinBill = buildBillEscPos(latinOrder, latinItems, {
  paperWidth: '80mm',
  taxRate: 0.05,
  taxLabel: 'GST',
});
assert(!hasRasterCommand(latinBill), 'Latin Customer Bill contains 0 raster commands (100% native fast text mode)');

// ============================================================================
// SUITE 3: Non-Latin KOT Raster Printing (All 6 Languages)
// ============================================================================
console.log('\n--- 3. Non-Latin Script KOT Raster Printing ---');

for (const [lang, samples] of Object.entries(sampleStrings)) {
  const nonLatinOrder = {
    order_ref: `ORD-${lang.toUpperCase()}-101`,
    order_type: 'dine_in' as const,
    table_number: '7',
    customer_name: `Guest (${samples.title})`,
    created_at: new Date().toISOString(),
  };

  const nonLatinItems = [
    { item_name: samples.dish, quantity: 2 },
  ];

  const kotBytes = buildKotEscPos(nonLatinOrder, nonLatinItems, {
    paperWidth: '80mm',
    stationName: samples.station,
  });

  assert(
    hasRasterCommand(kotBytes),
    `${lang.toUpperCase()} KOT emits ESC/POS raster bit image command (GS v 0) for non-Latin text`
  );

  const rasterCount = countRasterCommands(kotBytes);
  assert(
    rasterCount >= 2,
    `${lang.toUpperCase()} KOT rasters both station title/guest and item name (${rasterCount} raster blocks)`
  );
}

// ============================================================================
// SUITE 4: Non-Latin Customer Bill Raster Printing (All 6 Languages)
// ============================================================================
console.log('\n--- 4. Non-Latin Script Customer Bill Raster Printing ---');

for (const [lang, samples] of Object.entries(sampleStrings)) {
  const nonLatinOrder = {
    order_ref: `BILL-${lang.toUpperCase()}-202`,
    order_type: 'dine_in' as const,
    table_number: '10',
    customer_name: samples.title,
    created_at: new Date().toISOString(),
    payment_status: 'paid',
  };

  const nonLatinItems = [
    { item_name: samples.dish, quantity: 1, unit_price: 250, line_total: 250 },
  ];

  const billBytes = buildBillEscPos(nonLatinOrder, nonLatinItems, {
    paperWidth: '80mm',
    businessName: samples.title,
  });

  assert(
    hasRasterCommand(billBytes),
    `${lang.toUpperCase()} Bill emits ESC/POS raster command (GS v 0) for non-Latin items and header`
  );
}

// ============================================================================
// SUITE 5: 80mm vs 58mm Paper Width Raster Geometry
// ============================================================================
console.log('\n--- 5. Paper Width Geometry & Dot Layout (80mm vs 58mm) ---');

const testStr = '抹茶パフェ & 经典卡布奇诺';

// 80mm (576 dots = 72 bytes across)
const raster80 = renderTextToMonochromeRaster(testStr, { widthDots: PAPER_DOTS['80mm'] });
assert(raster80.widthDots === 576, '80mm raster width is exactly 576 dots');
assert(raster80.data.length % (576 / 8) === 0, '80mm raster byte buffer divisible by 72 bytes across');
assert(raster80.data.some(b => b > 0), '80mm raster buffer contains active printed dots');

// 58mm (384 dots = 48 bytes across)
const raster58 = renderTextToMonochromeRaster(testStr, { widthDots: PAPER_DOTS['58mm'] });
assert(raster58.widthDots === 384, '58mm raster width is exactly 384 dots');
assert(raster58.data.length % (384 / 8) === 0, '58mm raster byte buffer divisible by 48 bytes across');
assert(raster58.data.some(b => b > 0), '58mm raster buffer contains active printed dots');

// Verify ESC/POS builder emits correct xL, xH headers for 80mm vs 58mm
const builder80 = createEscPos('80mm').smartLine(testStr).build();
// Find GS v 0 header
const idx80 = builder80.findIndex((b, i) => b === 0x1d && builder80[i+1] === 0x76 && builder80[i+2] === 0x30);
assert(idx80 !== -1, '80mm smartLine emits GS v 0');
assert(builder80[idx80 + 4] === 72 && builder80[idx80 + 5] === 0, '80mm xL=72, xH=0 (72 bytes / 576 dots across)');

const builder58 = createEscPos('58mm').smartLine(testStr).build();
const idx58 = builder58.findIndex((b, i) => b === 0x1d && builder58[i+1] === 0x76 && builder58[i+2] === 0x30);
assert(idx58 !== -1, '58mm smartLine emits GS v 0');
assert(builder58[idx58 + 4] === 48 && builder58[idx58 + 5] === 0, '58mm xL=48, xH=0 (48 bytes / 384 dots across)');

// ============================================================================
// SUITE 6: Multi-Column Smart Rendering
// ============================================================================
console.log('\n--- 6. Multi-Column Smart Rendering ---');

// Two Column
const mixedTwoCol = createEscPos('80mm').smartRow('पनीर टिक्का मसाला', 'Rs. 350.00').build();
assert(hasRasterCommand(mixedTwoCol), 'smartRow with Hindi dish name emits raster');

const latinTwoCol = createEscPos('80mm').smartRow('Paneer Tikka Masala', 'Rs. 350.00').build();
assert(!hasRasterCommand(latinTwoCol), 'smartRow with pure Latin text does not emit raster');

// Three Column
const mixedThreeCol = createEscPos('80mm').smartThreeColumn('2x', 'شاورما دجاج', 'Rs. 400.00').build();
assert(hasRasterCommand(mixedThreeCol), 'smartThreeColumn with Arabic dish name emits raster');

const latinThreeCol = createEscPos('80mm').smartThreeColumn('2x', 'Chicken Shawarma', 'Rs. 400.00').build();
assert(!hasRasterCommand(latinThreeCol), 'smartThreeColumn with pure Latin text does not emit raster');

// ============================================================================
// SUITE 7: Inverted Badges and Boxes
// ============================================================================
console.log('\n--- 7. Smart Badge and Box Rendering ---');

const hindiBadge = createEscPos('80mm').smartBadge('विशेष टेबल #५').build();
assert(hasRasterCommand(hindiBadge), 'smartBadge with Hindi text emits raster badge');

const latinBadge = createEscPos('80mm').smartBadge('TABLE #5').build();
assert(!hasRasterCommand(latinBadge), 'smartBadge with Latin text uses native printer inverse text');

const thaiBox = createEscPos('80mm').smartBox('ไม่ใส่พริกและไม่ใส่น้ำตาล', 'คำแนะนำพิเศษ').build();
assert(hasRasterCommand(thaiBox), 'smartBox with Thai chef instructions emits raster box');

const latinBox = createEscPos('80mm').smartBox('No sugar, extra ice please', 'Special Note').build();
assert(!hasRasterCommand(latinBox), 'smartBox with Latin note uses native box borders');

// ============================================================================
// SUITE 8: Browser HTML5 Canvas Simulation
// ============================================================================
console.log('\n--- 8. Browser HTML5 Canvas Simulation ---');

// Mock HTML5 Canvas API in node to verify the Canvas 2D path executes
const mockImageData = {
  data: new Uint8ClampedArray(576 * 32 * 4),
};
// Set some black pixels in mock data (r=0, g=0, b=0, a=255)
for (let i = 0; i < 576 * 4; i += 4) {
  mockImageData.data[i] = 0;
  mockImageData.data[i + 1] = 0;
  mockImageData.data[i + 2] = 0;
  mockImageData.data[i + 3] = 255;
}

const originalDocument = (globalThis as any).document;
(globalThis as any).document = {
  createElement: (tag: string) => {
    if (tag === 'canvas') {
      return {
        width: 0,
        height: 0,
        getContext: () => ({
          fillStyle: '',
          fillRect: () => {},
          font: '',
          textBaseline: '',
          textAlign: '',
          direction: '',
          fillText: () => {},
          getImageData: () => mockImageData,
        }),
      };
    }
    return {};
  },
};

assert(hasCanvasSupport(), 'hasCanvasSupport detects mock HTML5 Canvas');

const canvasRaster = renderTextToMonochromeRaster('抹茶パフェ', { widthDots: 576 });
assert(canvasRaster.widthDots === 576, 'Canvas rasterizer returned correct 576 dot width');
assert(canvasRaster.data.some(b => b > 0), 'Canvas rasterizer successfully extracted monochrome bit image data');

const canvasTwoCol = renderTwoColumnRaster('불고기 비빔밥', 'Rs. 450.00', { widthDots: 576 });
assert(canvasTwoCol.data.some(b => b > 0), 'Canvas two-column rasterizer extracted monochrome bit image');

const canvasThreeCol = renderThreeColumnRaster('1x', 'ต้มยำกุ้ง', 'Rs. 320.00', { widthDots: 576 });
assert(canvasThreeCol.data.some(b => b > 0), 'Canvas three-column rasterizer extracted monochrome bit image');

// Restore original document state
(globalThis as any).document = originalDocument;

console.log(`\n======================================================`);
console.log(`ALL NON-LATIN SCRIPT PRINTING TESTS PASSED: ${passedTests}/${totalTests}`);
console.log(`======================================================\n`);
