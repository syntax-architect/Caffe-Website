import { createClient } from '@supabase/supabase-js';
import { seedVerifiedToken } from '../scripts/seed-test-token';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.log('Environment variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set.');
  console.log('Skipping live database verification (requires live database environment).');
  process.exit(0);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verifyLiveEnvironment() {
  console.log('================================================================');
  console.log('POST-MIGRATION 019 LIVE DATABASE VERIFICATION');
  console.log('Target: ' + SUPABASE_URL);
  console.log('================================================================\n');

  // Step 1: Submit Contact Form
  console.log('1. Submitting Contact Inquiry to Database via submit_contact_inquiry RPC...');
  const testRef = 'INQ-LIVE-' + Math.floor(1000 + Math.random() * 9000);
  const testContactToken = 'token_contact_' + Math.floor(100000 + Math.random() * 900000);

  // Seed token for contact action using service role key script
  try {
    await seedVerifiedToken(testContactToken, 'contact');
    console.log('   ✔ Test contact token seeded via service role key.');
  } catch (seedErr: any) {
    console.log('   [NOTICE] Could not seed contact token (service role key not configured):', seedErr.message);
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc('submit_contact_inquiry', {
    payload: {
      restaurant_id: 'the-cafe-barrackpore',
      inquiry_ref: testRef,
      name: 'Siddhartha Mukherjee',
      phone: '+919830123456',
      email: 'siddhartha@example.com',
      subject: 'catering',
      message: 'Requesting gourmet catering quote for 50 guests in Barrackpore Cantonment.'
    },
    verified_token: testContactToken
  });

  if (rpcError || !rpcData?.success) {
    console.log('   Submission result:', rpcError?.message || rpcData);
  } else {
    console.log('   ✔ submit_contact_inquiry RPC succeeded:', JSON.stringify(rpcData));

    // Confirm in Database with required phone number
    const actualInquiryRef = rpcData?.inquiry_ref || testRef;
    console.log(`\n2. Verifying Inquiry ${actualInquiryRef} in Database via get_contact_inquiry_status RPC...`);
    const { data: statusData, error: statusError } = await supabase.rpc('get_contact_inquiry_status', {
      p_inquiry_ref: actualInquiryRef,
      p_phone: '+919830123456'
    });

    if (statusError) {
      console.log('   Inquiry status RPC error:', statusError);
    } else {
      console.log('   ✔ Confirmed in Database! Record:', JSON.stringify(statusData));
      if (statusData && 'message' in statusData) {
        console.error('   ❌ SECURITY FLAW: get_contact_inquiry_status leaked message!');
      } else {
        console.log('   ✔ Confirmed: Only status returned, message is private.');
      }
    }
  }

  // Step 2: Seed Test Verified Token and Place Real Order
  console.log('\n3. Testing Token Seeder and Order Placement (create_order_atomic)...');
  const testToken = 'token_test_' + Math.floor(100000 + Math.random() * 900000);
  let tokenSeeded = false;
  try {
    await seedVerifiedToken(testToken, 'order');
    console.log('   ✔ Test verified token seeded successfully via service role key.');
    tokenSeeded = true;
  } catch (seedErr: any) {
    console.log('   [NOTICE] Service role key seeder skipped:', seedErr.message);
  }

  if (tokenSeeded) {
    const orderRef = 'ORD-LIVE-' + Math.floor(10000 + Math.random() * 90000);
    const { data: orderData, error: orderError } = await supabase.rpc('create_order_atomic', {
      p_order: {
        order_ref: orderRef,
        restaurant_id: 'the-cafe-barrackpore',
        customer_name: 'Siddhartha Mukherjee',
        customer_phone: '+919830123456',
        order_type: 'dine_in',
        table_number: '7',
        special_requests: 'Fresh mint please',
        source: 'website',
        currency: 'INR',
        payment_method: 'online',
        payment_provider: 'razorpay',
        payment_reference: 'pay_test_seeded_' + Date.now(),
        verified_token: testToken
      },
      p_items: [
        {
          id: 'hot-and-sour-soup',
          quantity: 1,
          selected_options: {}
        }
      ]
    });

    if (orderError) {
      console.log('   Order placement error:', orderError);
    } else {
      console.log('   ✔ Order placed atomically in database! ID:', orderData?.order_id, 'Ref:', orderData?.order_ref);

      // Verify order status retrieval using single-use payment token
      if (orderData?.order_ref && orderData?.payment_token) {
        console.log(`\n4. Verifying Order ${orderData.order_ref} via get_order_status_by_token RPC...`);
        const { data: orderStatus, error: tokenError } = await supabase.rpc('get_order_status_by_token', {
          p_order_ref: orderData.order_ref,
          p_payment_token: orderData.payment_token
        });

        if (tokenError) {
          console.log('   Order token query error:', tokenError);
        } else {
          console.log('   ✔ Confirmed in Database! Order record:', JSON.stringify(orderStatus));
        }
      }
    }
  }

  console.log('\n================================================================');
  console.log('VERIFICATION RUN COMPLETE');
  console.log('================================================================');
}

verifyLiveEnvironment().catch(console.error);
