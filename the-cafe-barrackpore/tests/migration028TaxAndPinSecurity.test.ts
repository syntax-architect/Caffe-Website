/**
 * Migration 028: Tax Strict Gating & PGCrypto Blowfish Manager PIN Verification Test
 *
 * Verifies:
 * 1. SQL `resolve_dated_tax_rate` raises an exception when no tax rule matches (NO 0% fallback).
 * 2. Owner setup blocks go-live (`canJurisdictionGoLive`) if tax is enabled and jurisdiction has no verified rules.
 * 3. Manager PIN hashing uses pgcrypto blowfish `crypt(pin, gen_salt('bf', 8))`.
 * 4. Manager PIN verify helper supports both bcrypt blowfish and legacy migration fallback.
 * 5. 5-attempt lockout and audit log recording are strictly maintained.
 */

import fs from 'node:fs';
import path from 'node:path';
import { canJurisdictionGoLive } from '../src/config/taxRegistry';

console.log('=== RUNNING MIGRATION 028 TAX STRICT GATING & PGCRYPTO PIN TESTS ===\n');

// 1. Load Migration 028 and related SQL files
const migration028Path = path.resolve(process.cwd(), 'supabase/migrations/028_tax_strict_gating_and_pgcrypto.sql');
const migration026Path = path.resolve(process.cwd(), 'supabase/migrations/026_authoritative_discounts_and_feature_guards.sql');
const migration027Path = path.resolve(process.cwd(), 'supabase/migrations/027_roles_and_manager_pin.sql');

if (!fs.existsSync(migration028Path)) {
  throw new Error('Test failed: supabase/migrations/028_tax_strict_gating_and_pgcrypto.sql does not exist');
}

const sql028 = fs.readFileSync(migration028Path, 'utf8');
const sql026 = fs.readFileSync(migration026Path, 'utf8');
const sql027 = fs.readFileSync(migration027Path, 'utf8');

// ----------------------------------------------------------------------------
// Test 1: SQL Tax Invariant — Exception Raised on No Matching Tax Rule
// ----------------------------------------------------------------------------
console.log('Test 1: SQL Tax Invariant — RAISE EXCEPTION on No Match');
if (!sql028.includes('RAISE EXCEPTION') || !sql028.includes('NO_MATCHING_TAX_RULE')) {
  throw new Error('Test 1 Failed: Migration 028 must RAISE EXCEPTION with NO_MATCHING_TAX_RULE when no tax rule matches');
}

if (sql028.includes("RETURN QUERY SELECT 'Zero Rate / Exempt'")) {
  throw new Error('Test 1 Failed: Migration 028 must NOT fall back to 0% Zero Rate / Exempt');
}

if (!sql026.includes('RAISE EXCEPTION') || !sql026.includes('NO_MATCHING_TAX_RULE')) {
  throw new Error('Test 1 Failed: Migration 026 must also be updated with RAISE EXCEPTION for resolve_dated_tax_rate');
}
console.log('✔ Test 1 Passed: SQL raises authoritative exception on missing tax rules (zero 0% leakage).\n');

// ----------------------------------------------------------------------------
// Test 2: Owner Setup Blocks Go-Live When Tax Rules Missing or Unverified
// ----------------------------------------------------------------------------
console.log('Test 2: Owner Setup Go-Live Blocker');
const unverifiedResult = canJurisdictionGoLive('ZZ', false);
if (unverifiedResult.allowed !== false) {
  throw new Error('Test 2 Failed: Unregistered/unverified country ZZ must block go-live');
}
if (!unverifiedResult.requiresAccountant) {
  throw new Error('Test 2 Failed: Blocked go-live must indicate accountant sign-off requirement');
}

const validResult = canJurisdictionGoLive('IN', true);
if (validResult.allowed !== true) {
  throw new Error(`Test 2 Failed: Valid preset country IN must be allowed to go live, got: ${JSON.stringify(validResult)}`);
}
console.log('✔ Test 2 Passed: canJurisdictionGoLive strictly prevents go-live for missing or unverified tax rules.\n');

// ----------------------------------------------------------------------------
// Test 3: Manager PIN Hashing — PGCrypto crypt(pin, gen_salt('bf', 8))
// ----------------------------------------------------------------------------
console.log('Test 3: Manager PIN Hashing — PGCrypto Blowfish crypt');
if (!sql028.includes("CREATE EXTENSION IF NOT EXISTS pgcrypto;")) {
  throw new Error('Test 3 Failed: Migration 028 must ensure pgcrypto extension is created');
}

if (!sql028.includes("crypt(trim(p_pin), gen_salt('bf', 8))")) {
  throw new Error("Test 3 Failed: Migration 028 must hash PIN with crypt(trim(p_pin), gen_salt('bf', 8))");
}

if (sql028.includes("encode(sha256((v_salt || ':' || trim(p_pin))::bytea), 'hex')") &&
    sql028.includes("hash_manager_pin")) {
  // hash_manager_pin should not return SHA-256 anymore
  const hashFuncMatch = sql028.match(/FUNCTION public\.hash_manager_pin[\s\S]*?END;/);
  if (hashFuncMatch && hashFuncMatch[0].includes('sha256')) {
    throw new Error('Test 3 Failed: hash_manager_pin must NOT use sha256');
  }
}
console.log('✔ Test 3 Passed: hash_manager_pin replaced SHA-256 with pgcrypto blowfish crypt.\n');

// ----------------------------------------------------------------------------
// Test 4: Manager PIN Verify Helper — Bcrypt and Migration Path
// ----------------------------------------------------------------------------
console.log('Test 4: Manager PIN Verification & Backward Compatibility');
if (!sql028.includes("p_hash LIKE '$2%'") || !sql028.includes("crypt(trim(p_pin), p_hash) = p_hash")) {
  throw new Error('Test 4 Failed: internal_verify_pin_hash must verify bcrypt hashes via crypt(pin, p_hash) = p_hash');
}

if (!sql028.includes("split_part(p_hash, '$', 1)")) {
  throw new Error('Test 4 Failed: internal_verify_pin_hash must maintain migration path for legacy salted sha256 hashes');
}
console.log('✔ Test 4 Passed: internal_verify_pin_hash verifies pgcrypto crypt with seamless legacy migration.\n');

// ----------------------------------------------------------------------------
// Test 5: Lockout & Audit Log Preservation
// ----------------------------------------------------------------------------
console.log('Test 5: 5-Attempt Lockout & Audit Log Invariants');
if (!sql027.includes('manager_pin_failed_attempts') || !sql027.includes("v_failed_attempts >= 5")) {
  throw new Error('Test 5 Failed: 5-attempt lockout invariant missing from pos_verify_manager_pin');
}

if (!sql027.includes("action, target_type, target_id, details") || !sql027.includes("'manager_pin_failed'")) {
  throw new Error('Test 5 Failed: Audit log entry for manager_pin_failed missing');
}
console.log('✔ Test 5 Passed: 5-attempt lockout and audit log recording strictly preserved.\n');

console.log('======================================================');
console.log('✔ ALL MIGRATION 028 TAX & PGCRYPTO TESTS PASSED (5/5)');
console.log('======================================================');
