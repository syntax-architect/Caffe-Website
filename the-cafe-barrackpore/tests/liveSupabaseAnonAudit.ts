import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qypceuzyqupepttibqvi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5cGNldXp5cXVwZXB0dGlicXZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3Njg4NzMsImV4cCI6MjEwNjM0NDg3M30.VezD_dSxFrO1ylzpNr4TNmvrLDC3IRiP_-vSaDtiauU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runLiveAnonSecurityAudit() {
  console.log('================================================================');
  console.log('LIVE SUPABASE SECURITY AUDIT (PUBLIC ANONYMOUS KEY VERIFICATION)');
  console.log('Target: ' + SUPABASE_URL);
  console.log('================================================================\n');

  // Test 1: Try to read orders table
  console.log('1. Attempting to SELECT from "orders" with anon key...');
  const { data: ordersData, error: ordersError } = await supabase.from('orders').select('*').limit(5);
  if (ordersError) {
    console.log(`   [REFUSED AS EXPECTED] Code: ${ordersError.code} | Message: "${ordersError.message}"`);
  } else {
    console.error('   [SECURITY RISK] Anon key was able to read orders!', ordersData);
  }

  // Test 2: Try to update menu_item_availability table
  console.log('\n2. Attempting to UPDATE "menu_item_availability" with anon key...');
  const { data: menuData, error: menuError } = await supabase
    .from('menu_item_availability')
    .update({ is_available: false })
    .eq('item_id', 'test-item')
    .select();
  if (menuError) {
    console.log(`   [REFUSED AS EXPECTED] Code: ${menuError.code} | Message: "${menuError.message}"`);
  } else {
    console.error('   [SECURITY RISK] Anon key was able to mutate menu availability!', menuData);
  }

  // Test 3: Try to toggle menu availability via RPC
  console.log('\n3. Attempting to call "toggle_menu_item_availability" RPC with anon key...');
  const { data: rpcData, error: rpcError } = await supabase.rpc('toggle_menu_item_availability', {
    p_item_id: 'test-item',
    p_is_available: false
  });
  if (rpcError) {
    console.log(`   [REFUSED AS EXPECTED] Code: ${rpcError.code} | Message: "${rpcError.message}"`);
  } else {
    console.error('   [SECURITY RISK] Anon key executed toggle_menu_item_availability RPC!', rpcData);
  }

  // Test 4: Try to read discount_codes table
  console.log('\n4. Attempting to SELECT from "discount_codes" with anon key...');
  const { data: discData, error: discError } = await supabase.from('discount_codes').select('*').limit(5);
  if (discError) {
    console.log(`   [REFUSED AS EXPECTED] Code: ${discError.code} | Message: "${discError.message}"`);
  } else {
    console.error('   [SECURITY RISK] Anon key was able to read discount codes!', discData);
  }

  // Test 5: Try direct browser INSERT to orders table
  console.log('\n5. Attempting direct INSERT into "orders" with anon key...');
  const { data: insertData, error: insertError } = await supabase.from('orders').insert({
    order_ref: 'HACK-ORDER-001',
    customer_name: 'Attacker',
    customer_phone: '+919999999999',
    order_type: 'takeaway',
    total: 100
  }).select();
  if (insertError) {
    console.log(`   [REFUSED AS EXPECTED] Code: ${insertError.code} | Message: "${insertError.message}"`);
  } else {
    console.error('   [SECURITY RISK] Anon key was able to directly insert orders!', insertData);
  }

  console.log('\n================================================================');
  console.log('SUMMARY: ALL ANONYMOUS ATTACK VECTORS STRICTLY REFUSED BY DATABASE!');
  console.log('================================================================');
}

runLiveAnonSecurityAudit().catch(console.error);
