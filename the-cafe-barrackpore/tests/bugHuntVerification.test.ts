/**
 * Bug Hunt Session Verification Test Suite
 * The Café Barrackpore — Operational Edge-Case & Regression Tests
 */

import { calculateOrderTotals } from '../src/utils/orderCalculations';
import { createOrder } from '../src/services/orderService';
import {
  fetchDashboardOverview,
  fetchOrders,
  fetchOrderItems,
  updateOrderStatus,
  fetchReservations,
  updateReservationStatus,
  fetchRestaurantTables,
  saveRestaurantTable,
  fetchStaffProfiles,
  fetchRestaurantSettings,
  updateRestaurantSettings,
} from '../src/services/dashboardService';
import { setMenuItemAvailability, isItemAvailable } from '../src/services/menuAvailabilityService';

console.log('=== RUNNING BUG HUNT VERIFICATION TEST SUITE ===\n');

// -------------------------------------------------------------
// 1. Tax Calculation & Order Service Synchronization
// -------------------------------------------------------------
const mockCartItems = [
  {
    id: 'pizza-margherita',
    name: 'Margherita Pizza',
    price: 400,
    quantity: 2,
    category: 'Pizza',
  },
  {
    id: 'iced-latte',
    name: 'Iced Latte',
    price: 200,
    quantity: 1,
    category: 'Beverages',
  },
];

// Test exclusive tax (US NYC 8.875%)
const exclusiveTaxOptions = {
  enabled: true,
  mode: 'exclusive' as const,
  rate: 0.08875,
  label: 'NYC Sales Tax',
};

const clientTotals = calculateOrderTotals(mockCartItems, exclusiveTaxOptions);
if (clientTotals.subtotal !== 1000) {
  throw new Error(`Test 1 Failed: Expected subtotal 1000, got ${clientTotals.subtotal}`);
}
if (clientTotals.tax !== 88.75) {
  throw new Error(`Test 1 Failed: Expected tax 88.75, got ${clientTotals.tax}`);
}
if (clientTotals.total !== 1088.75) {
  throw new Error(`Test 1 Failed: Expected total 1088.75, got ${clientTotals.total}`);
}

// Pass tax_options to createOrder payload
const orderPayload = {
  customer_name: 'David Miller',
  customer_phone: '+12125551234',
  order_type: 'takeaway' as const,
  items: [
    {
      item_id: 'pizza-margherita',
      item_name: 'Margherita Pizza',
      quantity: 2,
      unit_price: 400,
      line_total: 800,
    },
    {
      item_id: 'iced-latte',
      item_name: 'Iced Latte',
      quantity: 1,
      unit_price: 200,
      line_total: 200,
    },
  ],
  tax_options: exclusiveTaxOptions,
};

const orderResult = await createOrder(orderPayload);
if (!orderResult.success) {
  throw new Error(`Test 1 Failed: createOrder did not succeed: ${orderResult.error}`);
}
console.log('✔ Test 1: Exclusive tax recalculation and order payload synchronization verified');

// -------------------------------------------------------------
// 2. 86'd Out of Stock Item Rejection in createOrder
// -------------------------------------------------------------
await setMenuItemAvailability('sold-out-cheesecake', false);
if (isItemAvailable('sold-out-cheesecake')) {
  throw new Error('Test 2 Failed: Item should be unavailable (86ed)');
}

const soldOutPayload = {
  customer_name: 'Sneha Sen',
  customer_phone: '9830111222',
  order_type: 'dine_in' as const,
  table_number: '04',
  items: [
    {
      item_id: 'sold-out-cheesecake',
      item_name: 'Cheesecake',
      quantity: 1,
      unit_price: 250,
      line_total: 250,
    },
  ],
};

const rejectResult = await createOrder(soldOutPayload);
if (rejectResult.success) {
  throw new Error('Test 2 Failed: Order with 86ed item was unexpectedly accepted');
}
if (!rejectResult.error?.includes('unavailable')) {
  throw new Error(`Test 2 Failed: Expected unavailable error message, got: ${rejectResult.error}`);
}
console.log('✔ Test 2: 86d item rejection in createOrder verified');
// Clean up
await setMenuItemAvailability('sold-out-cheesecake', true);

// -------------------------------------------------------------
// 3. Dashboard Service Demo Mode Operations
// -------------------------------------------------------------
async function testDashboardDemoMode() {
  const overview = await fetchDashboardOverview();
  if (overview.kpis.todayOrdersCount < 1) {
    throw new Error(`Test 3 Failed: Demo overview todayOrdersCount is ${overview.kpis.todayOrdersCount}`);
  }
  if (overview.recentOrders.length < 1) {
    throw new Error('Test 3 Failed: Demo overview recentOrders is empty');
  }
  console.log('✔ Test 3: Dashboard overview demo data verified');

  const orders = await fetchOrders();
  if (orders.length < 1) {
    throw new Error('Test 4 Failed: fetchOrders returned 0 demo orders');
  }
  const orderItems = await fetchOrderItems(orders[0].id);
  if (!Array.isArray(orderItems) || orderItems.length === 0) {
    throw new Error('Test 4 Failed: fetchOrderItems returned no items for demo order');
  }
  console.log('✔ Test 4: Demo orders & order items fetching verified');

  const statusUpdate = await updateOrderStatus(orders[0].id, 'completed');
  if (!statusUpdate.success) {
    throw new Error(`Test 5 Failed: updateOrderStatus failed: ${statusUpdate.error}`);
  }
  console.log('✔ Test 5: Demo order status transition verified');

  const reservations = await fetchReservations();
  if (reservations.length < 1) {
    throw new Error('Test 6 Failed: fetchReservations returned 0 demo reservations');
  }
  const resUpdate = await updateReservationStatus(reservations[0].id, 'seated');
  if (!resUpdate.success) {
    throw new Error(`Test 6 Failed: updateReservationStatus failed: ${resUpdate.error}`);
  }
  console.log('✔ Test 6: Demo reservations & status update verified');

  const tables = await fetchRestaurantTables();
  if (tables.length < 1) {
    throw new Error('Test 7 Failed: fetchRestaurantTables returned 0 tables');
  }
  const saveResult = await saveRestaurantTable({
    table_number: '99',
    label: 'Test Demo Table',
    capacity: 6,
  });
  if (!saveResult.success || !saveResult.table) {
    throw new Error('Test 7 Failed: saveRestaurantTable failed');
  }
  console.log('✔ Test 7: Demo floor table creation & retrieval verified');

  const staff = await fetchStaffProfiles();
  if (staff.length < 1) {
    throw new Error('Test 8 Failed: fetchStaffProfiles returned 0 demo staff');
  }
  console.log('✔ Test 8: Demo staff roster verified');

  const settings = await fetchRestaurantSettings();
  if (!settings.business_name) {
    throw new Error('Test 9 Failed: fetchRestaurantSettings returned invalid settings');
  }
  const updateSettingsResult = await updateRestaurantSettings({
    ...settings,
    announcement_banner: 'Updated Demo Banner Test',
  });
  if (!updateSettingsResult.success) {
    throw new Error('Test 9 Failed: updateRestaurantSettings failed');
  }
  console.log('✔ Test 9: Demo restaurant configuration update verified');

  console.log('\n=============================================================');
  console.log('🎉 ALL 9 BUG HUNT REGRESSION & VERIFICATION TESTS PASSED!');
  console.log('=============================================================\n');
}

testDashboardDemoMode().catch((err) => {
  console.error('Fatal Bug Hunt Test Failure:', err);
  process.exit(1);
});
