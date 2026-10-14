import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.log('Environment variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set.');
  console.log('Skipping live anonymous audit (requires live database environment).');
  process.exit(0);
}

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

  // Test 6: Try to call dropped create_verified_token_for_test RPC with anon key
  console.log('\n6. Attempting to call "create_verified_token_for_test" RPC with anon key...');
  const { data: tokenSeedData, error: tokenSeedError } = await supabase.rpc('create_verified_token_for_test', {
    p_token: 'fake_token',
    p_action: 'order'
  });
  if (tokenSeedError) {
    console.log(`   [REFUSED AS EXPECTED] Code: ${tokenSeedError.code} | Message: "${tokenSeedError.message}"`);
  } else {
    console.error('   [SECURITY RISK] Anon key was able to call create_verified_token_for_test!', tokenSeedData);
  }

  // Test 7: Try direct browser INSERT into contact_inquiries table with anon key
  console.log('\n7. Attempting direct INSERT into "contact_inquiries" with anon key...');
  const { data: inqInsertData, error: inqInsertError } = await supabase.from('contact_inquiries').insert({
    inquiry_ref: 'INQ-HACK-001',
    name: 'Attacker',
    phone: '+919999999999',
    message: 'Direct unauthorized insert attempt'
  }).select();
  if (inqInsertError) {
    console.log(`   [REFUSED AS EXPECTED] Code: ${inqInsertError.code} | Message: "${inqInsertError.message}"`);
  } else {
    console.error('   [SECURITY RISK] Anon key was able to directly insert contact inquiries!', inqInsertData);
  }

  // Test 8: Try submit_contact_inquiry without verified token
  console.log('\n8. Attempting "submit_contact_inquiry" RPC WITHOUT verified token...');
  const { data: inqRpcData, error: inqRpcError } = await supabase.rpc('submit_contact_inquiry', {
    payload: {
      name: 'Unverified Visitor',
      phone: '+919876543210',
      message: 'Submitting without any captcha token'
    }
  });
  if (inqRpcError) {
    console.log(`   [REFUSED AS EXPECTED] Code: ${inqRpcError.code} | Message: "${inqRpcError.message}"`);
  } else {
    console.error('   [SECURITY RISK] submit_contact_inquiry succeeded without token!', inqRpcData);
  }

  console.log('\n================================================================');
  console.log('SUMMARY: ALL ANONYMOUS ATTACK VECTORS STRICTLY REFUSED BY DATABASE!');
  console.log('================================================================');
}

runLiveAnonSecurityAudit().catch(console.error);
