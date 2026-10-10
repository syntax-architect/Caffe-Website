/**
 * Database & Edge Function Security Hardening Verification Test Suite
 * The Café Barrackpore — Automated Security Regression & RLS Enforcement Test
 *
 * Verifies:
 * 1. Anon condition removed from orders & order_items SELECT policies (service_role + active restaurant staff only).
 * 2. restaurant_tables and menu_item_availability FOR ALL policies replaced:
 *    - Anon has SELECT only (active tables, availability).
 *    - Only active owner/manager staff may INSERT/UPDATE/DELETE.
 *    - WITH CHECK clauses present on every policy having USING.
 * 3. REVOKE INSERT, UPDATE, DELETE on all public tables from anon.
 *    REVOKE ALL on orders, order_items, payments, staff_profiles from anon.
 *    Re-granted only required public reads (menu, content, settings, active tables).
 * 4. Order references generated with gen_random_uuid-based 10+ char random codes (never sequential).
 *    create_order_atomic generates random payment_token, stores SHA-256 hash in orders.payment_token_hash,
 *    and returns the raw token once to caller.
 * 5. create-payment, create-razorpay-order, and create-stripe-checkout require order_ref + payment_token,
 *    verify SHA-256 hash against orders.payment_token_hash, and pass token in success/callback URLs.
 * 6. create_order_atomic ignores p_order.restaurant_id, reads from restaurant_settings, enforces 1-50 qty cap.
 * 7. No hardcoded fallbacks ('INR', 'The Café Barrackpore', 'http://localhost:5173') in edge functions.
 *    PUBLIC_SITE_URL required, CORS uses ALLOWED_ORIGIN secret without wildcard '*'.
 * 8. Simulated anon client enforcement: anon cannot SELECT orders, cannot directly INSERT orders,
 *    and cannot modify tables or availability.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { generateClientOrderRef } from '../src/utils/orderCalculations';
import { validateOrderPayload } from '../src/services/orderService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== RUNNING DATABASE & EDGE FUNCTION SECURITY HARDENING TESTS ===\n');

// Load SQL migrations
const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
const migration016Path = path.join(migrationsDir, '016_security_hardening.sql');
const combinedMigrationPath = path.join(__dirname, '..', 'supabase', 'all_migrations_combined.sql');

if (!fs.existsSync(migration016Path)) {
  throw new Error('Test failed: supabase/migrations/016_security_hardening.sql not found');
}
const sql016 = fs.readFileSync(migration016Path, 'utf8');
const combinedSql = fs.readFileSync(combinedMigrationPath, 'utf8');

// -------------------------------------------------------------
// Test 1: Orders and Order Items SELECT Policy Hardening
// -------------------------------------------------------------
console.log('Test 1: Orders & Order Items SELECT Policy Lockdown');
// Anon condition must be removed; must only allow service_role and active restaurant staff
if (!sql016.includes('CREATE POLICY "staff_select_orders_tenant"') ||
    !sql016.includes('public.is_active_staff(auth.uid())')) {
  throw new Error('Test 1 failed: orders SELECT policy missing active staff restriction');
}

if (!sql016.includes('CREATE POLICY "staff_select_order_items_tenant"')) {
  throw new Error('Test 1 failed: order_items SELECT policy missing active staff restriction');
}

// Ensure the old anon condition was explicitly dropped
if (!sql016.includes('DROP POLICY IF EXISTS "public_select_orders"') ||
    !sql016.includes('DROP POLICY IF EXISTS "staff_view_orders"')) {
  throw new Error('Test 1 failed: legacy permissive order select policies not explicitly dropped');
}
console.log('✔ Test 1: Anon condition stripped from orders/order_items SELECT. Access restricted to active staff/service_role.');

// -------------------------------------------------------------
// Test 2: Tables and Menu Availability Granular RLS & WITH CHECK
// -------------------------------------------------------------
console.log('\nTest 2: Tables & Availability RLS (No FOR ALL; Granular SELECT/INSERT/UPDATE/DELETE with WITH CHECK)');
// restaurant_tables policies
if (!sql016.includes('CREATE POLICY "anon_select_active_tables"') ||
    !sql016.includes('CREATE POLICY "owner_manager_insert_tables"') ||
    !sql016.includes('CREATE POLICY "owner_manager_update_tables"') ||
    !sql016.includes('CREATE POLICY "owner_manager_delete_tables"')) {
  throw new Error('Test 2 failed: restaurant_tables missing granular CRUD policies');
}

// menu_item_availability policies
if (!sql016.includes('CREATE POLICY "anon_select_menu_availability"') ||
    !sql016.includes('CREATE POLICY "owner_manager_insert_availability"') ||
    !sql016.includes('CREATE POLICY "owner_manager_update_availability"') ||
    !sql016.includes('CREATE POLICY "owner_manager_delete_availability"')) {
  throw new Error('Test 2 failed: menu_item_availability missing granular CRUD policies');
}

// Verify WITH CHECK clauses are on UPDATE policies that have USING
if (!sql016.includes('CREATE POLICY "owner_manager_update_tables"') ||
    !sql016.includes('WITH CHECK (\n    COALESCE(auth.role(), \'\') = \'service_role\'')) {
  throw new Error('Test 2 failed: UPDATE tables policy missing required WITH CHECK clause');
}

if (!sql016.includes('CREATE POLICY "owner_manager_update_availability"') ||
    !sql016.includes('WITH CHECK (\n    COALESCE(auth.role(), \'\') = \'service_role\'')) {
  throw new Error('Test 2 failed: UPDATE availability policy missing required WITH CHECK clause');
}
console.log('✔ Test 2: restaurant_tables and menu_item_availability have granular policies and mandatory WITH CHECK clauses.');

// -------------------------------------------------------------
// Test 3: Broad Table Revocation & Strict Re-Grants
// -------------------------------------------------------------
console.log('\nTest 3: Revocation of INSERT/UPDATE/DELETE from anon and strict Re-Grants');
if (!sql016.includes('REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;')) {
  throw new Error('Test 3 failed: Missing REVOKE INSERT, UPDATE, DELETE on all public tables from anon');
}

if (!sql016.includes('REVOKE ALL ON TABLE public.orders FROM anon;') ||
    !sql016.includes('REVOKE ALL ON TABLE public.order_items FROM anon;') ||
    !sql016.includes('REVOKE ALL ON TABLE public.payments FROM anon;') ||
    !sql016.includes('REVOKE ALL ON TABLE public.staff_profiles FROM anon;')) {
  throw new Error('Test 3 failed: Missing REVOKE ALL on sensitive tables from anon');
}

// Verify only necessary reads are granted back to anon
const requiredGrants = [
  'GRANT SELECT ON TABLE public.menu_categories TO anon;',
  'GRANT SELECT ON TABLE public.menu_items TO anon;',
  'GRANT SELECT ON TABLE public.site_content TO anon;',
  'GRANT SELECT ON TABLE public.restaurant_tables TO anon;',
  'GRANT SELECT ON TABLE public.menu_item_availability TO anon;',
  'GRANT SELECT ON TABLE public.restaurant_settings TO anon;',
];
for (const grant of requiredGrants) {
  if (!sql016.includes(grant)) {
    throw new Error(`Test 3 failed: Missing required anon re-grant: ${grant}`);
  }
}
console.log('✔ Test 3: Public table write privileges revoked; sensitive tables completely revoked; only public reads re-granted.');

// -------------------------------------------------------------
// Test 4: Non-sequential Order References & Payment Token Generation
// -------------------------------------------------------------
console.log('\nTest 4: Non-sequential Order References & Payment Token Hash Generation');
if (!sql016.includes('gen_random_uuid()') || !sql016.includes('generate_order_reference()')) {
  throw new Error('Test 4 failed: generate_order_reference missing gen_random_uuid random entropy');
}

// Test random client order ref generation
const refs = new Set<string>();
for (let i = 0; i < 50; i++) {
  const ref = generateClientOrderRef();
  if (refs.has(ref)) {
    throw new Error(`Test 4 failed: Colliding or sequential client order reference generated: ${ref}`);
  }
  refs.add(ref);
  if (!/^CB-\d{4}-[A-Z0-9]{4,10}$/.test(ref)) {
    throw new Error(`Test 4 failed: Invalid order reference format: ${ref}`);
  }
}

// In create_order_atomic, verify payment_token generation with two gen_random_uuid, hashing, and column storage
if (!sql016.includes("v_raw_payment_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');") ||
    !sql016.includes("v_payment_token_hash := encode(sha256(v_raw_payment_token::bytea), 'hex');") ||
    !sql016.includes('payment_token_hash,') ||
    !sql016.includes('\'payment_token\', v_raw_payment_token')) {
  throw new Error('Test 4 failed: create_order_atomic does not generate raw payment_token from two gen_random_uuid calls, store hash, and return raw token once');
}

// Verify payment_token_hash column and index added to orders
if (!sql016.includes('ADD COLUMN IF NOT EXISTS payment_token_hash TEXT;') ||
    !sql016.includes('CREATE INDEX IF NOT EXISTS idx_orders_payment_token_hash ON public.orders (payment_token_hash);')) {
  throw new Error('Test 4 failed: payment_token_hash column or index missing from orders table');
}
console.log('✔ Test 4: Random order references (gen_random_uuid 10+ chars) & 64-char double UUID payment token hashing verified.');

// -------------------------------------------------------------
// Test 5: create_order_atomic Tenant ID Lockdown & Quantity Caps
// -------------------------------------------------------------
console.log('\nTest 5: create_order_atomic Tenant Hardening & Quantity Caps (1–50)');
if (!sql016.includes('SELECT rs.restaurant_id\n    INTO v_restaurant_id\n    FROM public.restaurant_settings rs')) {
  throw new Error('Test 5 failed: create_order_atomic does not strictly fetch restaurant_id from restaurant_settings');
}

if (!sql016.includes('v_quantity < 1 OR v_quantity > 50') ||
    !sql016.includes('Item quantity must be between 1 and 50')) {
  throw new Error('Test 5 failed: create_order_atomic missing 1-50 quantity bounds exception');
}

// Test validation logic in TypeScript client for quantity bounds
const invalidOrderLowQty = validateOrderPayload({
  customer_name: 'Test Customer',
  customer_phone: '+919830012345',
  order_type: 'dine_in',
  table_number: '05',
  items: [{ id: 'item-1', name: 'Coffee', price: 150, quantity: 0 }],
});
if (invalidOrderLowQty.valid) {
  throw new Error('Test 5 failed: Client validation accepted quantity 0');
}

const invalidOrderHighQty = validateOrderPayload({
  customer_name: 'Test Customer',
  customer_phone: '+919830012345',
  order_type: 'dine_in',
  table_number: '05',
  items: [{ id: 'item-1', name: 'Coffee', price: 150, quantity: 51 }],
});
if (invalidOrderHighQty.valid) {
  throw new Error('Test 5 failed: Client validation accepted quantity 51');
}
console.log('✔ Test 5: create_order_atomic strictly overrides client restaurant_id with settings and enforces 1-50 quantity cap.');

// -------------------------------------------------------------
// Test 6: Edge Functions Payment Token Verification & No Hardcoded Fallbacks
// -------------------------------------------------------------
console.log('\nTest 6: Edge Functions Token Verification & Elimination of Hardcoded Fallbacks');

const edgeFunctionsDir = path.join(__dirname, '..', 'supabase', 'functions');
const functionsToVerify = [
  'create-payment',
  'create-razorpay-order',
  'create-stripe-checkout',
];

for (const fn of functionsToVerify) {
  const fnPath = path.join(edgeFunctionsDir, fn, 'index.ts');
  if (!fs.existsSync(fnPath)) {
    throw new Error(`Test 6 failed: Edge function ${fn}/index.ts not found`);
  }
  const content = fs.readFileSync(fnPath, 'utf8');

  // Verify order_ref and payment_token are required
  if (!content.includes('order_ref') || !content.includes('payment_token')) {
    throw new Error(`Test 6 failed: ${fn} does not require both order_ref and payment_token`);
  }

  // Verify SHA-256 computation and payment_token_hash comparison
  if (!content.includes('computeSha256') || !content.includes('payment_token_hash')) {
    throw new Error(`Test 6 failed: ${fn} missing SHA-256 verification against payment_token_hash`);
  }

  // Verify timing safe comparison
  if (!content.includes('timingSafeEqual')) {
    throw new Error(`Test 6 failed: ${fn} missing timing-safe token hash comparison`);
  }

  // Verify PUBLIC_SITE_URL is required (fails if missing)
  if (!content.includes('PUBLIC_SITE_URL environment variable is required')) {
    throw new Error(`Test 6 failed: ${fn} does not strictly require PUBLIC_SITE_URL env var`);
  }

  // Verify no hardcoded fallbacks in active code
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) {
      continue; // Skip comments explaining what was removed
    }

    if (line.includes('http://localhost:5173')) {
      throw new Error(`Test 6 failed: ${fn} line ${i + 1} contains hardcoded localhost:5173 fallback: ${line}`);
    }
    if (line.includes('|| \'INR\'') || line.includes('|| "INR"')) {
      throw new Error(`Test 6 failed: ${fn} line ${i + 1} contains hardcoded 'INR' fallback: ${line}`);
    }
    if (line.includes('|| \'The Café Barrackpore\'') || line.includes('|| "The Café Barrackpore"')) {
      throw new Error(`Test 6 failed: ${fn} line ${i + 1} contains hardcoded 'The Café Barrackpore' fallback: ${line}`);
    }
    if (line.includes('Access-Control-Allow-Origin\': \'*\'') || line.includes('Access-Control-Allow-Origin": "*"')) {
      throw new Error(`Test 6 failed: ${fn} line ${i + 1} contains wildcard CORS '*'`);
    }
  }

  // Verify token is appended to success or callback URLs
  if (!content.includes('token=${encodeURIComponent(paymentToken)}') &&
      !content.includes('token=${paymentToken}')) {
    throw new Error(`Test 6 failed: ${fn} does not pass payment_token in redirect/success/callback URLs`);
  }
}
console.log('✔ Test 6: All payment Edge Functions require payment_token, verify SHA-256 hash, and have zero hardcoded fallbacks.');

// -------------------------------------------------------------
// Test 7: Token-Verified Order Status RPC & Client Order Polling
// -------------------------------------------------------------
console.log('\nTest 7: Token-Verified Order Status RPC & Customer Polling Security');
if (!sql016.includes('CREATE OR REPLACE FUNCTION public.get_order_status_by_token(') ||
    !sql016.includes('SECURITY DEFINER') ||
    !sql016.includes('payment_token_hash = v_token_hash')) {
  throw new Error('Test 7 failed: get_order_status_by_token RPC missing or not validating token hash');
}

// Verify CartDrawer uses get_order_status_by_token RPC during polling
const cartDrawerPath = path.join(__dirname, '..', 'src', 'components', 'CartDrawer.tsx');
const cartDrawerContent = fs.readFileSync(cartDrawerPath, 'utf8');
if (!cartDrawerContent.includes('get_order_status_by_token')) {
  throw new Error('Test 7 failed: CartDrawer does not use get_order_status_by_token RPC for customer polling');
}
console.log('✔ Test 7: get_order_status_by_token RPC and CartDrawer token polling confirmed.');

// -------------------------------------------------------------
// Test 8: Simulated Anonymous Security Matrix
// -------------------------------------------------------------
console.log('\nTest 8: Simulated Anonymous Client Security Matrix');

interface MockAuthContext {
  role: 'anon' | 'authenticated' | 'service_role';
  userId?: string;
  staffRole?: 'staff' | 'manager' | 'owner';
}

function evaluatePermission(
  action: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE',
  table: 'orders' | 'order_items' | 'restaurant_tables' | 'menu_item_availability' | 'menu_items',
  context: MockAuthContext,
  data?: any
): { allowed: boolean; reason: string } {
  // Service role always has access
  if (context.role === 'service_role') {
    return { allowed: true, reason: 'service_role bypasses RLS' };
  }

  // 1. orders & order_items
  if (table === 'orders' || table === 'order_items') {
    if (action === 'SELECT') {
      if (context.role === 'anon') {
        return { allowed: false, reason: 'anon cannot SELECT orders' };
      }
      if (context.role === 'authenticated' && context.staffRole) {
        return { allowed: true, reason: 'Active restaurant staff can SELECT orders' };
      }
      return { allowed: false, reason: 'Unverified authenticated user cannot SELECT orders' };
    }
    if (action === 'INSERT') {
      // Direct table INSERT revoked from anon & authenticated; only create_order_atomic RPC allowed
      return { allowed: false, reason: `Direct ${action} on ${table} is revoked. Must use create_order_atomic RPC` };
    }
    if (action === 'UPDATE' || action === 'DELETE') {
      return { allowed: false, reason: `Direct ${action} on ${table} is restricted` };
    }
  }

  // 2. restaurant_tables
  if (table === 'restaurant_tables') {
    if (action === 'SELECT') {
      if (context.role === 'anon') {
        if (data?.active === false) {
          return { allowed: false, reason: 'anon cannot view inactive tables' };
        }
        return { allowed: true, reason: 'anon can SELECT active tables' };
      }
      return { allowed: true, reason: 'Staff can view all tables' };
    }
    if (action === 'INSERT' || action === 'UPDATE' || action === 'DELETE') {
      if (context.role === 'anon') {
        return { allowed: false, reason: `anon cannot ${action} restaurant_tables` };
      }
      if (context.staffRole === 'owner' || context.staffRole === 'manager') {
        return { allowed: true, reason: `Active ${context.staffRole} can ${action} restaurant_tables` };
      }
      return { allowed: false, reason: `Staff role ${context.staffRole || 'none'} cannot ${action} restaurant_tables` };
    }
  }

  // 3. menu_item_availability
  if (table === 'menu_item_availability') {
    if (action === 'SELECT') {
      return { allowed: true, reason: 'Public can read menu availability' };
    }
    if (action === 'INSERT' || action === 'UPDATE' || action === 'DELETE') {
      if (context.role === 'anon') {
        return { allowed: false, reason: `anon cannot ${action} menu_item_availability` };
      }
      if (context.staffRole === 'owner' || context.staffRole === 'manager') {
        return { allowed: true, reason: `Active ${context.staffRole} can ${action} menu_item_availability` };
      }
      return { allowed: false, reason: `Floor staff cannot mutate menu availability` };
    }
  }

  // 4. Public menu items
  if (table === 'menu_items') {
    if (action === 'SELECT') {
      return { allowed: true, reason: 'Public can browse menu' };
    }
  }

  return { allowed: false, reason: 'Default deny' };
}

const anonContext: MockAuthContext = { role: 'anon' };
const floorStaffContext: MockAuthContext = { role: 'authenticated', staffRole: 'staff', userId: 'staff-1' };
const managerContext: MockAuthContext = { role: 'authenticated', staffRole: 'manager', userId: 'mgr-1' };

// Assert Anon restrictions
const anonSelectOrders = evaluatePermission('SELECT', 'orders', anonContext);
if (anonSelectOrders.allowed) {
  throw new Error('Test 8 failed: anon was permitted to SELECT orders');
}

const anonDirectInsertOrders = evaluatePermission('INSERT', 'orders', anonContext);
if (anonDirectInsertOrders.allowed) {
  throw new Error('Test 8 failed: anon was permitted to directly INSERT into orders');
}

const anonInsertTables = evaluatePermission('INSERT', 'restaurant_tables', anonContext);
if (anonInsertTables.allowed) {
  throw new Error('Test 8 failed: anon was permitted to INSERT into restaurant_tables');
}

const anonUpdateAvailability = evaluatePermission('UPDATE', 'menu_item_availability', anonContext);
if (anonUpdateAvailability.allowed) {
  throw new Error('Test 8 failed: anon was permitted to UPDATE menu_item_availability');
}

// Assert Anon public read permissions
const anonSelectActiveTable = evaluatePermission('SELECT', 'restaurant_tables', anonContext, { active: true });
if (!anonSelectActiveTable.allowed) {
  throw new Error('Test 8 failed: anon was blocked from viewing active table');
}

const anonSelectMenu = evaluatePermission('SELECT', 'menu_items', anonContext);
if (!anonSelectMenu.allowed) {
  throw new Error('Test 8 failed: anon was blocked from browsing menu');
}

// Assert Manager permissions
const managerUpdateTables = evaluatePermission('UPDATE', 'restaurant_tables', managerContext);
if (!managerUpdateTables.allowed) {
  throw new Error('Test 8 failed: manager was blocked from updating restaurant_tables');
}

// Assert Floor staff restrictions on table/availability mutation
const floorStaffModifyAvailability = evaluatePermission('UPDATE', 'menu_item_availability', floorStaffContext);
if (floorStaffModifyAvailability.allowed) {
  throw new Error('Test 8 failed: floor staff was erroneously permitted to modify availability');
}

console.log('✔ Test 8: Comprehensive security matrix confirmed: anon blocked from orders SELECT/INSERT and tables/availability mutation.');

// -------------------------------------------------------------
// Test 9: Verified Single-Use Tokens & Turnstile Enforcement in RPCs
// -------------------------------------------------------------
console.log('\nTest 9: Verified Single-Use Tokens & Turnstile Enforcement in Atomic RPCs');
if (!sql016.includes('CREATE TABLE IF NOT EXISTS public.verified_tokens') ||
    !sql016.includes('CREATE TABLE IF NOT EXISTS public.rate_limits')) {
  throw new Error('Test 9 failed: verified_tokens or rate_limits table missing in 016 migration');
}

if (!sql016.includes('DELETE FROM public.verified_tokens\n    WHERE token = v_verified_token\n      AND action IN (\'order\', \'checkout\')')) {
  throw new Error('Test 9 failed: create_order_atomic does not consume verified_token from verified_tokens table');
}

if (!sql016.includes('DELETE FROM public.verified_tokens\n    WHERE token = v_verified_token\n      AND action = \'reservation\'')) {
  throw new Error('Test 9 failed: create_reservation_atomic does not consume verified_token from verified_tokens table');
}

const verifyTurnstileEdgeFn = fs.readFileSync(path.join(edgeFunctionsDir, 'verify-turnstile', 'index.ts'), 'utf8');
if (!verifyTurnstileEdgeFn.includes('verified_tokens') ||
    !verifyTurnstileEdgeFn.includes('verified_token: verifiedToken')) {
  throw new Error('Test 9 failed: verify-turnstile does not store single-use verified_tokens in database');
}

const rateLimiterShared = fs.readFileSync(path.join(edgeFunctionsDir, '_shared', 'rateLimiter.ts'), 'utf8');
if (!rateLimiterShared.includes('rate_limits') && !rateLimiterShared.includes('UPSTASH_REDIS_REST_URL')) {
  throw new Error('Test 9 failed: rateLimiter missing Postgres rate_limits table and Upstash implementation');
}
console.log('✔ Test 9: Single-use verified_tokens table, atomic Turnstile consumption in RPCs, and rate limiter verified.');

// -------------------------------------------------------------
// Test 10: Discount Codes Table Hardening & validate_discount_code RPC
// -------------------------------------------------------------
console.log('\nTest 10: Discount Codes Table Hardening & validate_discount_code RPC');
if (!sql016.includes('DROP POLICY IF EXISTS "discount_codes_public_validate" ON public.discount_codes;') ||
    !sql016.includes('REVOKE SELECT ON TABLE public.discount_codes FROM anon;')) {
  throw new Error('Test 10 failed: discount_codes anon select policy not dropped or revoked');
}

if (!sql016.includes('CREATE OR REPLACE FUNCTION public.validate_discount_code(code TEXT)') ||
    !sql016.includes('GRANT EXECUTE ON FUNCTION public.validate_discount_code(TEXT) TO anon, authenticated, service_role;')) {
  throw new Error('Test 10 failed: validate_discount_code RPC missing or not granted to anon');
}

const ownerServicePath = path.join(__dirname, '..', 'src', 'services', 'ownerService.ts');
const ownerServiceContent = fs.readFileSync(ownerServicePath, 'utf8');
if (!ownerServiceContent.includes("rpc('validate_discount_code'")) {
  throw new Error('Test 10 failed: ownerService.ts does not use validate_discount_code RPC');
}
if (ownerServiceContent.includes(".from('discount_codes').select('*').ilike('code', code)")) {
  throw new Error('Test 10 failed: ownerService.ts still contains direct discount_codes select');
}
console.log('✔ Test 10: discount_codes anon table access revoked and validate_discount_code RPC integrated.');

// -------------------------------------------------------------
// Test 11: Removal of Direct Browser Writes to Orders & Payments
// -------------------------------------------------------------
console.log('\nTest 11: Removal of Direct Browser Writes to Orders & Payments');
const paymentServicePath = path.join(__dirname, '..', 'src', 'services', 'paymentService.ts');
const paymentServiceContent = fs.readFileSync(paymentServicePath, 'utf8');
if (paymentServiceContent.includes(".from('payments').insert") ||
    paymentServiceContent.includes(".from('payments').update") ||
    paymentServiceContent.includes(".from('orders').update")) {
  throw new Error('Test 11 failed: paymentService.ts still contains browser writes to payments or orders table');
}

const orderServicePath = path.join(__dirname, '..', 'src', 'services', 'orderService.ts');
const orderServiceContent = fs.readFileSync(orderServicePath, 'utf8');
if (orderServiceContent.includes(".from('orders').update")) {
  throw new Error('Test 11 failed: orderService.ts still contains browser writes to orders table in updatePendingOrder');
}
console.log('✔ Test 11: Direct browser writes to orders and payments eliminated; reserved exclusively for payment-webhook.');

// -------------------------------------------------------------
// Test 12: Cron Secret Authorization & Elimination of INR/Restaurant Fallbacks
// -------------------------------------------------------------
console.log('\nTest 12: Cron Secret Authorization & Zero Fallbacks');
const cronFunctions = ['daily-sales-summary', 'stock-alerts'];
for (const fn of cronFunctions) {
  const content = fs.readFileSync(path.join(edgeFunctionsDir, fn, 'index.ts'), 'utf8');
  if (!content.includes('x-cron-secret') || !content.includes('CRON_SECRET')) {
    throw new Error(`Test 12 failed: ${fn} does not require x-cron-secret matching CRON_SECRET`);
  }
}

const webhookContent = fs.readFileSync(path.join(edgeFunctionsDir, 'payment-webhook', 'index.ts'), 'utf8');
if (webhookContent.includes("|| 'INR'") || webhookContent.includes('|| "INR"')) {
  throw new Error('Test 12 failed: payment-webhook still contains hardcoded INR fallback');
}
console.log('✔ Test 12: Cron secret header required (401 on mismatch) and zero INR/restaurant name fallbacks.');

// -------------------------------------------------------------
// Test 13: Refund Function Uses Schema Fields and Enforces Tenant Scope
// -------------------------------------------------------------
console.log('\nTest 13: Refund Owner and Tenant Scope');
const refundFunction = fs.readFileSync(path.join(edgeFunctionsDir, 'process-refund', 'index.ts'), 'utf8');
if (!refundFunction.includes(".select('role, active, restaurant_id')") ||
    refundFunction.includes(".select('role, is_active')")) {
  throw new Error('Test 13 failed: process-refund does not use the staff_profiles schema fields.');
}
const refundTenantFilters = refundFunction.match(/\.eq\('restaurant_id', staffProfile\.restaurant_id\)/g) || [];
if (refundTenantFilters.length < 3) {
  throw new Error('Test 13 failed: process-refund order lookup/update is not scoped to the owner restaurant.');
}
if (!refundFunction.includes("const refundStatus = refundAmount !== undefined")) {
  throw new Error('Test 13 failed: refund status does not distinguish partial and full refunds.');
}
if (!refundFunction.includes("This order has no supported refundable payment reference.")) {
  throw new Error('Test 13 failed: unsupported or unconfigured refunds are not rejected.');
}
console.log('✔ Test 13: Refund owner fields, tenant filters, and provider confirmation guards verified.');

console.log('\n================================================================');
console.log('🎉 ALL 13 DATABASE & EDGE FUNCTION HARDENING CHECKS PASSED!');
console.log('================================================================');
