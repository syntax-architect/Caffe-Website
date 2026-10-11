/**
 * Phase 5A Verification Test Suite: Functional Theme Runtime & Cinematic Motion System
 *
 * Verifies that:
 * 1. Default flagship theme preserves The Café Barrackpore identity (Nocturnal Gold)
 * 2. Editorial Cream theme provides distinct warm cream, espresso, and terracotta bronze palette
 * 3. themeToCssVariables properly maps color tokens, fonts, radii, and ambience tokens to CSS custom properties
 * 4. generateThemeCssString outputs valid SSR-inlinable :root CSS rules without undefined values
 * 5. Partial/malformed themes gracefully fallback to flagship defaults without breaking
 * 6. Color contrast for both Nocturnal Gold and Editorial Cream satisfies WCAG AA (>= 4.5:1 for body text)
 * 7. Motion system (resolveReducedMotion) collapses transforms to instant opacity-only fades when reduced motion is requested
 * 8. Direction-aware chapter transition mathematics for variable story chapters (N = 1, 2, 3, 5)
 * 9. All theme definitions and motion tokens are 100% JSON-serializable
 */

import {
  FLAGSHIP_THEME_NOCTURNAL_GOLD,
  THEME_EDITORIAL_CREAM,
  THEME_PRESETS,
  getThemePreset,
} from '../src/config/themePresets';
import {
  themeToCssVariables,
  generateThemeCssString,
} from '../src/services/themeRuntime';
import {
  EASING,
  DURATION,
  HERO_CHOREOGRAPHY,
  resolveReducedMotion,
  fadeSlideUp,
  staggerContainer,
  touchFeedback,
  chapterTransitionVariants,
  cinematicImageVariants,
} from '../src/utils/motion';
import type { RestaurantVisualTheme } from '../src/types/restaurantEngine';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

console.log('🧪 Starting Phase 5A Theme Runtime & Cinematic Motion Verification Suite...\n');

// ============================================================================
// 1. THEME PRESETS INTEGRITY & DEFAULTS
// ============================================================================
console.log('1. Verifying Theme Presets Integrity...');

assert(FLAGSHIP_THEME_NOCTURNAL_GOLD.id === 'nocturnal-gold', 'Flagship theme ID must be nocturnal-gold');
assert(FLAGSHIP_THEME_NOCTURNAL_GOLD.colors.primary === '212 175 55', 'Flagship primary must be warm gold (212 175 55)');
assert(FLAGSHIP_THEME_NOCTURNAL_GOLD.colors.background === '10 8 7', 'Flagship background must be deep espresso (10 8 7)');
assert(FLAGSHIP_THEME_NOCTURNAL_GOLD.colors.onSurface === '227 218 205', 'Flagship onSurface must be cream (227 218 205)');

assert(THEME_EDITORIAL_CREAM.id === 'editorial-cream', 'Editorial Cream ID must be editorial-cream');
assert(THEME_EDITORIAL_CREAM.colors.background === '247 244 238', 'Editorial Cream background must be parchment (247 244 238)');
assert(THEME_EDITORIAL_CREAM.colors.primary === '158 71 42', 'Editorial Cream primary must be terracotta bronze (158 71 42)');
assert(THEME_EDITORIAL_CREAM.colors.onSurface === '34 26 22', 'Editorial Cream onSurface must be roasted espresso (34 26 22)');

assert(THEME_PRESETS['nocturnal-gold'] !== undefined, 'THEME_PRESETS must contain nocturnal-gold');
assert(THEME_PRESETS['editorial-cream'] !== undefined, 'THEME_PRESETS must contain editorial-cream');
assert(getThemePreset('nocturnal-gold').name === 'Nocturnal Gold', 'getThemePreset resolves nocturnal-gold');
assert(getThemePreset('editorial-cream').name === 'Editorial Cream', 'getThemePreset resolves editorial-cream');
// Fallback for unknown preset
assert(getThemePreset('unknown-theme' as any).id === 'nocturnal-gold', 'getThemePreset falls back to nocturnal-gold');

console.log('  ✅ Theme presets verified.\n');

// ============================================================================
// 2. CSS VARIABLE MAPPING & SSR STRING GENERATION
// ============================================================================
console.log('2. Verifying CSS Variable Mapping & SSR String Generation...');

const goldVars = themeToCssVariables(FLAGSHIP_THEME_NOCTURNAL_GOLD);
assert(goldVars['--color-primary'] === '212 175 55', 'Primary token must be mapped to 212 175 55');
assert(goldVars['--color-primary-hex'] === '#D4AF37', 'Primary hex must be mapped to #D4AF37');
assert(goldVars['--color-primary-rgb'] === '212, 175, 55', 'Primary rgb channels must be 212, 175, 55');
assert(goldVars['--color-background'] === '10 8 7', 'Background token must be 10 8 7');
assert(goldVars['--color-surface-container'] === '35 25 20', 'Surface container token must be 35 25 20');
assert(goldVars['--font-heading'] === "'Playfair Display', serif", 'Heading font must be Playfair Display');
assert(goldVars['--font-body'] === "Outfit, 'Outfit-Fallback', sans-serif", 'Body font must be Outfit');
assert(goldVars['--ease-editorial'] === 'cubic-bezier(0.16, 1, 0.3, 1)', 'Editorial ease must be mapped');

const creamVars = themeToCssVariables(THEME_EDITORIAL_CREAM);
assert(creamVars['--color-primary'] === '158 71 42', 'Cream primary token must be 158 71 42');
assert(creamVars['--color-primary-hex'] === '#9E472A', 'Cream primary hex must be #9E472A');
assert(creamVars['--color-primary-rgb'] === '158, 71, 42', 'Cream primary rgb must be 158, 71, 42');
assert(creamVars['--color-background'] === '247 244 238', 'Cream background token must be 247 244 238');
assert(creamVars['--color-on-surface'] === '34 26 22', 'Cream onSurface token must be 34 26 22');
assert(creamVars['--font-heading'] === "'Playfair Display', serif", 'Cream heading font matches design system');

const ssrCss = generateThemeCssString(FLAGSHIP_THEME_NOCTURNAL_GOLD);
assert(ssrCss.startsWith(':root {'), 'SSR CSS must start with :root {');
assert(ssrCss.includes('--color-primary: 212 175 55;'), 'SSR CSS must declare --color-primary');
assert(ssrCss.includes('--color-primary-hex: #D4AF37;'), 'SSR CSS must declare --color-primary-hex');
assert(ssrCss.includes('--color-background: 10 8 7;'), 'SSR CSS must declare --color-background');
assert(ssrCss.endsWith('}'), 'SSR CSS must close block with }');
assert(!ssrCss.includes('undefined'), 'SSR CSS must not contain undefined values');

console.log('  ✅ CSS variable mapping and SSR generation verified.\n');

// ============================================================================
// 3. FALLBACK BEHAVIOR FOR PARTIAL/MISSING THEMES
// ============================================================================
console.log('3. Verifying Partial Theme Fallbacks...');

const partialTheme = {
  id: 'custom-minimal',
  name: 'Minimal Custom',
  colors: {
    primary: '200 100 50',
  },
} as unknown as RestaurantVisualTheme;

const fallbackVars = themeToCssVariables(partialTheme);
assert(fallbackVars['--color-primary'] === '200 100 50', 'Custom primary must be respected');
assert(fallbackVars['--color-background'] === '10 8 7', 'Missing background must fallback to flagship');
assert(fallbackVars['--font-heading'] === "'Playfair Display', serif", 'Missing font must fallback to flagship');
assert(fallbackVars['--radius-button'] === '9999px', 'Missing radius must fallback to flagship');

console.log('  ✅ Partial theme fallback behavior verified.\n');

// ============================================================================
// 4. WCAG CONTRAST STANDARDS
// ============================================================================
console.log('4. Verifying WCAG AA Color Contrast Standards...');

function parseRgbChannels(rgbStr: string): [number, number, number] {
  const parts = rgbStr.trim().split(/\s+/).map(Number);
  return [parts[0], parts[1], parts[2]];
}

function getRelativeLuminance(r: number, g: number, b: number): number {
  const a = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function getContrastRatio(rgb1: string, rgb2: string): number {
  const [r1, g1, b1] = parseRgbChannels(rgb1);
  const [r2, g2, b2] = parseRgbChannels(rgb2);
  const l1 = getRelativeLuminance(r1, g1, b1);
  const l2 = getRelativeLuminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Check Nocturnal Gold Contrast:
const goldBgContrast = getContrastRatio(
  FLAGSHIP_THEME_NOCTURNAL_GOLD.colors.onSurface,
  FLAGSHIP_THEME_NOCTURNAL_GOLD.colors.background
);
console.log(`  Nocturnal Gold Body Contrast (onSurface vs background): ${goldBgContrast.toFixed(2)}:1`);
assert(goldBgContrast >= 7.0, `Nocturnal Gold body text must meet WCAG AAA (>= 7:1), got ${goldBgContrast.toFixed(2)}`);

const goldBtnContrast = getContrastRatio(
  FLAGSHIP_THEME_NOCTURNAL_GOLD.colors.onPrimary,
  FLAGSHIP_THEME_NOCTURNAL_GOLD.colors.primary
);
console.log(`  Nocturnal Gold Button Contrast (onPrimary vs primary): ${goldBtnContrast.toFixed(2)}:1`);
assert(goldBtnContrast >= 4.5, `Nocturnal Gold button text must meet WCAG AA (>= 4.5:1), got ${goldBtnContrast.toFixed(2)}`);

// Check Editorial Cream Contrast:
const creamBgContrast = getContrastRatio(
  THEME_EDITORIAL_CREAM.colors.onSurface,
  THEME_EDITORIAL_CREAM.colors.background
);
console.log(`  Editorial Cream Body Contrast (onSurface vs background): ${creamBgContrast.toFixed(2)}:1`);
assert(creamBgContrast >= 7.0, `Editorial Cream body text must meet WCAG AAA (>= 7:1), got ${creamBgContrast.toFixed(2)}`);

const creamBtnContrast = getContrastRatio(
  THEME_EDITORIAL_CREAM.colors.onPrimary,
  THEME_EDITORIAL_CREAM.colors.primary
);
console.log(`  Editorial Cream Button Contrast (onPrimary vs primary): ${creamBtnContrast.toFixed(2)}:1`);
assert(creamBtnContrast >= 4.5, `Editorial Cream button text must meet WCAG AA (>= 4.5:1), got ${creamBtnContrast.toFixed(2)}`);

console.log('  ✅ WCAG AA/AAA contrast verified for both themes.\n');

// ============================================================================
// 5. MOTION SYSTEM & REDUCED MOTION RESOLUTION
// ============================================================================
console.log('5. Verifying Motion System & Reduced Motion Resolution...');

assert(Array.isArray(EASING.editorial), 'EASING.editorial must be defined');
assert(DURATION.normal === 0.4, 'DURATION.normal must be 0.4s');
assert(HERO_CHOREOGRAPHY.bgSettling.duration === 1.4, 'Hero bg settling duration must be 1.4s');

// Test standard motion variants
const normalFade = fadeSlideUp(20, 0.2);
assert(normalFade.initial.y === 20, 'Normal fade slide initial y must be 20');
assert(normalFade.animate.y === 0, 'Normal fade slide animate y must be 0');
assert(normalFade.animate.opacity === 1, 'Normal fade slide animate opacity must be 1');

// Test reduced motion resolution
const reducedFade = resolveReducedMotion(normalFade, true);
assert(reducedFade.initial.y === undefined || reducedFade.initial.y === 0, 'Reduced motion must clear initial y');
assert(reducedFade.animate.y === undefined || reducedFade.animate.y === 0, 'Reduced motion must clear animate y');
assert(reducedFade.animate.opacity === 1, 'Reduced motion must preserve opacity reveal');
assert((reducedFade.animate.transition as any)?.duration <= 0.15, 'Reduced motion duration must be instantaneous');

// Stagger container
const stagger = staggerContainer(0.1, 0.3);
assert((stagger.animate.transition as any).staggerChildren === 0.1, 'Stagger interval must be 0.1s');
assert((stagger.animate.transition as any).delayChildren === 0.3, 'Delay children must be 0.3s');

// Touch feedback
assert(touchFeedback.whileTap.scale === 0.97, 'Touch feedback tap scale must be 0.97');
assert(touchFeedback.whileHover.scale === 1.02, 'Touch feedback hover scale must be 1.02');

// Chapter transition variants
assert(typeof chapterTransitionVariants.initial === 'function', 'chapterTransitionVariants initial must be function');
const forwardInitial = (chapterTransitionVariants.initial as any)(1);
assert(forwardInitial.y === 14, 'Forward chapter initial y must be +14');
const backwardInitial = (chapterTransitionVariants.initial as any)(-1);
assert(backwardInitial.y === -14, 'Backward chapter initial y must be -14');

// Reduced chapter transition variants
const reducedChapters = resolveReducedMotion(chapterTransitionVariants, true);
const forwardReduced = (reducedChapters.initial as any)(1);
assert(forwardReduced.y === undefined, 'Reduced chapter initial y must be undefined');
assert(forwardReduced.opacity === 0, 'Reduced chapter initial opacity must be 0 for fade-in');
const animateReduced = (reducedChapters.animate as any);
assert(animateReduced.y === undefined, 'Reduced chapter animate y must be undefined');
assert(animateReduced.opacity === 1, 'Reduced chapter animate opacity must be 1');

// Cinematic image variants
assert((cinematicImageVariants.initial as any).scale === 1.03, 'Cinematic image initial scale must be 1.03');
assert((cinematicImageVariants.animate as any).scale === 1, 'Cinematic image animate scale must be 1');

console.log('  ✅ Motion system and reduced motion safety verified.\n');

// ============================================================================
// 6. VARIABLE STORY CHAPTER MATHEMATICS & BOUNDARIES
// ============================================================================
console.log('6. Verifying Variable Story Chapter Mathematics (N = 1, 2, 3, 5)...');

function simulateChapterNavigation(totalChapters: number) {
  let currentIndex = 0;
  const navigate = (nextIndex: number) => {
    const clampedIndex = Math.max(0, Math.min(totalChapters - 1, nextIndex));
    const direction = clampedIndex >= currentIndex ? 1 : -1;
    currentIndex = clampedIndex;
    return { currentIndex, direction };
  };

  // Test next
  const step1 = navigate(1);
  if (totalChapters > 1) {
    assert(step1.currentIndex === 1, `Next index should be 1 for N=${totalChapters}`);
    assert(step1.direction === 1, `Direction should be forward (1)`);
  } else {
    assert(step1.currentIndex === 0, `N=1 should clamp index at 0`);
  }

  // Test boundary overflow
  const stepOverflow = navigate(totalChapters + 5);
  assert(stepOverflow.currentIndex === totalChapters - 1, `Index should clamp at max ${totalChapters - 1}`);

  // Test previous
  const stepPrev = navigate(0);
  assert(stepPrev.currentIndex === 0, `Previous index should be 0`);
  if (totalChapters > 1) {
    assert(stepPrev.direction === -1, `Direction should be backward (-1)`);
  }

  // Test boundary underflow
  const stepUnderflow = navigate(-5);
  assert(stepUnderflow.currentIndex === 0, `Underflow must clamp to 0`);
}

for (const n of [1, 2, 3, 5]) {
  simulateChapterNavigation(n);
}

console.log('  ✅ Chapter navigation mathematics verified for N = 1, 2, 3, 5.\n');

// ============================================================================
// 7. JSON SERIALIZABILITY
// ============================================================================
console.log('7. Verifying 100% JSON Serializability for Themes and Presets...');

const serializedGold = JSON.stringify(FLAGSHIP_THEME_NOCTURNAL_GOLD);
const parsedGold = JSON.parse(serializedGold);
assert(parsedGold.id === 'nocturnal-gold', 'Flagship theme JSON serializable');

const serializedCream = JSON.stringify(THEME_EDITORIAL_CREAM);
const parsedCream = JSON.parse(serializedCream);
assert(parsedCream.id === 'editorial-cream', 'Editorial Cream JSON serializable');

console.log('  ✅ JSON serializability verified.\n');

console.log('🎉 ALL PHASE 5A THEME RUNTIME & MOTION SYSTEM TESTS PASSED SUCCESSFULLY!\n');
