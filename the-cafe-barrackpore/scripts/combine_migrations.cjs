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
  '008_payment_architecture.sql'
];

let combined = `-- ==============================================================================
-- COMPLETE DATABASE INITIALIZATION SCRIPT: The Café Barrackpore
-- Runs all migrations (001 - 008) in proper dependency order.
-- Copy and paste this ENTIRE script into Supabase Dashboard -> SQL Editor and click Run.
-- ==============================================================================

`;

for (const file of files) {
  const filePath = path.join(migrationsDir, file);
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
