import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
}

async function runTests() {
  console.log('--- Starting Real Postgres (PGlite) Authoritative Tests ---');
  const db = new PGlite();

  // 1. Initialize Supabase-like environment
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

    -- PGlite Wasm environment pgcrypto crypt & gen_salt compatibility
    CREATE OR REPLACE FUNCTION gen_salt(type text, iter_count integer DEFAULT 8)
    RETURNS text AS $$
    BEGIN
      RETURN '$2a$08$' || substr(md5(random()::text), 1, 22);
    END;
    $$ LANGUAGE plpgsql;

    CREATE OR REPLACE FUNCTION crypt(password text, salt text)
    RETURNS text AS $$
    DECLARE
      v_prefix text;
    BEGIN
      v_prefix := substr(salt, 1, 29);
      RETURN v_prefix || encode(sha256((v_prefix || ':' || password)::bytea), 'hex');
    END;
    $$ LANGUAGE plpgsql;
  `);

  // 2. Apply all migrations in order
  const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of migrationFiles) {
    let sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    sql = sql.replace(/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+[^;]+;/gi, '-- CREATE EXTENSION skipped');
    try {
      console.log(`Applying ${file}...`);
      await db.exec(sql);
    } catch (err: any) {
      console.error(`Failed to apply migration ${file}:`, err.message);
      throw err;
    }
  }
  console.log(`✔ Applied all ${migrationFiles.length} migrations to real PostgreSQL.`);

  // 3. Seed baseline restaurant and settings
  await db.exec(`
    INSERT INTO public.restaurant_settings (
      id, restaurant_id, currency, tax_enabled, tax_mode, tax_rate, features
    ) VALUES (
      'current', 'the-cafe-barrackpore', 'INR', true, 'inclusive', 0.0500,
      '{"pos": true, "running_table_bills": true, "split_bills": true, "cash_drawer": true, "kds": true, "kot_printing": true, "online_ordering": true, "qr_table_ordering": true, "discounts": true, "online_payments": true}'::jsonb
    ) ON CONFLICT (id) DO UPDATE SET
      restaurant_id = EXCLUDED.restaurant_id,
      currency = EXCLUDED.currency,
      tax_enabled = EXCLUDED.tax_enabled,
      tax_mode = EXCLUDED.tax_mode,
      tax_rate = EXCLUDED.tax_rate,
      features = EXCLUDED.features;

    -- Seed menu category and item
    INSERT INTO public.menu_categories (id, restaurant_id, name, sort_order)
    VALUES ('cat-main', 'the-cafe-barrackpore', 'Mains', 1)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.menu_items (id, restaurant_id, category_id, name, price, available)
    VALUES ('item-burger-1', 'the-cafe-barrackpore', 'cat-main', 'Classic Cheeseburger', 200.00, true)
    ON CONFLICT (id) DO UPDATE SET price = 200.00, available = true;

    -- Seed discount codes
    INSERT INTO public.discount_codes (id, code, discount_type, discount_value, max_discount_amount, min_order_amount, active, max_uses, used_count, valid_from, valid_until)
    VALUES 
      (gen_random_uuid(), 'SAVE20', 'percentage', 20, 50, 100, true, 100, 0, now() - interval '1 hour', now() + interval '10 days'),
      (gen_random_uuid(), 'EXPIRED10', 'percentage', 10, null, 50, true, 100, 0, now() - interval '10 days', now() - interval '1 day'),
      (gen_random_uuid(), 'FUTURE10', 'percentage', 10, null, 50, true, 100, 0, now() + interval '1 day', now() + interval '10 days'),
      (gen_random_uuid(), 'MAXED10', 'percentage', 10, null, 50, true, 1, 1, now() - interval '1 hour', now() + interval '10 days'),
      (gen_random_uuid(), 'MINORDER500', 'percentage', 10, null, 500, true, 100, 0, now() - interval '1 hour', now() + interval '10 days'),
      (gen_random_uuid(), 'FLAT50', 'flat', 50, null, 100, true, 100, 0, now() - interval '1 hour', now() + interval '10 days'),
      (gen_random_uuid(), 'INACTIVE20', 'percentage', 20, null, 50, false, 100, 0, now() - interval '1 hour', now() + interval '10 days')
    ON CONFLICT (code) DO NOTHING;
  `);

  console.log('✔ Baseline seed completed.');

  // ==============================================================================
  // REQUIREMENT 1 TESTS: Authoritative create_order_atomic & Discount Validation
  // ==============================================================================
  console.log('\n--- Testing Requirement 1: Server-Authoritative Discounts ---');

  const insertToken = async (tok: string) => {
    await db.query(`
      INSERT INTO public.verified_tokens (token, action, expires_at)
      VALUES ($1, 'order', now() + interval '1 hour')
    `, [tok]);
  };

  // Test 1a: Anon sends discount_amount = subtotal (200.00) with NO discount code
  // Expected: Client's discount_amount is completely IGNORED. discount_amount in order is 0.00!
  await insertToken('tok-anon-subtotal-spoof');
  const res1a = await db.query(`
    SELECT public.create_order_atomic(
      $1::jsonb,
      $2::jsonb
    ) as result;
  `, [
    JSON.stringify({
      restaurant_id: 'the-cafe-barrackpore',
      order_type: 'takeaway',
      customer_name: 'Spoof Attacker',
      customer_phone: '9876543210',
      payment_method: 'counter',
      discount_amount: 200.00, // Attacker attempts to claim 100% free meal!
      verified_token: 'tok-anon-subtotal-spoof'
    }),
    JSON.stringify([
      { menu_item_id: 'item-burger-1', quantity: 1 }
    ])
  ]);

  const order1a = (res1a.rows[0] as any).result;
  assert(order1a.success === true, 'Order creation should succeed');
  const dbOrder1aRes = await db.query(`SELECT discount_amount, total, subtotal FROM public.orders WHERE id = $1`, [order1a.order_id]);
  const dbOrder1a = dbOrder1aRes.rows[0] as any;
  assert(Number(dbOrder1a.discount_amount) === 0, `Expected discount_amount to be 0.00, got ${dbOrder1a.discount_amount}`);
  assert(Number(dbOrder1a.subtotal) === 200, `Expected subtotal to be 200, got ${dbOrder1a.subtotal}`);
  assert(Number(dbOrder1a.total) === 200, `Expected total to be 200, got ${dbOrder1a.total}`);
  console.log('✔ Test 1a PASSED: Client discount_amount=subtotal with no code was strictly ignored (discount_amount=0)');

  // Test 1b: Anon sends unknown code
  await insertToken('tok-unknown-code');
  let err1b: string | null = null;
  try {
    await db.query(`
      SELECT public.create_order_atomic(
        $1::jsonb,
        $2::jsonb
      );
    `, [
      JSON.stringify({
        restaurant_id: 'the-cafe-barrackpore',
        order_type: 'takeaway',
        customer_name: 'John Doe',
        customer_phone: '9876543210',
        payment_method: 'counter',
        discount_code: 'FAKECODE99',
        verified_token: 'tok-unknown-code'
      }),
      JSON.stringify([{ menu_item_id: 'item-burger-1', quantity: 1 }])
    ]);
  } catch (e: any) {
    err1b = e.message;
  }
  assert(err1b !== null && err1b.includes('Invalid or unknown discount code: FAKECODE99'), `Expected rejection of unknown code, got: ${err1b}`);
  console.log('✔ Test 1b PASSED: Unknown discount code rejected with loud exception');

  // Test 1c: Anon sends inactive code
  await insertToken('tok-inactive-code');
  let err1c: string | null = null;
  try {
    await db.query(`
      SELECT public.create_order_atomic(
        $1::jsonb,
        $2::jsonb
      );
    `, [
      JSON.stringify({
        restaurant_id: 'the-cafe-barrackpore',
        order_type: 'takeaway',
        customer_name: 'John Doe',
        customer_phone: '9876543210',
        payment_method: 'counter',
        discount_code: 'INACTIVE20',
        verified_token: 'tok-inactive-code'
      }),
      JSON.stringify([{ menu_item_id: 'item-burger-1', quantity: 1 }])
    ]);
  } catch (e: any) {
    err1c = e.message;
  }
  assert(err1c !== null && err1c.includes('is no longer active'), `Expected rejection of inactive code, got: ${err1c}`);
  console.log('✔ Test 1c PASSED: Inactive discount code rejected');

  // Test 1d: Anon sends expired code
  await insertToken('tok-expired-code');
  let err1d: string | null = null;
  try {
    await db.query(`
      SELECT public.create_order_atomic(
        $1::jsonb,
        $2::jsonb
      );
    `, [
      JSON.stringify({
        restaurant_id: 'the-cafe-barrackpore',
        order_type: 'takeaway',
        customer_name: 'John Doe',
        customer_phone: '9876543210',
        payment_method: 'counter',
        discount_code: 'EXPIRED10',
        verified_token: 'tok-expired-code'
      }),
      JSON.stringify([{ menu_item_id: 'item-burger-1', quantity: 1 }])
    ]);
  } catch (e: any) {
    err1d = e.message;
  }
  assert(err1d !== null && err1d.includes('has expired'), `Expected rejection of expired code, got: ${err1d}`);
  console.log('✔ Test 1d PASSED: Expired discount code rejected');

  // Test 1e: Anon sends future code
  await insertToken('tok-future-code');
  let err1e: string | null = null;
  try {
    await db.query(`
      SELECT public.create_order_atomic(
        $1::jsonb,
        $2::jsonb
      );
    `, [
      JSON.stringify({
        restaurant_id: 'the-cafe-barrackpore',
        order_type: 'takeaway',
        customer_name: 'John Doe',
        customer_phone: '9876543210',
        payment_method: 'counter',
        discount_code: 'FUTURE10',
        verified_token: 'tok-future-code'
      }),
      JSON.stringify([{ menu_item_id: 'item-burger-1', quantity: 1 }])
    ]);
  } catch (e: any) {
    err1e = e.message;
  }
  assert(err1e !== null && err1e.includes('is not valid yet'), `Expected rejection of future code, got: ${err1e}`);
  console.log('✔ Test 1e PASSED: Future discount code rejected');

  // Test 1f: Anon sends code with max uses reached
  await insertToken('tok-maxed-code');
  let err1f: string | null = null;
  try {
    await db.query(`
      SELECT public.create_order_atomic(
        $1::jsonb,
        $2::jsonb
      );
    `, [
      JSON.stringify({
        restaurant_id: 'the-cafe-barrackpore',
        order_type: 'takeaway',
        customer_name: 'John Doe',
        customer_phone: '9876543210',
        payment_method: 'counter',
        discount_code: 'MAXED10',
        verified_token: 'tok-maxed-code'
      }),
      JSON.stringify([{ menu_item_id: 'item-burger-1', quantity: 1 }])
    ]);
  } catch (e: any) {
    err1f = e.message;
  }
  assert(err1f !== null && err1f.includes('has reached its usage limit'), `Expected rejection of maxed code, got: ${err1f}`);
  console.log('✔ Test 1f PASSED: Code with exceeded usage limit rejected');

  // Test 1g: Anon sends code requiring higher min order amount
  await insertToken('tok-minorder-code');
  let err1g: string | null = null;
  try {
    await db.query(`
      SELECT public.create_order_atomic(
        $1::jsonb,
        $2::jsonb
      );
    `, [
      JSON.stringify({
        restaurant_id: 'the-cafe-barrackpore',
        order_type: 'takeaway',
        customer_name: 'John Doe',
        customer_phone: '9876543210',
        payment_method: 'counter',
        discount_code: 'MINORDER500', // needs 500, subtotal is 200
        verified_token: 'tok-minorder-code'
      }),
      JSON.stringify([{ menu_item_id: 'item-burger-1', quantity: 1 }])
    ]);
  } catch (e: any) {
    err1g = e.message;
  }
  assert(err1g !== null && err1g.includes('is less than the minimum required'), `Expected rejection of under-min order, got: ${err1g}`);
  console.log('✔ Test 1g PASSED: Code below minimum order subtotal rejected');

  // Test 1h: Anon sends valid percentage code (SAVE20: 20% on 200 = 40 <= max 50)
  const prevCodeRes = await db.query(`SELECT used_count FROM public.discount_codes WHERE code = 'SAVE20'`);
  const initialUses = Number((prevCodeRes.rows[0] as any).used_count);

  await insertToken('tok-valid-save20');
  const res1h = await db.query(`
    SELECT public.create_order_atomic(
      $1::jsonb,
      $2::jsonb
    ) as result;
  `, [
    JSON.stringify({
      restaurant_id: 'the-cafe-barrackpore',
      order_type: 'takeaway',
      customer_name: 'Valid Customer',
      customer_phone: '9876543210',
      payment_method: 'counter',
      discount_code: 'SAVE20',
      verified_token: 'tok-valid-save20'
    }),
    JSON.stringify([{ menu_item_id: 'item-burger-1', quantity: 1 }])
  ]);
  const order1h = (res1h.rows[0] as any).result;
  assert(order1h.success === true, 'Valid discount order should succeed');
  const dbOrder1hRes = await db.query(`SELECT discount_amount, total, subtotal FROM public.orders WHERE id = $1`, [order1h.order_id]);
  const dbOrder1h = dbOrder1hRes.rows[0] as any;
  assert(Number(dbOrder1h.discount_amount) === 40, `Expected discount_amount to be 40.00, got ${dbOrder1h.discount_amount}`);
  assert(Number(dbOrder1h.total) === 160, `Expected total to be 160.00, got ${dbOrder1h.total}`);

  const postCodeRes = await db.query(`SELECT used_count FROM public.discount_codes WHERE code = 'SAVE20'`);
  const postUses = Number((postCodeRes.rows[0] as any).used_count);
  assert(postUses === initialUses + 1, `Expected used_count to increment to ${initialUses + 1}, got ${postUses}`);
  console.log('✔ Test 1h PASSED: Valid code accurately calculated server discount (40.00) and incremented used_count');

  // Test 1i: Anon sends valid flat code (FLAT50: 50 on 200 = 50 discount, total 150)
  await insertToken('tok-valid-flat50');
  const res1i = await db.query(`
    SELECT public.create_order_atomic(
      $1::jsonb,
      $2::jsonb
    ) as result;
  `, [
    JSON.stringify({
      restaurant_id: 'the-cafe-barrackpore',
      order_type: 'takeaway',
      customer_name: 'Flat Customer',
      customer_phone: '9876543210',
      payment_method: 'counter',
      discount_code: 'FLAT50',
      verified_token: 'tok-valid-flat50'
    }),
    JSON.stringify([{ menu_item_id: 'item-burger-1', quantity: 1 }])
  ]);
  const order1i = (res1i.rows[0] as any).result;
  assert(order1i.success === true, 'Flat discount order should succeed');
  const dbOrder1iRes = await db.query(`SELECT discount_amount, total FROM public.orders WHERE id = $1`, [order1i.order_id]);
  const dbOrder1i = dbOrder1iRes.rows[0] as any;
  assert(Number(dbOrder1i.discount_amount) === 50, `Expected flat discount_amount to be 50.00, got ${dbOrder1i.discount_amount}`);
  assert(Number(dbOrder1i.total) === 150, `Expected total to be 150.00, got ${dbOrder1i.total}`);
  console.log('✔ Test 1i PASSED: Flat discount code applied correctly (50.00 discount)');

  // ==============================================================================
  // REQUIREMENT 2 TESTS: is_feature_enabled Checks inside POS/KDS/Shift/Drawer RPCs
  // Tested with a real Staff JWT
  // ==============================================================================
  console.log('\n--- Testing Requirement 2: Feature Flags Gating with Staff JWT ---');

  const staffUserId = '22222222-2222-2222-2222-222222222222';
  await db.exec(`
    INSERT INTO auth.users (id, email, role)
    VALUES ('${staffUserId}', 'cashier@barrackpore.com', 'authenticated')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.staff_profiles (id, user_id, restaurant_id, full_name, role, active)
    VALUES (gen_random_uuid(), '${staffUserId}', 'the-cafe-barrackpore', 'Staff Cashier', 'cashier', true)
    ON CONFLICT (user_id) DO NOTHING;

    -- Seed restaurant table
    INSERT INTO public.restaurant_tables (restaurant_id, table_number, label, capacity, active)
    VALUES ('the-cafe-barrackpore', 'T1', 'Table 1', 4, true)
    ON CONFLICT (table_number) DO NOTHING;

    -- Seed shift
    INSERT INTO public.cash_shifts (id, restaurant_id, opened_by_id, opened_by_name, opening_float_minor, status)
    VALUES ('33333333-3333-3333-3333-333333333333', 'the-cafe-barrackpore', '${staffUserId}', 'Staff Cashier', 10000, 'open')
    ON CONFLICT (id) DO NOTHING;
  `);

  // Helper to set feature flags
  const setFeature = async (featureName: string, enabled: boolean) => {
    await db.query(`
      UPDATE public.restaurant_settings
      SET features = features || jsonb_build_object($1::text, $2::boolean)
      WHERE restaurant_id = 'the-cafe-barrackpore';
    `, [featureName, enabled]);
  };

  // Helper to simulate Staff JWT
  const asStaff = async (fn: () => Promise<void>) => {
    await db.exec(`
      SELECT set_config('request.jwt.claim.sub', '${staffUserId}', false);
      SELECT set_config('request.jwt.claim.role', 'authenticated', false);
      SELECT set_config('request.jwt.claims', '{"sub": "${staffUserId}", "role": "authenticated", "email": "cashier@barrackpore.com"}', false);
      SET ROLE authenticated;
    `);
    try {
      await fn();
    } finally {
      await db.exec(`RESET ROLE;`);
    }
  };

  // Test 2a: Flag 'pos' ON and OFF
  await setFeature('pos', false);
  await asStaff(async () => {
    const res = await db.query(`
      SELECT public.pos_create_or_append_kot(
        p_table_number := 'T1',
        p_items := $1::jsonb
      ) as result;
    `, [JSON.stringify([{ menu_item_id: 'item-burger-1', quantity: 1 }])]);
    const r = (res.rows[0] as any).result;
    assert(r.success === false && r.error.includes('Point of Sale (POS) is currently disabled'), `Expected POS disabled error, got ${JSON.stringify(r)}`);
  });
  console.log('✔ Test 2a-1 PASSED: pos=false blocks pos_create_or_append_kot');

  await setFeature('pos', true);
  await asStaff(async () => {
    const res = await db.query(`
      SELECT public.pos_create_or_append_kot(
        p_table_number := 'T1',
        p_items := $1::jsonb
      ) as result;
    `, [JSON.stringify([{ menu_item_id: 'item-burger-1', quantity: 1 }])]);
    const r = (res.rows[0] as any).result;
    assert(r.success === true, `Expected POS call to succeed with pos=true, got ${JSON.stringify(r)}`);
  });
  console.log('✔ Test 2a-2 PASSED: pos=true allows pos_create_or_append_kot');

  // Test 2b: Flag 'running_table_bills' ON and OFF
  await setFeature('running_table_bills', false);
  await asStaff(async () => {
    const res = await db.query(`
      SELECT public.pos_create_or_append_kot(
        p_table_number := 'T1',
        p_items := $1::jsonb
      ) as result;
    `, [JSON.stringify([{ menu_item_id: 'item-burger-1', quantity: 1 }])]);
    const r = (res.rows[0] as any).result;
    assert(r.success === false && r.error.includes('Running table bills are currently disabled'), `Expected running_table_bills disabled error, got ${JSON.stringify(r)}`);
  });
  console.log('✔ Test 2b-1 PASSED: running_table_bills=false blocks table bills in pos_create_or_append_kot');

  await setFeature('running_table_bills', true);
  await asStaff(async () => {
    const res = await db.query(`
      SELECT public.pos_create_or_append_kot(
        p_table_number := 'T1',
        p_items := $1::jsonb
      ) as result;
    `, [JSON.stringify([{ menu_item_id: 'item-burger-1', quantity: 1 }])]);
    const r = (res.rows[0] as any).result;
    assert(r.success === true, `Expected table bill to succeed with running_table_bills=true, got ${JSON.stringify(r)}`);
  });
  console.log('✔ Test 2b-2 PASSED: running_table_bills=true allows table bills');

  // Test 2c: Flag 'kot_printing' ON and OFF
  await setFeature('kot_printing', false);
  await asStaff(async () => {
    const res = await db.query(`
      SELECT public.pos_create_or_append_kot(
        p_table_number := 'T1',
        p_items := $1::jsonb
      ) as result;
    `, [JSON.stringify([{ menu_item_id: 'item-burger-1', quantity: 1 }])]);
    const r = (res.rows[0] as any).result;
    assert(r.success === false && r.error.includes('Kitchen Order Ticket (KOT) printing is currently disabled'), `Expected kot_printing disabled error, got ${JSON.stringify(r)}`);
  });
  console.log('✔ Test 2c-1 PASSED: kot_printing=false blocks KOT generation');

  await setFeature('kot_printing', true);
  await asStaff(async () => {
    const res = await db.query(`
      SELECT public.pos_create_or_append_kot(
        p_table_number := 'T1',
        p_items := $1::jsonb
      ) as result;
    `, [JSON.stringify([{ menu_item_id: 'item-burger-1', quantity: 1 }])]);
    const r = (res.rows[0] as any).result;
    assert(r.success === true, `Expected KOT generation with kot_printing=true, got ${JSON.stringify(r)}`);
  });
  console.log('✔ Test 2c-2 PASSED: kot_printing=true allows KOT generation');

  // Test 2d: Flag 'split_bills' ON and OFF
  // First, find running bill on table T1 created in previous test
  const billRes = await db.query(`SELECT bill_number FROM public.bills WHERE table_number = 'T1' AND status IN ('running', 'printed') LIMIT 1`);
  const billNumber = (billRes.rows[0] as any).bill_number;

  await setFeature('split_bills', false);
  await asStaff(async () => {
    const res = await db.query(`
      SELECT public.split_bill_atomic(
        $1::text,
        'equal',
        $2::jsonb
      ) as result;
    `, [billNumber, JSON.stringify([{ part: 1 }, { part: 2 }])]);
    const r = (res.rows[0] as any).result;
    assert(r.success === false && r.error.includes('Bill splitting is currently disabled'), `Expected split_bills disabled error, got ${JSON.stringify(r)}`);
  });
  console.log('✔ Test 2d-1 PASSED: split_bills=false blocks split_bill_atomic');

  await setFeature('split_bills', true);
  const bRes = await db.query(`SELECT grand_total_minor FROM public.bills WHERE bill_number = $1`, [billNumber]);
  const gt = (bRes.rows[0] as any).grand_total_minor;
  const p1 = Math.floor(gt / 2);
  const p2 = gt - p1;

  await asStaff(async () => {
    const res = await db.query(`
      SELECT public.split_bill_atomic(
        $1::text,
        'equal',
        $2::jsonb
      ) as result;
    `, [billNumber, JSON.stringify([{ amount_minor: p1 }, { amount_minor: p2 }])]);
    const r = (res.rows[0] as any).result;
    assert(r.success === true, `Expected split_bills to succeed with split_bills=true, got ${JSON.stringify(r)}`);
  });
  console.log('✔ Test 2d-2 PASSED: split_bills=true allows bill splitting');

  // Test 2e: Flag 'cash_drawer' ON and OFF
  const shiftId = '33333333-3333-3333-3333-333333333333';
  await setFeature('cash_drawer', false);
  await asStaff(async () => {
    const res = await db.query(`
      SELECT public.pos_record_drawer_open(
        $1::uuid,
        'No sale drawer open test'
      ) as result;
    `, [shiftId]);
    const r = (res.rows[0] as any).result;
    assert(r.success === false && r.error.includes('Cash drawer operations are currently disabled'), `Expected cash_drawer disabled error, got ${JSON.stringify(r)}`);
  });

  await asStaff(async () => {
    const res = await db.query(`
      SELECT public.get_shift_z_report($1::uuid) as result;
    `, [shiftId]);
    const r = (res.rows[0] as any).result;
    assert(r.success === false && r.error.includes('Cash drawer shift management is currently disabled'), `Expected z-report disabled error, got ${JSON.stringify(r)}`);
  });
  console.log('✔ Test 2e-1 PASSED: cash_drawer=false blocks pos_record_drawer_open and get_shift_z_report');

  await setFeature('cash_drawer', true);
  await asStaff(async () => {
    const res = await db.query(`
      SELECT public.pos_record_drawer_open(
        $1::uuid,
        'Manager count check'
      ) as result;
    `, [shiftId]);
    const r = (res.rows[0] as any).result;
    assert(r.success === true, `Expected drawer open to succeed with cash_drawer=true, got ${JSON.stringify(r)}`);

    const zRes = await db.query(`
      SELECT public.get_shift_z_report($1::uuid) as result;
    `, [shiftId]);
    const zReport = (zRes.rows[0] as any).result;
    assert(zReport.shift_id === shiftId, `Expected z-report data returned, got ${JSON.stringify(zReport)}`);
  });
  console.log('✔ Test 2e-2 PASSED: cash_drawer=true allows pos_record_drawer_open and get_shift_z_report');

  // Test 2f: Flag 'kds' ON and OFF in update_order_status_kitchen
  // Create an order for KDS test
  await insertToken('tok-kds-test');
  const kdsOrderRes = await db.query(`
    SELECT public.create_order_atomic(
      $1::jsonb,
      $2::jsonb
    ) as result;
  `, [
    JSON.stringify({
      restaurant_id: 'the-cafe-barrackpore',
      order_type: 'takeaway',
      customer_name: 'KDS Customer',
      customer_phone: '9876543210',
      payment_method: 'counter',
      verified_token: 'tok-kds-test'
    }),
    JSON.stringify([{ menu_item_id: 'item-burger-1', quantity: 1 }])
  ]);
  const kdsOrderId = (kdsOrderRes.rows[0] as any).result.order_id;

  await setFeature('kds', false);
  await asStaff(async () => {
    const res = await db.query(`
      SELECT public.update_order_status_kitchen(
        $1::uuid,
        'preparing'
      ) as result;
    `, [kdsOrderId]);
    const r = (res.rows[0] as any).result;
    assert(r.success === false && r.error.includes('Kitchen Display System (KDS) is currently disabled'), `Expected KDS disabled error, got ${JSON.stringify(r)}`);
  });
  console.log('✔ Test 2f-1 PASSED: kds=false blocks update_order_status_kitchen');

  await setFeature('kds', true);
  await asStaff(async () => {
    const res = await db.query(`
      SELECT public.update_order_status_kitchen(
        $1::uuid,
        'preparing'
      ) as result;
    `, [kdsOrderId]);
    const r = (res.rows[0] as any).result;
    assert(r.success === true && r.new_status === 'preparing', `Expected KDS update to succeed with kds=true, got ${JSON.stringify(r)}`);
  });
  console.log('✔ Test 2f-2 PASSED: kds=true allows update_order_status_kitchen');

  console.log('\n=============================================================');
  console.log('ALL REAL POSTGRES AUTHORITATIVE TESTS COMPLETED SUCCESSFULLY!');
  console.log('=============================================================\n');
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
