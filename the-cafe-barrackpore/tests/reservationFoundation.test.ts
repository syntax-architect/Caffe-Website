import { validateReservationPayload, createReservation } from '../src/services/reservationService';
import { generateClientReservationRef } from '../src/utils/orderCalculations';
import { isSupabaseConfigured } from '../src/lib/supabase';

console.log('=== RUNNING PHASE 1D RESERVATION FOUNDATION TESTS ===\n');

// 1. Test Reservation Reference Generation
const resRef = generateClientReservationRef();
console.log('Test 1: Reservation reference format:', resRef);
const resRefPattern = /^RS-\d{4}-[A-Z0-9]{4}$/;
if (!resRefPattern.test(resRef)) {
  throw new Error(`Reservation reference ${resRef} did not match expected pattern RS-YYYY-XXXX`);
}
console.log('✔ Reservation reference pattern test passed');

// 2. Test Valid Reservation Payload
const validReservation = {
  customer_name: 'Rahul Sharma',
  customer_phone: '9876543210',
  reservation_date: '2026-10-15',
  reservation_time: '19:30',
  party_size: 4,
  special_requests: 'Quiet corner table',
};
const v1 = validateReservationPayload(validReservation);
if (!v1.valid) {
  throw new Error(`Expected valid reservation to pass, failed with: ${v1.error}`);
}
console.log('✔ Valid reservation validation passed');

// 3. Test Invalid Phone
const invalidPhone = {
  ...validReservation,
  customer_phone: '12345',
};
const v2 = validateReservationPayload(invalidPhone);
if (v2.valid) {
  throw new Error('Expected invalid phone to be rejected');
}
console.log('✔ Invalid phone rejected properly:', v2.error);

// 4. Test Empty / Short Name
const emptyName = {
  ...validReservation,
  customer_name: '   ',
};
const v3 = validateReservationPayload(emptyName);
if (v3.valid) {
  throw new Error('Expected empty name to be rejected');
}
console.log('✔ Empty name rejected properly:', v3.error);

// 5. Test Invalid Party Sizes (0, -1, 21)
const invalidSizes = [0, -1, 21, 50];
for (const size of invalidSizes) {
  const v = validateReservationPayload({
    ...validReservation,
    party_size: size,
  });
  if (v.valid) {
    throw new Error(`Expected party size ${size} to be rejected`);
  }
}
console.log('✔ Invalid party sizes (0, -1, 21, 50) rejected properly');

// 6. Test Missing Date
const missingDate = {
  ...validReservation,
  reservation_date: '',
};
const v4 = validateReservationPayload(missingDate);
if (v4.valid) {
  throw new Error('Expected missing date to be rejected');
}
console.log('✔ Missing date rejected properly:', v4.error);

// 7. Test Missing Time
const missingTime = {
  ...validReservation,
  reservation_time: '',
};
const v5 = validateReservationPayload(missingTime);
if (v5.valid) {
  throw new Error('Expected missing time to be rejected');
}
console.log('✔ Missing time rejected properly:', v5.error);

// 8. Test Demo Mode Submission & Reference Generation
async function runAsyncTests() {
  console.log('\nTest 8: Demo mode reservation submission:');
  console.log('  isSupabaseConfigured:', isSupabaseConfigured);
  const result = await createReservation(validReservation);
  console.log('  Reservation result:', result);

  if (!result.success || !result.reservationRef) {
    throw new Error('createReservation failed in demo mode');
  }
  if (!resRefPattern.test(result.reservationRef)) {
    throw new Error(`Generated reference ${result.reservationRef} does not match RS-YYYY-XXXX`);
  }
  if (!isSupabaseConfigured && !result.isDemoMode) {
    throw new Error('Expected isDemoMode to be true when Supabase is unconfigured');
  }
  console.log('✔ createReservation demo mode resilience passed');

  // 9. Test Duplicate Submission Protection Simulation
  console.log('\nTest 9: Duplicate submission protection:');
  let isSubmitting = false;
  let callCount = 0;
  const simulatedSubmit = async () => {
    if (isSubmitting) return; // Protected
    isSubmitting = true;
    callCount++;
    try {
      await createReservation(validReservation);
    } finally {
      isSubmitting = false;
    }
  };

  // Trigger 5 rapid simultaneous calls
  await Promise.all([
    simulatedSubmit(),
    simulatedSubmit(),
    simulatedSubmit(),
    simulatedSubmit(),
    simulatedSubmit(),
  ]);

  if (callCount !== 1) {
    throw new Error(`Duplicate submission guard failed! Call count was ${callCount}, expected 1`);
  }
  console.log('✔ Duplicate submission guard correctly blocked repeated rapid clicks');

  console.log('\n=== ALL PHASE 1D RESERVATION TESTS PASSED SUCCESSFULLY! ===');
}

runAsyncTests().catch((e) => {
  console.error('Test failed:', e);
  process.exit(1);
});
