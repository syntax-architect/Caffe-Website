/**
 * Phase 1K: Commercial Production Readiness & Deployment Verification Test Suite
 * The Café Barrackpore — Client Deployment & Handover Foundation
 */

import { getPublicSiteOrigin, buildTableQrUrl } from '../src/utils/url';
import { sanitizeLogData, sanitizeCustomerError } from '../src/services/logger';
import { isSupabaseConfigured } from '../src/lib/supabase';
import { RESTAURANT_PRESETS, DEFAULT_RESTAURANT_CONFIG } from '../src/config/restaurantPresets';
import { isKdsEligible } from '../src/services/kitchenService';
import { validateAndCalculateOrderPayment } from '../src/services/paymentService';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== RUNNING PHASE 1K PRODUCTION READINESS TESTS ===\n');

// -------------------------------------------------------------
// 1. Authoritative URL & Origin Resolution
// -------------------------------------------------------------
const origin = getPublicSiteOrigin();
if (!origin || !origin.startsWith('http')) {
  throw new Error(`Test 1 failed: Invalid default site origin: "${origin}"`);
}
const qr07 = buildTableQrUrl('07');
const qr7 = buildTableQrUrl('7');
if (!qr07.endsWith('/qr?table=07') || !qr7.endsWith('/qr?table=07')) {
  throw new Error(`Test 1 failed: QR URL generation failed: "${qr07}" / "${qr7}"`);
}
console.log('✔ Test 1: Authoritative public URL & table QR builder verified');

// -------------------------------------------------------------
// 2. Sensitive Secret Log Sanitization
// -------------------------------------------------------------
const rawSecrets = {
  user: 'admin',
  password: 'superSecretPassword123',
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  api_key: 'sk_live_1234567890',
  service_role: 'secret_service_key',
  safeField: 'The Cafe Barrackpore',
  nested: {
    cvv: '123',
    card: '4111222233334444',
    orderTotal: 450,
  },
};

const sanitized = sanitizeLogData(rawSecrets) as any;
if (
  sanitized.password !== '[REDACTED]' ||
  sanitized.token !== '[REDACTED]' ||
  sanitized.api_key !== '[REDACTED]' ||
  sanitized.service_role !== '[REDACTED]' ||
  sanitized.nested.cvv !== '[REDACTED]' ||
  sanitized.nested.card !== '[REDACTED]' ||
  sanitized.safeField !== 'The Cafe Barrackpore' ||
  sanitized.nested.orderTotal !== 450
) {
  throw new Error(`Test 2 failed: Sensitive secret redaction was incomplete: ${JSON.stringify(sanitized)}`);
}
console.log('✔ Test 2: Sensitive secret logging sanitization verified');

// -------------------------------------------------------------
// 3. Customer Error Message Sanitization
// -------------------------------------------------------------
const technicalError1 = new Error('duplicate key value violates unique constraint "idx_orders_ref"');
const technicalError2 = new Error('PGRST116: JSON object requested, multiple (or no) rows returned');
const technicalError3 = new Error('connect ECONNREFUSED 127.0.0.1:5432');
const userFriendlyError = new Error('Please enter a valid 10-digit mobile number.');

const safe1 = sanitizeCustomerError(technicalError1);
const safe2 = sanitizeCustomerError(technicalError2);
const safe3 = sanitizeCustomerError(technicalError3);
const safeFriendly = sanitizeCustomerError(userFriendlyError);

if (safe1.includes('violates') || safe1.includes('constraint')) {
  throw new Error(`Test 3 failed: Technical SQL error leaked to customer: "${safe1}"`);
}
if (safe2.includes('PGRST116')) {
  throw new Error(`Test 3 failed: Internal Supabase PGRST error leaked to customer: "${safe2}"`);
}
if (safe3.includes('ECONNREFUSED')) {
  throw new Error(`Test 3 failed: Internal connection error leaked to customer: "${safe3}"`);
}
if (safeFriendly !== 'Please enter a valid 10-digit mobile number.') {
  throw new Error(`Test 3 failed: Valid user validation message altered: "${safeFriendly}"`);
}
console.log('✔ Test 3: Customer error message sanitization verified (zero SQL/stack trace leakage)');

// -------------------------------------------------------------
// 4. Combined Migration Chain Integrity (001 - 008)
// -------------------------------------------------------------
const combinedMigrationPath = path.join(__dirname, '..', 'supabase', 'all_migrations_combined.sql');
if (!fs.existsSync(combinedMigrationPath)) {
  throw new Error('Test 4 failed: all_migrations_combined.sql does not exist.');
}
const combinedSql = fs.readFileSync(combinedMigrationPath, 'utf8');

const requiredMigrationHeaders = [
  '001_initial_orders.sql',
  '002_reservations.sql',
  '003_staff_profiles.sql',
  '004_restaurant_tables.sql',
  '005_menu_availability.sql',
  '006_kitchen_realtime.sql',
  '007_internationalization.sql',
  '008_payment_architecture.sql',
];

for (const header of requiredMigrationHeaders) {
  if (!combinedSql.includes(header)) {
    throw new Error(`Test 4 failed: all_migrations_combined.sql missing ${header}`);
  }
}

// Verify critical security clauses in migrations
if (!combinedSql.includes('SECURITY DEFINER') || !combinedSql.includes('ENABLE ROW LEVEL SECURITY')) {
  throw new Error('Test 4 failed: Missing RLS or SECURITY DEFINER in combined migration.');
}
console.log('✔ Test 4: Combined migration chain integrity (001-008, RLS, RPC) verified');

// -------------------------------------------------------------
// 5. Environment Template Separation (.env.example)
// -------------------------------------------------------------
const envExamplePath = path.join(__dirname, '..', '.env.example');
if (!fs.existsSync(envExamplePath)) {
  throw new Error('Test 5 failed: .env.example does not exist.');
}
const envExampleContent = fs.readFileSync(envExamplePath, 'utf8');
const requiredClientVars = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_SANITY_PROJECT_ID'];
const requiredServerSecrets = ['SUPABASE_SERVICE_ROLE_KEY', 'SANITY_WRITE_TOKEN', 'STRIPE_SECRET_KEY', 'RAZORPAY_KEY_SECRET'];

for (const v of requiredClientVars) {
  if (!envExampleContent.includes(v)) {
    throw new Error(`Test 5 failed: .env.example missing client variable ${v}`);
  }
}
for (const s of requiredServerSecrets) {
  if (!envExampleContent.includes(s)) {
    throw new Error(`Test 5 failed: .env.example missing server secret documentation ${s}`);
  }
}
if (typeof isSupabaseConfigured !== 'boolean') {
  throw new Error('Test 5 failed: isSupabaseConfigured must be a boolean flag.');
}
console.log('✔ Test 5: Environment template separation verified (.env.example)');

// -------------------------------------------------------------
// 6. Hardcoded Port / Localhost Audit in HTML & Client Source
// -------------------------------------------------------------
const indexHtmlPath = path.join(__dirname, '..', 'index.html');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

if (indexHtml.includes('localhost:') || indexHtml.includes('127.0.0.1:')) {
  throw new Error('Test 6 failed: index.html contains hardcoded localhost/127.0.0.1 development ports.');
}
if (indexHtml.includes('caffe-website-6y9r.onrender.com')) {
  throw new Error('Test 6 failed: index.html contains temporary render test URL.');
}
console.log('✔ Test 6: Zero hardcoded development URLs or staging domains in index.html');

// -------------------------------------------------------------
// 7. Restaurant Configuration Completeness Across All Presets
// -------------------------------------------------------------
const presets = ['IN', 'US', 'GB', 'AE', 'CA', 'AU'];
for (const p of presets) {
  const cfg = RESTAURANT_PRESETS[p];
  if (!cfg) throw new Error(`Test 7 failed: Missing preset ${p}`);
  if (!cfg.currency || !cfg.locale || !cfg.timezone || !cfg.taxLabel || !cfg.taxMode) {
    throw new Error(`Test 7 failed: Preset ${p} has incomplete configuration.`);
  }
  if (!cfg.paymentProvider || !cfg.paymentMode) {
    throw new Error(`Test 7 failed: Preset ${p} missing payment provider configuration.`);
  }
}
if (!DEFAULT_RESTAURANT_CONFIG.businessName || !DEFAULT_RESTAURANT_CONFIG.payments) {
  throw new Error('Test 7 failed: DEFAULT_RESTAURANT_CONFIG is incomplete.');
}
console.log('✔ Test 7: International restaurant configuration completeness verified');

// -------------------------------------------------------------
// 8. KDS Payment Safety Enforced
// -------------------------------------------------------------
if (isKdsEligible({ id: '1', order_ref: 'CB-1', payment_status: 'pending' }) !== false) {
  throw new Error('Test 8 failed: KDS allowed unpaid pending order into kitchen!');
}
if (isKdsEligible({ id: '2', order_ref: 'CB-2', payment_status: 'failed' }) !== false) {
  throw new Error('Test 8 failed: KDS allowed failed payment order into kitchen!');
}
if (isKdsEligible({ id: '3', order_ref: 'CB-3', payment_status: 'paid' }) !== true) {
  throw new Error('Test 8 failed: KDS rejected paid order!');
}
if (isKdsEligible({ id: '4', order_ref: 'CB-4', payment_status: 'not_required' }) !== true) {
  throw new Error('Test 8 failed: KDS rejected pay-at-counter order!');
}
console.log('✔ Test 8: KDS payment eligibility guard verified');

// -------------------------------------------------------------
// 9. Server Price Integrity & Tampering Resistance
// -------------------------------------------------------------
async function runAsyncTests() {
  const tampered = await validateAndCalculateOrderPayment(
    [{ id: 'hot-and-sour-soup', quantity: 1, price: 5 }],
    { enabled: false },
    5 // client claims 5
  );
  if (tampered.valid) {
    throw new Error('Test 9 failed: Price tampering check bypassed!');
  }
  console.log('✔ Test 9: Server price integrity and tampering defense verified');

  console.log('\n=== ALL PHASE 1K PRODUCTION READINESS TESTS PASSED (9/9)! ===');
}

runAsyncTests().catch((err) => {
  console.error('\n✖ TEST FAILED:', err);
  process.exit(1);
});
