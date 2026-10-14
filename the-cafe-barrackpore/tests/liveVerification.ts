import { createClient } from '@supabase/supabase-js';
import { submitContactInquiry } from '../src/services/contactService';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://qypceuzyqupepttibqvi.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5cGNldXp5cXVwZXB0dGlicXZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3Njg4NzMsImV4cCI6MjEwNjM0NDg3M30.VezD_dSxFrO1ylzpNr4TNmvrLDC3IRiP_-vSaDtiauU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verifyLiveEnvironment() {
  console.log('================================================================');
  console.log('POST-MIGRATION 018 LIVE DATABASE VERIFICATION');
  console.log('Target: ' + SUPABASE_URL);
  console.log('================================================================\n');

  // Step 1: Submit Contact Form
  console.log('1. Submitting Contact Inquiry to Database via submit_contact_inquiry RPC...');
  const testRef = 'INQ-LIVE-' + Math.floor(1000 + Math.random() * 9000);
  const testContactToken = 'token_contact_' + Math.floor(100000 + Math.random() * 900000);

  // Seed token for contact action
  await supabase.rpc('create_verified_token_for_test', {
    p_token: testContactToken,
    p_action: 'contact'
  });

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
    console.log('   Submission error:', rpcError || rpcData);
  } else {
    console.log('   ✔ submit_contact_inquiry RPC succeeded:', JSON.stringify(rpcData));

    // Confirm in Database
    console.log(`\n2. Verifying Inquiry ${testRef} in Database via get_contact_inquiry_status RPC...`);
    const { data: statusData, error: statusError } = await supabase.rpc('get_contact_inquiry_status', {
      p_inquiry_ref: testRef
    });

    if (statusError) {
      console.log('   Inquiry status RPC error:', statusError);
    } else {
      console.log('   ✔ Confirmed in Database! Record:', JSON.stringify(statusData));
    }
  }

  // Step 2: Seed Test Verified Token and Place Real Order
  console.log('\n3. Testing Token Seeder and Order Placement (create_order_atomic)...');
  const testToken = 'token_test_' + Math.floor(100000 + Math.random() * 900000);
  const { error: seedError } = await supabase.rpc('create_verified_token_for_test', {
    p_token: testToken,
    p_action: 'order'
  });

  if (seedError) {
    console.log('   [PENDING] create_verified_token_for_test RPC pending migration 018:', seedError.message);
  } else {
    console.log('   ✔ Test verified token seeded successfully.');

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
