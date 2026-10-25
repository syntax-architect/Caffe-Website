import fs from 'node:fs';
import path from 'node:path';

/**
 * Test: Ensure no literal HTML entities (&amp;, &lt;, &gt;, &#123;) exist inside string literals in src and src/i18n
 */
console.log('=== VERIFYING NO HTML ENTITIES IN STRINGS (src & src/i18n) ===');

const ENTITY_REGEX = /&amp;|&lt;|&gt;|&#\d+;/g;
const srcDir = path.resolve(process.cwd(), 'src');

const violations: Array<{ file: string; line: number; match: string; text: string }> = [];

function scanDirectory(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git') {
        scanDirectory(fullPath);
      }
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        // Strip out comments if needed, but entity check in code/strings:
        const matches = line.match(ENTITY_REGEX);
        if (matches) {
          // Ignore comments explaining this regex if any
          if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
          for (const m of matches) {
            violations.push({
              file: path.relative(process.cwd(), fullPath),
              line: idx + 1,
              match: m,
              text: line.trim()
            });
          }
        }
      });
    }
  }
}

scanDirectory(srcDir);

if (violations.length > 0) {
  console.error(`❌ Found ${violations.length} HTML entity violations:`);
  violations.forEach(v => {
    console.error(`  - ${v.file}:${v.line} [${v.match}] -> ${v.text}`);
  });
  throw new Error(`HTML entity check failed: Found ${violations.length} entity occurrences in src.`);
} else {
  console.log('✔ Passed: Zero HTML entity violations found across all files in src and src/i18n.');
}
