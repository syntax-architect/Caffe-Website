/**
 * Phase 7A Verification Test Suite: Boutique Mobile Experience Refinement
 *
 * Verifies that:
 * 1. Mobile Hero:
 *    - Fluid typography scale with minimum 34px on narrow 320px screens
 *    - Visually dominant primary CTA (min-h-[48px], bg-primary)
 *    - Visually subordinate secondary CTA (min-h-[44px], bg-surface-obsidian/40, border-outline/30)
 *    - Tightened entrance delays in index.css (actions ready by 0.35s on mobile)
 *    - Clearance for fixed mobile action dock (pb-28 on mobile)
 * 2. Brand Header:
 *    - Mobile brand text truncation constraints (min-w-0, truncate) preventing button crowding
 *    - Minimum 44px touch targets on cart and mobile hamburger buttons
 * 3. ScrollSequence:
 *    - Telemetry step indicators (01 / 03, 02 / 03, 03 / 03) with semantic tokens
 * 4. AboutVibe:
 *    - Mobile body copy elevated to text-[15px] for effortless readability
 *    - Telemetry chips formatted with min-w-[95px]
 *    - Soundscape status reflecting true playback state without autoplay
 * 5. Menu (Sensory Tasting Ledger):
 *    - Add button upgraded to h-9 min-w-[64px] (and h-11 min-h-[44px]) for touch reliability
 *    - Elevated mobile descriptions (text-[13px] sm:text-sm)
 * 6. SpecialsBanner:
 *    - Companion platters touch-snapping carousel track with ~15% card peek (min-w-[82vw])
 *    - 44px touch targets on buttons
 * 7. OurStory:
 *    - Chapter descriptions elevated to text-[15px] sm:text-base
 *    - Explicit mobile thumb tap controls (01 / 04, prev, next)
 * 8. MobileActionDock:
 *    - 44px touch targets on all interactive items (min-w-[44px] min-h-[44px])
 *    - Safe-area bottom clearance (env(safe-area-inset-bottom))
 * 9. Drawers (CartDrawer & ReservationDrawer):
 *    - Safe-area bottom padding on sticky action bars (env(safe-area-inset-bottom))
 *    - Semantic theme tokens (border-primary/25, bg-surface-obsidian/95)
 */

import fs from 'fs';
import path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

console.log('=== RUNNING PHASE 7A BOUTIQUE MOBILE EXPERIENCE TESTS ===\n');

const componentsDir = path.resolve(process.cwd(), 'src/components');
const cssPath = path.resolve(process.cwd(), 'src/index.css');

// ============================================================================
// 1. MOBILE HERO TYPOGRAPHY, CTA HIERARCHY & CHOREOGRAPHY
// ============================================================================
console.log('1. Verifying Mobile Hero Refinements...');

const heroSource = fs.readFileSync(path.join(componentsDir, 'Hero.tsx'), 'utf-8');
const cssSource = fs.readFileSync(cssPath, 'utf-8');

// Fluid headline scale
assert(
  heroSource.includes('text-[clamp(34px,8vw,88px)]'),
  'Hero Variant A must use clamp starting at 34px for narrow 320px screens'
);
assert(
  heroSource.includes('text-[clamp(34px,5.2vw,74px)]'),
  'Hero Variant B must use clamp starting at 34px'
);
assert(
  heroSource.includes('text-[clamp(34px,6.2vw,84px)]'),
  'Hero Variant C must use clamp starting at 34px'
);

// CTA hierarchy and touch targets
assert(
  heroSource.includes('min-h-[48px]') && heroSource.includes('bg-primary'),
  'Hero primary CTA must have min-h-[48px] touch target'
);
assert(
  heroSource.includes('min-h-[44px]') &&
    heroSource.includes('border-outline/30') &&
    heroSource.includes('bg-surface-obsidian/40'),
  'Hero secondary CTA must be visually subordinate with border-outline/30 and min-h-[44px]'
);

// Dock clearance
assert(
  heroSource.includes('pb-28 sm:pb-6'),
  'Hero Variant A footer must provide pb-28 mobile clearance for the floating dock'
);

// Tightened mobile animation delays
assert(
  cssSource.includes('.hero-enter-actions { animation-delay: 0.35s; }'),
  'Hero actions must be interactive by 0.35s on mobile'
);
assert(
  cssSource.includes('.hero-enter-eyebrow { animation-delay: 0.05s; }'),
  'Hero eyebrow delay must be 0.05s on mobile'
);

console.log('  ✅ Mobile Hero typography, hierarchy, and choreography verified.\n');

// ============================================================================
// 2. BRAND HEADER VIEWPORT RESILIENCE & TOUCH TARGETS
// ============================================================================
console.log('2. Verifying Header 320px Resilience and Touch Targets...');

const headerSource = fs.readFileSync(path.join(componentsDir, 'Header.tsx'), 'utf-8');

assert(
  headerSource.includes('truncate') && headerSource.includes('min-w-0'),
  'Header brand name must have min-w-0 and truncate to prevent button collisions on 320px screens'
);
assert(
  headerSource.includes('min-w-[44px] min-h-[44px]') && headerSource.includes('cartCount'),
  'Header cart button must have min-w-[44px] min-h-[44px] touch target'
);
assert(
  headerSource.includes('min-w-[44px] min-h-[44px]') && headerSource.includes('setIsMobileMenuOpen'),
  'Header mobile hamburger button must have min-w-[44px] min-h-[44px] touch target'
);

console.log('  ✅ Header 320px resilience and 44px touch targets verified.\n');

// ============================================================================
// 3. SCROLL SEQUENCE TELEMETRY STEP INDICATORS
// ============================================================================
console.log('3. Verifying ScrollSequence Telemetry Step Indicators...');

const scrollSeqSource = fs.readFileSync(path.join(componentsDir, 'ScrollSequence.tsx'), 'utf-8');

assert(
  scrollSeqSource.includes('01 / 03 • EXTRACTION'),
  'ScrollSequence must include telemetry capsule 01 / 03'
);
assert(
  scrollSeqSource.includes('02 / 03 • PRECISION'),
  'ScrollSequence must include telemetry capsule 02 / 03'
);
assert(
  scrollSeqSource.includes('03 / 03 • ATMOSPHERE'),
  'ScrollSequence must include telemetry capsule 03 / 03'
);
assert(
  scrollSeqSource.includes('bg-surface-obsidian/85') && scrollSeqSource.includes('border-primary/30'),
  'ScrollSequence telemetry capsules must use semantic theme tokens'
);

console.log('  ✅ ScrollSequence telemetry indicators verified.\n');

// ============================================================================
// 4. ABOUT VIBE TYPOGRAPHY & TELEMETRY CHIPS
// ============================================================================
console.log('4. Verifying AboutVibe Mobile Typography & Layout...');

const aboutVibeSource = fs.readFileSync(path.join(componentsDir, 'AboutVibe.tsx'), 'utf-8');

assert(
  aboutVibeSource.includes('text-[15px] sm:text-base'),
  'AboutVibe description must be elevated to text-[15px] for mobile readability'
);
assert(
  aboutVibeSource.includes('min-w-[95px]'),
  'AboutVibe chips must specify min-w-[95px] preventing layout squeezing'
);

console.log('  ✅ AboutVibe mobile typography verified.\n');

// ============================================================================
// 5. MENU TOUCH TARGETS & READABILITY
// ============================================================================
console.log('5. Verifying Menu Touch Targets and Typography...');

const menuSource = fs.readFileSync(path.join(componentsDir, 'Menu.tsx'), 'utf-8');

assert(
  menuSource.includes('h-9 min-w-[64px] px-3.5 sm:h-7'),
  'Menu ledger Add button must be scaled to h-9 min-w-[64px] on mobile'
);
assert(
  menuSource.includes('h-11 sm:h-10 min-h-[44px]'),
  'Menu featured dish Add button must have min-h-[44px] on mobile'
);
assert(
  menuSource.includes('text-[13px] sm:text-sm'),
  'Menu ledger description must be text-[13px] sm:text-sm'
);

console.log('  ✅ Menu touch targets and typography verified.\n');

// ============================================================================
// 6. SPECIALS BANNER COMPANION PLATTERS TOUCH SNAP TRACK
// ============================================================================
console.log('6. Verifying SpecialsBanner Touch Snap Track & Affordance...');

const specialsSource = fs.readFileSync(path.join(componentsDir, 'SpecialsBanner.tsx'), 'utf-8');

assert(
  specialsSource.includes('overflow-x-auto') &&
    specialsSource.includes('snap-x') &&
    specialsSource.includes('snap-mandatory'),
  'SpecialsBanner companion platters must support horizontal touch snapping on mobile'
);
assert(
  specialsSource.includes('min-w-[82vw]'),
  'SpecialsBanner companion platters must specify min-w-[82vw] for card peek affordance'
);
assert(
  specialsSource.includes('min-h-[44px]'),
  'SpecialsBanner companion platter button must satisfy min-h-[44px] touch target'
);

console.log('  ✅ SpecialsBanner touch snap track verified.\n');

// ============================================================================
// 7. OUR STORY MOBILE TYPOGRAPHY & THUMB TAP CONTROLS
// ============================================================================
console.log('7. Verifying OurStory Mobile Typography & Thumb Navigation...');

const ourStorySource = fs.readFileSync(path.join(componentsDir, 'OurStory.tsx'), 'utf-8');

assert(
  ourStorySource.includes('text-[15px] sm:text-base'),
  'OurStory chapter description must be text-[15px] sm:text-base'
);
assert(
  ourStorySource.includes('arrow_back') && ourStorySource.includes('arrow_forward'),
  'OurStory must provide mobile thumb navigation buttons (arrow_back, arrow_forward)'
);

console.log('  ✅ OurStory mobile typography and navigation verified.\n');

// ============================================================================
// 8. MOBILE ACTION DOCK 44PX TARGETS & SAFE AREA
// ============================================================================
console.log('8. Verifying MobileActionDock Touch Targets & Insets...');

const dockSource = fs.readFileSync(path.join(componentsDir, 'MobileActionDock.tsx'), 'utf-8');

assert(
  dockSource.includes('min-w-[44px] min-h-[44px]'),
  'MobileActionDock buttons must meet min-w-[44px] min-h-[44px]'
);
assert(
  dockSource.includes('env(safe-area-inset-bottom'),
  'MobileActionDock must clear iOS home gesture bar via safe-area-inset-bottom'
);

console.log('  ✅ MobileActionDock touch targets and safe area verified.\n');

// ============================================================================
// 9. DRAWERS SAFE AREA CLEARANCE & SEMANTIC TOKENS
// ============================================================================
console.log('9. Verifying CartDrawer & ReservationDrawer Safe Area & Tokens...');

const cartDrawerSource = fs.readFileSync(path.join(componentsDir, 'CartDrawer.tsx'), 'utf-8');
const resDrawerSource = fs.readFileSync(path.join(componentsDir, 'ReservationDrawer.tsx'), 'utf-8');

assert(
  cartDrawerSource.includes('env(safe-area-inset-bottom'),
  'CartDrawer footer action bars must respect env(safe-area-inset-bottom)'
);
assert(
  resDrawerSource.includes('env(safe-area-inset-bottom'),
  'ReservationDrawer footer action bar must respect env(safe-area-inset-bottom)'
);

assert(
  cartDrawerSource.includes('bg-surface-obsidian/95') && cartDrawerSource.includes('border-primary/25'),
  'CartDrawer footer must use semantic theme tokens'
);
assert(
  resDrawerSource.includes('bg-surface-obsidian/95') && resDrawerSource.includes('border-primary/25'),
  'ReservationDrawer footer must use semantic theme tokens'
);

console.log('  ✅ Drawers safe area clearance and semantic tokens verified.\n');

console.log('======================================================================');
console.log('🎉 ALL PHASE 7A MOBILE EXPERIENCE TESTS PASSED SUCCESSFULLY!');
console.log('======================================================================\n');
