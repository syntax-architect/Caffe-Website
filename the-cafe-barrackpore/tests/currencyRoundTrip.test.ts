import assert from 'node:assert';
import {
  toMinorUnits,
  fromMinorUnits,
  toMajorUnits,
  getCurrencyMultiplier,
  getCurrencyDecimalDigits
} from '../src/utils/currencyMinorUnits';

console.log('--- Running Currency-Aware Round-Trip Tests (JPY, KWD, USD) ---');

// 1. JPY (Japanese Yen - Zero Decimal Currency: multiplier 1, decimals 0)
console.log('\nTesting JPY (Zero-decimal)...');
assert.strictEqual(getCurrencyMultiplier('JPY'), 1);
assert.strictEqual(getCurrencyDecimalDigits('JPY'), 0);

const jpyAmounts = [1, 50, 250, 1500, 99999, 125000];
for (const amt of jpyAmounts) {
  const minor = toMinorUnits(amt, 'JPY');
  assert.strictEqual(minor, amt, `JPY minor units for ${amt} should equal ${amt}`);
  const major = fromMinorUnits(minor, 'JPY');
  assert.strictEqual(major, amt, `JPY major units round-trip for ${amt} failed`);
}
// Rounding for JPY: 1250.4 -> 1250, 1250.6 -> 1251
assert.strictEqual(toMinorUnits(1250.4, 'JPY'), 1250);
assert.strictEqual(toMinorUnits(1250.6, 'JPY'), 1251);
console.log('✔ JPY tests passed: zero-decimal conversions exact without drift.');

// 2. KWD (Kuwaiti Dinar - Three Decimal Currency: multiplier 1000, decimals 3)
console.log('\nTesting KWD (Three-decimal)...');
assert.strictEqual(getCurrencyMultiplier('KWD'), 1000);
assert.strictEqual(getCurrencyDecimalDigits('KWD'), 3);

const kwdAmounts = [0.001, 0.050, 0.250, 1.500, 12.345, 99.999, 125.750];
for (const amt of kwdAmounts) {
  const minor = toMinorUnits(amt, 'KWD');
  assert.strictEqual(minor, Math.round(amt * 1000), `KWD minor units for ${amt} should equal ${Math.round(amt * 1000)}`);
  const major = fromMinorUnits(minor, 'KWD');
  assert.strictEqual(major, amt, `KWD major units round-trip for ${amt} failed`);
}
// Rounding for KWD: 5.2504 -> 5250 fils, 5.2506 -> 5251 fils
assert.strictEqual(toMinorUnits(5.2504, 'KWD'), 5250);
assert.strictEqual(toMinorUnits(5.2506, 'KWD'), 5251);
console.log('✔ KWD tests passed: three-decimal conversions exact without drift.');

// 3. USD (US Dollar - Two Decimal Currency: multiplier 100, decimals 2)
console.log('\nTesting USD (Two-decimal)...');
assert.strictEqual(getCurrencyMultiplier('USD'), 100);
assert.strictEqual(getCurrencyDecimalDigits('USD'), 2);

const usdAmounts = [0.01, 0.50, 1.99, 19.99, 49.50, 120.75, 999.99];
for (const amt of usdAmounts) {
  const minor = toMinorUnits(amt, 'USD');
  assert.strictEqual(minor, Math.round(amt * 100), `USD minor units for ${amt} should equal ${Math.round(amt * 100)}`);
  const major = fromMinorUnits(minor, 'USD');
  assert.strictEqual(major, amt, `USD major units round-trip for ${amt} failed`);
}
// Rounding for USD: 19.994 -> 1999 cents, 19.996 -> 2000 cents
assert.strictEqual(toMinorUnits(19.994, 'USD'), 1999);
assert.strictEqual(toMinorUnits(19.996, 'USD'), 2000);
console.log('✔ USD tests passed: two-decimal conversions exact without drift.');

// 4. Test toMajorUnits alias parity
for (const curr of ['JPY', 'KWD', 'USD'] as const) {
  const testVal = curr === 'JPY' ? 1500 : curr === 'KWD' ? 1.5 : 15.0;
  const minor = toMinorUnits(testVal, curr);
  const major1 = fromMinorUnits(minor, curr);
  const major2 = toMajorUnits(minor, curr);
  assert.strictEqual(major1, major2, `Parity check between fromMinorUnits and toMajorUnits failed for ${curr}`);
}
console.log('✔ toMajorUnits parity check passed.');

console.log('\n=============================================================');
console.log('ALL ROUND-TRIP TESTS (JPY, KWD, USD) COMPLETED SUCCESSFULLY!');
console.log('=============================================================\n');
