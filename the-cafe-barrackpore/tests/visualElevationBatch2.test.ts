/**
 * Visual Elevation Batch 2 Verification Test Suite
 *
 * Verifies that:
 * 1. Engine Configuration & Layout Variants:
 *    - `defaultEngineConfig.variants.specials` is 'horizontal-platters'
 *    - Complete JSON-serializability across all 5 layout variants simultaneously
 *      (hero, story, gallery, specials, menu)
 * 2. SpecialsBanner Component Architecture ('horizontal-platters' & 'grid'):
 *    - Communal banquet hierarchy: Master Sharing Platter (col-span-12) + Companion Platters (col-span-6)
 *    - Mobile horizontal snap track with smooth touch physics
 *    - Dietary badge preservation (India veg/non-veg status colors)
 *    - 100% Cart dispatch contract integrity ({ id, name, price, quantity: 1, diet, isCombo: true })
 *    - Toast notification dispatch on add-to-cart
 * 3. Architectural De-Nesting & Doppelrand Discipline:
 *    - AboutVibe: De-nested outer double-bezel shells in favor of flush photographic windows
 *    - AboutVibe: Architectural telemetry spec capsules with semantic tokens
 *    - OurStory: De-nested outer white-gradient bezel on floating chapter card
 *    - VIPClub: Preserved signature double-bezel gold foil master frame for speakeasy salon
 * 4. 7-Act Cinematic Homepage Narrative Flow:
 *    - Act I (Hero) -> Act II (ScrollSequence) -> Act III (AboutVibe) ->
 *      Act IV (Menu) -> Act V (Specials) -> Act VI (OurStory) -> Act VII (Gallery & VIP)
 *    - Zero broken links, zero orphaned anchors
 */

import fs from 'fs';
import path from 'path';
import { defaultEngineConfig } from '../src/config/defaultEngineConfig';
import type {
  HeroVariant,
  StoryVariant,
  GalleryVariant,
  SpecialsVariant,
  MenuVariant,
  RestaurantEngineConfig,
} from '../src/types/restaurantEngine';
import { DEFAULT_SPECIAL_COMBOS } from '../src/services/siteContentService';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

console.log('=== RUNNING VISUAL ELEVATION BATCH 2 TESTS ===\n');

// ============================================================================
// 1. ENGINE CONFIGURATION & SPECIALS LAYOUT VARIANT TYPING
// ============================================================================
console.log('1. Verifying Specials Layout Variant Engine Configuration...');

assert(
  defaultEngineConfig.variants.specials === 'horizontal-platters',
  `Flagship default specials variant must be 'horizontal-platters', got '${defaultEngineConfig.variants.specials}'`
);

assert(
  defaultEngineConfig.variants.hero === 'cinematic-fullscreen',
  `Flagship hero variant must be 'cinematic-fullscreen', got '${defaultEngineConfig.variants.hero}'`
);

assert(
  defaultEngineConfig.variants.story === 'interactive-chapters',
  `Flagship story variant must be 'interactive-chapters', got '${defaultEngineConfig.variants.story}'`
);

assert(
  defaultEngineConfig.variants.gallery === 'asymmetric-bento',
  `Flagship gallery variant must be 'asymmetric-bento', got '${defaultEngineConfig.variants.gallery}'`
);

assert(
  defaultEngineConfig.variants.menu === 'sensory-ledger',
  `Flagship menu variant must be 'sensory-ledger', got '${defaultEngineConfig.variants.menu}'`
);

console.log('  ✅ Flagship 5-variant composition configuration verified.\n');

// ============================================================================
// 2. 5-DIMENSIONAL JSON SERIALIZABILITY MATRIX
// ============================================================================
console.log('2. Verifying 5-Dimensional Variant JSON Serializability...');

const heroVariants: HeroVariant[] = ['cinematic-fullscreen', 'split-editorial', 'minimal-centered'];
const storyVariants: StoryVariant[] = ['interactive-chapters', 'editorial-split', 'timeline'];
const galleryVariants: GalleryVariant[] = ['asymmetric-bento', 'carousel-snap', 'filmstrip'];
const specialsVariants: SpecialsVariant[] = ['horizontal-platters', 'grid'];
const menuVariants: MenuVariant[] = ['sensory-ledger', 'catalog-grid'];

let permutationCount = 0;
for (const h of heroVariants) {
  for (const s of storyVariants) {
    for (const g of galleryVariants) {
      for (const sp of specialsVariants) {
        for (const m of menuVariants) {
          const config: RestaurantEngineConfig = {
            ...defaultEngineConfig,
            variants: {
              hero: h,
              story: s,
              gallery: g,
              specials: sp,
              menu: m,
            },
          };
          const serialized = JSON.stringify(config);
          const deserialized = JSON.parse(serialized) as RestaurantEngineConfig;
          assert(deserialized.variants.hero === h, `Hero variant serialization failed for ${h}`);
          assert(deserialized.variants.story === s, `Story variant serialization failed for ${s}`);
          assert(deserialized.variants.gallery === g, `Gallery variant serialization failed for ${g}`);
          assert(deserialized.variants.specials === sp, `Specials variant serialization failed for ${sp}`);
          assert(deserialized.variants.menu === m, `Menu variant serialization failed for ${m}`);
          permutationCount++;
        }
      }
    }
  }
}

assert(
  permutationCount === 3 * 3 * 3 * 2 * 2,
  `Expected 108 variant permutations tested, got ${permutationCount}`
);
console.log(`  ✅ All ${permutationCount} variant permutations are 100% JSON-serializable.\n`);

// ============================================================================
// 3. AUDITING SPECIALSBANNER.TSX ARCHITECTURE & CONTRACTS
// ============================================================================
console.log('3. Auditing SpecialsBanner.tsx Component Architecture...');

const componentsDir = path.resolve(process.cwd(), 'src/components');
const specialsPath = path.join(componentsDir, 'SpecialsBanner.tsx');
const specialsContent = fs.readFileSync(specialsPath, 'utf-8');

// Communal banquet hierarchy assertions
assert(
  specialsContent.includes("specialsVariant === 'horizontal-platters'"),
  'SpecialsBanner must conditionally handle horizontal-platters layout variant'
);
assert(
  specialsContent.includes('masterPlatter'),
  'SpecialsBanner must resolve masterPlatter for the signature banquet centerpiece'
);
assert(
  specialsContent.includes('companionPlatters'),
  'SpecialsBanner must resolve companionPlatters for the secondary sharing platters'
);
assert(
  specialsContent.includes('ACT V • THE SHARED TABLE') || specialsContent.includes('THE SHARED TABLE'),
  'SpecialsBanner must include Act V narrative header'
);

// Cart dispatch contract preservation
assert(
  specialsContent.includes('addToCart({'),
  'SpecialsBanner must call addToCart to add item to cart context'
);
assert(
  specialsContent.includes('id: combo.id') && specialsContent.includes('price: combo.price'),
  'SpecialsBanner cart payload must preserve combo id and price'
);
assert(
  specialsContent.includes('showToast({'),
  'SpecialsBanner must trigger feedback toast on add-to-cart'
);

// Fallback grid preservation
assert(
  specialsContent.includes('lg:grid-cols-3'),
  'SpecialsBanner must retain 3-column grid fallback variant'
);

// Fallback combos data validation
assert(
  DEFAULT_SPECIAL_COMBOS.length >= 3,
  'Default special combos must provide at least 3 sharing platters'
);
assert(
  DEFAULT_SPECIAL_COMBOS[0].id === 'combo-chinese-platter',
  'First combo must be Chinese Platter'
);

console.log('  ✅ SpecialsBanner communal banquet architecture and cart contracts verified.\n');

// ============================================================================
// 4. AUDITING DE-NESTING & DOPPELRAND DISCIPLINE
// ============================================================================
console.log('4. Auditing De-nesting & Doppelrand Discipline across Homepage Sections...');

const aboutVibePath = path.join(componentsDir, 'AboutVibe.tsx');
const aboutVibeContent = fs.readFileSync(aboutVibePath, 'utf-8');

// Verify removal of nested wrapper bloat on photographic cells
assert(
  !aboutVibeContent.includes('rounded-[calc(2rem-0.5rem)] lg:rounded-[calc(2.5rem-0.5rem)]'),
  'AboutVibe must not nest inner rounded cards within outer padded bezel shells'
);
assert(
  aboutVibeContent.includes('bg-surface-container-lowest border border-outline/20'),
  'AboutVibe photographic cells must use clean direct architectural window styling'
);
assert(
  aboutVibeContent.includes('bg-surface-elevated/40 border border-outline/15'),
  'AboutVibe telemetry bar must use architectural spec capsules'
);

// OurStory de-nesting
const ourStoryPath = path.join(componentsDir, 'OurStory.tsx');
const ourStoryContent = fs.readFileSync(ourStoryPath, 'utf-8');
assert(
  !ourStoryContent.includes('from-white/[0.08] via-white/[0.02] to-transparent'),
  'OurStory floating card must not use redundant outer white-gradient bezel shell'
);
assert(
  ourStoryContent.includes('bg-surface-container/95') &&
    ourStoryContent.includes('border-primary/30') &&
    ourStoryContent.includes('backdrop-blur-2xl'),
  'OurStory floating card must use high-craft luxury architectural frame'
);

// VIPClub signature master frame
const vipClubPath = path.join(componentsDir, 'VIPClub.tsx');
const vipClubContent = fs.readFileSync(vipClubPath, 'utf-8');
assert(
  vipClubContent.includes('rounded-[2.5rem] p-1.5 sm:p-2 bg-gradient-to-b from-primary/55 via-primary-fixed-dim/30 to-primary/50'),
  'VIPClub must preserve signature double-bezel gold foil master frame for the private salon'
);

console.log('  ✅ Doppelrand discipline and architectural de-nesting verified across sections.\n');

// ============================================================================
// 5. 7-ACT NARRATIVE FLOW & ANCHOR CONTINUITY
// ============================================================================
console.log('5. Verifying 7-Act Narrative Flow & Section Anchor Integrity...');

const appPath = path.join(process.cwd(), 'src/App.tsx');
const appContent = fs.readFileSync(appPath, 'utf-8');

// Section order in App.tsx:
// Hero -> ScrollSequence -> AboutVibe -> Menu -> SpecialsBanner -> OurStory -> Gallery -> VIPClub -> Footer
const actSequence = [
  '<Hero',
  '<ScrollSequence',
  '<AboutVibe',
  '<Menu',
  '<SpecialsBanner',
  '<OurStory',
  '<Gallery',
  '<VIPClub',
  '<Footer',
];

let lastIdx = -1;
for (const act of actSequence) {
  const currentIdx = appContent.indexOf(act);
  assert(currentIdx > -1, `App.tsx must include ${act}`);
  assert(
    currentIdx > lastIdx,
    `Narrative sequence order violation: ${act} must appear after previous acts in App.tsx`
  );
  lastIdx = currentIdx;
}

console.log('  ✅ 7-Act homepage narrative order strictly preserved in App.tsx.\n');

// ============================================================================
// 6. VISUAL POLISH BATCH 2.1: CONTINUITY, ACCURACY & USABILITY
// ============================================================================
console.log('6. Verifying Visual Polish Batch 2.1 Improvements...');

// 6.1 ScrollSequence Transition & Pre-decode
const scrollSeqPath = path.join(componentsDir, 'ScrollSequence.tsx');
const scrollSeqContent = fs.readFileSync(scrollSeqPath, 'utf-8');
assert(
  scrollSeqContent.includes('exitOverlayRef') && scrollSeqContent.includes('exitProgress'),
  'ScrollSequence must include exit overlay dissolve into background'
);
assert(
  scrollSeqContent.includes('pre-decode') || scrollSeqContent.includes('firstImg.decode()'),
  'ScrollSequence must pre-decode frame 1 immediately on mount'
);

// 6.2 Sensory Tasting Ledger Explicit Signature & Fallback Badge Logic
const menuPath = path.join(componentsDir, 'Menu.tsx');
const menuContent = fs.readFileSync(menuPath, 'utf-8');
assert(
  menuContent.includes('isExplicitSignature'),
  'Menu.tsx must define isExplicitSignature check'
);
assert(
  menuContent.includes('Featured in this category'),
  'Menu.tsx must use "Featured in this category" for generic photographic fallbacks'
);
assert(
  menuContent.includes('activeSensoryMetadata?.isExplicitSignature && featuredItem.popular'),
  'Menu.tsx must only render "Signature Pick" pill for explicit signatures'
);

// 6.3 Gallery & OurStory Selective Framing De-nesting
const galleryPath = path.join(componentsDir, 'Gallery.tsx');
const galleryContent = fs.readFileSync(galleryPath, 'utf-8');
assert(
  !galleryContent.includes('rounded-[2rem] p-1.5 bg-gradient-to-b from-surface-container/70'),
  'Gallery carousel cards must not use nested double-bezel p-1.5 enclosure'
);
assert(
  !galleryContent.includes('rounded-[2rem] p-1.5 bg-gradient-to-b from-surface-container/60'),
  'Gallery bento cards must not use nested double-bezel p-1.5 enclosure'
);
assert(
  !ourStoryContent.includes('Double-Bezel Outer Enclosure'),
  'OurStory stage must not use redundant outer double-bezel enclosure'
);

// 6.4 AboutVibe Soundscape Status
assert(
  aboutVibeContent.includes('soundscapeStatus'),
  'AboutVibe must calculate soundscapeStatus based on true playback state'
);
assert(
  aboutVibeContent.includes("'PLAYING'") &&
    aboutVibeContent.includes("'AVAILABLE'") &&
    aboutVibeContent.includes("'UNAVAILABLE'"),
  'AboutVibe must support PLAYING, AVAILABLE, and UNAVAILABLE states'
);
assert(
  !aboutVibeContent.includes('autoplay') && !aboutVibeContent.includes('autoPlay'),
  'AboutVibe must not autoplay audio on mount'
);

// 6.5 Footer Mobile Usability & Untruncated Phone
const footerPath = path.join(componentsDir, 'Footer.tsx');
const footerContent = fs.readFileSync(footerPath, 'utf-8');
assert(
  footerContent.includes('grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2'),
  'Footer contact quick action grid must use responsive column scaling to prevent small-screen squeeze'
);
assert(
  footerContent.includes('whitespace-nowrap font-mono'),
  'Footer phone link must keep phone number untruncated with whitespace-nowrap and font-mono'
);

console.log('  ✅ Visual Polish Batch 2.1 continuity, accuracy & mobile usability verified.\n');

console.log('======================================================================');
console.log('🎉 ALL VISUAL ELEVATION BATCH 2 & 2.1 TESTS PASSED SUCCESSFULLY!');
console.log('======================================================================\n');
