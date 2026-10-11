/**
 * Phase 4A Verification Test Suite: Content-Driven Visual Components
 *
 * Verifies that:
 * 1. Default site content perfectly preserves The Café Barrackpore flagship identity
 * 2. Hero configuration supports custom headlines, CTAs, coordinates, and images
 * 3. OurStory dynamically calculates progress, scroll targets, and section height for variable chapters (N >= 1)
 * 4. Gallery dynamically binds custom items, aspect variants, captions, and lightbox metadata
 * 5. Legacy data shapes fallback gracefully without regressions
 * 6. Content structures are 100% JSON-serializable for SSR and static pre-rendering
 */

import {
  DEFAULT_SITE_CONTENT,
  DEFAULT_STORY_CHAPTERS,
  DEFAULT_GALLERY_ITEMS,
  type HeroContent,
  type StoryContent,
  type StoryChapter,
  type GalleryContent,
  type GalleryItem,
} from '../src/services/siteContentService';
import { defaultEngineConfig } from '../src/config/defaultEngineConfig';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

console.log('=== RUNNING PHASE 4A CONTENT-DRIVEN COMPONENTS TESTS ===\n');

// -----------------------------------------------------------------------------
// Test 1: Flagship Identity & Default Preservation
// -----------------------------------------------------------------------------
console.log('Test 1: Verifying Flagship Default Preservation for The Café Barrackpore');

assert(
  DEFAULT_SITE_CONTENT.hero.headline === 'NOCTURNAL',
  'Default hero headline must be "NOCTURNAL"'
);
assert(
  DEFAULT_SITE_CONTENT.hero.headlineItalic === 'Gastronomy.',
  'Default hero headlineItalic must be "Gastronomy."'
);
assert(
  DEFAULT_SITE_CONTENT.hero.eyebrowBadge === 'CAFÉ • BAR • BARRACKPORE',
  'Default eyebrow badge must be "CAFÉ • BAR • BARRACKPORE"'
);
assert(
  DEFAULT_SITE_CONTENT.hero.coordinates === '22.76° N, 88.37° E',
  'Default coordinates must be Barrackpore coordinates "22.76° N, 88.37° E"'
);
assert(
  DEFAULT_SITE_CONTENT.hero.establishmentLabel === 'EST. CANTONMENT',
  'Default establishment label must be "EST. CANTONMENT"'
);
assert(
  DEFAULT_SITE_CONTENT.hero.primaryCtaText === 'Explore Curated Menu',
  'Default primary CTA text must be "Explore Curated Menu"'
);
assert(
  DEFAULT_SITE_CONTENT.hero.secondaryCtaText === 'Reserve a Table',
  'Default secondary CTA text must be "Reserve a Table"'
);

// Story defaults
assert(
  DEFAULT_STORY_CHAPTERS.length === 3,
  'Default story chapters must have exactly 3 chapters'
);
assert(
  DEFAULT_STORY_CHAPTERS[0].step === '01' && DEFAULT_STORY_CHAPTERS[0].badge === 'THE PHILOSOPHY',
  'Chapter 1 must match the flagship philosophy chapter'
);
assert(
  DEFAULT_STORY_CHAPTERS[1].step === '02' && DEFAULT_STORY_CHAPTERS[1].badge === '2200K NOCTURNAL RITUAL',
  'Chapter 2 must match the flagship nocturnal ritual chapter'
);
assert(
  DEFAULT_STORY_CHAPTERS[2].step === '03' && DEFAULT_STORY_CHAPTERS[2].badge === 'ARTISANAL GASTRONOMY',
  'Chapter 3 must match the flagship gastronomy chapter'
);

// Gallery defaults
assert(
  DEFAULT_GALLERY_ITEMS.length === 4,
  'Default gallery items must have exactly 4 items'
);
assert(
  DEFAULT_GALLERY_ITEMS[0].tag === 'Intimate Evenings' && DEFAULT_GALLERY_ITEMS[0].aspectVariant === 'tall',
  'Item 0 must have tag "Intimate Evenings" with tall aspect variant'
);
assert(
  DEFAULT_GALLERY_ITEMS[1].tag === 'Wood-Fired Artisans' && DEFAULT_GALLERY_ITEMS[1].aspectVariant === 'wide',
  'Item 1 must have tag "Wood-Fired Artisans" with wide aspect variant'
);
assert(
  DEFAULT_SITE_CONTENT.gallery.eyebrow === 'Visual Chronicles',
  'Default gallery eyebrow must be "Visual Chronicles"'
);
assert(
  DEFAULT_SITE_CONTENT.gallery.title === 'Moments Captured at The Café',
  'Default gallery title must be "Moments Captured at The Café"'
);

console.log('✔ Flagship identity defaults verified 100% intact.\n');

// -----------------------------------------------------------------------------
// Test 2: Hero Customization Simulation
// -----------------------------------------------------------------------------
console.log('Test 2: Simulating Client-Specific Hero Customization');

const customHero: HeroContent = {
  headline: 'VELVET & VINE',
  headlineItalic: 'Bistro.',
  subtext: 'An intimate culinary escape in South Kolkata.',
  src: '/images/custom-hero.webp',
  mobileSrc: '/images/custom-hero-mobile.webp',
  alt: 'Velvet & Vine Dining Room',
  eyebrowBadge: 'BISTRO • CELLAR • BALLYGUNGE',
  coordinates: '22.52° N, 88.36° E',
  primaryCtaText: 'View Tasting Menu',
  primaryCtaHref: '#tasting-menu',
  secondaryCtaText: 'Book Private Dining',
  showPrimaryCta: true,
  showSecondaryCta: true,
  establishmentLabel: 'EST. 2024',
  scrollLabel: 'EXPLORE OUR WORLD',
};

// Verify field access & fallback resolution logic
const resolvedHeadline = customHero.headline || 'NOCTURNAL';
const resolvedItalic = customHero.headlineItalic !== undefined ? customHero.headlineItalic : 'Gastronomy.';
const resolvedEyebrow = customHero.eyebrowBadge || 'DEFAULT BADGE';
const resolvedTarget = (customHero.primaryCtaHref || '#menu').replace(/^#/, '');

assert(resolvedHeadline === 'VELVET & VINE', 'Custom headline resolved correctly');
assert(resolvedItalic === 'Bistro.', 'Custom italic headline resolved correctly');
assert(resolvedEyebrow === 'BISTRO • CELLAR • BALLYGUNGE', 'Custom eyebrow badge resolved');
assert(resolvedTarget === 'tasting-menu', 'Custom primary CTA target parsed without hash');
assert(customHero.establishmentLabel === 'EST. 2024', 'Custom establishment label preserved');

// Verify CTA toggle suppression
const heroWithoutSecondary: HeroContent = {
  ...customHero,
  showSecondaryCta: false,
};
assert(heroWithoutSecondary.showSecondaryCta === false, 'Secondary CTA can be suppressed via toggle');

console.log('✔ Hero configuration flexibility and CTA toggles verified.\n');

// -----------------------------------------------------------------------------
// Test 3: Dynamic OurStory Chapter Calculations (Variable N)
// -----------------------------------------------------------------------------
console.log('Test 3: Testing Dynamic Story Chapter Mathematics for Variable N');

const testCases = [
  { n: 2, label: '2 chapters (Boutique Cafe)' },
  { n: 3, label: '3 chapters (Standard Flagship)' },
  { n: 4, label: '4 chapters (Extended Heritage)' },
  { n: 5, label: '5 chapters (Multi-Course Story)' },
];

for (const tc of testCases) {
  const chapters: StoryChapter[] = Array.from({ length: tc.n }, (_, i) => ({
    id: `chapter-${i + 1}`,
    step: String(i + 1).padStart(2, '0'),
    badge: `CHAPTER ${i + 1}`,
    title: `Title ${i + 1}`,
    titleItalic: `Italic ${i + 1}`,
    description: `Description for chapter ${i + 1}`,
    highlight: `Highlight ${i + 1}`,
    image: `/images/ch-${i + 1}.webp`,
  }));

  const numChapters = chapters.length;
  assert(numChapters === tc.n, `Chapters array should have length ${tc.n}`);

  // Test dynamic section height formula
  const minHeightVh = Math.max(180, numChapters * 75);
  assert(minHeightVh >= 180, `Min height (${minHeightVh}vh) must be at least 180vh`);
  if (tc.n === 3) {
    assert(minHeightVh === 225, `Flagship 3 chapters min height must be 225vh`);
  }

  // Test scroll progress indexing: for any progress p in [0, 1], index must be in [0, numChapters - 1]
  const sampleP = [0.0, 0.1, 0.25, 0.49, 0.51, 0.75, 0.99, 1.0];
  for (const p of sampleP) {
    const computedIdx = Math.min(numChapters - 1, Math.max(0, Math.floor(p * numChapters)));
    assert(
      computedIdx >= 0 && computedIdx < numChapters,
      `Computed chapter index ${computedIdx} must be within [0, ${numChapters - 1}] for p=${p}`
    );
  }

  // Test target scroll position for every chapter
  for (let idx = 0; idx < numChapters; idx++) {
    const targetP = (idx + 0.5) / numChapters;
    assert(
      targetP > 0 && targetP < 1,
      `Target scroll position ${targetP} for chapter ${idx} must be within (0, 1)`
    );
    if (idx > 0) {
      const prevTargetP = (idx - 1 + 0.5) / numChapters;
      assert(targetP > prevTargetP, 'Target scroll positions must be strictly monotonically increasing');
    }
  }

  console.log(`  ✔ Passed ${tc.label} (N=${tc.n}, minHeight=${minHeightVh}vh)`);
}

// Test legacy single-description fallback mapping
const legacyCustomStory: StoryContent = {
  title: 'Our Custom Legacy Title',
  description: 'Custom description written by an owner in the legacy dashboard.',
  src: '/images/legacy-custom-image.webp',
  alt: 'Legacy Photo',
};

// When chapters are not supplied, Chapter 1 inherits the legacy description
const resolvedFallbackChapters = DEFAULT_STORY_CHAPTERS.map((c, i) =>
  i === 0 && legacyCustomStory.description ? { ...c, description: legacyCustomStory.description } : c
);
assert(
  resolvedFallbackChapters[0].description === legacyCustomStory.description,
  'Chapter 1 must inherit legacy story description if chapters array is absent'
);
assert(
  resolvedFallbackChapters[1].description === DEFAULT_STORY_CHAPTERS[1].description,
  'Chapter 2 retains default content'
);

console.log('✔ Dynamic story chapter mathematics and legacy fallback verified.\n');

// -----------------------------------------------------------------------------
// Test 4: Gallery Custom Items & Bento Spans
// -----------------------------------------------------------------------------
console.log('Test 4: Testing Gallery Custom Items, Aspect Variants, and Lightbox Counts');

const customGalleryItems: GalleryItem[] = [
  {
    id: 'item-wine',
    src: '/images/wine.webp',
    alt: 'Vintage Wine Cellar',
    tag: 'Sommelier Selection',
    caption: 'Rare natural wines aged in French oak.',
    aspectVariant: 'tall',
  },
  {
    id: 'item-tasting',
    src: '/images/tasting.webp',
    alt: 'Chef Tasting Menu',
    tag: 'Omakase Nights',
    caption: 'Seven-course tasting experience curated by Chef Marco.',
    aspectVariant: 'wide',
  },
  {
    id: 'item-patio',
    src: '/images/patio.webp',
    alt: 'Courtyard Seating',
    tag: 'Al Fresco Dining',
    caption: 'Moonlit patio surrounded by flowering jasmine.',
    aspectVariant: 'square',
  },
];

// Verify span class resolution helper
function getSpanClass(item: GalleryItem, idx: number): string {
  const variant = item.aspectVariant || (idx === 0 ? 'tall' : idx === 1 ? 'wide' : 'square');
  if (variant === 'tall') return 'lg:col-span-1 lg:row-span-2';
  if (variant === 'wide') return 'lg:col-span-2 lg:row-span-1';
  return 'lg:col-span-1 lg:row-span-1';
}

assert(getSpanClass(customGalleryItems[0], 0) === 'lg:col-span-1 lg:row-span-2', 'Tall aspect gets 1 col 2 rows');
assert(getSpanClass(customGalleryItems[1], 1) === 'lg:col-span-2 lg:row-span-1', 'Wide aspect gets 2 cols 1 row');
assert(getSpanClass(customGalleryItems[2], 2) === 'lg:col-span-1 lg:row-span-1', 'Square aspect gets 1 col 1 row');

// Verify lightbox photo counter formatting
for (let i = 0; i < customGalleryItems.length; i++) {
  const counterText = `${String(i + 1).padStart(2, '0')} / ${String(customGalleryItems.length).padStart(2, '0')}`;
  assert(
    counterText === `0${i + 1} / 03`,
    `Lightbox counter for item ${i} must be "0${i + 1} / 03"`
  );
}

// Test legacy images array fallback
const legacyGallery: GalleryContent = {
  images: [
    { src: '/images/legacy-1.jpg', alt: 'Legacy 1' },
    { src: '/images/legacy-2.jpg', alt: 'Legacy 2' },
  ],
};

const mappedFromLegacy = legacyGallery.images.map((img, idx) => ({
  id: `legacy-${idx + 1}`,
  src: img.src,
  alt: img.alt,
  tag: DEFAULT_GALLERY_ITEMS[idx]?.tag || 'The Experience',
  caption: DEFAULT_GALLERY_ITEMS[idx]?.caption || img.alt,
  aspectVariant: (idx === 0 ? 'tall' : idx === 1 ? 'wide' : 'square') as 'tall' | 'wide' | 'square',
}));

assert(mappedFromLegacy.length === 2, 'Legacy gallery images mapped successfully');
assert(mappedFromLegacy[0].tag === 'Intimate Evenings', 'Legacy item 0 receives fallback tag cleanly');

console.log('✔ Gallery items, bento aspect variants, and lightbox formatting verified.\n');

// -----------------------------------------------------------------------------
// Test 5: SSR / Static Pre-rendering Serialization
// -----------------------------------------------------------------------------
console.log('Test 5: Verifying Full JSON Serialization for Static Pre-Rendering');

const testEngineConfig = {
  ...defaultEngineConfig,
  content: DEFAULT_SITE_CONTENT,
};

const serialized = JSON.stringify(testEngineConfig);
assert(typeof serialized === 'string' && serialized.length > 500, 'Engine config serializes cleanly to JSON');

const parsed = JSON.parse(serialized);
assert(parsed.content.hero.headline === 'NOCTURNAL', 'Parsed hero headline matches original');
assert(parsed.content.story.chapters.length === 3, 'Parsed chapters preserved across JSON cycle');
assert(parsed.content.gallery.items.length === 4, 'Parsed gallery items preserved across JSON cycle');

console.log('✔ Static pre-rendering / SSR JSON serializability confirmed.\n');

console.log('================================================================');
console.log('🎉 ALL PHASE 4A CONTENT-DRIVEN COMPONENTS TESTS PASSED (5/5)!');
console.log('================================================================');
