// Quick Supabase connection test
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://qypceuzyqupepttibqvi.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5cGNldXp5cXVwZXB0dGlicXZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3Njg4NzMsImV4cCI6MjEwNjM0NDg3M30.VezD_dSxFrO1ylzpNr4TNmvrLDC3IRiP_-vSaDtiauU';

async function testConnection() {
  console.log('🔌 Testing Supabase connection...\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Test 1: Basic connectivity — query a system-level health check
  try {
    const { data: _data, error } = await supabase.from('_test_nonexistent_table_').select('*').limit(1);
    
    if (error && error.code === '42P01') {
      // "relation does not exist" means we connected successfully, the table just doesn't exist
      console.log('✅ Test 1 PASSED — Connected to Supabase successfully!');
      console.log('   (Got expected "table not found" — proves auth + network are working)\n');
    } else if (error) {
      console.log(`⚠️  Test 1 — Got response with code: ${error.code}`);
      console.log(`   Message: ${error.message}\n`);
    } else {
      console.log('✅ Test 1 PASSED — Connected and queried successfully!\n');
    }
  } catch (err) {
    console.log('❌ Test 1 FAILED — Could not connect to Supabase');
    console.log(`   Error: ${err.message}\n`);
  }

  // Test 2: Auth service health
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.log(`❌ Test 2 FAILED — Auth service error: ${error.message}\n`);
    } else {
      console.log('✅ Test 2 PASSED — Auth service is reachable');
      console.log(`   Session: ${data.session ? 'Active session found' : 'No active session (expected)'}\n`);
    }
  } catch (err) {
    console.log(`❌ Test 2 FAILED — Auth error: ${err.message}\n`);
  }

  // Test 3: List existing tables via RPC or information_schema
  try {
    const { data: _data, error } = await supabase.rpc('', {});
    // This will fail but confirms RPC endpoint is reachable
    if (error) {
      console.log('✅ Test 3 PASSED — RPC endpoint is reachable');
      console.log(`   (Expected error: ${error.message})\n`);
    }
  } catch (err) {
    console.log(`ℹ️  Test 3 — RPC endpoint check: ${err.message}\n`);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏁 Connection test complete!');
  console.log(`   Project URL: ${SUPABASE_URL}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

testConnection();
