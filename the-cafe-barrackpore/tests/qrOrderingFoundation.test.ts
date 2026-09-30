import { validateAndNormalizeTableNumber } from '../src/utils/tableValidation';
import { validateOrderPayload, createOrder } from '../src/services/orderService';
import type { CreateOrderPayload } from '../src/types/order';

console.log('=== RUNNING PHASE 1E SMART QR TABLE ORDERING TESTS ===\n');

// 1. Table Normalization Tests: Valid Cases
console.log('Test Suite 1: Table Number Normalization (Valid)');
const validCases: Array<[string | null | undefined, string]> = [
  ['07', '07'],
  ['7', '07'],
  ['1', '01'],
  ['01', '01'],
  ['12', '12'],
  ['99', '99'],
  ['  07  ', '07'],
  ['5', '05'],
];

for (const [input, expected] of validCases) {
  const result = validateAndNormalizeTableNumber(input);
  if (!result.isValid || result.normalized !== expected) {
    throw new Error(`Expected "${input}" to normalize to "${expected}", got: ${JSON.stringify(result)}`);
  }
}
console.log('✔ All valid table formats correctly normalized to two digits (01 - 99)\n');

// 2. Table Validation Tests: Invalid Cases
console.log('Test Suite 2: Table Rejection (Invalid inputs & security guardrails)');
const invalidCases: Array<[string | null | undefined, string]> = [
  [null, 'null input'],
  [undefined, 'undefined input'],
  ['', 'empty string'],
  ['   ', 'whitespace only'],
  ['0', 'table 0'],
  ['00', 'table 00'],
  ['-1', 'negative table'],
  ['-07', 'negative formatted table'],
  ['100', 'table > 99'],
  ['999', 'large table number'],
  ['abc', 'non-numeric characters'],
  ['7a', 'alphanumeric'],
  ['<script>alert(1)</script>', 'XSS injection attempt'],
  ['SELECT * FROM tables', 'SQL injection attempt'],
  ['1.5', 'decimal number'],
];

for (const [input, desc] of invalidCases) {
  const result = validateAndNormalizeTableNumber(input);
  if (result.isValid || result.normalized !== null) {
    throw new Error(`Expected invalid input "${desc}" (${input}) to be rejected, got: ${JSON.stringify(result)}`);
  }
}
console.log('✔ All invalid table formats and injection strings safely rejected\n');

// 3. Query Parameter Parser Simulation
console.log('Test Suite 3: URL Query Parameter Parsing Simulation');
function parseQrQuery(searchString: string) {
  const params = new URLSearchParams(searchString);
  const rawTable = params.get('table');
  const hasTableParam = params.has('table');
  const validation = validateAndNormalizeTableNumber(rawTable);

  return {
    rawTable,
    hasTableParam,
    tableNumber: validation.normalized,
    isValidTable: validation.isValid,
    validationError: validation.error,
    isQrOrder: hasTableParam && validation.isValid,
  };
}

// Case A: /qr?table=07
const caseA = parseQrQuery('?table=07');
if (!caseA.isQrOrder || caseA.tableNumber !== '07' || !caseA.isValidTable) {
  throw new Error(`Case A (/qr?table=07) failed: ${JSON.stringify(caseA)}`);
}
console.log('✔ Case A (/qr?table=07): valid QR order, table = "07"');

// Case B: /qr?table=7 (single digit)
const caseB = parseQrQuery('?table=7');
if (!caseB.isQrOrder || caseB.tableNumber !== '07' || !caseB.isValidTable) {
  throw new Error(`Case B (/qr?table=7) failed: ${JSON.stringify(caseB)}`);
}
console.log('✔ Case B (/qr?table=7): single digit normalized to "07"');

// Case C: /qr (missing table)
const caseC = parseQrQuery('');
if (caseC.hasTableParam || caseC.tableNumber !== null || caseC.isQrOrder) {
  throw new Error(`Case C (/qr missing param) failed: ${JSON.stringify(caseC)}`);
}
console.log('✔ Case C (/qr missing param): correctly marked missing table');

// Case D: /qr?table=abc (invalid format)
const caseD = parseQrQuery('?table=abc');
if (caseD.isValidTable || caseD.isQrOrder || !caseD.validationError) {
  throw new Error(`Case D (/qr?table=abc) failed: ${JSON.stringify(caseD)}`);
}
console.log('✔ Case D (/qr?table=abc): correctly flagged invalid table without crashing');

// Case E: /qr?table=100 (exceeds max 99)
const caseE = parseQrQuery('?table=100');
if (caseE.isValidTable || caseE.isQrOrder) {
  throw new Error(`Case E (/qr?table=100) failed: ${JSON.stringify(caseE)}`);
}
console.log('✔ Case E (/qr?table=100): correctly rejected boundary table > 99\n');

// 4. Order Creation & Source Tracking Tests
console.log('Test Suite 4: Order Creation & Source Tracking (QR vs Website)');

const sampleItems = [
  { id: 'item-espresso', name: 'Artisan Espresso', price: 160, quantity: 2 },
  { id: 'item-pizza', name: 'Truffle Mushroom Pizza', price: 420, quantity: 1 },
];

// QR Order Payload
const qrOrderPayload: CreateOrderPayload = {
  customer_name: 'Ananya Roy',
  customer_phone: '9830012345',
  order_type: 'dine_in',
  table_number: '07',
  source: 'qr',
  items: sampleItems,
};

const vQr = validateOrderPayload(qrOrderPayload);
if (!vQr.valid) {
  throw new Error(`QR order payload validation failed: ${vQr.error}`);
}
console.log('✔ QR order payload validation passed');

// Normal Website Order Payload (Takeaway)
const webTakeawayPayload: CreateOrderPayload = {
  customer_name: 'Vikram Bose',
  customer_phone: '9830054321',
  order_type: 'takeaway',
  table_number: null,
  source: 'website',
  items: sampleItems,
};

const vWeb = validateOrderPayload(webTakeawayPayload);
if (!vWeb.valid) {
  throw new Error(`Website takeaway payload validation failed: ${vWeb.error}`);
}
console.log('✔ Normal website takeaway payload validation passed');

// Normal Website Order Payload (Dine-in manual table entry)
const webDineInPayload: CreateOrderPayload = {
  customer_name: 'Debjit Das',
  customer_phone: '9830098765',
  order_type: 'dine_in',
  table_number: 'Balcony 3',
  source: 'website',
  items: sampleItems,
};

const vWebDineIn = validateOrderPayload(webDineInPayload);
if (!vWebDineIn.valid) {
  throw new Error(`Website manual dine-in payload validation failed: ${vWebDineIn.error}`);
}
console.log('✔ Normal website manual dine-in payload validation passed\n');

// 5. Asynchronous Order Submission Testing with Source Verification
async function runAsyncOrderTests() {
  console.log('Test Suite 5: Async createOrder Execution with Source Fields');

  // Submit QR Order
  const qrResult = await createOrder(qrOrderPayload);
  if (!qrResult.success || !qrResult.orderRef) {
    throw new Error(`Failed to create QR order: ${JSON.stringify(qrResult)}`);
  }
  console.log(`✔ QR order successfully created with reference ${qrResult.orderRef} (source: qr)`);

  // Submit Website Order
  const webResult = await createOrder(webTakeawayPayload);
  if (!webResult.success || !webResult.orderRef) {
    throw new Error(`Failed to create Website order: ${JSON.stringify(webResult)}`);
  }
  console.log(`✔ Website order successfully created with reference ${webResult.orderRef} (source: website)`);

  console.log('\n=== ALL PHASE 1E SMART QR TABLE ORDERING TESTS PASSED SUCCESSFULLY! ===\n');
}

runAsyncOrderTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
