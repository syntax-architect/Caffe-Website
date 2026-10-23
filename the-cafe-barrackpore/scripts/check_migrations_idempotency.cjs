const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'supabase', 'migrations');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

console.log(`Auditing ${files.length} migration files for idempotency...\n`);

const issues = [];

files.forEach(file => {
  const content = fs.readFileSync(path.join(dir, file), 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('--')) return;

    // Check CREATE TABLE without IF NOT EXISTS
    if (/CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/i.test(trimmed)) {
      issues.push({ file, line: idx + 1, type: 'CREATE TABLE without IF NOT EXISTS', text: trimmed });
    }

    // Check ADD COLUMN without IF NOT EXISTS
    if (/ADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS)/i.test(trimmed)) {
      issues.push({ file, line: idx + 1, type: 'ADD COLUMN without IF NOT EXISTS', text: trimmed });
    }

    // Check CREATE INDEX without IF NOT EXISTS
    if (/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?!IF\s+NOT\s+EXISTS)/i.test(trimmed)) {
      issues.push({ file, line: idx + 1, type: 'CREATE INDEX without IF NOT EXISTS', text: trimmed });
    }

    // Check CREATE POLICY without DROP POLICY IF EXISTS
    if (/CREATE\s+POLICY\s+/i.test(trimmed)) {
      // Check if preceding 10 lines had DROP POLICY IF EXISTS
      const prevLines = lines.slice(Math.max(0, idx - 10), idx).join(' ');
      if (!/DROP\s+POLICY\s+IF\s+EXISTS/i.test(prevLines)) {
        issues.push({ file, line: idx + 1, type: 'CREATE POLICY without preceding DROP POLICY IF EXISTS', text: trimmed });
      }
    }

    // Check CREATE TRIGGER without DROP TRIGGER IF EXISTS
    if (/CREATE\s+TRIGGER\s+/i.test(trimmed)) {
      const prevLines = lines.slice(Math.max(0, idx - 10), idx).join(' ');
      if (!/DROP\s+TRIGGER\s+IF\s+EXISTS/i.test(prevLines)) {
        issues.push({ file, line: idx + 1, type: 'CREATE TRIGGER without preceding DROP TRIGGER IF EXISTS', text: trimmed });
      }
    }

    // Check ADD CONSTRAINT without guard
    if (/ADD\s+CONSTRAINT\s+/i.test(trimmed)) {
      const prevLines = lines.slice(Math.max(0, idx - 5), idx).join(' ');
      if (!/DROP\s+CONSTRAINT\s+IF\s+EXISTS/i.test(prevLines) && !/DO\s+\$\$/i.test(prevLines)) {
        issues.push({ file, line: idx + 1, type: 'ADD CONSTRAINT without DROP or DO block', text: trimmed });
      }
    }
  });
});

console.log(`Found ${issues.length} potential idempotency friction points across migrations:`);
const byFile = {};
issues.forEach(iss => {
  byFile[iss.file] = byFile[iss.file] || [];
  byFile[iss.file].push(iss);
});

for (const [file, list] of Object.entries(byFile)) {
  console.log(`\nFile: ${file} (${list.length} issues)`);
  list.slice(0, 10).forEach(i => console.log(`  Line ${i.line}: [${i.type}] ${i.text.slice(0, 70)}`));
  if (list.length > 10) console.log(`  ... and ${list.length - 10} more`);
}
