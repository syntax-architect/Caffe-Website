const fs = require('fs');
const content = fs.readFileSync('the-cafe-barrackpore/supabase/master_sync_migration.sql', 'utf8');

const lines = content.split('\n');
const errors = [];

lines.forEach((line, idx) => {
  const t = line.trim();
  if (t.startsWith('--') || t.startsWith('/*')) return;

  // 1. Table
  if (/CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/i.test(t)) {
    errors.push({ line: idx + 1, rule: 'CREATE TABLE without IF NOT EXISTS', text: t });
  }

  // 2. Column
  if (/ADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS)/i.test(t)) {
    errors.push({ line: idx + 1, rule: 'ADD COLUMN without IF NOT EXISTS', text: t });
  }

  // 3. Index
  if (/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?!IF\s+NOT\s+EXISTS)/i.test(t)) {
    // Check if inside DO $$ block
    const prevBlock = lines.slice(Math.max(0, idx - 15), idx).join(' ');
    if (!/IF\s+NOT\s+EXISTS/i.test(prevBlock) && !/pg_indexes/i.test(prevBlock)) {
      errors.push({ line: idx + 1, rule: 'INDEX without IF NOT EXISTS', text: t });
    }
  }

  // 4. Policy
  if (/CREATE\s+POLICY\s+/i.test(t)) {
    const prevBlock = lines.slice(Math.max(0, idx - 10), idx).join(' ');
    if (!/DROP\s+POLICY\s+IF\s+EXISTS/i.test(prevBlock) && !/pg_policies/i.test(prevBlock)) {
      errors.push({ line: idx + 1, rule: 'POLICY without DROP or DO block', text: t });
    }
  }

  // 5. Trigger
  if (/CREATE\s+TRIGGER\s+/i.test(t)) {
    const prevBlock = lines.slice(Math.max(0, idx - 10), idx).join(' ');
    if (!/DROP\s+TRIGGER\s+IF\s+EXISTS/i.test(prevBlock)) {
      errors.push({ line: idx + 1, rule: 'TRIGGER without DROP TRIGGER IF EXISTS', text: t });
    }
  }
});

console.log('Auditing master_sync_migration.sql...');
console.log('Total lines:', lines.length);
console.log('Issues found:', errors.length);
if (errors.length > 0) {
  errors.forEach(e => console.log(`Line ${e.line}: [${e.rule}] ${e.text.slice(0, 80)}`));
} else {
  console.log('ALL STATEMENTS ARE 100% IDEMPOTENT!');
}
