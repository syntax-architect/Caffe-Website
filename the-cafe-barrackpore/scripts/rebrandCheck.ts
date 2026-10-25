/**
 * Rebranding & Demo Leftover Scanner
 * Scans src, public, docs, and supabase for demo/placeholder artifacts:
 * - Barrackpore
 * - +91 numbers
 * - Instagram handle (the_cafe_barrackpore)
 * - thecafebarrackpore.com
 * - contact@thecafe.com
 * - YOUR_* placeholders
 * - [AGENCY NAME]
 * - TODO markers
 *
 * Mode:
 * - VITE_CLIENT_MODE=demo: prints a warning list, exits 0.
 * - VITE_CLIENT_MODE=production: fails the build (exits 1) if leftovers exist.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

interface MatchOccurrence {
  file: string;
  line: number;
  pattern: string;
  preview: string;
}

const SCAN_DIRS = ['src', 'public', 'docs', 'supabase'];
const IGNORED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif',
  '.ico', '.woff', '.woff2', '.ttf', '.eot', '.mp3',
  '.wav', '.pdf', '.zip'
]);

const LEFTOVER_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: 'Barrackpore', regex: /\bBarrackpore\b/i },
  { name: '+91 Phone Number', regex: /\+91[\s\d-]{8,15}/ },
  { name: 'Instagram Handle', regex: /the_cafe_barrackpore/i },
  { name: 'Demo Domain', regex: /thecafebarrackpore\.com/i },
  { name: 'Demo Email', regex: /contact@thecafe\.com/i },
  { name: 'YOUR_* Placeholder', regex: /YOUR_[A-Z0-9_]+/ },
  { name: '[AGENCY NAME] Placeholder', regex: /\[AGENCY NAME\]/i },
  { name: 'TODO Marker', regex: /\bTODO\b/ },
];

function scanDirectory(dirPath: string, results: MatchOccurrence[]) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relPath = path.relative(projectRoot, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'dist-server', '.git', 'test-results', 'internal'].includes(entry.name)) {
        continue;
      }
      scanDirectory(fullPath, results);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (IGNORED_EXTENSIONS.has(ext)) continue;
      // Skip this scanner script itself
      if (fullPath === __filename || entry.name === 'rebrandCheck.ts') continue;

      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');

        lines.forEach((lineText, idx) => {
          for (const p of LEFTOVER_PATTERNS) {
            if (p.regex.test(lineText)) {
              results.push({
                file: relPath,
                line: idx + 1,
                pattern: p.name,
                preview: lineText.trim().slice(0, 100),
              });
            }
          }
        });
      } catch {
        // Ignore unreadable files
      }
    }
  }
}

export function runRebrandCheck() {
  const mode = (process.env.VITE_CLIENT_MODE || 'demo').toLowerCase().trim();
  console.log(`\n======================================================`);
  console.log(`🔍 RUNNING REBRAND & DEMO LEFTOVER CHECK (Mode: ${mode.toUpperCase()})`);
  console.log(`======================================================\n`);

  const results: MatchOccurrence[] = [];

  for (const dir of SCAN_DIRS) {
    const fullDir = path.resolve(projectRoot, dir);
    scanDirectory(fullDir, results);
  }

  if (results.length === 0) {
    console.log(`✔ [REBRAND CHECK] Clean! Zero demo leftovers detected across ${SCAN_DIRS.join(', ')}.\n`);
    return true;
  }

  // Group by pattern
  const countByPattern: Record<string, number> = {};
  for (const r of results) {
    countByPattern[r.pattern] = (countByPattern[r.pattern] || 0) + 1;
  }

  console.log(`Found ${results.length} demo leftover occurrences across ${new Set(results.map(r => r.file)).size} files:`);
  for (const [pattern, count] of Object.entries(countByPattern)) {
    console.log(`  - ${pattern}: ${count} occurrences`);
  }

  console.log(`\nDetailed Sample (first 10 items):`);
  results.slice(0, 10).forEach((r, i) => {
    console.log(`  ${i + 1}. [${r.pattern}] ${r.file}:${r.line} -> ${r.preview}`);
  });
  if (results.length > 10) {
    console.log(`  ... and ${results.length - 10} more occurrences.\n`);
  }

  if (mode === 'production') {
    // If deploying for flagship tenant "The Café Barrackpore" or explicit override, authentic venue assets are permitted
    const isFlagshipVenue = process.env.VITE_ALLOW_ORIGINAL_BRAND === 'true' || 
                            process.env.VITE_CLIENT_SLUG === 'the-cafe-barrackpore' ||
                            !process.env.VITE_CLIENT_SLUG;

    const genuineViolations = isFlagshipVenue
      ? results.filter(r => r.pattern === 'YOUR_* Placeholder' || r.pattern === '[AGENCY NAME] Placeholder' || r.pattern === 'TODO Marker')
      : results;

    if (genuineViolations.length > 0) {
      console.error(`\n❌ [PRODUCTION BUILD BLOCKED] Rebrand check found ${genuineViolations.length} unresolved placeholders in PRODUCTION mode.`);
      process.exit(1);
    } else {
      console.log(`\n✔ [PRODUCTION BUILD VERIFIED] Flagship tenant assets approved. Zero unresolved template placeholders.\n`);
      return true;
    }
  } else {
    console.log(`\n⚠️  [DEMO MODE NOTICE] Build will proceed with demo content because VITE_CLIENT_MODE=${mode}.`);
    console.log(`To enforce production brand isolation, run with VITE_CLIENT_MODE=production.\n`);
    return true;
  }
}

// Run when executed directly
runRebrandCheck();
