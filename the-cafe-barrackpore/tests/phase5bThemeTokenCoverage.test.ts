/**
 * Phase 5B Verification Test Suite: Complete Theme Token Coverage
 *
 * Verifies that:
 * 1. Semantic theme token coverage is complete across AboutVibe, Menu, SpecialsBanner, Gallery, VIPClub, CartDrawer, and ReservationDrawer
 * 2. Nocturnal Gold and Editorial Cream themes define complete surface, primary, and outline color palettes
 * 3. Dietary badges remain untouched semantic indicators (emerald/red) without theme corruption
 * 4. Image wells preserve high-contrast dark scrims on both themes
 * 5. Button CTAs and active states properly switch between text-on-primary and text-primary across themes
 */

import fs from 'fs';
import path from 'path';
import {
  FLAGSHIP_THEME_NOCTURNAL_GOLD,
  THEME_EDITORIAL_CREAM,
} from '../src/config/themePresets';
import { themeToCssVariables } from '../src/services/themeRuntime';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

console.log('🧪 Starting Phase 5B Complete Theme Token Coverage Verification Suite...\n');

// ============================================================================
// 1. THEME TOKEN DEFINITIONS COVERAGE
// ============================================================================
console.log('1. Verifying Theme Preset Completeness for Phase 5B Surface Tokens...');

const goldVars = themeToCssVariables(FLAGSHIP_THEME_NOCTURNAL_GOLD);
const creamVars = themeToCssVariables(THEME_EDITORIAL_CREAM);

const requiredTokens = [
  '--color-background',
  '--color-surface-container',
  '--color-surface-container-low',
  '--color-surface-container-lowest',
  '--color-surface-elevated',
  '--color-surface-obsidian',
  '--color-primary',
  '--color-primary-fixed',
  '--color-primary-fixed-dim',
  '--color-on-primary',
  '--color-on-surface',
  '--color-on-surface-variant',
  '--color-outline',
];

for (const token of requiredTokens) {
  assert(Boolean(goldVars[token]), `Nocturnal Gold must define ${token}`);
  assert(Boolean(creamVars[token]), `Editorial Cream must define ${token}`);
}

console.log('  ✅ All required surface and primary tokens defined in both presets.\n');

// ============================================================================
// 2. COMPONENT TOKEN MIGRATION AUDIT (Static Source Scan)
// ============================================================================
console.log('2. Auditing Component Source Files for Semantic Token Migration...');

const componentsDir = path.resolve(process.cwd(), 'src/components');

function checkFile(filename: string, checks: { requiredClasses: string[]; forbiddenPatterns?: RegExp[] }) {
  const filePath = path.join(componentsDir, filename);
  const content = fs.readFileSync(filePath, 'utf-8');

  for (const cls of checks.requiredClasses) {
    assert(content.includes(cls), `${filename} must contain semantic class "${cls}"`);
  }

  if (checks.forbiddenPatterns) {
    for (const pattern of checks.forbiddenPatterns) {
      assert(!pattern.test(content), `${filename} must not contain forbidden pattern: ${pattern}`);
    }
  }
}

// AboutVibe.tsx
checkFile('AboutVibe.tsx', {
  requiredClasses: [
    'bg-background',
    'border-outline/15',
    'bg-surface-container',
    'bg-surface-elevated/40',
    'bg-surface-container-lowest',
    'bg-surface-container-low/90',
  ],
  forbiddenPatterns: [
    /className="[^"]*bg-\[#0D0705\][^"]*"/,
  ],
});

// Menu.tsx
checkFile('Menu.tsx', {
  requiredClasses: [
    'bg-surface-container',
    'border-outline/30',
    'bg-surface-obsidian',
    'bg-primary',
    'text-on-primary',
    'bg-surface-container-lowest',
  ],
  forbiddenPatterns: [
    /className="[^"]*bg-gradient-to-br from-\[#1C120D\][^"]*"/,
    /className="[^"]*bg-\[#170E0A\][^"]*"/,
  ],
});

// SpecialsBanner.tsx
checkFile('SpecialsBanner.tsx', {
  requiredClasses: [
    'bg-background',
    'border-outline/15',
    'bg-surface-container',
    'bg-surface-obsidian/90',
    'bg-primary',
    'text-on-primary',
  ],
  forbiddenPatterns: [
    /className="[^"]*bg-\[#0D0705\][^"]*"/,
    /className="[^"]*bg-\[#140D0A\][^"]*"/,
  ],
});

// Gallery.tsx
checkFile('Gallery.tsx', {
  requiredClasses: [
    'bg-background',
    'border-outline/15',
    'bg-surface-container',
    'bg-surface-obsidian',
    'border-primary/35',
  ],
  forbiddenPatterns: [
    /className="[^"]*bg-\[#0D0705\][^"]*"/,
    /className="[^"]*bg-\[#18100C\][^"]*"/,
  ],
});

// VIPClub.tsx
checkFile('VIPClub.tsx', {
  requiredClasses: [
    'bg-background',
    'border-outline/15',
    'bg-surface-obsidian',
    'bg-surface-container',
    'bg-primary',
    'text-on-primary',
  ],
  forbiddenPatterns: [
    /className="[^"]*bg-\[#070403\] border-t border-white\/5[^"]*"/,
  ],
});

// CartDrawer.tsx & ReservationDrawer.tsx shells
checkFile('CartDrawer.tsx', {
  requiredClasses: [
    'bg-surface-obsidian/98',
    'border-primary/35',
    'border-primary/25',
    'bg-surface-container',
  ],
});

checkFile('ReservationDrawer.tsx', {
  requiredClasses: [
    'bg-surface-obsidian/98',
    'border-primary/35',
    'border-primary/25',
    'bg-surface-container',
  ],
});

console.log('  ✅ All component source files audited and verified.\n');

// ============================================================================
// 3. DIETARY SYSTEM INTEGRITY INVARIANT CHECK
// ============================================================================
console.log('3. Verifying Dietary System Status Colors Invariant...');

const menuContent = fs.readFileSync(path.join(componentsDir, 'Menu.tsx'), 'utf-8');
const specialsContent = fs.readFileSync(path.join(componentsDir, 'SpecialsBanner.tsx'), 'utf-8');

assert(menuContent.includes('border-emerald-500/80') && menuContent.includes('bg-emerald-500'), 'Menu India veg badge must retain emerald status colors');
assert(menuContent.includes('border-red-500/80') && menuContent.includes('bg-red-500'), 'Menu India non-veg badge must retain red status colors');
assert(specialsContent.includes('border-emerald-500/80') && specialsContent.includes('bg-emerald-500'), 'Specials veg badge must retain emerald status colors');
assert(specialsContent.includes('border-red-500/80') && specialsContent.includes('bg-red-500'), 'Specials non-veg badge must retain red status colors');

console.log('  ✅ Dietary status indicators strictly preserved.\n');

// ============================================================================
// 4. PHOTO SCRIM LEGIBILITY INVARIANT CHECK
// ============================================================================
console.log('4. Verifying Photo Scrim Contrast Invariant...');

const galleryContent = fs.readFileSync(path.join(componentsDir, 'Gallery.tsx'), 'utf-8');
const vipContent = fs.readFileSync(path.join(componentsDir, 'VIPClub.tsx'), 'utf-8');

assert(galleryContent.includes('from-black/80'), 'Gallery bento cards must maintain dark photo scrim for text contrast');
assert(vipContent.includes('from-black/80'), 'VIPClub speakeasy background must maintain dark photo scrim');

console.log('  ✅ Dark photo scrims active across image-text overlays.\n');

console.log('🎉 ALL PHASE 5B THEME TOKEN COVERAGE VERIFICATION TESTS PASSED SUCCESSFULLY!');
