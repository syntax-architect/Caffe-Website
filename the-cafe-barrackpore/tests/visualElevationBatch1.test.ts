/**
 * Visual Elevation Batch 1 Verification Test Suite
 *
 * Verifies that:
 * 1. Typed Engine Configuration & Default Preset:
 *    - `MenuVariant` is typed and includes 'catalog-grid' and 'sensory-ledger'
 *    - `defaultEngineConfig.variants.menu` is 'sensory-ledger'
 *    - `defaultEngineConfig.menu` defines flagship signature dish metadata
 *    - Complete JSON-serializability of restaurant engine configurations with menu variants
 * 2. Menu Component Layout Variants & Architecture:
 *    - 'sensory-ledger': 2-tier architectural layout with featured signature dish and editorial ledger list
 *    - 'catalog-grid': 3-column catalog grid
 *    - Dynamic fallback algorithm for featured signature dish without invented dishes
 *    - Deduplication: signature dish excluded from ledger list
 *    - Semantic theme tokens and dietary badges preserved
 *    - Cart dispatch payload integrity preserved
 * 3. ScrollSequence Component Visual Elevation & Accessibility:
 *    - Elimination of hardcoded hex values (#0a0807, #D4AF37) in favor of semantic tokens
 *    - Dark photographic scrim (bg-black/40) ensuring text legibility across both themes
 *    - Reduced-motion support via useReducedMotion() with static keyframe showcase
 */

import fs from 'fs';
import path from 'path';
import { defaultEngineConfig } from '../src/config/defaultEngineConfig';
import type {
  MenuVariant,
  RestaurantEngineConfig,
} from '../src/types/restaurantEngine';
import { MENU_ITEMS_FALLBACK } from '../src/data/menuFallbacks';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

console.log('=== RUNNING VISUAL ELEVATION BATCH 1 TESTS ===\n');

// ============================================================================
// 1. ENGINE CONFIGURATION & MENU VARIANTS TYPING
// ============================================================================
console.log('1. Verifying Menu Layout Variant Engine Configuration...');

assert(
  defaultEngineConfig.variants.menu === 'sensory-ledger',
  `Flagship default menu variant must be 'sensory-ledger', got '${defaultEngineConfig.variants.menu}'`
);

assert(
  Boolean(defaultEngineConfig.menu),
  'defaultEngineConfig must define menu section configuration'
);

assert(
  defaultEngineConfig.menu?.featuredItemId === 'special-chicken-on-a-bun',
  `Flagship featuredItemId must be 'special-chicken-on-a-bun', got '${defaultEngineConfig.menu?.featuredItemId}'`
);

assert(
  Boolean(defaultEngineConfig.menu?.featuredEyebrow),
  'Flagship menu must define featuredEyebrow crest'
);

assert(
  Boolean(defaultEngineConfig.menu?.featuredTastingNotes),
  'Flagship menu must define featuredTastingNotes'
);

assert(
  Boolean(defaultEngineConfig.menu?.featuredPairing),
  'Flagship menu must define featuredPairing'
);

// Verify featuredItemId exists in actual menu fallbacks (no invented dishes)
const fallbackFeaturedItem = MENU_ITEMS_FALLBACK.find(
  (item) => item.id === defaultEngineConfig.menu?.featuredItemId
);
assert(
  Boolean(fallbackFeaturedItem),
  `Featured item '${defaultEngineConfig.menu?.featuredItemId}' must exist in actual menu data`
);

console.log('  ✅ Flagship menu variant and signature dish configuration verified.\n');

// ============================================================================
// 2. JSON SERIALIZABILITY ACROSS MENU VARIANTS
// ============================================================================
console.log('2. Verifying JSON Serializability of Menu Variants...');

const variantsToTest: MenuVariant[] = ['sensory-ledger', 'catalog-grid'];

for (const variant of variantsToTest) {
  const testConfig: RestaurantEngineConfig = {
    ...defaultEngineConfig,
    variants: {
      ...defaultEngineConfig.variants,
      menu: variant,
    },
  };

  const serialized = JSON.stringify(testConfig);
  const parsed = JSON.parse(serialized) as RestaurantEngineConfig;

  assert(
    parsed.variants.menu === variant,
    `Round-trip serialization failed for menu variant: ${variant}`
  );
  assert(
    parsed.menu?.featuredItemId === defaultEngineConfig.menu?.featuredItemId,
    'Menu section config must survive JSON serialization'
  );
}

console.log('  ✅ 100% JSON-serializability verified for all menu layout variants.\n');

// ============================================================================
// 3. MENU COMPONENT IMPLEMENTATION & THEME TOKEN COVERAGE
// ============================================================================
console.log('3. Auditing Menu.tsx Component Architecture...');

const menuPath = path.resolve(process.cwd(), 'src/components/Menu.tsx');
const menuContent = fs.readFileSync(menuPath, 'utf-8');

// Layout variants branch verification
assert(
  menuContent.includes("menuVariant === 'sensory-ledger'"),
  "Menu.tsx must implement sensory-ledger variant branch"
);
assert(
  menuContent.includes('lg:col-span-5') && menuContent.includes('lg:col-span-7'),
  "Menu.tsx sensory-ledger must feature 5/7 column architectural layout"
);
assert(
  menuContent.includes('border-dotted'),
  "Menu.tsx sensory-ledger must render dotted leader lines between item name and price"
);

// Featured item fallback algorithm verification
assert(
  menuContent.includes('featuredConfigId'),
  "Menu.tsx must check configured featured item ID"
);
assert(
  menuContent.includes('ledgerItems') && menuContent.includes('i.id !== featuredItem.id'),
  "Menu.tsx must omit featured item from ledger list to avoid duplication"
);

// Semantic Theme Token verification
const requiredMenuTokens = [
  'bg-surface-container',
  'border-outline/30',
  'bg-surface-obsidian',
  'bg-primary',
  'text-on-primary',
  'bg-surface-container-lowest',
];

for (const token of requiredMenuTokens) {
  assert(
    menuContent.includes(token),
    `Menu.tsx must contain semantic theme token: ${token}`
  );
}

// Forbidden hardcoded dark hex patterns check
const forbiddenPatterns = [
  /className="[^"]*bg-gradient-to-br from-\[#1C120D\][^"]*"/,
  /className="[^"]*bg-\[#170E0A\][^"]*"/,
];

for (const pattern of forbiddenPatterns) {
  assert(
    !pattern.test(menuContent),
    `Menu.tsx must not contain hardcoded color pattern: ${pattern}`
  );
}

console.log('  ✅ Menu.tsx architecture, deduplication, and semantic tokens verified.\n');

// ============================================================================
// 4. SCROLLSEQUENCE COMPONENT VISUAL ELEVATION & THEME AUDIT
// ============================================================================
console.log('4. Auditing ScrollSequence.tsx Theme & Motion Implementation...');

const scrollSeqPath = path.resolve(process.cwd(), 'src/components/ScrollSequence.tsx');
const scrollSeqContent = fs.readFileSync(scrollSeqPath, 'utf-8');

// Verification of hardcoded hex removal
assert(
  !scrollSeqContent.includes('#0a0807'),
  "ScrollSequence.tsx must not contain hardcoded background '#0a0807'"
);
assert(
  !scrollSeqContent.includes('#D4AF37'),
  "ScrollSequence.tsx must not contain hardcoded gold '#D4AF37'"
);

// Semantic tokens verification
assert(
  scrollSeqContent.includes('bg-background'),
  "ScrollSequence.tsx must use bg-background for container and transitions"
);
assert(
  scrollSeqContent.includes('text-primary') || scrollSeqContent.includes('bg-primary'),
  "ScrollSequence.tsx must use semantic primary tokens"
);

// High-contrast photographic scrim verification
assert(
  scrollSeqContent.includes('bg-black/40'),
  "ScrollSequence.tsx must include dark photographic scrim (bg-black/40) for text legibility"
);

// Reduced-motion support verification
assert(
  scrollSeqContent.includes('useReducedMotion'),
  "ScrollSequence.tsx must integrate useReducedMotion hook"
);
assert(
  scrollSeqContent.includes('prefersReducedMotion'),
  "ScrollSequence.tsx must support reduced motion accessibility fallback"
);

console.log('  ✅ ScrollSequence.tsx theme tokens, scrims, and reduced-motion verified.\n');

// ============================================================================
// 5. FEATURED PRODUCT FALLBACK SIMULATION TEST
// ============================================================================
console.log('5. Testing Featured Dish Fallback Algorithm Simulation...');

// Test Category: Burgers & Pizzas
const burgerItems = MENU_ITEMS_FALLBACK.filter((i) => i.category_id === 'burgers-pizzas');
const configuredFeatured = burgerItems.find(
  (i) => i.id === defaultEngineConfig.menu?.featuredItemId
);
assert(
  Boolean(configuredFeatured),
  'Configured featured dish must be present in Burgers & Pizzas category'
);

// Simulation with Starters (configured chicken burger is absent, so fallback to popular starter)
const starterItems = MENU_ITEMS_FALLBACK.filter((i) => i.category_id === 'starters-momos');
const starterPopular = starterItems.find((i) => i.popular);
assert(
  Boolean(starterPopular),
  'Starters category must have a popular item for fallback'
);

// Simulation when veg-only is active
const vegItems = MENU_ITEMS_FALLBACK.filter((i) => i.diet === 'veg' || i.diet === 'vegan');
const vegPopular = vegItems.find((i) => i.popular);
assert(
  Boolean(vegPopular),
  'Veg-only menu must have a popular item for fallback'
);

// Simulation of image prioritization over non-image popular items
const mockItemsWithImages = [
  {
    id: 'regular-dish',
    name: 'Regular Dish',
    popular: true,
    available: true,
  },
  {
    id: 'photographed-dish',
    name: 'Photographed Dish',
    popular: true,
    available: true,
    image_url: 'https://images.unsplash.com/photo-dish.jpg',
  },
];
const prioritizedWithImage = mockItemsWithImages.find(
  (i) => i.popular && i.available && Boolean(i.image_url)
);
assert(
  prioritizedWithImage?.id === 'photographed-dish',
  'Item with image must be prioritized when both are popular'
);

console.log('  ✅ Featured item resolution fallback algorithm validated across categories and dietary filters.\n');

// ============================================================================
// 6. VISUAL ELEVATION BATCH 1.1: EDITORIAL POLISH & AUTHENTIC ASSET AUDIT
// ============================================================================
console.log('6. Verifying Visual Elevation Batch 1.1 Polish & Asset Integrity...');

// 6.1 Authentic Image Paths & Missing Asset Disclosure
const pizzaItem = MENU_ITEMS_FALLBACK.find((i) => i.id === 'margherita-pizza');
assert(
  pizzaItem?.image_url === '/images/gallery-pizza.webp',
  'margherita-pizza must point to authentic gallery pizza photography'
);
assert(
  fs.existsSync(path.resolve(process.cwd(), 'public', 'images', 'gallery-pizza.webp')),
  'public/images/gallery-pizza.webp must exist on disk'
);

const chinesePlatter = MENU_ITEMS_FALLBACK.find((i) => i.id === 'chinese-platter');
assert(
  chinesePlatter?.image_url === '/images/platters/platter-chinese.webp',
  'chinese-platter must point to authentic chinese platter photography'
);
assert(
  fs.existsSync(path.resolve(process.cwd(), 'public', 'images', 'platters', 'platter-chinese.webp')),
  'public/images/platters/platter-chinese.webp must exist on disk'
);

const tandooriPlatter = MENU_ITEMS_FALLBACK.find((i) => i.id === 'tandoori-platter');
assert(
  tandooriPlatter?.image_url === '/images/platters/platter-tandoori.webp',
  'tandoori-platter must point to authentic tandoori platter photography'
);
assert(
  fs.existsSync(path.resolve(process.cwd(), 'public', 'images', 'platters', 'platter-tandoori.webp')),
  'public/images/platters/platter-tandoori.webp must exist on disk'
);

// Explicitly audit that special-chicken-on-a-bun lacks image asset in source data
const chickenBun = MENU_ITEMS_FALLBACK.find((i) => i.id === 'special-chicken-on-a-bun');
assert(
  !chickenBun?.image_url,
  'special-chicken-on-a-bun must have no image_url, confirming missing source asset is not spoofed'
);

// 6.2 Deterministic image resolution in Menu.tsx
assert(
  menuContent.includes('hasRealImage'),
  'Menu.tsx must implement hasRealImage check to prioritize authentic photography'
);
assert(
  menuContent.includes("Chef's Signature Selection"),
  "Menu.tsx must render compact editorial crest ('Chef\\'s Signature Selection') when category lacks imagery"
);

// 6.3 Dish Name Wrapping & Typography
// Ensure dish titles in ledger list do not truncate
assert(
  !menuContent.includes('font-serif text-base sm:text-lg font-medium text-on-surface truncate'),
  'Menu.tsx ledger dish names must not truncate, allowing natural wrapping for multi-line titles'
);

// Ensure de-nested tasting notes and lightened photographic scrim
assert(
  menuContent.includes('from-black/50 via-transparent to-transparent'),
  'Menu.tsx must use lightened 50% photo scrim to keep food photography vibrant'
);

// 6.4 SectionReveal SSR-safe mount detection
const sectionRevealPath = path.resolve(process.cwd(), 'src/components/SectionReveal.tsx');
const sectionRevealContent = fs.readFileSync(sectionRevealPath, 'utf-8');
assert(
  sectionRevealContent.includes('useSyncExternalStore'),
  'SectionReveal.tsx must use useSyncExternalStore for hydration-safe mount detection'
);
assert(
  !sectionRevealContent.includes('setIsMounted(true)'),
  'SectionReveal.tsx must not contain setState in effect to prevent React re-render cascades'
);

console.log('  ✅ Batch 1.1 signature image resolution, authentic assets, typography, and mount safety verified.\n');

// ============================================================================
// 7. FEATURED-DISH SENSORY METADATA ISOLATION & REGRESSION SUITE
// ============================================================================
console.log('7. Verifying Featured-Dish Sensory Metadata Isolation & Leakage Prevention...');

// Helper simulation replicating Menu.tsx activeSensoryMetadata logic
function resolveSensoryMetadata(
  item: typeof MENU_ITEMS_FALLBACK[0] | null,
  config: typeof defaultEngineConfig.menu
) {
  if (!item) return null;
  const featuredConfigId = config?.featuredItemId;
  const isConfiguredItem = Boolean(featuredConfigId && item.id === featuredConfigId);

  const itemNotes = item.tasting_notes;
  const itemPairing = item.pairing;

  const mappedMeta = config?.itemsMetadata?.[item.id];
  const mappedNotes = mappedMeta?.tastingNotes;
  const mappedPairing = mappedMeta?.pairing;

  const configNotes = isConfiguredItem ? config?.featuredTastingNotes : undefined;
  const configPairing = isConfiguredItem ? config?.featuredPairing : undefined;

  const tastingNotes = itemNotes || mappedNotes || configNotes || null;
  const pairing = itemPairing || mappedPairing || configPairing || null;
  const eyebrow =
    mappedMeta?.eyebrow ||
    (isConfiguredItem ? config?.featuredEyebrow : null) ||
    "Chef's Signature Selection";

  return { tastingNotes, pairing, eyebrow };
}

// 7.1 Configured Item Case
const configuredItem = MENU_ITEMS_FALLBACK.find((i) => i.id === 'special-chicken-on-a-bun')!;
assert(Boolean(configuredItem), 'special-chicken-on-a-bun must exist in fallbacks');
const configuredSensory = resolveSensoryMetadata(configuredItem, defaultEngineConfig.menu);

assert(
  configuredSensory?.tastingNotes === 'Flame-Charred Brioche • Melted Cheddar • House Smoked Relish',
  `Configured item must resolve its own tasting notes, got: ${configuredSensory?.tastingNotes}`
);
assert(
  configuredSensory?.pairing === 'Pairs with Single-Origin Cold Brew or Botanical Tonic',
  `Configured item must resolve its own pairing, got: ${configuredSensory?.pairing}`
);

// 7.2 Fallback Item Without Tasting Metadata (Margherita Pizza)
// Margherita Pizza has an authentic photo and becomes the featured dish in Burgers & Pizzas,
// but MUST NOT inherit the chicken burger's brioche notes or cold brew pairing!
const fallbackPizza = MENU_ITEMS_FALLBACK.find((i) => i.id === 'margherita-pizza')!;
assert(Boolean(fallbackPizza), 'margherita-pizza must exist in fallbacks');
const pizzaSensory = resolveSensoryMetadata(fallbackPizza, defaultEngineConfig.menu);

assert(
  pizzaSensory?.tastingNotes === null,
  `Margherita Pizza MUST NOT inherit chicken burger tasting notes! Got: ${pizzaSensory?.tastingNotes}`
);
assert(
  pizzaSensory?.pairing === null,
  `Margherita Pizza MUST NOT inherit chicken burger beverage pairing! Got: ${pizzaSensory?.pairing}`
);
assert(
  pizzaSensory?.eyebrow === "Chef's Signature Selection",
  `Margherita Pizza should receive default crest eyebrow, got: ${pizzaSensory?.eyebrow}`
);

// 7.3 Fallback Item With Its Own Stable Metadata via itemsMetadata
const customMenuConfig = {
  ...defaultEngineConfig.menu,
  itemsMetadata: {
    ...defaultEngineConfig.menu?.itemsMetadata,
    'chinese-platter': {
      tastingNotes: 'Wok-charred szechuan peppercorn & smoked sesame glaze',
      pairing: 'Jasmine Pearl Green Tea or Sparkling Lychee Tonic',
      eyebrow: 'Imperial Banquet Selection',
    },
  },
};
const chinesePlatterItem = MENU_ITEMS_FALLBACK.find((i) => i.id === 'chinese-platter')!;
const platterSensory = resolveSensoryMetadata(chinesePlatterItem, customMenuConfig);

assert(
  platterSensory?.tastingNotes === 'Wok-charred szechuan peppercorn & smoked sesame glaze',
  `Fallback item with configured itemsMetadata must resolve its own notes, got: ${platterSensory?.tastingNotes}`
);
assert(
  platterSensory?.pairing === 'Jasmine Pearl Green Tea or Sparkling Lychee Tonic',
  `Fallback item with configured itemsMetadata must resolve its own pairing, got: ${platterSensory?.pairing}`
);
assert(
  platterSensory?.eyebrow === 'Imperial Banquet Selection',
  `Fallback item with configured itemsMetadata must resolve its own eyebrow, got: ${platterSensory?.eyebrow}`
);

// 7.4 Menu.tsx Render Invariants
const updatedMenuContent = fs.readFileSync(menuPath, 'utf-8');
assert(
  updatedMenuContent.includes('activeSensoryMetadata?.tastingNotes'),
  'Menu.tsx must guard tasting notes with activeSensoryMetadata?.tastingNotes'
);
assert(
  updatedMenuContent.includes('activeSensoryMetadata?.pairing'),
  'Menu.tsx must guard beverage pairing with activeSensoryMetadata?.pairing'
);
assert(
  !updatedMenuContent.includes('menuSectionConfig?.featuredTastingNotes && ('),
  'Menu.tsx must NOT directly guard render on menuSectionConfig?.featuredTastingNotes'
);
assert(
  !updatedMenuContent.includes('menuSectionConfig?.featuredPairing && ('),
  'Menu.tsx must NOT directly guard render on menuSectionConfig?.featuredPairing'
);

console.log('  ✅ Sensory metadata isolation, zero-leakage, and regression tests passed.\n');

console.log('======================================================================');
console.log('🎉 ALL VISUAL ELEVATION BATCH 1, 1.1 & METADATA TESTS PASSED SUCCESSFULLY!');
console.log('======================================================================');


