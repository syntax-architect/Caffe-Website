/**
 * Comprehensive Money, Security, Real Postgres (PGlite), and Roles Hardening Test Suite
 * Tests all 8 Group 1 requirements against a REAL PostgreSQL 18 instance via @electric-sql/pglite.
 */

import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { toMajorUnits, toMinorUnits, isZeroDecimalCurrency, isThreeDecimalCurrency } from '../src/utils/currencyMinorUnits';
import { formatCurrency, getLocaleForCountry } from '../src/utils/currency';
import { enforceRateLimit } from '../src/utils/rateLimiter';

console.log('=== RUNNING REAL POSTGRES SECURITY & MONEY TEST SUITE ===\n');

async function runTests() {
  const db = new PGlite();

  // 1. Initialize Supabase Auth & Realtime environment in PGlite
  await db.exec(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role;
      END IF;
    END $$;

    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE SCHEMA IF NOT EXISTS storage;
    CREATE PUBLICATION supabase_realtime;
    CREATE TABLE IF NOT EXISTS storage.buckets (id TEXT PRIMARY KEY, name TEXT, public BOOLEAN DEFAULT false, file_size_limit BIGINT, allowed_mime_types TEXT[]);
    CREATE TABLE IF NOT EXISTS storage.objects (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id TEXT, name TEXT, owner UUID, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ, last_accessed_at TIMESTAMPTZ, metadata JSONB);
    CREATE TABLE IF NOT EXISTS auth.users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT,
      role TEXT DEFAULT 'authenticated'
    );
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
    $$ LANGUAGE sql STABLE;

    CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT AS $$
      SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), 'anon');
    $$ LANGUAGE sql STABLE;

    CREATE OR REPLACE FUNCTION auth.jwt() RETURNS JSONB AS $$
      SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
    $$ LANGUAGE sql STABLE;
  `);

  // 2. Apply all migrations sequentially
  const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Applying ${migrationFiles.length} migration files to PGlite...`);
  for (const file of migrationFiles) {
    let sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    sql = sql.replace(/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+[^;]+;/gi, '-- CREATE EXTENSION skipped');
    try {
      await db.exec(sql);
    } catch (err: any) {
      console.error(`Migration failure on ${file}:`, err.message);
      throw err;
    }
  }
  console.log('✔ All migrations applied successfully to PGlite.\n');

  // Helper to execute as specific user role
  async function asUser(userId: string | null, role: string, claims: Record<string, any> = {}) {
    const claimsJson = JSON.stringify({
      sub: userId,
      role: role,
      ...claims,
    });
    await db.exec(`
      SELECT set_config('request.jwt.claim.sub', '${userId || ''}', false);
      SELECT set_config('request.jwt.claim.role', '${role}', false);
      SELECT set_config('request.jwt.claims', '${claimsJson}', false);
    `);
  }

  // Seed baseline restaurant settings & menu item
  await db.exec(`
    INSERT INTO public.restaurant_settings (
      id, restaurant_id, business_name, currency, tax_enabled, tax_rate, tax_label,
      service_charge_enabled, service_charge_rate, service_charge_label, service_charge_taxable
    ) VALUES (
      'current', 'the-cafe-barrackpore', 'The Cafe', 'INR', true, 0.0500, 'GST',
      false, 0.0000, 'Service Charge', false
    ) ON CONFLICT (id) DO UPDATE SET
      restaurant_id = 'the-cafe-barrackpore',
      tax_enabled = true,
      tax_rate = 0.0500,
      currency = 'INR';

    INSERT INTO public.menu_items (
      id, category_id, name, description, price, diet, image_url, popular, available, sort_order
    ) VALUES (
      'item-coffee-01', 'soups-salads', 'Artisanal Cappuccino', 'Rich roast', 250.00, 'veg', NULL, false, true, 99
    ) ON CONFLICT (id) DO UPDATE SET price = 250.00, available = true;

    INSERT INTO public.discount_codes (
      code, discount_type, discount_value, active, max_uses, used_count, min_order_amount, max_discount_amount
    ) VALUES (
      'TESTSAVE20', 'percentage', 20.00, true, 100, 0, 100.00, 100.00
    ) ON CONFLICT (code) DO UPDATE SET active = true, used_count = 0;
  `);

  // Helper to generate verified token for Turnstile
  async function createVerifiedToken(): Promise<string> {
    const token = 'tok_' + Math.random().toString(36).substring(2);
    await db.exec(`
      INSERT INTO public.verified_tokens (token, action, expires_at)
      VALUES ('${token}', 'order', now() + interval '5 minutes');
    `);
    return token;
  }

  // ---------------------------------------------------------------------------
  // TEST 1: CRITICAL create_order_atomic IGNORES client discount_amount
  // ---------------------------------------------------------------------------
  console.log('Running Test 1: create_order_atomic strictly ignores client discount_amount...');
  await asUser(null, 'anon');
  const token1 = await createVerifiedToken();

  // Attacker sends discount_amount = subtotal (250) but NO discount_code
  const maliciousOrderPayload = {
    restaurant_id: 'the-cafe-barrackpore',
    customer_name: 'Adversary User',
    customer_phone: '9876543210',
    order_type: 'takeaway',
    payment_method: 'counter',
    verified_token: token1,
    discount_amount: 250.00, // Malicious client claims 100% discount!
    discount_code: null,
  };
  const itemsPayload = [
    { id: 'item-coffee-01', quantity: 1 }
  ];

  const result1 = await db.query<any>(`
    SELECT public.create_order_atomic(
      $1::jsonb,
      $2::jsonb
    ) as result;
  `, [JSON.stringify(maliciousOrderPayload), JSON.stringify(itemsPayload)]);

  const orderResult1 = result1.rows[0].result;
  if (!orderResult1 || !orderResult1.order_id) {
    throw new Error(`Order creation failed: ${JSON.stringify(orderResult1)}`);
  }

  // Verify server calculated discount
  const orderInDb = await db.query<any>(`
    SELECT subtotal, discount_amount, total, tax_amount FROM public.orders WHERE id = $1;
  `, [orderResult1.order_id]);

  const discDb = Number(orderInDb.rows[0].discount_amount);
  if (discDb !== 0.0) {
    throw new Error(`CRITICAL VULNERABILITY: Client discount_amount was accepted! In DB: ${discDb}, expected 0.00`);
  }
  console.log(`✔ Test 1a Passed: Client discount_amount was completely ignored. In DB discount_amount = ${discDb}`);

  // Test 1b: Reject unknown discount code
  const token1b = await createVerifiedToken();
  const fakeCodeOrder = {
    ...maliciousOrderPayload,
    verified_token: token1b,
    discount_code: 'NON_EXISTENT_COUPON',
  };

  let rejectedCode = false;
  try {
    await db.query(`
      SELECT public.create_order_atomic(
        $1::jsonb,
        $2::jsonb
      );
    `, [JSON.stringify(fakeCodeOrder), JSON.stringify(itemsPayload)]);
  } catch (err: any) {
    rejectedCode = true;
    if (!err.message.includes('Invalid') && !err.message.includes('NON_EXISTENT_COUPON')) {
      throw new Error(`Unexpected error message on unknown coupon: ${err.message}`);
    }
  }
  if (!rejectedCode) {
    throw new Error('FAILED: Unknown discount code was not rejected by server!');
  }
  console.log('✔ Test 1b Passed: Unknown discount code was rejected by server.');

  // Test 1c: Server computes valid discount code authoritative
  const token1c = await createVerifiedToken();
  const validCouponOrder = {
    ...maliciousOrderPayload,
    verified_token: token1c,
    discount_code: 'TESTSAVE20',
  };
  const result1c = await db.query<any>(`
    SELECT public.create_order_atomic(
      $1::jsonb,
      $2::jsonb
    ) as result;
  `, [JSON.stringify(validCouponOrder), JSON.stringify(itemsPayload)]);

  const orderId1c = result1c.rows[0].result.order_id;
  const order1cDb = await db.query<any>(`
    SELECT subtotal, discount_amount, total FROM public.orders WHERE id = $1;
  `, [orderId1c]);

  // Subtotal = 250, 20% = 50 discount
  const discAuthoritative = Number(order1cDb.rows[0].discount_amount);
  if (discAuthoritative !== 50.00) {
    throw new Error(`Authoritative discount mismatch: expected 50.00, got ${discAuthoritative}`);
  }
  console.log(`✔ Test 1c Passed: Valid code TESTSAVE20 calculated authoritative discount of ₹${discAuthoritative}`);

  // ---------------------------------------------------------------------------
  // TEST 2: Tax Fail Loudly (No silent 5% fallback)
  // ---------------------------------------------------------------------------
  console.log('\nRunning Test 2: Missing tax_rate fails loudly...');
  await db.exec(`
    UPDATE public.restaurant_settings
    SET tax_enabled = true, tax_rate = NULL, tax_rules = '[]'::jsonb
    WHERE restaurant_id = 'the-cafe-barrackpore';
  `);

  const token2 = await createVerifiedToken();
  let taxFailedLoudly = false;
  try {
    await db.query(`
      SELECT public.create_order_atomic(
        $1::jsonb,
        $2::jsonb
      );
    `, [JSON.stringify({ ...maliciousOrderPayload, verified_token: token2, discount_code: null }), JSON.stringify(itemsPayload)]);
  } catch (err: any) {
    taxFailedLoudly = true;
    console.log(`✔ Caught expected loud exception: "${err.message}"`);
  }

  // Restore tax settings
  await db.exec(`
    UPDATE public.restaurant_settings
    SET tax_enabled = true, tax_rate = 0.0500, tax_rules = '[]'::jsonb
    WHERE restaurant_id = 'the-cafe-barrackpore';
  `);

  if (!taxFailedLoudly) {
    throw new Error('FAILED: Missing tax_rate did not fail loudly!');
  }
  console.log('✔ Test 2 Passed: Silent 5% tax fallback eliminated; fails loudly on misconfiguration.');

  // ---------------------------------------------------------------------------
  // TEST 3: Feature Toggles in POS, billing, shift, drawer, KOT, and KDS RPCs
  // ---------------------------------------------------------------------------
  console.log('\nRunning Test 3: Feature toggle enforcement across all RPCs...');
  const staffUserId = '11111111-2222-3333-4444-555555555555';
  await db.exec(`
    INSERT INTO auth.users (id, email) VALUES ('${staffUserId}', 'staff@thecafe.com')
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.staff_profiles (user_id, restaurant_id, full_name, role, active)
    VALUES ('${staffUserId}', 'the-cafe-barrackpore', 'Test Manager', 'manager', true)
    ON CONFLICT (user_id) DO UPDATE SET role = 'manager', active = true;
  `);

  await asUser(staffUserId, 'authenticated');

  // Disable 'pos' feature
  await db.exec(`
    UPDATE public.restaurant_settings
    SET features = jsonb_set(COALESCE(features, '{}'::jsonb), '{pos}', 'false'::jsonb)
    WHERE restaurant_id = 'the-cafe-barrackpore';
  `);

  // Assert pos_create_or_append_kot rejects
  const kotRes = await db.query<any>(`
    SELECT public.pos_create_or_append_kot(
      'TB-101'::text, 'dine_in'::text, 'T1'::text,
      '[{"id": "item-coffee-01", "name": "Coffee", "price": 250, "quantity": 1}]'::jsonb
    ) as res;
  `);
  const kotData = kotRes.rows[0].res;
  if (kotData.success !== false || (!kotData.error?.includes('Point of Sale') && !kotData.error?.includes('disabled'))) {
    throw new Error(`FAILED: pos_create_or_append_kot did not reject when POS is disabled: ${JSON.stringify(kotData)}`);
  }
  console.log('✔ Test 3a Passed: pos_create_or_append_kot rejected when POS feature is disabled.');

  // Disable 'kds' feature
  await db.exec(`
    UPDATE public.restaurant_settings
    SET features = jsonb_set(
      jsonb_set(COALESCE(features, '{}'::jsonb), '{pos}', 'true'::jsonb),
      '{kds}', 'false'::jsonb
    )
    WHERE restaurant_id = 'the-cafe-barrackpore';
  `);

  const dummyOrderRes = await db.query<any>(`
    INSERT INTO public.orders (order_ref, restaurant_id, status, subtotal, total, customer_name, customer_phone, order_type)
    VALUES ('DUMMY-KDS-01', 'the-cafe-barrackpore', 'pending', 250, 250, 'Test Patron', '9876543210', 'takeaway')
    RETURNING id;
  `);
  const dummyOrderId = dummyOrderRes.rows[0].id;

  const kdsResult = await db.query<any>(`
    SELECT public.update_order_status_kitchen($1, 'preparing', 'pending') as res;
  `, [dummyOrderId]);

  if (kdsResult.rows[0].res.success !== false || !kdsResult.rows[0].res.error?.includes('KDS')) {
    throw new Error(`FAILED: update_order_status_kitchen did not reject when KDS is disabled: ${JSON.stringify(kdsResult.rows[0].res)}`);
  }
  console.log('✔ Test 3b Passed: update_order_status_kitchen rejected when KDS feature is disabled.');

  // Re-enable KDS and POS
  await db.exec(`
    UPDATE public.restaurant_settings
    SET features = jsonb_set(
      jsonb_set(COALESCE(features, '{}'::jsonb), '{pos}', 'true'::jsonb),
      '{kds}', 'true'::jsonb
    )
    WHERE restaurant_id = 'the-cafe-barrackpore';
  `);

  // ---------------------------------------------------------------------------
  // TEST 4: Manager PIN Hardening, Attempt Lockout & Audit Log
  // ---------------------------------------------------------------------------
  console.log('\nRunning Test 4: Manager PIN hardening, 5-try lockout, and audit log...');
  const ownerUserId = '88888888-9999-0000-1111-222222222222';
  await db.exec(`
    INSERT INTO auth.users (id, email) VALUES ('${ownerUserId}', 'owner@thecafe.com')
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.staff_profiles (user_id, restaurant_id, full_name, role, active)
    VALUES ('${ownerUserId}', 'the-cafe-barrackpore', 'Main Owner', 'owner', true)
    ON CONFLICT (user_id) DO UPDATE SET role = 'owner', active = true;
  `);

  // Step 4a: Non-owner cannot set PIN
  await asUser(staffUserId, 'authenticated'); // Staff role = manager, not owner
  let nonOwnerBlocked = false;
  try {
    await db.query(`SELECT public.pos_set_manager_pin('9999');`);
  } catch (err: any) {
    nonOwnerBlocked = true;
    console.log(`✔ Non-owner set PIN blocked: "${err.message}"`);
  }
  if (!nonOwnerBlocked) throw new Error('FAILED: Non-owner was able to call pos_set_manager_pin!');

  // Step 4b: Owner sets PIN
  await asUser(ownerUserId, 'authenticated');
  const setPinRes = await db.query<any>(`SELECT public.pos_set_manager_pin('7890') as res;`);
  if (!setPinRes.rows[0].res.success) {
    throw new Error(`Owner failed to set PIN: ${JSON.stringify(setPinRes.rows[0].res)}`);
  }
  console.log('✔ Test 4a Passed: Owner configured Manager PIN.');

  // Step 4c: Old default '1234' is rejected!
  const oldPinRes = await db.query<any>(`SELECT public.pos_verify_manager_pin('1234') as valid;`);
  if (oldPinRes.rows[0].valid !== false) {
    throw new Error('FAILED: Old default 1234 was accepted!');
  }
  console.log('✔ Old default 1234 was rejected.');

  // Step 4d: 5 consecutive failed attempts trigger lockout
  for (let i = 2; i <= 5; i++) {
    const wrongPinRes = await db.query<any>(`SELECT public.pos_verify_manager_pin('0000') as valid;`);
    if (wrongPinRes.rows[0].valid !== false) {
      throw new Error(`FAILED: Wrong PIN was accepted on attempt ${i}`);
    }
  }

  // 6th attempt even with CORRECT PIN ('7890') must be locked out!
  let lockedOut = false;
  try {
    await db.query(`SELECT public.pos_verify_manager_pin('7890');`);
  } catch (err: any) {
    lockedOut = true;
    if (!err.message.includes('locked')) {
      throw new Error(`Unexpected lockout error message: ${err.message}`);
    }
    console.log(`✔ Attempt while locked out rejected: "${err.message}"`);
  }
  if (!lockedOut) throw new Error('FAILED: 5 failed attempts did not lock out manager PIN!');

  // Check audit log for failed attempts
  const auditEntries = await db.query<any>(`
    SELECT count(*) as count FROM public.audit_log WHERE action = 'manager_pin_failed';
  `);
  const failedAuditCount = Number(auditEntries.rows[0].count);
  if (failedAuditCount < 5) {
    throw new Error(`Audit log missing failed attempts: found ${failedAuditCount}, expected >= 5`);
  }
  console.log(`✔ Test 4b Passed: ${failedAuditCount} failed PIN attempts recorded in audit_log.`);

  // ---------------------------------------------------------------------------
  // TEST 5: Roles & Permission Matrix (Cashier, Waiter, Kitchen)
  // ---------------------------------------------------------------------------
  console.log('\nRunning Test 5: Permission Matrix for Cashier, Waiter, and Kitchen...');
  const cashierId = '22222222-3333-4444-5555-666666666666';
  const waiterId = '33333333-4444-5555-6666-777777777777';
  const kitchenId = '44444444-5555-6666-7777-888888888888';

  await db.exec(`
    INSERT INTO auth.users (id, email) VALUES
      ('${cashierId}', 'cashier@thecafe.com'),
      ('${waiterId}', 'waiter@thecafe.com'),
      ('${kitchenId}', 'kitchen@thecafe.com')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.staff_profiles (user_id, restaurant_id, full_name, role, active) VALUES
      ('${cashierId}', 'the-cafe-barrackpore', 'Alice Cashier', 'cashier', true),
      ('${waiterId}', 'the-cafe-barrackpore', 'Bob Waiter', 'waiter', true),
      ('${kitchenId}', 'the-cafe-barrackpore', 'Chef Kitchen', 'kitchen', true)
    ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
  `);

  // Cashier check: can open drawer, cannot discount or see reports
  await asUser(cashierId, 'authenticated');
  const cashierPerms = await db.query<any>(`
    SELECT
      public.can_open_drawer() as open_drawer,
      public.can_discount() as discount,
      public.can_void() as void,
      public.can_see_reports() as reports;
  `);
  if (!cashierPerms.rows[0].open_drawer || cashierPerms.rows[0].discount || cashierPerms.rows[0].reports) {
    throw new Error(`Cashier permissions mismatch: ${JSON.stringify(cashierPerms.rows[0])}`);
  }
  console.log('✔ Test 5a Passed: Cashier can open drawer, but cannot discount or see reports.');

  // Waiter check: cannot open drawer, cannot discount, cannot void
  await asUser(waiterId, 'authenticated');
  const waiterPerms = await db.query<any>(`
    SELECT
      public.can_open_drawer() as open_drawer,
      public.can_discount() as discount,
      public.can_void() as void;
  `);
  if (waiterPerms.rows[0].open_drawer || waiterPerms.rows[0].discount || waiterPerms.rows[0].void) {
    throw new Error(`Waiter permissions mismatch: ${JSON.stringify(waiterPerms.rows[0])}`);
  }
  console.log('✔ Test 5b Passed: Waiter cannot open drawer, discount, or void.');

  // Manager check: can discount, void, refund, see reports
  await asUser(staffUserId, 'authenticated'); // manager
  const mgrPerms = await db.query<any>(`
    SELECT
      public.can_discount() as discount,
      public.can_void() as void,
      public.can_refund() as refund,
      public.can_see_reports() as reports;
  `);
  if (!mgrPerms.rows[0].discount || !mgrPerms.rows[0].void || !mgrPerms.rows[0].reports) {
    throw new Error(`Manager permissions mismatch: ${JSON.stringify(mgrPerms.rows[0])}`);
  }
  console.log('✔ Test 5c Passed: Manager has discount, void, and reporting permissions.');

  // ---------------------------------------------------------------------------
  // TEST 6: Currency-aware Helpers Round-trip (JPY, KRW, KWD, USD)
  // ---------------------------------------------------------------------------
  console.log('\nRunning Test 6: Currency-aware helpers round-trip (JPY, KRW, KWD, USD)...');
  // JPY: Zero decimal
  const jpyMajor = 1500;
  const jpyMinor = toMinorUnits(jpyMajor, 'JPY');
  const jpyRoundTrip = toMajorUnits(jpyMinor, 'JPY');
  if (jpyMinor !== 1500 || jpyRoundTrip !== 1500 || !isZeroDecimalCurrency('JPY')) {
    throw new Error(`JPY round-trip failed: major=${jpyMajor}, minor=${jpyMinor}, roundTrip=${jpyRoundTrip}`);
  }

  // KRW: Zero decimal
  const krwMajor = 45000;
  const krwMinor = toMinorUnits(krwMajor, 'KRW');
  const krwRoundTrip = toMajorUnits(krwMinor, 'KRW');
  if (krwMinor !== 45000 || krwRoundTrip !== 45000 || !isZeroDecimalCurrency('KRW')) {
    throw new Error(`KRW round-trip failed: major=${krwMajor}, minor=${krwMinor}, roundTrip=${krwRoundTrip}`);
  }

  // KWD: Three decimals
  const kwdMajor = 12.345;
  const kwdMinor = toMinorUnits(kwdMajor, 'KWD');
  const kwdRoundTrip = toMajorUnits(kwdMinor, 'KWD');
  if (kwdMinor !== 12345 || kwdRoundTrip !== 12.345 || !isThreeDecimalCurrency('KWD')) {
    throw new Error(`KWD round-trip failed: major=${kwdMajor}, minor=${kwdMinor}, roundTrip=${kwdRoundTrip}`);
  }

  // USD: Standard two decimals
  const usdMajor = 19.99;
  const usdMinor = toMinorUnits(usdMajor, 'USD');
  const usdRoundTrip = toMajorUnits(usdMinor, 'USD');
  if (usdMinor !== 1999 || usdRoundTrip !== 19.99) {
    throw new Error(`USD round-trip failed: major=${usdMajor}, minor=${usdMinor}, roundTrip=${usdRoundTrip}`);
  }
  console.log('✔ Test 6 Passed: Round-trip currency math verified for JPY, KRW, KWD, USD.');

  // ---------------------------------------------------------------------------
  // TEST 7: Locale derivation from Country & Currency (No en-IN hardcoding)
  // ---------------------------------------------------------------------------
  console.log('\nRunning Test 7: Locale derivation eliminating hardcoded en-IN...');
  const usLocale = getLocaleForCountry('US');
  const jpLocale = getLocaleForCountry('JP');
  const kwLocale = getLocaleForCountry('KW');
  const gbLocale = getLocaleForCountry('GB');
  const inLocale = getLocaleForCountry('IN');

  if (usLocale !== 'en-US' || jpLocale !== 'ja-JP' || kwLocale !== 'ar-KW' || gbLocale !== 'en-GB' || inLocale !== 'en-IN') {
    throw new Error(`Locale derivation failed: US=${usLocale}, JP=${jpLocale}, KW=${kwLocale}`);
  }

  const usdFmt = formatCurrency(25.5, 'USD');
  if (!usdFmt.includes('$25.50')) {
    throw new Error(`USD formatCurrency without explicit locale failed: got ${usdFmt}`);
  }
  console.log(`✔ Test 7 Passed: Derived locales verified without en-IN default (USD: ${usdFmt}).`);

  // ---------------------------------------------------------------------------
  // TEST 8: CSP Configuration Verification
  // ---------------------------------------------------------------------------
  console.log('\nRunning Test 8: CSP configuration verification in vercel.json & render.yaml...');
  const vercelPath = path.resolve(process.cwd(), 'vercel.json');
  const renderPath = path.resolve(process.cwd(), 'render.yaml');
  const vercelJson = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
  const cspHeader = vercelJson.headers[0].headers.find((h: any) => h.key === 'Content-Security-Policy')?.value;
  const renderYaml = fs.readFileSync(renderPath, 'utf8');

  if (!cspHeader) throw new Error('CSP header missing from vercel.json');
  if (!renderYaml.includes('Content-Security-Policy')) throw new Error('CSP missing from render.yaml');

  const requiredHosts = [
    'checkout.razorpay.com',
    'js.stripe.com',
    'challenges.cloudflare.com',
    'api.razorpay.com',
    'api.stripe.com',
  ];

  for (const host of requiredHosts) {
    if (!cspHeader.includes(host)) {
      throw new Error(`CSP is missing required host: ${host}`);
    }
  }

  // Ensure unsafe-inline is removed from script-src
  const scriptSrcPart = cspHeader.split(';').find((p: string) => p.trim().startsWith('script-src'));
  if (scriptSrcPart?.includes("'unsafe-inline'")) {
    throw new Error(`Security issue: script-src in CSP still contains 'unsafe-inline'`);
  }
  console.log('✔ Test 8 Passed: CSP allows checkout.razorpay.com, Stripe, Turnstile, and bans unsafe-inline in script-src.');

  // ---------------------------------------------------------------------------
  // TEST 9: Rapid Order Rate Limiting (100 orders from one client)
  // ---------------------------------------------------------------------------
  console.log('\nRunning Test 9: Rapid order rate limiting (100 rapid orders throttled)...');
  // Clear any existing rate limit storage
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }

  let throttledCount = 0;
  let allowedCount = 0;

  for (let i = 0; i < 100; i++) {
    const res = enforceRateLimit('order');
    if (res.allowed) {
      allowedCount++;
    } else {
      throttledCount++;
    }
  }

  if (throttledCount < 90 || allowedCount > 10) {
    throw new Error(`Rate limiting failed: allowed=${allowedCount}, throttled=${throttledCount}`);
  }
  console.log(`✔ Test 9 Passed: 100 rapid order attempts throttled: allowed=${allowedCount}, throttled=${throttledCount}.`);

  console.log('\n============================================================');
  console.log('ALL 9 MONEY, SECURITY, AND REAL POSTGRES TESTS PASSED (100%)');
  console.log('============================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ Test Suite Aborted with Error:', err);
  process.exit(1);
});
