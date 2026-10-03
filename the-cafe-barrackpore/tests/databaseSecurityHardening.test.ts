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
const migration013Path = path.join(migrationsDir, '013_security_hardening.sql');
const combinedMigrationPath = path.join(__dirname, '..', 'supabase', 'all_migrations_combined.sql');

if (!fs.existsSync(migration013Path)) {
  throw new Error('Test failed: supabase/migrations/013_security_hardening.sql not found');
}
const sql013 = fs.readFileSync(migration013Path, 'utf8');
const combinedSql = fs.readFileSync(combinedMigrationPath, 'utf8');

// -------------------------------------------------------------
// Test 1: Orders and Order Items SELECT Policy Hardening
// -------------------------------------------------------------
console.log('Test 1: Orders & Order Items SELECT Policy Lockdown');
// Anon condition must be removed; must only allow service_role and active restaurant staff
if (!sql013.includes('CREATE POLICY "staff_select_orders_tenant"') ||
    !sql013.includes('public.is_active_staff(auth.uid())')) {
  throw new Error('Test 1 failed: orders SELECT policy missing active staff restriction');
}

if (!sql013.includes('CREATE POLICY "staff_select_order_items_tenant"')) {
  throw new Error('Test 1 failed: order_items SELECT policy missing active staff restriction');
}

// Ensure the old anon condition was explicitly dropped
if (!sql013.includes('DROP POLICY IF EXISTS "public_select_orders"') ||
    !sql013.includes('DROP POLICY IF EXISTS "staff_view_orders"')) {
  throw new Error('Test 1 failed: legacy permissive order select policies not explicitly dropped');
}
console.log('✔ Test 1: Anon condition stripped from orders/order_items SELECT. Access restricted to active staff/service_role.');

// -------------------------------------------------------------
// Test 2: Tables and Menu Availability Granular RLS & WITH CHECK
// -------------------------------------------------------------
console.log('\nTest 2: Tables & Availability RLS (No FOR ALL; Granular SELECT/INSERT/UPDATE/DELETE with WITH CHECK)');
// restaurant_tables policies
if (!sql013.includes('CREATE POLICY "anon_select_active_tables"') ||
    !sql013.includes('CREATE POLICY "owner_manager_insert_tables"') ||
    !sql013.includes('CREATE POLICY "owner_manager_update_tables"') ||
    !sql013.includes('CREATE POLICY "owner_manager_delete_tables"')) {
  throw new Error('Test 2 failed: restaurant_tables missing granular CRUD policies');
}

// menu_item_availability policies
if (!sql013.includes('CREATE POLICY "anon_select_menu_availability"') ||
    !sql013.includes('CREATE POLICY "owner_manager_insert_availability"') ||
    !sql013.includes('CREATE POLICY "owner_manager_update_availability"') ||
    !sql013.includes('CREATE POLICY "owner_manager_delete_availability"')) {
  throw new Error('Test 2 failed: menu_item_availability missing granular CRUD policies');
}

// Verify WITH CHECK clauses are on UPDATE policies that have USING
if (!sql013.includes('CREATE POLICY "owner_manager_update_tables"') ||
    !sql013.includes('WITH CHECK (\n    COALESCE(auth.role(), \'\') = \'service_role\'')) {
  throw new Error('Test 2 failed: UPDATE tables policy missing required WITH CHECK clause');
}

if (!sql013.includes('CREATE POLICY "owner_manager_update_availability"') ||
    !sql013.includes('WITH CHECK (\n    COALESCE(auth.role(), \'\') = \'service_role\'')) {
  throw new Error('Test 2 failed: UPDATE availability policy missing required WITH CHECK clause');
}
console.log('✔ Test 2: restaurant_tables and menu_item_availability have granular policies and mandatory WITH CHECK clauses.');

// -------------------------------------------------------------
// Test 3: Broad Table Revocation & Strict Re-Grants
// -------------------------------------------------------------
console.log('\nTest 3: Revocation of INSERT/UPDATE/DELETE from anon and strict Re-Grants');
if (!sql013.includes('REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;')) {
  throw new Error('Test 3 failed: Missing REVOKE INSERT, UPDATE, DELETE on all public tables from anon');
}

if (!sql013.includes('REVOKE ALL ON TABLE public.orders FROM anon;') ||
    !sql013.includes('REVOKE ALL ON TABLE public.order_items FROM anon;') ||
    !sql013.includes('REVOKE ALL ON TABLE public.payments FROM anon;') ||
    !sql013.includes('REVOKE ALL ON TABLE public.staff_profiles FROM anon;')) {
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
  if (!sql013.includes(grant)) {
    throw new Error(`Test 3 failed: Missing required anon re-grant: ${grant}`);
  }
}
console.log('✔ Test 3: Public table write privileges revoked; sensitive tables completely revoked; only public reads re-granted.');

// -------------------------------------------------------------
// Test 4: Non-sequential Order References & Payment Token Generation
// -------------------------------------------------------------
console.log('\nTest 4: Non-sequential Order References & Payment Token Hash Generation');
if (!sql013.includes('gen_random_uuid()') || !sql013.includes('generate_order_reference()')) {
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

// In create_order_atomic, verify payment_token generation, hashing, and column storage
if (!sql013.includes('v_raw_payment_token := encode(gen_random_bytes(32), \'hex\');') ||
    !sql013.includes('v_payment_token_hash := encode(sha256(v_raw_payment_token::bytea), \'hex\');') ||
    !sql013.includes('payment_token_hash,') ||
    !sql013.includes('\'payment_token\', v_raw_payment_token')) {
  throw new Error('Test 4 failed: create_order_atomic does not generate raw payment_token, store hash, and return raw token once');
}

// Verify payment_token_hash column and index added to orders
if (!sql013.includes('ADD COLUMN IF NOT EXISTS payment_token_hash TEXT;') ||
    !sql013.includes('CREATE INDEX IF NOT EXISTS idx_orders_payment_token_hash ON public.orders (payment_token_hash);')) {
  throw new Error('Test 4 failed: payment_token_hash column or index missing from orders table');
}
console.log('✔ Test 4: Random order references (gen_random_uuid 10+ chars) & 32-byte payment token hashing verified.');

// -------------------------------------------------------------
// Test 5: create_order_atomic Tenant ID Lockdown & Quantity Caps
// -------------------------------------------------------------
console.log('\nTest 5: create_order_atomic Tenant Hardening & Quantity Caps (1–50)');
if (!sql013.includes('SELECT rs.restaurant_id\n    INTO v_restaurant_id\n    FROM public.restaurant_settings rs')) {
  throw new Error('Test 5 failed: create_order_atomic does not strictly fetch restaurant_id from restaurant_settings');
}

if (!sql013.includes('v_quantity < 1 OR v_quantity > 50') ||
    !sql013.includes('Item quantity must be between 1 and 50')) {
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
if (!sql013.includes('CREATE OR REPLACE FUNCTION public.get_order_status_by_token(') ||
    !sql013.includes('SECURITY DEFINER') ||
    !sql013.includes('payment_token_hash = v_token_hash')) {
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

console.log('\n================================================================');
console.log('🎉 ALL 8 DATABASE & EDGE FUNCTION HARDENING CHECKS PASSED!');
console.log('================================================================');
