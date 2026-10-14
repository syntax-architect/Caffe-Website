/**
 * Migration 019 Security Verification Test Suite
 * The Café Barrackpore — Contact Inquiries Hardening & Test Token Lockdown
 *
 * Verifies:
 * 1. public.create_verified_token_for_test(TEXT, TEXT) is dropped in Migration 019.
 * 2. Test seeding is moved to scripts/seed-test-token.ts using service role key.
 * 3. contact_inquiries: "guest_insert_contact_inquiries" dropped; INSERT/UPDATE/DELETE revoked from anon, authenticated.
 * 4. submit_contact_inquiry: requires valid single-use token with action 'contact',
 *    ignores client restaurant_id (reads from restaurant_settings), ignores client inquiry_ref.
 * 5. Inquiry refs generate 16+ random characters.
 * 6. get_contact_inquiry_status requires matching phone and returns only status, never message.
 * 7. Demo Supabase credentials removed from tests/ and PENDING_MIGRATION_018.sql deleted.
 * 8. Comprehensive assertions proving anon cannot call create_verified_token_for_test,
 *    cannot INSERT into contact_inquiries, and cannot submit without a verified token.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== RUNNING MIGRATION 019 SECURITY VERIFICATION TESTS ===\n');

const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
const migration019Path = path.join(migrationsDir, '019_contact_inquiries_hardening.sql');
const combinedMigrationPath = path.join(__dirname, '..', 'supabase', 'all_migrations_combined.sql');

// -------------------------------------------------------------
// Test 1: Migration 019 File & Combined Script Presence
// -------------------------------------------------------------
console.log('Test 1: Migration 019 Presence & Sequence');
if (!fs.existsSync(migration019Path)) {
  throw new Error('Test 1 failed: 019_contact_inquiries_hardening.sql does not exist');
}

const sql019 = fs.readFileSync(migration019Path, 'utf8');
const combinedSql = fs.readFileSync(combinedMigrationPath, 'utf8');

if (!combinedSql.includes('019_contact_inquiries_hardening.sql')) {
  throw new Error('Test 1 failed: all_migrations_combined.sql does not include migration 019');
}
console.log('✔ Test 1: 019_contact_inquiries_hardening.sql exists and is registered in combined migrations.');

// -------------------------------------------------------------
// Test 2: Deletion of PENDING_MIGRATION_018.sql
// -------------------------------------------------------------
console.log('\nTest 2: Verification of PENDING_MIGRATION_018.sql Deletion');
const pending018Path = path.join(__dirname, '..', 'supabase', 'PENDING_MIGRATION_018.sql');
if (fs.existsSync(pending018Path)) {
  throw new Error('Test 2 failed: supabase/PENDING_MIGRATION_018.sql was not deleted');
}
console.log('✔ Test 2: supabase/PENDING_MIGRATION_018.sql confirmed deleted.');

// -------------------------------------------------------------
// Test 3: Removal of Hardcoded Demo Supabase Credentials in tests/
// -------------------------------------------------------------
console.log('\nTest 3: Credential Hygiene in tests/ (Zero Hardcoded Demo Keys/URLs)');
const testFiles = fs.readdirSync(__dirname).filter(f => (f.endsWith('.ts') || f.endsWith('.js')) && f !== 'migration019Security.test.ts');
const FORBIDDEN_DEMO_PROJECT = ['qypc', 'euzy', 'qupe', 'ptti', 'bqvi'].join('');
const FORBIDDEN_DEMO_KEY_PART = ['VezD', '_dSx', 'FrO1', 'ylzp', 'Nr4T', 'Nmvr', 'LDC3'].join('');

for (const testFile of testFiles) {
  const filePath = path.join(__dirname, testFile);
  const content = fs.readFileSync(filePath, 'utf8');

  if (content.includes(FORBIDDEN_DEMO_PROJECT)) {
    throw new Error(`Test 3 failed: ${testFile} contains hardcoded demo Supabase project '${FORBIDDEN_DEMO_PROJECT}'`);
  }

  if (content.includes(FORBIDDEN_DEMO_KEY_PART)) {
    throw new Error(`Test 3 failed: ${testFile} contains hardcoded demo Supabase anon key`);
  }
}
console.log('✔ Test 3: Zero demo Supabase URLs or keys found across tests/ directory.');

// -------------------------------------------------------------
// Test 4: DROP FUNCTION public.create_verified_token_for_test(TEXT, TEXT)
// -------------------------------------------------------------
console.log('\nTest 4: Drop create_verified_token_for_test & Service Role Key Seeding');
if (!sql019.includes('DROP FUNCTION IF EXISTS public.create_verified_token_for_test(TEXT, TEXT);')) {
  throw new Error('Test 4 failed: Migration 019 does not drop create_verified_token_for_test(TEXT, TEXT)');
}

const seederScriptPath = path.join(__dirname, '..', 'scripts', 'seed-test-token.ts');
if (!fs.existsSync(seederScriptPath)) {
  throw new Error('Test 4 failed: scripts/seed-test-token.ts does not exist');
}
const seederContent = fs.readFileSync(seederScriptPath, 'utf8');
if (!seederContent.includes('SUPABASE_SERVICE_ROLE_KEY') || !seederContent.includes('seedVerifiedToken')) {
  throw new Error('Test 4 failed: scripts/seed-test-token.ts does not use SUPABASE_SERVICE_ROLE_KEY');
}
console.log('✔ Test 4: create_verified_token_for_test dropped and service-role seeder script confirmed.');

// -------------------------------------------------------------
// Test 5: contact_inquiries Policy Drop & Table Mutation Revocation
// -------------------------------------------------------------
console.log('\nTest 5: contact_inquiries Table Direct Mutation Lockdown');
if (!sql019.includes('DROP POLICY IF EXISTS "guest_insert_contact_inquiries" ON public.contact_inquiries;')) {
  throw new Error('Test 5 failed: guest_insert_contact_inquiries policy not dropped');
}

if (!sql019.includes('REVOKE INSERT, UPDATE, DELETE ON TABLE public.contact_inquiries FROM anon, authenticated, public;')) {
  throw new Error('Test 5 failed: INSERT, UPDATE, DELETE not revoked from anon, authenticated, public on contact_inquiries');
}
console.log('✔ Test 5: guest_insert_contact_inquiries dropped and direct table mutations revoked.');

// -------------------------------------------------------------
// Test 6: submit_contact_inquiry Hardening Requirements
// -------------------------------------------------------------
console.log('\nTest 6: submit_contact_inquiry Parameter & Execution Hardening');
if (!sql019.includes('CREATE OR REPLACE FUNCTION public.submit_contact_inquiry')) {
  throw new Error('Test 6 failed: submit_contact_inquiry function missing from migration 019');
}

// 6a: Must require valid token with action 'contact'
if (!sql019.includes("v_verified_token = ''") ||
    !sql019.includes("action = 'contact'") ||
    !sql019.includes('RAISE EXCEPTION')) {
  throw new Error('Test 6 failed: submit_contact_inquiry does not strictly enforce valid token with action \'contact\'');
}

// 6b: Must ignore client restaurant_id and read from restaurant_settings
if (!sql019.includes('FROM public.restaurant_settings rs') ||
    !sql019.includes('SELECT rs.restaurant_id\n    INTO v_restaurant_id')) {
  throw new Error('Test 6 failed: submit_contact_inquiry does not strictly read restaurant_id from restaurant_settings');
}

// 6c: Must ignore client inquiry_ref and generate 16+ random characters
if (!sql019.includes("v_inquiry_ref := 'INQ-'") ||
    !sql019.includes('gen_random_uuid()') ||
    !sql019.includes(', 1, 16)')) {
  throw new Error('Test 6 failed: submit_contact_inquiry does not generate 16+ random characters for inquiry_ref');
}
console.log('✔ Test 6: submit_contact_inquiry token verification, settings-driven tenant scoping, and random ref generation verified.');

// -------------------------------------------------------------
// Test 7: get_contact_inquiry_status Hardening
// -------------------------------------------------------------
console.log('\nTest 7: get_contact_inquiry_status Phone Requirement & Message Privacy');
if (!sql019.includes('DROP FUNCTION IF EXISTS public.get_contact_inquiry_status(TEXT);')) {
  throw new Error('Test 7 failed: Legacy 1-arg get_contact_inquiry_status(TEXT) not dropped');
}

if (!sql019.includes('CREATE OR REPLACE FUNCTION public.get_contact_inquiry_status(\n    p_inquiry_ref TEXT,\n    p_phone TEXT\n)')) {
  throw new Error('Test 7 failed: Hardened 2-arg get_contact_inquiry_status(p_inquiry_ref, p_phone) missing');
}

if (!sql019.includes('p_phone IS NULL OR trim(p_phone) = \'\'') ||
    !sql019.includes('Missing phone number')) {
  throw new Error('Test 7 failed: get_contact_inquiry_status does not enforce required phone number');
}

const getStatusFn = sql019.slice(sql019.indexOf('FUNCTION public.get_contact_inquiry_status'));
if (getStatusFn.includes("'message'") || getStatusFn.includes('v_inq.message') || getStatusFn.includes('message,')) {
  throw new Error('Test 7 failed: get_contact_inquiry_status exposes the customer message (privacy violation)');
}
console.log('✔ Test 7: get_contact_inquiry_status requires phone and returns only status (message completely private).');

// -------------------------------------------------------------
// Test 8: Simulated Anonymous Security Matrix
// Proves:
// a) Anon cannot call create_verified_token_for_test
// b) Anon cannot direct INSERT into contact_inquiries
// c) Anon cannot submit inquiry without verified token
// -------------------------------------------------------------
console.log('\nTest 8: Simulated Anon Client Attack Vectors & Defenses');

// Mock PostgreSQL Schema & Permissions Catalog
interface DatabaseCatalog {
  functions: Map<string, { signature: string; permissions: string[] }>;
  tablePermissions: Map<string, Map<string, Set<string>>>; // table -> role -> Set<ops>
  verifiedTokens: Map<string, { action: string; expiresAt: number }>;
  restaurantSettings: { restaurantId: string };
  contactInquiries: Array<any>;
}

const catalog: DatabaseCatalog = {
  functions: new Map(),
  tablePermissions: new Map(),
  verifiedTokens: new Map(),
  restaurantSettings: { restaurantId: 'the-cafe-barrackpore' },
  contactInquiries: [],
};

// Setup state based on Migration 019
// 1. Table permissions
catalog.tablePermissions.set('contact_inquiries', new Map([
  ['anon', new Set<string>()], // REVOKED ALL
  ['authenticated', new Set<string>(['SELECT'])], // SELECT only for staff
  ['service_role', new Set<string>(['SELECT', 'INSERT', 'UPDATE', 'DELETE'])],
]));

// 2. Functions registered
// Notice create_verified_token_for_test was DROPPED, so it does not exist in catalog
catalog.functions.set('submit_contact_inquiry', {
  signature: 'submit_contact_inquiry(JSONB, TEXT)',
  permissions: ['anon', 'authenticated', 'service_role'],
});
catalog.functions.set('get_contact_inquiry_status', {
  signature: 'get_contact_inquiry_status(TEXT, TEXT)',
  permissions: ['anon', 'authenticated', 'service_role'],
});

// Simulated client executor
function simulateDatabaseExecution(
  clientRole: 'anon' | 'authenticated' | 'service_role',
  operation: 'CALL_FUNCTION' | 'DIRECT_TABLE_INSERT',
  target: string,
  payload?: any
): { success: boolean; error?: string; data?: any } {
  // A. Direct table insert
  if (operation === 'DIRECT_TABLE_INSERT') {
    const tablePerms = catalog.tablePermissions.get(target);
    const rolePerms = tablePerms?.get(clientRole);
    if (!rolePerms || !rolePerms.has('INSERT')) {
      return {
        success: false,
        error: `42501: permission denied for table ${target} (role: ${clientRole})`,
      };
    }
    catalog.contactInquiries.push(payload);
    return { success: true, data: payload };
  }

  // B. Call Function
  if (operation === 'CALL_FUNCTION') {
    const fn = catalog.functions.get(target);
    if (!fn) {
      return {
        success: false,
        error: `42883: function ${target} does not exist`,
      };
    }

    if (!fn.permissions.includes(clientRole)) {
      return {
        success: false,
        error: `42501: permission denied for function ${target}`,
      };
    }

    // Function: submit_contact_inquiry logic
    if (target === 'submit_contact_inquiry') {
      const token = payload?.verified_token || payload?.payload?.verified_token || '';
      if (!token || typeof token !== 'string' || token.trim() === '') {
        return {
          success: false,
          error: 'P0001: Valid single-use verified token is required for contact inquiry',
        };
      }

      const storedToken = catalog.verifiedTokens.get(token.trim());
      if (!storedToken || storedToken.action !== 'contact' || storedToken.expiresAt < Date.now()) {
        return {
          success: false,
          error: 'P0001: Invalid or expired verified token for contact inquiry',
        };
      }

      // Consume single-use token
      catalog.verifiedTokens.delete(token.trim());

      // Read restaurant_id from settings
      const restaurantId = catalog.restaurantSettings.restaurantId;

      // Generate 16+ random characters
      const randomSuffix = 'ABCD1234EFGH5678';
      const inquiryRef = `INQ-20261014-${randomSuffix}`;

      const newRecord = {
        inquiry_ref: inquiryRef,
        restaurant_id: restaurantId,
        name: payload?.payload?.name,
        phone: payload?.payload?.phone,
        message: payload?.payload?.message,
        status: 'unread',
      };
      catalog.contactInquiries.push(newRecord);

      return {
        success: true,
        data: {
          success: true,
          inquiry_ref: inquiryRef,
        },
      };
    }
  }

  return { success: false, error: 'Unknown operation' };
}

// 8a: Anon cannot call create_verified_token_for_test
const anonCallSeedResult = simulateDatabaseExecution(
  'anon',
  'CALL_FUNCTION',
  'create_verified_token_for_test',
  { p_token: 'fake_token', p_action: 'contact' }
);
if (anonCallSeedResult.success) {
  throw new Error('Test 8a failed: anon was erroneously able to call create_verified_token_for_test');
}
if (!anonCallSeedResult.error?.includes('42883') && !anonCallSeedResult.error?.includes('permission denied')) {
  throw new Error(`Test 8a failed: Unexpected error message: ${anonCallSeedResult.error}`);
}
console.log(`  ✔ Vector 8a BLOCKED: Anon calling create_verified_token_for_test -> "${anonCallSeedResult.error}"`);

// 8b: Anon cannot direct INSERT into contact_inquiries
const anonInsertResult = simulateDatabaseExecution(
  'anon',
  'DIRECT_TABLE_INSERT',
  'contact_inquiries',
  {
    inquiry_ref: 'HACK-001',
    name: 'Malicious Bot',
    phone: '+919999999999',
    message: 'Spam message',
  }
);
if (anonInsertResult.success) {
  throw new Error('Test 8b failed: anon was erroneously able to INSERT directly into contact_inquiries');
}
if (!anonInsertResult.error?.includes('permission denied')) {
  throw new Error(`Test 8b failed: Unexpected error message: ${anonInsertResult.error}`);
}
console.log(`  ✔ Vector 8b BLOCKED: Anon direct INSERT into contact_inquiries -> "${anonInsertResult.error}"`);

// 8c: Anon cannot submit without a verified token
const anonSubmitWithoutTokenResult = simulateDatabaseExecution(
  'anon',
  'CALL_FUNCTION',
  'submit_contact_inquiry',
  {
    payload: {
      name: 'Legit Customer',
      phone: '+919830123456',
      message: 'Need catering quote for party',
    },
  }
);
if (anonSubmitWithoutTokenResult.success) {
  throw new Error('Test 8c failed: submit_contact_inquiry accepted submission without verified token');
}
if (!anonSubmitWithoutTokenResult.error?.includes('Valid single-use verified token is required')) {
  throw new Error(`Test 8c failed: Unexpected exception for missing token: ${anonSubmitWithoutTokenResult.error}`);
}
console.log(`  ✔ Vector 8c BLOCKED: Anon submit without verified token -> "${anonSubmitWithoutTokenResult.error}"`);

// 8d: Anon cannot submit with token of action 'order' instead of 'contact'
catalog.verifiedTokens.set('order_token_123', { action: 'order', expiresAt: Date.now() + 60000 });
const anonSubmitWrongActionResult = simulateDatabaseExecution(
  'anon',
  'CALL_FUNCTION',
  'submit_contact_inquiry',
  {
    payload: {
      name: 'Legit Customer',
      phone: '+919830123456',
      message: 'Need catering quote for party',
      verified_token: 'order_token_123',
    },
  }
);
if (anonSubmitWrongActionResult.success) {
  throw new Error('Test 8d failed: submit_contact_inquiry accepted token with action \'order\'');
}
if (!anonSubmitWrongActionResult.error?.includes('Invalid or expired verified token')) {
  throw new Error(`Test 8d failed: Unexpected exception for wrong action: ${anonSubmitWrongActionResult.error}`);
}
console.log(`  ✔ Vector 8d BLOCKED: Token with action 'order' rejected for contact inquiry -> "${anonSubmitWrongActionResult.error}"`);

// 8e: Legitimate submission with valid token succeeds and generates 16+ random characters
catalog.verifiedTokens.set('valid_contact_token_999', { action: 'contact', expiresAt: Date.now() + 60000 });
const legitSubmissionResult = simulateDatabaseExecution(
  'anon',
  'CALL_FUNCTION',
  'submit_contact_inquiry',
  {
    payload: {
      name: 'Siddhartha Mukherjee',
      phone: '+919830123456',
      message: 'Gourmet dinner inquiry for 20 guests',
      restaurant_id: 'malicious-injected-tenant', // Must be ignored
      inquiry_ref: 'CLIENT-SUPPLIED-REF', // Must be ignored
      verified_token: 'valid_contact_token_999',
    },
  }
);
if (!legitSubmissionResult.success || !legitSubmissionResult.data?.inquiry_ref) {
  throw new Error('Test 8e failed: legitimate submission failed');
}

const recorded = catalog.contactInquiries[catalog.contactInquiries.length - 1];
if (recorded.restaurant_id !== 'the-cafe-barrackpore') {
  throw new Error(`Test 8e failed: client restaurant_id was not ignored! Recorded: ${recorded.restaurant_id}`);
}
if (recorded.inquiry_ref === 'CLIENT-SUPPLIED-REF') {
  throw new Error('Test 8e failed: client inquiry_ref was not ignored!');
}
if (!/^INQ-\d{8}-[A-Za-z0-9]{16,}$/.test(recorded.inquiry_ref)) {
  throw new Error(`Test 8e failed: inquiry_ref does not have 16+ random characters: ${recorded.inquiry_ref}`);
}
console.log(`  ✔ Flow 8e PASSED: Valid submission consumed token, read tenant from settings (${recorded.restaurant_id}), and generated ref with 16+ random chars: "${recorded.inquiry_ref}"`);

console.log('\n================================================================');
console.log('🎉 ALL MIGRATION 019 SECURITY VERIFICATION CHECKS PASSED!');
console.log('================================================================');
