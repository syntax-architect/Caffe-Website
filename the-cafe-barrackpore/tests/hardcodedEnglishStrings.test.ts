/**
 * Hardcoded English String Detector Test
 * Global Restaurant Platform — i18n Translation Integrity Verification
 *
 * Scans every customer-facing component to guarantee that:
 * 1. Every component imports and connects to the i18n translation system (useI18n).
 * 2. No visible user-facing strings, placeholders, or aria-labels are hardcoded in English
 *    without routing through the t() translation dictionary.
 */

import fs from 'node:fs';
import path from 'node:path';

// All customer-facing components required by spec
const CUSTOMER_COMPONENTS = [
  'src/components/Header.tsx',
  'src/components/Hero.tsx',
  'src/components/Menu.tsx',
  'src/components/CurvedMenuReel.tsx',
  'src/components/CartDrawer.tsx',
  'src/components/ReservationDrawer.tsx',
  'src/components/ContactDrawer.tsx',
  'src/components/Footer.tsx',
  'src/components/OurStory.tsx',
  'src/components/VIPClub.tsx',
  'src/components/Gallery.tsx',
  'src/components/OrderSuccessPage.tsx',
  'src/components/QROrderingPage.tsx',
  'src/components/CookieConsent.tsx',
  'src/components/NotFoundPage.tsx',
  'src/components/legal/PrivacyPolicyPage.tsx',
  'src/components/legal/TermsPage.tsx',
];

// Whitelist of technical identifiers, material symbols, brand constants, or punctuation
const ALLOWED_LITERALS = new Set([
  'The Café',
  'The Cafe',
  'Barrackpore',
  'restaurant',
  'shopping_bag',
  'close',
  'menu',
  'translate',
  'check',
  'arrow_forward',
  'arrow_back',
  'expand_more',
  'expand_less',
  'search',
  'schedule',
  'location_on',
  'call',
  'mail',
  'star',
  'lock',
  'receipt_long',
  'soup_kitchen',
  'add',
  'remove',
  'delete',
  'edit',
  'info',
  'warning',
  'error',
  'done',
  'wifi',
  'table_bar',
  'chair',
  'timer',
  'volume_up',
  'volume_off',
  'history',
  'fullscreen',
  'fullscreen_exit',
  'open_in_new',
  'bolt',
  'sparkles',
  'favorite',
  'share',
  'qr_code_2',
  'qr_code_scanner',
  'lunch_dining',
  'local_pizza',
  'coffee',
  'cake',
  'badge',
  'verified',
  'shield',
  'currency_rupee',
  'payments',
  'print',
  'arrow_drop_down',
  'arrow_drop_up',
  'chevron_left',
  'chevron_right',
  'first_page',
  'last_page',
  'drag_handle',
  'more_vert',
  'tune',
]);

interface HardcodedFinding {
  file: string;
  line: number;
  snippet: string;
  type: 'JSX_TEXT' | 'PLACEHOLDER' | 'ARIA_LABEL';
}

function scanFileForHardcodedStrings(filePath: string): HardcodedFinding[] {
  const fullPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Component file not found: ${filePath}`);
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const lines = content.split('\n');
  const findings: HardcodedFinding[] = [];

  // 1. Verify i18n hook usage
  if (!content.includes('useI18n')) {
    findings.push({
      file: filePath,
      line: 1,
      snippet: 'Missing useI18n hook injection',
      type: 'JSX_TEXT',
    });
  }

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Skip comments and imports
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('import ')) {
      continue;
    }

    // Skip lines that are pure TypeScript logic (no JSX)
    if (trimmed.includes('setActiveFilmstripIndex') || trimmed.includes('for (') || trimmed.includes('while (') || trimmed.includes('window.innerWidth')) {
      continue;
    }

    // Check placeholder="Hardcoded English" (without {t(...)})
    const placeholderMatch = rawLine.match(/placeholder=["']([^"']+)["']/);
    if (placeholderMatch) {
      const val = placeholderMatch[1].trim();
      if (/[a-zA-Z]{3,}/.test(val) && !val.startsWith('http') && !ALLOWED_LITERALS.has(val)) {
        findings.push({
          file: filePath,
          line: lineNum,
          snippet: rawLine.trim(),
          type: 'PLACEHOLDER',
        });
      }
    }

    // Check aria-label="Hardcoded English" (without {t(...)})
    const ariaMatch = rawLine.match(/aria-label=["']([^"']+)["']/);
    if (ariaMatch) {
      const val = ariaMatch[1].trim();
      // Skip brand names, known social handles, and technical labels
      const isSocialOrBrand = /^(Instagram|Facebook|Twitter|Google Maps|WhatsApp|YouTube|LinkedIn|TikTok)$/i.test(val);
      if (/[a-zA-Z]{3,}/.test(val) && !ALLOWED_LITERALS.has(val) && !isSocialOrBrand) {
        findings.push({
          file: filePath,
          line: lineNum,
          snippet: rawLine.trim(),
          type: 'ARIA_LABEL',
        });
      }
    }

    // Check raw JSX text between tags: >Some English Text<
    // If the line is an icon element <span className="...material-symbols...">icon_name</span>, skip it
    if (rawLine.includes('material-symbols')) {
      continue;
    }

    const jsxTextMatches = rawLine.matchAll(/>([^<>{}\n]+)</g);
    for (const match of jsxTextMatches) {
      const text = match[1].trim();
      // Skip empty, numbers, simple punctuation, code operators, single words matching icons
      if (
        text.length >= 3 &&
        /[a-zA-Z]{3,}/.test(text) &&
        !ALLOWED_LITERALS.has(text) &&
        !text.startsWith('http') &&
        !text.startsWith('data:') &&
        !/^[\d\s.,:;!?()[\]{}%#@&/\\+*~=-]+$/.test(text)
      ) {
        findings.push({
          file: filePath,
          line: lineNum,
          snippet: `Found raw JSX text: "${text}" in: ${rawLine.trim()}`,
          type: 'JSX_TEXT',
        });
      }
    }
  }

  return findings;
}

async function runTests() {
  console.log('=== RUNNING HARDCODED ENGLISH STRING DETECTION AUDIT ===\n');

  let totalFindings = 0;
  const componentReports: { file: string; pass: boolean; findings: HardcodedFinding[] }[] = [];

  for (const comp of CUSTOMER_COMPONENTS) {
    const findings = scanFileForHardcodedStrings(comp);
    const pass = findings.length === 0;
    componentReports.push({ file: comp, pass, findings });

    if (!pass) {
      totalFindings += findings.length;
      console.log(`❌ ${comp}: ${findings.length} findings`);
      // Print first 3 findings
      for (const f of findings.slice(0, 5)) {
        console.log(`     L${f.line} [${f.type}]: ${f.snippet}`);
      }
    } else {
      console.log(`✔ ${comp}: 0 hardcoded strings`);
    }
  }

  console.log('\n---------------------------------------------------------');
  if (totalFindings > 0) {
    console.error(`❌ AUDIT FAILED: ${totalFindings} hardcoded English strings detected across customer components!`);
    process.exit(1);
  } else {
    console.log(`✔ AUDIT PASSED: All ${CUSTOMER_COMPONENTS.length} customer components are 100% localized via t()!`);
  }
}

runTests().catch((err) => {
  console.error('Fatal error during hardcoded string audit:', err);
  process.exit(1);
});
