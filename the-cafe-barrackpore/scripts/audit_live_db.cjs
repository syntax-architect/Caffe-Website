const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://qypceuzyqupepttibqvi.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5cGNldXp5cXVwZXB0dGlicXZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3Njg4NzMsImV4cCI6MjEwNjM0NDg3M30.VezD_dSxFrO1ylzpNr4TNmvrLDC3IRiP_-vSaDtiauU';

// 1. All tables defined in migrations
const ALL_TABLES = [
  'orders',
  'order_items',
  'reservations',
  'staff_profiles',
  'restaurant_tables',
  'menu_item_availability',
  'payments',
  'verified_tokens',
  'menu',
  'site_content',
  'menu_categories',
  'menu_items',
  'customers',
  'rate_limits',
  'discount_codes',
  'happy_hour_schedules',
  'audit_log',
  'contact_inquiries',
  'restaurant_settings',
  'bills',
  'bill_items',
  'bill_splits',
  'cash_shifts',
  'cash_drawer_transactions',
  'kot_batches',
  'tax_rules'
];

// 2. Expected columns per table from all migrations
const EXPECTED_COLUMNS = {
  orders: [
    'id', 'order_ref', 'customer_name', 'customer_phone', 'customer_email',
    'order_type', 'table_number', 'special_requests', 'subtotal', 'total',
    'status', 'source', 'created_at', 'updated_at', 'restaurant_id',
    'payment_method', 'payment_status', 'payment_provider', 'payment_id',
    'discount_code', 'discount_amount', 'tip_amount',
    'tax_amount', 'tax_mode', 'tax_rate', 'tax_label', 'tax_lines',
    'service_charge_amount', 'service_charge_rate', 'service_charge_label', 'service_charge_taxable',
    'currency', 'cash_shift_id', 'bill_id', 'pos_order'
  ],
  order_items: [
    'id', 'order_id', 'menu_item_id', 'name', 'unit_price', 'quantity', 'total_price',
    'customizations', 'notes', 'status', 'created_at', 'restaurant_id'
  ],
  reservations: [
    'id', 'customer_name', 'customer_phone', 'customer_email', 'party_size',
    'reservation_date', 'reservation_time', 'special_requests', 'status',
    'table_id', 'source', 'created_at', 'updated_at', 'restaurant_id'
  ],
  restaurant_tables: [
    'id', 'table_number', 'capacity', 'floor_section', 'is_active', 'status',
    'current_order_id', 'restaurant_id', 'created_at', 'updated_at'
  ],
  restaurant_settings: [
    'id', 'business_name', 'phone', 'address', 'is_ordering_enabled',
    'is_table_booking_enabled', 'opening_time', 'closing_time', 'announcement_banner',
    'updated_at', 'country', 'currency', 'currency_symbol', 'locale', 'timezone',
    'phone_country_code', 'tax_enabled', 'tax_mode', 'tax_label', 'tax_rate',
    'dietary_system', 'primary_contact_method', 'email', 'city', 'state_region',
    'postal_code', 'payment_enabled', 'payment_provider', 'payment_mode',
    'restaurant_id', 'payments_enabled', 'google_review_link',
    'owner_notification_phone', 'owner_notification_email', 'owner_notification_method',
    'low_stock_alert_threshold', 'allow_pay_at_counter',
    // New additions:
    'features', 'tax_rules', 'tax_rounding_mode',
    'service_charge_enabled', 'service_charge_rate', 'service_charge_label', 'service_charge_taxable',
    'printers', 'drawer_kick_command'
  ],
  menu: [
    'id', 'name', 'name_hi', 'name_bn', 'description', 'description_hi', 'description_bn',
    'price', 'category', 'category_hi', 'category_bn', 'image', 'dietary',
    'is_available', 'order_index', 'featured', 'rating', 'preparation_time',
    'spice_level', 'allergens', 'restaurant_id', 'created_at', 'updated_at',
    'tax_category'
  ],
  menu_items: [
    'id', 'name', 'name_hi', 'name_bn', 'description', 'description_hi', 'description_bn',
    'price', 'category_id', 'image', 'dietary', 'is_available', 'order_index',
    'featured', 'rating', 'preparation_time', 'spice_level', 'allergens',
    'restaurant_id', 'created_at', 'updated_at', 'tax_category', 'stock_quantity'
  ],
  menu_categories: [
    'id', 'name', 'name_hi', 'name_bn', 'slug', 'order_index', 'is_active',
    'restaurant_id', 'created_at', 'updated_at'
  ],
  customers: [
    'id', 'name', 'phone', 'email', 'first_order_at', 'last_order_at',
    'total_orders', 'total_spend', 'loyalty_points', 'restaurant_id', 'created_at', 'updated_at'
  ],
  discount_codes: [
    'id', 'code', 'discount_type', 'discount_value', 'min_order_amount',
    'max_discount_amount', 'usage_limit', 'times_used', 'is_active',
    'valid_from', 'valid_until', 'restaurant_id', 'created_at'
  ],
  audit_log: [
    'id', 'action', 'entity_type', 'entity_id', 'actor_id', 'actor_role',
    'actor_name', 'old_data', 'new_data', 'restaurant_id', 'created_at', 'ip_address'
  ],
  contact_inquiries: [
    'id', 'name', 'email', 'phone', 'subject', 'message', 'status',
    'restaurant_id', 'created_at', 'updated_at'
  ],
  bills: [
    'id', 'bill_number', 'restaurant_id', 'order_type', 'table_number',
    'customer_name', 'customer_phone', 'subtotal', 'discount_amount', 'discount_code',
    'service_charge_amount', 'tax_amount', 'tip_amount', 'rounded_total',
    'payment_status', 'payment_method', 'paid_amount', 'balance_due',
    'created_at', 'closed_at', 'cash_shift_id', 'created_by', 'closed_by',
    'tax_lines', 'service_charge_rate', 'service_charge_label', 'service_charge_taxable',
    'currency', 'payment_idempotency_key'
  ],
  bill_items: [
    'id', 'bill_id', 'restaurant_id', 'menu_item_id', 'item_name', 'quantity',
    'unit_price', 'total_price', 'notes', 'status', 'kot_batch_id', 'created_at'
  ],
  bill_splits: [
    'id', 'bill_id', 'restaurant_id', 'split_index', 'split_type', 'amount',
    'payment_method', 'payment_status', 'transaction_ref', 'created_at', 'paid_at'
  ],
  cash_shifts: [
    'id', 'restaurant_id', 'staff_id', 'staff_name', 'shift_number',
    'opening_float', 'expected_cash', 'actual_cash', 'cash_difference',
    'total_sales', 'cash_sales', 'card_sales', 'upi_sales', 'other_sales',
    'drawer_open_count', 'opened_at', 'closed_at', 'status', 'notes'
  ],
  cash_drawer_transactions: [
    'id', 'restaurant_id', 'cash_shift_id', 'transaction_type', 'amount',
    'reason', 'authorized_by', 'created_at', 'staff_id'
  ],
  kot_batches: [
    'id', 'bill_id', 'restaurant_id', 'batch_number', 'order_type', 'table_number',
    'server_name', 'items', 'special_instructions', 'status', 'created_at', 'idempotency_key'
  ],
  tax_rules: [
    'id', 'restaurant_id', 'country_code', 'state_code', 'category', 'tax_name',
    'tax_rate', 'is_inclusive', 'valid_from', 'valid_until', 'is_active', 'created_at'
  ]
};

// RPC candidates to probe
const RPC_TESTS = [
  { name: 'calculate_order_totals', args: { p_items: [], p_currency: 'INR' } },
  { name: 'create_order_atomic', args: { p_order: {}, p_items: [] } },
  { name: 'create_reservation_atomic', args: { p_reservation: {} } },
  { name: 'get_currency_decimals', args: { p_currency: 'INR' } },
  { name: 'get_order_status_by_token', args: { p_token: 'test', p_restaurant_id: 'the-cafe-barrackpore' } },
  { name: 'get_shift_z_report', args: { p_shift_id: '00000000-0000-0000-0000-000000000000' } },
  { name: 'get_staff_role', args: {} },
  { name: 'is_active_staff', args: { p_user_id: '00000000-0000-0000-0000-000000000000' } },
  { name: 'is_cashier_or_above', args: { p_user_id: '00000000-0000-0000-0000-000000000000' } },
  { name: 'is_feature_enabled', args: { p_feature_key: 'online_ordering', p_restaurant_id: 'the-cafe-barrackpore' } },
  { name: 'is_manager_or_above', args: { p_user_id: '00000000-0000-0000-0000-000000000000' } },
  { name: 'is_waiter_or_above', args: { p_user_id: '00000000-0000-0000-0000-000000000000' } },
  { name: 'pos_apply_discount', args: { p_bill_id: '00000000-0000-0000-0000-000000000000', p_discount_type: 'percent', p_discount_value: 10 } },
  { name: 'pos_create_or_append_kot', args: { p_table_number: '1', p_items: [] } },
  { name: 'pos_merge_tables', args: { p_source_table: '1', p_target_table: '2' } },
  { name: 'pos_record_drawer_open', args: { p_shift_id: '00000000-0000-0000-0000-000000000000', p_reason: 'manual' } },
  { name: 'pos_transfer_table', args: { p_from_table: '1', p_to_table: '2' } },
  { name: 'pos_verify_manager_pin', args: { p_pin: '1234' } },
  { name: 'pos_void_item', args: { p_bill_item_id: '00000000-0000-0000-0000-000000000000', p_reason: 'guest_cancelled' } },
  { name: 'process_bill_payment', args: { p_bill_id: '00000000-0000-0000-0000-000000000000', p_amount: 100, p_payment_method: 'cash' } },
  { name: 'resolve_dated_tax_rate', args: { p_restaurant_id: 'the-cafe-barrackpore', p_category: 'beverage' } },
  { name: 'split_bill_atomic', args: { p_bill_id: '00000000-0000-0000-0000-000000000000', p_splits: [] } },
  { name: 'submit_contact_inquiry', args: { p_name: 'Test', p_email: 'test@example.com', p_message: 'Hi' } },
  { name: 'toggle_menu_item_availability', args: { p_menu_item_id: '00000000-0000-0000-0000-000000000000', p_is_available: true } },
  { name: 'update_restaurant_features', args: { p_restaurant_id: 'the-cafe-barrackpore', p_features: {} } },
  { name: 'validate_discount_code', args: { p_code: 'WELCOME10' } }
];

async function checkTable(table) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`;
  const res = await fetch(url, {
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
  });
  if (res.status === 404) {
    return { exists: false, status: 404 };
  }
  return { exists: true, status: res.status };
}

async function checkColumn(table, col) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(col)}&limit=1`;
  const res = await fetch(url, {
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
  });
  if (res.status === 400) {
    try {
      const b = await res.json();
      if (b.code === '42703') return false; // column does not exist
    } catch {}
  }
  return true; // 200 or 401/403 or other PG errors mean column is valid in schema
}

async function checkRpc(test) {
  const url = `${SUPABASE_URL}/rest/v1/rpc/${test.name}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(test.args)
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}

  // PostgREST 404 PGRST202 means function not found in schema cache
  if (res.status === 404 && json && json.code === 'PGRST202') {
    return { exists: false, status: 404, message: json.message || json.details };
  }
  // 401 / 403 / 400 (plpgsql exception like P0001) / 200 all mean function exists!
  return { exists: true, status: res.status, code: json?.code, message: json?.message || text.slice(0, 100) };
}

async function main() {
  console.log('================================================================');
  console.log('   THE CAFÉ BARRACKPORE — COMPREHENSIVE LIVE DATABASE AUDIT     ');
  console.log('   Target Supabase Instance: qypceuzyqupepttibqvi.supabase.co   ');
  console.log('================================================================\n');

  console.log('1. AUDITING TABLES...');
  const tableResults = {};
  for (const table of ALL_TABLES) {
    tableResults[table] = await checkTable(table);
  }

  const existingTables = ALL_TABLES.filter(t => tableResults[t].exists);
  const missingTables = ALL_TABLES.filter(t => !tableResults[t].exists);

  console.log(`\nExisting Tables (${existingTables.length} / ${ALL_TABLES.length}):`);
  for (const t of existingTables) {
    console.log(`  [OK] ${t.padEnd(26)} (Status: ${tableResults[t].status})`);
  }

  console.log(`\nMissing Tables (${missingTables.length} / ${ALL_TABLES.length}):`);
  for (const t of missingTables) {
    console.log(`  [MISSING] ${t}`);
  }

  console.log('\n----------------------------------------------------------------');
  console.log('2. AUDITING COLUMNS ON EXISTING TABLES...');
  const columnAudit = {};

  for (const table of existingTables) {
    const expected = EXPECTED_COLUMNS[table] || [];
    if (expected.length === 0) continue;

    columnAudit[table] = { existing: [], missing: [] };
    for (const col of expected) {
      const exists = await checkColumn(table, col);
      if (exists) {
        columnAudit[table].existing.push(col);
      } else {
        columnAudit[table].missing.push(col);
      }
    }
  }

  for (const [table, res] of Object.entries(columnAudit)) {
    if (res.missing.length > 0) {
      console.log(`\nTable "${table}" has MISSING COLUMNS (${res.missing.length}):`);
      for (const c of res.missing) {
        console.log(`  [-] ${c}`);
      }
    } else {
      console.log(`Table "${table}": all ${res.existing.length} audited columns present.`);
    }
  }

  console.log('\n----------------------------------------------------------------');
  console.log('3. AUDITING RPC FUNCTIONS...');
  const rpcResults = [];
  for (const test of RPC_TESTS) {
    const res = await checkRpc(test);
    rpcResults.push({ name: test.name, ...res });
  }

  const existingRpcs = rpcResults.filter(r => r.exists);
  const missingRpcs = rpcResults.filter(r => !r.exists);

  console.log(`\nExisting RPCs (${existingRpcs.length} / ${RPC_TESTS.length}):`);
  for (const r of existingRpcs) {
    console.log(`  [OK] ${r.name.padEnd(32)} (Status: ${r.status}, PG Code: ${r.code || 'None'})`);
  }

  console.log(`\nMissing RPCs (${missingRpcs.length} / ${RPC_TESTS.length}):`);
  for (const r of missingRpcs) {
    console.log(`  [MISSING] ${r.name.padEnd(32)} (${r.message || 'Not found'})`);
  }

  console.log('\n================================================================');
  console.log('   AUDIT COMPLETE');
  console.log('================================================================');

  // Save report to disk as JSON for programmatic use
  fs.writeFileSync(
    path.join(__dirname, 'live_database_audit_result.json'),
    JSON.stringify({ existingTables, missingTables, columnAudit, existingRpcs, missingRpcs }, null, 2),
    'utf8'
  );
}

main().catch(console.error);
