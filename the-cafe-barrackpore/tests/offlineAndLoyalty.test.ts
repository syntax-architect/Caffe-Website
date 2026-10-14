/**
 * Automated Verification Suite for Zero-Cost Features 2 & 3:
 * - Feature 2: Offline-First IndexedDB Order Queue & Auto-Sync
 * - Feature 3: Digital Loyalty Stamps & 1-Tap Google Review Retention
 */

import {
  enqueueOfflineOrder,
  getPendingOfflineOrders,
  getPendingOfflineCount,
  markOfflineOrderSynced,
} from '../src/utils/offlineQueue';

import {
  getLoyaltyProfile,
  awardOrderStamp,
  getGoogleReviewUrl,
} from '../src/utils/loyalty';

import type { CreateOrderPayload } from '../src/types/order';

async function runOfflineAndLoyaltyTests() {
  console.log('======================================================');
  console.log('🧪 RUNNING OFFLINE QUEUE & DIGITAL LOYALTY TEST SUITE');
  console.log('======================================================\n');

  // Mock localStorage for node test runner if needed
  if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (key: string) => store.get(key) || null,
      setItem: (key: string, val: string) => store.set(key, val),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
    };
  }

  // Mock window for dispatchEvent
  if (typeof globalThis.window === 'undefined') {
    (globalThis as any).window = {
      dispatchEvent: () => true,
    };
  }

  // --- FEATURE 2 TESTS: OFFLINE QUEUE ---
  console.log('Test 1: Enqueuing offline order into local resilient queue');
  const samplePayload: CreateOrderPayload = {
    order_ref: 'CB-2026-TEST-OFFLINE',
    customer_name: 'Rahul Sharma',
    customer_phone: '9876543210',
    order_type: 'dine_in',
    table_number: '05',
    items: [
      { id: 'latte', name: 'Signature Latte', price: 180, quantity: 2 },
    ],
  };

  const queued = await enqueueOfflineOrder(samplePayload, 'CB-2026-TEST-OFFLINE');
  if (queued.order_ref !== 'CB-2026-TEST-OFFLINE' || queued.status !== 'pending') {
    throw new Error('Failed to properly enqueue offline order!');
  }
  console.log('✔ Test 1 Passed: Order enqueued with status pending');

  console.log('\nTest 2: Verifying pending count & retrieval');
  const count = await getPendingOfflineCount();
  if (count < 1) {
    throw new Error(`Expected at least 1 pending offline order, found ${count}`);
  }
  const pendingList = await getPendingOfflineOrders();
  const found = pendingList.find((o) => o.order_ref === 'CB-2026-TEST-OFFLINE');
  if (!found) {
    throw new Error('Could not find queued offline order in retrieval list!');
  }
  console.log(`✔ Test 2 Passed: Found ${count} pending offline orders in local store`);

  console.log('\nTest 3: Marking offline order synced');
  await markOfflineOrderSynced('CB-2026-TEST-OFFLINE');
  const countAfter = await getPendingOfflineCount();
  if (countAfter !== count - 1) {
    throw new Error(`Expected count to decrease by 1, was ${count} now ${countAfter}`);
  }
  console.log('✔ Test 3 Passed: Offline order cleanly marked synced/cleared');

  // --- FEATURE 3 TESTS: DIGITAL LOYALTY & RETENTION ---
  console.log('\nTest 4: Initial loyalty profile lookup for new guest');
  const testPhone = '9876543210';
  const initialProfile = getLoyaltyProfile(testPhone);
  if (!initialProfile || initialProfile.stamps !== 0 || initialProfile.totalVisits !== 0) {
    throw new Error('New customer should start with 0 stamps and 0 visits!');
  }
  console.log('✔ Test 4 Passed: Clean zero-state loyalty profile created');

  console.log('\nTest 5: Awarding sequential loyalty stamps');
  // Order 1
  const r1 = awardOrderStamp(testPhone, 'Ananya Roy');
  if (r1.profile.stamps !== 1 || r1.profile.totalVisits !== 1 || r1.isNewRewardUnlocked) {
    throw new Error('Order 1 should result in 1 stamp with no reward!');
  }

  // Order 2, 3, 4
  awardOrderStamp(testPhone, 'Ananya Roy');
  awardOrderStamp(testPhone, 'Ananya Roy');
  const r4 = awardOrderStamp(testPhone, 'Ananya Roy');
  if (r4.profile.stamps !== 4 || r4.profile.totalVisits !== 4 || r4.isNewRewardUnlocked) {
    throw new Error('Order 4 should result in 4 stamps with no reward!');
  }
  console.log('✔ Test 5 Passed: Stamps 1 through 4 accumulated correctly');

  console.log('\nTest 6: 5-Stamp Milestone unlock & reward generation');
  const r5 = awardOrderStamp(testPhone, 'Ananya Roy');
  if (!r5.isNewRewardUnlocked) {
    throw new Error('Order 5 must trigger isNewRewardUnlocked === true!');
  }
  if (r5.profile.unlockedRewards.length !== 1) {
    throw new Error('Expected 1 unlocked reward milestone in customer profile!');
  }
  if (r5.profile.stamps !== 0) {
    throw new Error(`Expected stamps to rollover to 0 after 5 stamps, got ${r5.profile.stamps}`);
  }
  console.log('✔ Test 6 Passed: 5th visit unlocked Milestone Reward & rolled over stamp counter');

  console.log('\nTest 7: Google Review 1-Tap URL verification');
  const reviewUrl = getGoogleReviewUrl();
  if (!reviewUrl || (!reviewUrl.includes('google.com') && !reviewUrl.includes('http'))) {
    throw new Error(`Invalid Google Review URL generated: ${reviewUrl}`);
  }
  console.log('✔ Test 7 Passed: Valid Google Review target URL verified:', reviewUrl);

  console.log('\n======================================================');
  console.log('🎉 ALL OFFLINE RESILIENCE & LOYALTY TESTS PASSED (7/7)!');
  console.log('======================================================\n');
}

runOfflineAndLoyaltyTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
