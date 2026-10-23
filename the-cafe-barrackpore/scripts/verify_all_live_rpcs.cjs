const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5cGNldXp5cXVwZXB0dGlicXZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3Njg4NzMsImV4cCI6MjEwNjM0NDg3M30.VezD_dSxFrO1ylzpNr4TNmvrLDC3IRiP_-vSaDtiauU';
const SUPABASE_URL = 'https://qypceuzyqupepttibqvi.supabase.co';

const candidateRpcs = [
  'create_order_atomic',
  'create_reservation_atomic',
  'get_currency_decimals',
  'get_order_status_by_token',
  'get_shift_z_report',
  'get_staff_role',
  'is_active_staff',
  'is_cashier_or_above',
  'is_feature_enabled',
  'is_manager_or_above',
  'is_waiter_or_above',
  'pos_apply_discount',
  'pos_create_or_append_kot',
  'pos_merge_tables',
  'pos_record_drawer_open',
  'pos_transfer_table',
  'pos_verify_manager_pin',
  'pos_void_item',
  'process_bill_payment',
  'resolve_dated_tax_rate',
  'split_bill_atomic',
  'submit_contact_inquiry',
  'toggle_menu_item_availability',
  'update_restaurant_features',
  'validate_discount_code',
  'void_or_refund_order_secure'
];

async function verifyRpc(name) {
  const url = `${SUPABASE_URL}/rest/v1/rpc/${name}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ dummy_arg_for_probing: 1 })
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}

  if (res.status === 404 && json && json.code === 'PGRST202') {
    if (json.hint && json.hint.includes('Perhaps you meant to call')) {
      return { exists: true, status: 'EXISTS', hint: json.hint };
    }
    return { exists: false, status: 'NOT FOUND', hint: null };
  }
  return { exists: true, status: `HTTP ${res.status} (${json?.code || 'OK'})`, hint: null };
}

async function main() {
  console.log('Probing all candidate RPCs on Supabase...\n');
  const results = [];
  for (const name of candidateRpcs) {
    const res = await verifyRpc(name);
    results.push({ name, ...res });
  }

  console.log('=== RPC STATUS REPORT ===');
  for (const r of results) {
    if (r.exists) {
      console.log(`[OK]   ${r.name.padEnd(32)}: ${r.hint || r.status}`);
    } else {
      console.log(`[FAIL] ${r.name.padEnd(32)}: NOT IN SCHEMA CACHE`);
    }
  }

  const existingCount = results.filter(r => r.exists).length;
  console.log(`\nTotal verified in database: ${existingCount} / ${candidateRpcs.length}`);
}

main();
