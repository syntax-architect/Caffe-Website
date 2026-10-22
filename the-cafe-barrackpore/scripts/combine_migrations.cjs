const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
const files = [
  '001_initial_orders.sql',
  '002_reservations.sql',
  '003_staff_profiles.sql',
  '004_restaurant_tables.sql',
  '005_menu_availability.sql',
  '006_kitchen_realtime.sql',
  '007_internationalization.sql',
  '008_payment_architecture.sql',
  '009_menu_and_secure_orders.sql',
  '010_menu_and_site_content.sql',
  '011_multi_tenant_and_allergens.sql',
  '012_provider_agnostic_payments.sql',
  '013_owner_features.sql',
  '014_order_caps_and_direct_insert_lockdown.sql',
  '015_complete_image_sync.sql',
  '016_security_hardening.sql',
  '017_indexing_and_audit_log.sql',
  '018_contact_inquiries.sql',
  '019_contact_inquiries_hardening.sql',
  '020_payment_ledger_and_order_status.sql',
  '021_pos_billing_shifts_and_drawer.sql',
  '022_restaurant_feature_toggles.sql',
  '023_dated_tax_registry.sql',
  '024_financial_parity_tax_and_money_logic.sql'
];

let combined = `-- ==============================================================================
-- COMPLETE DATABASE INITIALIZATION SCRIPT
-- Runs all migrations (001 - 024) in proper dependency order.
-- Copy and paste this ENTIRE script into Supabase Dashboard -> SQL Editor and click Run.
-- ==============================================================================

`;

for (const file of files) {
  const filePath = path.join(migrationsDir, file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Migration file missing: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  combined += `\n-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>\n` +
              `-- START OF: ${file}\n` +
              `-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>\n\n` +
              content.trim() + '\n\n';
}

const outputPath = path.join(__dirname, '..', 'supabase', 'all_migrations_combined.sql');
fs.writeFileSync(outputPath, combined, 'utf8');
console.log('Successfully created:', outputPath);
console.log('Total characters:', combined.length);
