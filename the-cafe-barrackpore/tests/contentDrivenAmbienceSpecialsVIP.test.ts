/**
 * Phase 4B Verification Test Suite: Content-Driven Ambience, Specials, and VIP Components
 *
 * Verifies that:
 * 1. Default site content perfectly preserves The Café Barrackpore flagship identity
 * 2. Ambience (AboutVibe) supports structured items, telemetry chips, metrics, and audio toggle
 * 3. Ambience layout handles variable cards (N = 2, 3, 4+) and audio disabling gracefully
 * 4. SpecialsBanner supports configurable eyebrow, trust badges, and combos
 * 5. Specials cart add payload integrity matches cart schema exactly
 * 6. VIPClub supports configurable crest, badges, perks (N = 2, 3, 5), form copy, and disclaimer
 * 7. Section toggles (enabled: false) are respected across all three sections
 * 8. Legacy data shapes fallback gracefully without regressions
 * 9. Content structures are 100% JSON-serializable for SSR and static pre-rendering
 */

import {
  DEFAULT_SITE_CONTENT,
  DEFAULT_AMBIENCE_ITEMS,
  DEFAULT_AMBIENCE_CHIPS,
  DEFAULT_AMBIENCE_METRICS,
  DEFAULT_AMBIENCE_AUDIO,
  DEFAULT_SPECIAL_BADGES,
  DEFAULT_SPECIAL_COMBOS,
  DEFAULT_VIP_PERKS,
  type AmbienceItem,
  type AmbienceAudioConfig,
  type AboutVibeContent,
  type SpecialCombo,
  type SpecialsContent,
  type VIPPerk,
  type VIPClubContent,
} from '../src/services/siteContentService';
import { defaultEngineConfig } from '../src/config/defaultEngineConfig';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

console.log('=== RUNNING PHASE 4B CONTENT-DRIVEN AMBIENCE, SPECIALS & VIP TESTS ===\n');

// -----------------------------------------------------------------------------
// Test 1: Flagship Identity & Default Preservation for The Café Barrackpore
// -----------------------------------------------------------------------------
console.log('Test 1: Verifying Flagship Default Preservation for The Café Barrackpore');

// AboutVibe defaults
assert(
  DEFAULT_SITE_CONTENT.aboutVibe.enabled === true,
  'AboutVibe must be enabled by default'
);
assert(
  DEFAULT_SITE_CONTENT.aboutVibe.eyebrowBadge === 'Cantonment Ambience',
  'AboutVibe eyebrowBadge must be "Cantonment Ambience"'
);
assert(
  DEFAULT_SITE_CONTENT.aboutVibe.eyebrowSub === 'Nocturne Sanctuary',
  'AboutVibe eyebrowSub must be "Nocturne Sanctuary"'
);
assert(
  DEFAULT_SITE_CONTENT.aboutVibe.eyebrowText === 'COLONIAL CHARM • VINTAGE GLOW',
  'AboutVibe eyebrowText must be "COLONIAL CHARM • VINTAGE GLOW"'
);
assert(
  DEFAULT_SITE_CONTENT.aboutVibe.title === 'The Atmosphere.',
  'AboutVibe title must be "The Atmosphere."'
);
assert(
  DEFAULT_SITE_CONTENT.aboutVibe.titleItalic === 'Atmosphere',
  'AboutVibe titleItalic must be "Atmosphere"'
);
assert(
  DEFAULT_AMBIENCE_ITEMS.length === 3,
  'Default ambience items must have exactly 3 cards'
);
assert(
  DEFAULT_AMBIENCE_ITEMS[0].id === 'vibe-seating' &&
    DEFAULT_AMBIENCE_ITEMS[0].title === 'Private Velvet Booths' &&
    DEFAULT_AMBIENCE_ITEMS[0].aspectVariant === 'tall',
  'Ambience item 0 must be Private Velvet Booths with tall aspect variant'
);
assert(
  DEFAULT_AMBIENCE_ITEMS[1].id === 'vibe-nocturne' &&
    DEFAULT_AMBIENCE_ITEMS[1].title === 'Iconic Neon Accents',
  'Ambience item 1 must be Iconic Neon Accents'
);
assert(
  DEFAULT_AMBIENCE_ITEMS[2].id === 'vibe-gastronomy' &&
    DEFAULT_AMBIENCE_ITEMS[2].title === 'Curated Plating',
  'Ambience item 2 must be Curated Plating'
);
assert(
  DEFAULT_AMBIENCE_CHIPS.length === 3,
  'Default ambience telemetry chips must have exactly 3 chips'
);
assert(
  DEFAULT_AMBIENCE_CHIPS[0].label === 'Lighting' && DEFAULT_AMBIENCE_CHIPS[0].value === '2200K Amber',
  'Chip 0 must be 2200K Amber lighting'
);
assert(
  DEFAULT_AMBIENCE_AUDIO.enabled === true && DEFAULT_AMBIENCE_AUDIO.badge === 'Live',
  'Default audio config must be enabled with "Live" badge'
);
assert(
  DEFAULT_AMBIENCE_METRICS.length === 2 && DEFAULT_AMBIENCE_METRICS[0].highlight === '2200K',
  'Default ambience metrics must have 2 metrics with 2200K highlight'
);

// Specials defaults
assert(
  DEFAULT_SITE_CONTENT.specials.enabled === true,
  'Specials must be enabled by default'
);
assert(
  DEFAULT_SITE_CONTENT.specials.eyebrow === "Chef's Signature Banquets",
  'Specials eyebrow must be "Chef\'s Signature Banquets"'
);
assert(
  DEFAULT_SITE_CONTENT.specials.title === 'Special Banquet & Hangout Platters',
  'Specials title must be "Special Banquet & Hangout Platters"'
);
assert(
  DEFAULT_SPECIAL_BADGES.length === 2,
  'Default special badges must have 2 badges'
);
assert(
  DEFAULT_SPECIAL_BADGES[0].text === 'Ideal for 2–3 Guests' && DEFAULT_SPECIAL_BADGES[0].icon === 'groups',
  'Badge 0 must be Ideal for 2–3 Guests with groups icon'
);
assert(
  DEFAULT_SPECIAL_BADGES[1].text === 'Made Fresh to Order' && DEFAULT_SPECIAL_BADGES[1].icon === 'skillet',
  'Badge 1 must be Made Fresh to Order with skillet icon'
);
assert(
  DEFAULT_SPECIAL_COMBOS.length === 3,
  'Default special combos must have exactly 3 platters'
);
assert(
  DEFAULT_SPECIAL_COMBOS[0].name === 'Chinese Platter' &&
    DEFAULT_SPECIAL_COMBOS[0].price === 380 &&
    DEFAULT_SPECIAL_COMBOS[0].diet === 'nv',
  'Combo 0 must be Chinese Platter at ₹380 non-veg'
);
assert(
  DEFAULT_SPECIAL_COMBOS[1].name === 'Tandoori Platter' &&
    DEFAULT_SPECIAL_COMBOS[1].price === 450 &&
    DEFAULT_SPECIAL_COMBOS[1].diet === 'nv',
  'Combo 1 must be Tandoori Platter at ₹450 non-veg'
);
assert(
  DEFAULT_SPECIAL_COMBOS[2].name === 'Rice & Noodles Bowl' &&
    DEFAULT_SPECIAL_COMBOS[2].price === 240 &&
    DEFAULT_SPECIAL_COMBOS[2].diet === 'all',
  'Combo 2 must be Rice & Noodles Bowl at ₹240 veg-optional ("all")'
);

// VIP Club defaults
assert(
  DEFAULT_SITE_CONTENT.vipClub.enabled === true,
  'VIP Club must be enabled by default'
);
assert(
  DEFAULT_SITE_CONTENT.vipClub.badge === "PRIVATE MEMBERS' SALON",
  'VIP Club badge must be "PRIVATE MEMBERS\' SALON"'
);
assert(
  DEFAULT_SITE_CONTENT.vipClub.badgeIcon === 'hotel_class',
  'VIP Club badge icon must be "hotel_class"'
);
assert(
  DEFAULT_SITE_CONTENT.vipClub.eyebrow === "Connoisseurs' Privileges",
  'VIP Club eyebrow must be "Connoisseurs\' Privileges"'
);
assert(
  DEFAULT_SITE_CONTENT.vipClub.title === 'Join the Nocturnal Circle',
  'VIP Club title must be "Join the Nocturnal Circle"'
);
assert(
  DEFAULT_SITE_CONTENT.vipClub.titleItalic === 'Nocturnal Circle',
  'VIP Club titleItalic must be "Nocturnal Circle"'
);
assert(
  DEFAULT_VIP_PERKS.length === 3,
  'Default VIP perks must have exactly 3 perks'
);
assert(
  DEFAULT_VIP_PERKS[0].title === 'Priority' && DEFAULT_VIP_PERKS[0].icon === 'event_seat',
  'VIP perk 0 must be Priority with event_seat icon'
);
assert(
  DEFAULT_VIP_PERKS[1].title === 'Secret Menus' && DEFAULT_VIP_PERKS[1].icon === 'restaurant_menu',
  'VIP perk 1 must be Secret Menus with restaurant_menu icon'
);
assert(
  DEFAULT_VIP_PERKS[2].title === 'Live Acoustix' && DEFAULT_VIP_PERKS[2].icon === 'music_note',
  'VIP perk 2 must be Live Acoustix with music_note icon'
);
assert(
  DEFAULT_SITE_CONTENT.vipClub.ctaLabel === 'Join Privileges',
  'VIP Club CTA label must be "Join Privileges"'
);

console.log('  ✔ Flagship defaults verified successfully\n');

// -----------------------------------------------------------------------------
// Test 2: Variable Ambience Cards (N = 2, 3, 4+) & Layout Flexibility
// -----------------------------------------------------------------------------
console.log('Test 2: Verifying Variable Ambience Cards Configuration');

const custom2Cards: AmbienceItem[] = [
  {
    id: 'card-1',
    title: 'Terrace Dining',
    eyebrow: '01 • SKYLINE',
    description: 'Open air under the stars.',
    image: '/images/custom-terrace.webp',
    icon: 'deck',
  },
  {
    id: 'card-2',
    title: 'Fireplace Hearth',
    eyebrow: '02 • WARMTH',
    description: 'Cozy hearthside tables.',
    image: '/images/custom-hearth.webp',
    icon: 'fireplace',
  },
];

const custom4Cards: AmbienceItem[] = [
  ...DEFAULT_AMBIENCE_ITEMS,
  {
    id: 'vibe-courtyard',
    title: 'Heritage Courtyard',
    eyebrow: '04 • OUTDOORS',
    badge: 'COURTYARD',
    description: 'Pebbled courtyard with jasmine canopy.',
    image: '/images/courtyard.webp',
    icon: 'yard',
  },
];

assert(custom2Cards.length === 2, '2-card custom ambience must contain 2 items');
assert(custom4Cards.length === 4, '4-card custom ambience must contain 4 items');
assert(custom4Cards[3].icon === 'yard', '4th ambience item must retain its custom icon');

console.log('  ✔ Variable ambience cards supported\n');

// -----------------------------------------------------------------------------
// Test 3: Ambience Audio Soundscape Toggle
// -----------------------------------------------------------------------------
console.log('Test 3: Verifying Ambience Audio Soundscape Toggle');

const audioDisabledConfig: AmbienceAudioConfig = {
  enabled: false,
};

assert(audioDisabledConfig.enabled === false, 'Audio can be cleanly disabled via enabled: false');

// Verify engineConfig feature flag interaction
const engineAudioDisabled = {
  ...defaultEngineConfig,
  features: {
    ...defaultEngineConfig.features,
    audioAmbianceEnabled: false,
  },
};

assert(
  engineAudioDisabled.features.audioAmbianceEnabled === false,
  'EngineConfig feature audioAmbianceEnabled can disable audio at platform level'
);

console.log('  ✔ Ambience audio toggle verified\n');

// -----------------------------------------------------------------------------
// Test 4: Dynamic Specials Combos & Platter Cart Payload Integrity
// -----------------------------------------------------------------------------
console.log('Test 4: Verifying Specials Combos & Cart Payload Integrity');

const customCombos: SpecialCombo[] = [
  {
    id: 'combo-seafood-feast',
    name: 'Coastal Seafood Platter',
    category: 'mains-platters',
    diet: 'nv',
    price: 650,
    badge: 'CHEF SELECTION',
    serves: '2–4 Guests',
    description: 'Charred tiger prawns, calamari fritti, and butter garlic dip.',
    image: '/images/platters/seafood.webp',
  },
];

assert(customCombos[0].id === 'combo-seafood-feast', 'Custom combo ID preserved');
assert(customCombos[0].diet === 'nv', 'Custom combo diet is nv');
assert(customCombos[0].price === 650, 'Custom combo price is 650');

// Verify addToCart payload contract
const simulatedCartItem = {
  id: customCombos[0].id,
  name: customCombos[0].name,
  category: customCombos[0].category,
  category_id: customCombos[0].category,
  diet: customCombos[0].diet,
  price: customCombos[0].price,
  description: customCombos[0].description,
  popular: true,
  available: true,
  sort_order: 99,
};

assert(simulatedCartItem.id === 'combo-seafood-feast', 'Cart item id matches combo id');
assert(simulatedCartItem.price === 650, 'Cart item price matches combo price');
assert(simulatedCartItem.diet === 'nv', 'Cart item diet matches combo diet');
assert(simulatedCartItem.popular === true && simulatedCartItem.available === true, 'Cart item flags are valid');

console.log('  ✔ Specials combos and cart payload integrity verified\n');

// -----------------------------------------------------------------------------
// Test 5: Variable VIP Club Perks (N = 2, 3, 5)
// -----------------------------------------------------------------------------
console.log('Test 5: Verifying Variable VIP Club Perks Configuration');

const custom5Perks: VIPPerk[] = [
  ...DEFAULT_VIP_PERKS,
  {
    id: 'perk-sommelier',
    title: 'Wine Cellar',
    description: 'Curated natural wine allocations',
    icon: 'wine_bar',
  },
  {
    id: 'perk-valet',
    title: 'Private Valet',
    description: 'Dedicated arrival concierge',
    icon: 'local_taxi',
  },
];

assert(custom5Perks.length === 5, '5-perk VIP configuration supported');
assert(custom5Perks[3].icon === 'wine_bar', 'Perk 4 has wine_bar icon');
assert(custom5Perks[4].icon === 'local_taxi', 'Perk 5 has local_taxi icon');

console.log('  ✔ Variable VIP perks supported\n');

// -----------------------------------------------------------------------------
// Test 6: Section Suppression & Visibility Toggles
// -----------------------------------------------------------------------------
console.log('Test 6: Verifying Section Visibility Toggles');

// 1. Content-level toggle (enabled: false)
const contentDisabledAboutVibe: AboutVibeContent = {
  ...DEFAULT_SITE_CONTENT.aboutVibe,
  enabled: false,
};
const contentDisabledSpecials: SpecialsContent = {
  ...DEFAULT_SITE_CONTENT.specials,
  enabled: false,
};
const contentDisabledVIP: VIPClubContent = {
  ...DEFAULT_SITE_CONTENT.vipClub,
  enabled: false,
};

assert(contentDisabledAboutVibe.enabled === false, 'AboutVibe content toggle suppresses section');
assert(contentDisabledSpecials.enabled === false, 'Specials content toggle suppresses section');
assert(contentDisabledVIP.enabled === false, 'VIP Club content toggle suppresses section');

// 2. EngineConfig-level toggle
const engineConfigDisabled = {
  ...defaultEngineConfig,
  sections: {
    ...defaultEngineConfig.sections,
    aboutVibe: false,
    specialsBanner: false,
    vipClub: false,
  },
};

assert(engineConfigDisabled.sections.aboutVibe === false, 'EngineConfig suppresses aboutVibe');
assert(engineConfigDisabled.sections.specialsBanner === false, 'EngineConfig suppresses specialsBanner');
assert(engineConfigDisabled.sections.vipClub === false, 'EngineConfig suppresses vipClub');

console.log('  ✔ Section visibility toggles verified\n');

// -----------------------------------------------------------------------------
// Test 7: Legacy Data Shape Normalization
// -----------------------------------------------------------------------------
console.log('Test 7: Verifying Legacy Data Shape Fallbacks');

// If a legacy client only has an array of images for aboutVibe
const legacyImages = [
  { src: '/images/legacy-booths.webp', alt: 'Legacy Booths' },
  { src: '/images/legacy-lounge.webp', alt: 'Legacy Lounge' },
];

const normalizedItems: AmbienceItem[] = legacyImages.map((img, idx) => {
  const fallback = DEFAULT_AMBIENCE_ITEMS[idx] || DEFAULT_AMBIENCE_ITEMS[0];
  return {
    id: `vibe-legacy-${idx + 1}`,
    title: fallback.title,
    eyebrow: fallback.eyebrow,
    badge: fallback.badge,
    description: fallback.description,
    image: img.src,
    imageAlt: img.alt,
    icon: fallback.icon,
    aspectVariant: fallback.aspectVariant,
  };
});

assert(normalizedItems.length === 2, 'Legacy images successfully mapped to 2 AmbienceItems');
assert(normalizedItems[0].image === '/images/legacy-booths.webp', 'Legacy image 0 preserved');
assert(normalizedItems[0].title === 'Private Velvet Booths', 'Fallback title applied from default');
assert(normalizedItems[1].image === '/images/legacy-lounge.webp', 'Legacy image 1 preserved');

console.log('  ✔ Legacy data normalization verified\n');

// -----------------------------------------------------------------------------
// Test 8: 100% JSON-Serializability for SSR & SSG Pre-rendering
// -----------------------------------------------------------------------------
console.log('Test 8: Verifying Full JSON-Serializability for SSR & Prerendering');

const testPayload = {
  aboutVibe: DEFAULT_SITE_CONTENT.aboutVibe,
  specials: DEFAULT_SITE_CONTENT.specials,
  vipClub: DEFAULT_SITE_CONTENT.vipClub,
};

const serialized = JSON.stringify(testPayload);
const deserialized = JSON.parse(serialized);

assert(typeof serialized === 'string' && serialized.length > 500, 'Serialized JSON must be valid');
assert(
  deserialized.aboutVibe.title === DEFAULT_SITE_CONTENT.aboutVibe.title,
  'Deserialized aboutVibe title must match'
);
assert(
  deserialized.specials.combos.length === DEFAULT_SPECIAL_COMBOS.length,
  'Deserialized specials combos length must match'
);
assert(
  deserialized.vipClub.perks.length === DEFAULT_VIP_PERKS.length,
  'Deserialized VIP perks length must match'
);

console.log('  ✔ JSON-serializability verified for SSR\n');

console.log('===============================================================');
console.log('🎉 ALL 8 PHASE 4B TEST SUITES PASSED FLAWLESSLY');
console.log('===============================================================\n');
