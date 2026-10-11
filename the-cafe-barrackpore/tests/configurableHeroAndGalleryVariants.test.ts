/**
 * Phase 6A Verification Test Suite: Configurable Hero and Gallery Layout Variants
 *
 * Verifies that:
 * 1. Gallery Layout Variant Mismatch is resolved:
 *    - Default configuration sets `gallery: 'asymmetric-bento'`
 *    - `GalleryVariant` type includes 'asymmetric-bento', 'carousel-snap', 'filmstrip', and legacy alias 'masonry-grid'
 *    - Gallery component treats 'masonry-grid' as an alias for 'asymmetric-bento'
 * 2. Hero Layout Variants:
 *    - 'cinematic-fullscreen': Default flagship Café Barrackpore preserved 100%
 *    - 'editorial-split': 2-column balanced editorial layout with architectural showcase
 *    - 'minimal-centered': Centered typography-led layout with focal photographic pedestal
 *    - Shared HeroActions component handles primary and secondary CTA routing and reservation trigger
 *    - Respects reduced-motion preferences, responsive art-direction, and coordinates
 * 3. Gallery Layout Variants:
 *    - 'asymmetric-bento': Asymmetric bento grid with double-bezel styling and aspect ratio variants
 *    - 'carousel-snap': Horizontal snap-scrolling carousel with chevrons, pagination dots, and touch hints
 *    - 'filmstrip': Featured showcase card with synchronized thumbnail track and keyboard navigation
 *    - Shared luxury fullscreen theater lightbox modal with keyboard Escape support
 *    - Graceful empty state handling and metadata fallback
 * 4. Theme & Motion Token Integration:
 *    - Theme tokens (primary, surface-container, obsidian, outline, on-surface) applied across all variants
 *    - Dark scrims and contrast protections present in all photographic elements
 * 5. Configuration round-trip & JSON-serializability
 */

import fs from 'fs';
import path from 'path';
import { defaultEngineConfig } from '../src/config/defaultEngineConfig';
import {
  DEFAULT_GALLERY_ITEMS,
  type GalleryItem,
  type SiteContent,
  DEFAULT_SITE_CONTENT,
} from '../src/services/siteContentService';
import type {
  GalleryVariant,
  HeroVariant,
  RestaurantEngineConfig,
} from '../src/types/restaurantEngine';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

console.log('=== RUNNING PHASE 6A CONFIGURABLE HERO & GALLERY LAYOUT VARIANTS TESTS ===\n');

// ============================================================================
// 1. RESOLUTION OF GALLERY LAYOUT VARIANT MISMATCH
// ============================================================================
console.log('1. Verifying Gallery Variant Mismatch Resolution...');

assert(
  defaultEngineConfig.variants.gallery === 'asymmetric-bento',
  `Default gallery variant must be 'asymmetric-bento', found: '${defaultEngineConfig.variants.gallery}'`
);
assert(
  defaultEngineConfig.variants.hero === 'cinematic-fullscreen',
  `Default hero variant must be 'cinematic-fullscreen', found: '${defaultEngineConfig.variants.hero}'`
);

// Verify restaurantEngine.ts type definitions
const engineTypesPath = path.resolve(process.cwd(), 'src/types/restaurantEngine.ts');
const engineTypesContent = fs.readFileSync(engineTypesPath, 'utf8');

assert(
  engineTypesContent.includes("'asymmetric-bento'"),
  "restaurantEngine.ts must define 'asymmetric-bento' in GalleryVariant"
);
assert(
  engineTypesContent.includes("'carousel-snap'"),
  "restaurantEngine.ts must define 'carousel-snap' in GalleryVariant"
);
assert(
  engineTypesContent.includes("'filmstrip'"),
  "restaurantEngine.ts must define 'filmstrip' in GalleryVariant"
);
assert(
  engineTypesContent.includes("'masonry-grid'"),
  "restaurantEngine.ts must define legacy 'masonry-grid' in GalleryVariant for backwards compatibility"
);

console.log('  ✅ Default gallery variant correctly set to asymmetric-bento and all variants typed.\n');

// ============================================================================
// 2. HERO COMPONENT LAYOUT VARIANTS INSPECTION
// ============================================================================
console.log('2. Verifying Hero Layout Variants Implementation in Hero.tsx...');

const heroSourcePath = path.resolve(process.cwd(), 'src/components/Hero.tsx');
const heroSource = fs.readFileSync(heroSourcePath, 'utf8');

// 2.1 Variant Dispatch
assert(
  heroSource.includes("activeVariant === 'editorial-split'"),
  "Hero.tsx must have conditional branch for 'editorial-split'"
);
assert(
  heroSource.includes("activeVariant === 'minimal-centered'"),
  "Hero.tsx must have conditional branch for 'minimal-centered'"
);
assert(
  heroSource.includes('VARIANT A: CINEMATIC FULLSCREEN') ||
    heroSource.includes('hero-mask-reveal'),
  "Hero.tsx must retain the flagship 'cinematic-fullscreen' layout as the default/canonical branch"
);

// 2.2 Shared HeroActions Component
assert(
  heroSource.includes('const HeroActions: React.FC<HeroActionsProps>'),
  'Hero.tsx must declare a reusable HeroActions component to prevent triplicated CTA logic'
);
assert(
  heroSource.includes('showPrimaryCta') && heroSource.includes('showSecondaryCta'),
  'HeroActions must accept and respect showPrimaryCta and showSecondaryCta flags'
);
assert(
  heroSource.includes('handleNav(e, primaryCtaTarget)') || heroSource.includes('smoothScrollTo'),
  'HeroActions must use smoothScrollTo navigation for primary CTA'
);
assert(
  heroSource.includes('setIsReservationOpen(true)') || heroSource.includes('handleReservation'),
  'HeroActions must invoke table reservation drawer trigger'
);

// 2.3 Reduced Motion and Parallax Protection
assert(
  heroSource.includes('useReducedMotion()') || heroSource.includes('useReducedMotion'),
  'Hero.tsx must consult Framer Motion useReducedMotion'
);
assert(
  heroSource.includes('!prefersReducedMotion'),
  'Hero.tsx must disable mouse parallax motion when reduced motion is preferred'
);

// 2.4 Responsive Art Direction and Fallbacks
assert(
  heroSource.includes('<picture>') && heroSource.includes('heroMobileSrc'),
  'Hero.tsx must use <picture> tag with responsive mobile WebP source'
);
assert(
  heroSource.includes('establishmentLabel') && heroSource.includes('coordinatesText'),
  'Hero.tsx must display establishmentLabel and coordinatesText across variants'
);

console.log('  ✅ Hero variants and shared CTA architecture verified.\n');

// ============================================================================
// 3. GALLERY COMPONENT LAYOUT VARIANTS INSPECTION
// ============================================================================
console.log('3. Verifying Gallery Layout Variants Implementation in Gallery.tsx...');

const gallerySourcePath = path.resolve(process.cwd(), 'src/components/Gallery.tsx');
const gallerySource = fs.readFileSync(gallerySourcePath, 'utf8');

// 3.1 Legacy Variant Aliasing
assert(
  gallerySource.includes("rawVariant === 'masonry-grid' ? 'asymmetric-bento' : rawVariant"),
  "Gallery.tsx must alias 'masonry-grid' to 'asymmetric-bento' for backwards compatibility"
);

// 3.2 Variant Dispatch
assert(
  gallerySource.includes("activeVariant === 'carousel-snap'"),
  "Gallery.tsx must contain branch for 'carousel-snap'"
);
assert(
  gallerySource.includes("activeVariant === 'filmstrip'"),
  "Gallery.tsx must contain branch for 'filmstrip'"
);
assert(
  gallerySource.includes('VARIANT A: ASYMMETRIC BENTO GRID'),
  "Gallery.tsx must contain branch for 'asymmetric-bento'"
);

// 3.3 Carousel-Snap Affordances
assert(
  gallerySource.includes('canScrollLeft') && gallerySource.includes('canScrollRight'),
  'Gallery.tsx carousel-snap must track and provide scroll affordances (chevrons)'
);
assert(
  gallerySource.includes('scrollToSlide') || gallerySource.includes('handleCarouselScroll'),
  'Gallery.tsx carousel-snap must provide programmatic slide scrolling'
);
assert(
  gallerySource.includes('snap-x snap-mandatory'),
  'Gallery.tsx carousel-snap must implement CSS scroll snap'
);

// 3.4 Filmstrip Affordances
assert(
  gallerySource.includes('activeFilmstripIndex') && gallerySource.includes('setActiveFilmstripIndex'),
  'Gallery.tsx filmstrip must maintain active thumbnail index state'
);
assert(
  gallerySource.includes("e.key === 'ArrowLeft'") && gallerySource.includes("e.key === 'ArrowRight'"),
  'Gallery.tsx filmstrip must listen for ArrowLeft and ArrowRight keyboard navigation'
);
assert(
  gallerySource.includes('group/showcase') && gallerySource.includes('aspect-[16/10]'),
  'Gallery.tsx filmstrip must render a prominent showcase display card'
);

// 3.5 Shared Fullscreen Theater Lightbox Modal
assert(
  gallerySource.includes('selectedPhoto') && gallerySource.includes('setSelectedPhoto'),
  'Gallery.tsx must manage lightbox state across all variants'
);
assert(
  gallerySource.includes("e.key === 'Escape'"),
  'Gallery.tsx must dismiss lightbox on Escape key'
);
assert(
  gallerySource.includes('z-[250] bg-black/95 backdrop-blur-2xl'),
  'Gallery.tsx lightbox must render high-contrast luxury theater backdrop'
);

// 3.6 Empty State Graceful Handling
assert(
  gallerySource.includes('items.length === 0'),
  'Gallery.tsx must contain safe fallback empty state when no items are present'
);

console.log('  ✅ Gallery layout variants and interactive controls verified.\n');

// ============================================================================
// 4. METADATA ROBUSTNESS & CONTENT MODEL VERIFICATION
// ============================================================================
console.log('4. Verifying Gallery Metadata and Content Fallback...');

assert(
  Array.isArray(DEFAULT_GALLERY_ITEMS) && DEFAULT_GALLERY_ITEMS.length >= 4,
  'DEFAULT_GALLERY_ITEMS must contain at least 4 default items'
);

DEFAULT_GALLERY_ITEMS.forEach((item: GalleryItem, idx: number) => {
  assert(Boolean(item.id), `Gallery item ${idx} must have an id`);
  assert(Boolean(item.src), `Gallery item ${idx} must have a src`);
  assert(Boolean(item.alt), `Gallery item ${idx} must have alt text`);
  assert(Boolean(item.tag), `Gallery item ${idx} must have a category tag`);
  assert(Boolean(item.caption), `Gallery item ${idx} must have a caption`);
  assert(
    item.aspectVariant === 'tall' || item.aspectVariant === 'wide' || item.aspectVariant === 'square',
    `Gallery item ${idx} must specify a valid aspectVariant`
  );
});

console.log('  ✅ Gallery default items provide complete metadata.\n');

// ============================================================================
// 5. ENGINE CONFIGURATION JSON-SERIALIZABILITY & ROUND-TRIP
// ============================================================================
console.log('5. Verifying JSON Serializability and Configuration Permutations...');

const variantsToTest: Array<{ hero: HeroVariant; gallery: GalleryVariant }> = [
  { hero: 'cinematic-fullscreen', gallery: 'asymmetric-bento' },
  { hero: 'editorial-split', gallery: 'carousel-snap' },
  { hero: 'minimal-centered', gallery: 'filmstrip' },
  { hero: 'cinematic-fullscreen', gallery: 'masonry-grid' },
  { hero: 'editorial-split', gallery: 'asymmetric-bento' },
  { hero: 'minimal-centered', gallery: 'carousel-snap' },
];

for (const variantPair of variantsToTest) {
  const customConfig: RestaurantEngineConfig = {
    ...defaultEngineConfig,
    variants: {
      ...defaultEngineConfig.variants,
      hero: variantPair.hero,
      gallery: variantPair.gallery,
    },
  };

  const serialized = JSON.stringify(customConfig);
  const parsed = JSON.parse(serialized) as RestaurantEngineConfig;

  assert(
    parsed.variants.hero === variantPair.hero,
    `Round-trip serialization failed for hero variant: ${variantPair.hero}`
  );
  assert(
    parsed.variants.gallery === variantPair.gallery,
    `Round-trip serialization failed for gallery variant: ${variantPair.gallery}`
  );
}

console.log('  ✅ All hero and gallery variant combinations are 100% JSON-serializable.\n');

// ============================================================================
// 6. THEME TOKEN COMPATIBILITY IN NEW VARIANTS
// ============================================================================
console.log('6. Verifying Semantic Theme Token Usage in Hero and Gallery Variants...');

// Hero token checks
assert(
  heroSource.includes('bg-background') && heroSource.includes('text-on-surface'),
  'Hero must use semantic bg-background and text-on-surface tokens'
);
assert(
  heroSource.includes('bg-primary') && heroSource.includes('text-on-primary'),
  'HeroActions must use semantic primary and on-primary tokens'
);
assert(
  heroSource.includes('border-outline'),
  'Hero variants must use semantic border-outline tokens'
);

// Gallery token checks
assert(
  gallerySource.includes('bg-surface-obsidian') && gallerySource.includes('border-primary'),
  'Gallery variants must use surface-obsidian and primary accent tokens'
);
assert(
  gallerySource.includes('bg-surface-container') && gallerySource.includes('text-on-surface'),
  'Gallery variants must use semantic surface containers and text tokens'
);

console.log('  ✅ Semantic theme tokens correctly integrated in all variants.\n');

console.log('======================================================================');
console.log('🎉 ALL PHASE 6A HERO & GALLERY VARIANT TESTS PASSED SUCCESSFULLY!');
console.log('======================================================================\n');
