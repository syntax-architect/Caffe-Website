import { calculateOrderTotals, generateClientOrderRef } from '../src/utils/orderCalculations';
import { validateOrderPayload, createOrder } from '../src/services/orderService';
import { isSupabaseConfigured } from '../src/lib/supabase';

console.log('=== RUNNING PHASE 1C ORDER FOUNDATION TESTS ===\n');

// 1. Test Order Reference Generation
const ref = generateClientOrderRef();
console.log('Test 1: Order reference format:', ref);
const refPattern = /^CB-\d{4}-[A-Z0-9]{4}$/;
if (!refPattern.test(ref)) {
  throw new Error(`Order reference ${ref} did not match pattern CB-YYYY-XXXX`);
}
console.log('✔ Order reference format passed');

// 2. Test Order Calculations
const sampleItems = [
  { id: 'item-1', name: 'Chicken Momo', price: 250, quantity: 2 },
  { id: 'item-2', name: 'Cold Coffee', price: 180, quantity: 1 },
];
const totals = calculateOrderTotals(sampleItems);
console.log('\nTest 2: Order calculations:');
console.log('  Subtotal:', totals.subtotal);
console.log('  Total:', totals.total);
console.log('  Item Count:', totals.itemCount);
if (totals.subtotal !== 680 || totals.total !== 680 || totals.itemCount !== 3) {
  throw new Error(`Calculation mismatch! Expected 680, got ${totals.total}`);
}
console.log('✔ Order totals calculation passed');

// 3. Test Validation: Valid Dine-In
const validDineIn = {
  customer_name: 'Rahul Sharma',
  customer_phone: '9876543210',
  order_type: 'dine_in' as const,
  table_number: 'Table 4',
  items: sampleItems,
};
const v1 = validateOrderPayload(validDineIn);
if (!v1.valid) throw new Error(`Expected valid dine-in, failed with: ${v1.error}`);
console.log('✔ Valid Dine-In validation passed');

// 4. Test Validation: Valid Takeaway (no table required)
const validTakeaway = {
  customer_name: 'Priya Sen',
  customer_phone: '9876543211',
  order_type: 'takeaway' as const,
  table_number: null,
  items: sampleItems,
};
const v2 = validateOrderPayload(validTakeaway);
if (!v2.valid) throw new Error(`Expected valid takeaway, failed with: ${v2.error}`);
console.log('✔ Valid Takeaway validation passed');

// 5. Test Validation: Dine-In missing table (Must fail)
const invalidDineIn = {
  customer_name: 'Rahul Sharma',
  customer_phone: '9876543210',
  order_type: 'dine_in' as const,
  table_number: '',
  items: sampleItems,
};
const v3 = validateOrderPayload(invalidDineIn);
if (v3.valid) throw new Error('Expected Dine-in without table number to fail validation!');
console.log('✔ Invalid Dine-In (missing table) rejected properly:', v3.error);

// 6. Test Validation: Short Phone Number (Must fail)
const invalidPhone = {
  customer_name: 'Rahul Sharma',
  customer_phone: '12345',
  order_type: 'takeaway' as const,
  items: sampleItems,
};
const v4 = validateOrderPayload(invalidPhone);
if (v4.valid) throw new Error('Expected short phone to fail validation!');
console.log('✔ Invalid phone rejected properly:', v4.error);

// 7. Test Validation: Empty Cart (Must fail)
const emptyCart = {
  customer_name: 'Rahul Sharma',
  customer_phone: '9876543210',
  order_type: 'takeaway' as const,
  items: [],
};
const v5 = validateOrderPayload(emptyCart);
if (v5.valid) throw new Error('Expected empty cart to fail validation!');
console.log('✔ Empty cart rejected properly:', v5.error);

// 8. Test Demo Mode Order Submission
async function runAsyncTests() {
  console.log('\nTest 8: Demo mode order creation:');
  console.log('  isSupabaseConfigured:', isSupabaseConfigured);
  const result = await createOrder(validDineIn);
  console.log('  Order result:', result);
  if (!result.success || !result.orderRef) {
    throw new Error('createOrder failed in demo mode');
  }
  if (!isSupabaseConfigured && !result.isDemoMode) {
    throw new Error('Expected isDemoMode to be true when Supabase is unconfigured');
  }
  console.log('✔ createOrder demo mode resilience passed');

  console.log('\n=== ALL PHASE 1C TESTS PASSED SUCCESSFULLY! ===');
}

runAsyncTests().catch((e) => {
  console.error('Test failed:', e);
  process.exit(1);
});
