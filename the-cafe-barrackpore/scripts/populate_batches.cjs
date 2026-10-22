const fs = require('fs');
const path = require('path');

const repoDir = path.resolve(__dirname, '..');

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const relPath = path.relative(repoDir, fullPath).split(path.sep).join('/');
    if (
      relPath.startsWith('node_modules') ||
      relPath.startsWith('.git') ||
      relPath.startsWith('dist') ||
      relPath.startsWith('test-results') ||
      relPath.startsWith('lighthouse-report') ||
      relPath === 'AUDIT_LEDGER.md'
    ) {
      continue;
    }
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getAllFiles(fullPath, fileList);
    } else {
      fileList.push(relPath);
    }
  }
  return fileList;
}

const all = getAllFiles(repoDir);
console.log('Total tracked files found:', all.length);

const batches = {
  1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: [], 10: [], 11: [], 12: []
};

for (const f of all) {
  if (f.startsWith('supabase/migrations/') || f === 'supabase/all_migrations_combined.sql') {
    batches[1].push(f);
  } else if (f.startsWith('supabase/functions/')) {
    batches[2].push(f);
  } else if (f.startsWith('src/services/')) {
    batches[3].push(f);
  } else if (f.startsWith('src/utils/')) {
    batches[4].push(f);
  } else if (f.startsWith('src/context/') || f.startsWith('src/hooks/')) {
    batches[5].push(f);
  } else if (f.startsWith('src/components/')) {
    batches[6].push(f);
  } else if (f.startsWith('src/config/') || f.startsWith('src/types/') || f.startsWith('src/data/') || f.startsWith('src/lib/')) {
    batches[7].push(f);
  } else if (f.startsWith('src/i18n/')) {
    batches[8].push(f);
  } else if (f.startsWith('scripts/')) {
    batches[9].push(f);
  } else if (f.startsWith('tests/') || f.startsWith('e2e/')) {
    batches[11].push(f);
  } else if (f.startsWith('docs/') || f.startsWith('public/')) {
    batches[12].push(f);
  } else {
    // Root configs, build files, src root files (App.tsx, main.tsx, etc.)
    batches[10].push(f);
  }
}

for (let i = 1; i <= 12; i++) {
  console.log(`Batch ${i}: ${batches[i].length} files`);
}
