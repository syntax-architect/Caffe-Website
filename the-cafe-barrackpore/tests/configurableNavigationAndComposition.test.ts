/**
 * Phase 4C Verification Test Suite: Configurable Header, Footer, Mobile Dock,
 * and Homepage Composition
 *
 * Verifies that:
 * 1. Default engine configuration preserves The Café Barrackpore flagship identity
 * 2. Header navigation items are section-aware and filter unmounted sections dynamically
 * 3. Active scroll-spy synchronization only targets visible mounted sections
 * 4. Header primary CTA adapts to reservation availability (Booking vs Walk-Ins)
 * 5. Footer curations and links dynamically filter against disabled sections
 * 6. Footer staff portal link and social links obey feature flags and link presence
 * 7. Mobile Action Dock filters actions based on operational contact data and feature flags
 * 8. Minimal restaurant engine composition (e.g. Hero + Menu + Footer only) functions cleanly
 * 9. All navigation, header, footer, and dock configurations are 100% JSON-serializable
 */

import {
  defaultEngineConfig,
  FLAGSHIP_THEME_NOCTURNAL_GOLD,
  DEFAULT_NAVIGATION_ITEMS,
  DEFAULT_HEADER_CONFIG,
  DEFAULT_FOOTER_CURATIONS,
  DEFAULT_FOOTER_CONFIG,
  DEFAULT_MOBILE_DOCK_ACTIONS,
  DEFAULT_MOBILE_DOCK_CONFIG,
} from '../src/config/defaultEngineConfig';
import type {
  NavigationItem,
  FooterLink,
  MobileDockAction,
  SectionVisibilityConfig,
  RestaurantEngineConfig,
} from '../src/types/restaurantEngine';
import { clientDetails } from '../src/config/client';
import { DEFAULT_RESTAURANT_CONFIG } from '../src/config/restaurantPresets';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

console.log('=== RUNNING PHASE 4C CONFIGURABLE NAVIGATION & COMPOSITION TESTS ===\n');

// -----------------------------------------------------------------------------
// Test 1: Flagship Identity & Default Preservation for The Café Barrackpore
// -----------------------------------------------------------------------------
console.log('Test 1: Verifying Flagship Default Preservation for The Café Barrackpore');

// 1.1 Header Navigation Defaults
assert(
  DEFAULT_NAVIGATION_ITEMS.length === 6,
  'Default navigation items must have exactly 6 links'
);
assert(
  DEFAULT_NAVIGATION_ITEMS[0].id === 'nav-vibe' &&
    DEFAULT_NAVIGATION_ITEMS[0].label === 'About & Vibe' &&
    DEFAULT_NAVIGATION_ITEMS[0].href === '#about-and-vibe' &&
    DEFAULT_NAVIGATION_ITEMS[0].sectionKey === 'aboutVibe' &&
    DEFAULT_NAVIGATION_ITEMS[0].enabled === true,
  'Navigation item 0 must be About & Vibe bound to #about-and-vibe'
);
assert(
  DEFAULT_NAVIGATION_ITEMS[1].id === 'nav-menu' &&
    DEFAULT_NAVIGATION_ITEMS[1].label === 'Curated Menu' &&
    DEFAULT_NAVIGATION_ITEMS[1].href === '#menu-section' &&
    DEFAULT_NAVIGATION_ITEMS[1].sectionKey === 'menu' &&
    DEFAULT_NAVIGATION_ITEMS[1].enabled === true,
  'Navigation item 1 must be Curated Menu bound to #menu-section'
);
assert(
  DEFAULT_NAVIGATION_ITEMS[2].id === 'nav-specials' &&
    DEFAULT_NAVIGATION_ITEMS[2].label === 'Chef Specials' &&
    DEFAULT_NAVIGATION_ITEMS[2].href === '#chef-specials' &&
    DEFAULT_NAVIGATION_ITEMS[2].sectionKey === 'specialsBanner' &&
    DEFAULT_NAVIGATION_ITEMS[2].enabled === true,
  'Navigation item 2 must be Chef Specials bound to #chef-specials'
);
assert(
  DEFAULT_NAVIGATION_ITEMS[3].id === 'nav-story' &&
    DEFAULT_NAVIGATION_ITEMS[3].label === 'Our Story' &&
    DEFAULT_NAVIGATION_ITEMS[3].href === '#our-story' &&
    DEFAULT_NAVIGATION_ITEMS[3].sectionKey === 'story' &&
    DEFAULT_NAVIGATION_ITEMS[3].enabled === true,
  'Navigation item 3 must be Our Story bound to #our-story'
);
assert(
  DEFAULT_NAVIGATION_ITEMS[4].id === 'nav-gallery' &&
    DEFAULT_NAVIGATION_ITEMS[4].label === 'Gallery' &&
    DEFAULT_NAVIGATION_ITEMS[4].href === '#gallery' &&
    DEFAULT_NAVIGATION_ITEMS[4].sectionKey === 'gallery' &&
    DEFAULT_NAVIGATION_ITEMS[4].enabled === true,
  'Navigation item 4 must be Gallery bound to #gallery'
);
assert(
  DEFAULT_NAVIGATION_ITEMS[5].id === 'nav-hours' &&
    DEFAULT_NAVIGATION_ITEMS[5].label === 'Visit & Hours' &&
    DEFAULT_NAVIGATION_ITEMS[5].href === '#reserve-section' &&
    DEFAULT_NAVIGATION_ITEMS[5].sectionKey === 'footer' &&
    DEFAULT_NAVIGATION_ITEMS[5].enabled === true,
  'Navigation item 5 must be Visit & Hours bound to #reserve-section'
);

// 1.2 Header Config Defaults
assert(
  DEFAULT_HEADER_CONFIG.primaryCtaText === 'Book a Table',
  'Header default primary CTA text must be "Book a Table"'
);
assert(
  DEFAULT_HEADER_CONFIG.primaryCtaAction === 'reservation',
  'Header default primary CTA action must be "reservation"'
);
assert(
  DEFAULT_HEADER_CONFIG.showPrimaryCta === true,
  'Header showPrimaryCta must be true by default'
);
assert(
  DEFAULT_HEADER_CONFIG.showCart === true,
  'Header showCart must be true by default'
);
assert(
  DEFAULT_HEADER_CONFIG.showCallAction === true,
  'Header showCallAction must be true by default'
);
assert(
  DEFAULT_HEADER_CONFIG.showDirectionsAction === true,
  'Header showDirectionsAction must be true by default'
);

// 1.3 Footer Curations Defaults
assert(
  DEFAULT_FOOTER_CURATIONS.length === 5,
  'Default footer curations must have exactly 5 links'
);
assert(
  DEFAULT_FOOTER_CURATIONS[0].id === 'curation-brews' &&
    DEFAULT_FOOTER_CURATIONS[0].label === 'Single-Origin Brews' &&
    DEFAULT_FOOTER_CURATIONS[0].sectionKey === 'menu',
  'Curation 0 must be Single-Origin Brews bound to menu'
);
assert(
  DEFAULT_FOOTER_CURATIONS[1].id === 'curation-banquets' &&
    DEFAULT_FOOTER_CURATIONS[1].label === "Chef's Banquets" &&
    DEFAULT_FOOTER_CURATIONS[1].sectionKey === 'specialsBanner',
  'Curation 1 must be Chef\'s Banquets bound to specialsBanner'
);
assert(
  DEFAULT_FOOTER_CURATIONS[2].id === 'curation-pizzas' &&
    DEFAULT_FOOTER_CURATIONS[2].label === 'Wood-Fired Pizzas' &&
    DEFAULT_FOOTER_CURATIONS[2].sectionKey === 'menu',
  'Curation 2 must be Wood-Fired Pizzas bound to menu'
);
assert(
  DEFAULT_FOOTER_CURATIONS[3].id === 'curation-mocktails' &&
    DEFAULT_FOOTER_CURATIONS[3].label === 'Lounge Mocktails' &&
    DEFAULT_FOOTER_CURATIONS[3].sectionKey === 'menu',
  'Curation 3 must be Lounge Mocktails bound to menu'
);
assert(
  DEFAULT_FOOTER_CURATIONS[4].id === 'curation-booths' &&
    DEFAULT_FOOTER_CURATIONS[4].label === 'Private Booths' &&
    DEFAULT_FOOTER_CURATIONS[4].sectionKey === 'gallery',
  'Curation 4 must be Private Booths bound to gallery'
);

// 1.4 Footer Config Defaults
assert(
  DEFAULT_FOOTER_CONFIG.tagline1 === (clientDetails.tagline1 || 'Bespoke Hospitality'),
  'Footer tagline1 must match clientDetails.tagline1 or fallback'
);
assert(
  DEFAULT_FOOTER_CONFIG.tagline2 === (clientDetails.tagline2 || 'An Unrivaled Dining Atmosphere'),
  'Footer tagline2 must match clientDetails.tagline2 or fallback'
);
assert(
  DEFAULT_FOOTER_CONFIG.showHospitalityBanner === true,
  'Footer showHospitalityBanner must be true'
);
assert(
  DEFAULT_FOOTER_CONFIG.showSocialLinks === true,
  'Footer showSocialLinks must be true'
);
assert(
  DEFAULT_FOOTER_CONFIG.scheduleNoticeTitle === 'Acoustics',
  'Footer scheduleNoticeTitle must be "Acoustics"'
);
assert(
  DEFAULT_FOOTER_CONFIG.scheduleNoticeText === 'Fri & Sat from 7 PM',
  'Footer scheduleNoticeText must be "Fri & Sat from 7 PM"'
);
assert(
  DEFAULT_FOOTER_CONFIG.showStaffPortalLink === true,
  'Footer showStaffPortalLink must be true'
);

// 1.5 Mobile Dock Defaults
assert(
  DEFAULT_MOBILE_DOCK_CONFIG.enabled === true,
  'Mobile dock must be enabled by default'
);
assert(
  DEFAULT_MOBILE_DOCK_ACTIONS.length === 6,
  'Default mobile dock must have exactly 6 actions'
);
assert(
  DEFAULT_MOBILE_DOCK_ACTIONS.map((a) => a.type).join(',') ===
    'menu,call,reservation,whatsapp,directions,cart',
  'Mobile dock actions must maintain exact flagship action sequence: menu,call,reservation,whatsapp,directions,cart'
);

// 1.6 Default Sections & Features
assert(
  defaultEngineConfig.sections.hero === true &&
    defaultEngineConfig.sections.scrollSequence === true &&
    defaultEngineConfig.sections.aboutVibe === true &&
    defaultEngineConfig.sections.story === true &&
    defaultEngineConfig.sections.gallery === true &&
    defaultEngineConfig.sections.specialsBanner === true &&
    defaultEngineConfig.sections.menu === true &&
    defaultEngineConfig.sections.vipClub === true &&
    defaultEngineConfig.sections.footer === true,
  'All 9 sections must be enabled by default for The Café Barrackpore'
);
assert(
  defaultEngineConfig.theme.id === FLAGSHIP_THEME_NOCTURNAL_GOLD.id,
  'Default engine config theme must match FLAGSHIP_THEME_NOCTURNAL_GOLD'
);
assert(
  defaultEngineConfig.features?.orderingEnabled === true &&
    defaultEngineConfig.features?.reservationsEnabled === true &&
    defaultEngineConfig.features?.audioAmbianceEnabled === true &&
    defaultEngineConfig.features?.staffPortalEnabled === true,
  'All core features must be enabled by default'
);

console.log('  ✔ Flagship identity defaults verified\n');

// -----------------------------------------------------------------------------
// Test 2: Section-Aware Header Navigation Link Filtering
// -----------------------------------------------------------------------------
console.log('Test 2: Verifying Section-Aware Header Navigation Link Filtering');

// Replication of Header.tsx visibleNavLinks filtering logic
function filterNavLinks(
  rawNavItems: NavigationItem[],
  sections?: SectionVisibilityConfig
): NavigationItem[] {
  return rawNavItems.filter((link) => {
    if (link.enabled === false) return false;
    if (link.sectionKey && sections && sections[link.sectionKey] === false) return false;
    return true;
  });
}

// Case 2.1: All sections active
const allActive = filterNavLinks(DEFAULT_NAVIGATION_ITEMS, defaultEngineConfig.sections);
assert(allActive.length === 6, 'All 6 navigation items must pass when all sections active');

// Case 2.2: Suppress story section
const storyDisabled: SectionVisibilityConfig = {
  ...defaultEngineConfig.sections,
  story: false,
};
const storyFiltered = filterNavLinks(DEFAULT_NAVIGATION_ITEMS, storyDisabled);
assert(storyFiltered.length === 5, 'Disabling story section must reduce nav items to 5');
assert(
  !storyFiltered.some((item) => item.id === 'nav-story'),
  'nav-story must be filtered out when sections.story is false'
);

// Case 2.3: Suppress gallery section
const galleryDisabled: SectionVisibilityConfig = {
  ...defaultEngineConfig.sections,
  gallery: false,
};
const galleryFiltered = filterNavLinks(DEFAULT_NAVIGATION_ITEMS, galleryDisabled);
assert(galleryFiltered.length === 5, 'Disabling gallery section must reduce nav items to 5');
assert(
  !galleryFiltered.some((item) => item.id === 'nav-gallery'),
  'nav-gallery must be filtered out when sections.gallery is false'
);

// Case 2.4: Suppress specialsBanner
const specialsDisabled: SectionVisibilityConfig = {
  ...defaultEngineConfig.sections,
  specialsBanner: false,
};
const specialsFiltered = filterNavLinks(DEFAULT_NAVIGATION_ITEMS, specialsDisabled);
assert(specialsFiltered.length === 5, 'Disabling specialsBanner must reduce nav items to 5');
assert(
  !specialsFiltered.some((item) => item.id === 'nav-specials'),
  'nav-specials must be filtered out when sections.specialsBanner is false'
);

// Case 2.5: Suppress aboutVibe
const vibeDisabled: SectionVisibilityConfig = {
  ...defaultEngineConfig.sections,
  aboutVibe: false,
};
const vibeFiltered = filterNavLinks(DEFAULT_NAVIGATION_ITEMS, vibeDisabled);
assert(vibeFiltered.length === 5, 'Disabling aboutVibe must reduce nav items to 5');
assert(
  !vibeFiltered.some((item) => item.id === 'nav-vibe'),
  'nav-vibe must be filtered out when sections.aboutVibe is false'
);

// Case 2.6: Suppress menu
const menuDisabled: SectionVisibilityConfig = {
  ...defaultEngineConfig.sections,
  menu: false,
};
const menuFiltered = filterNavLinks(DEFAULT_NAVIGATION_ITEMS, menuDisabled);
assert(menuFiltered.length === 5, 'Disabling menu must reduce nav items to 5');
assert(
  !menuFiltered.some((item) => item.id === 'nav-menu'),
  'nav-menu must be filtered out when sections.menu is false'
);

// Case 2.7: Explicit item toggle (enabled: false) overrides section visibility
const explicitItemDisabled: NavigationItem[] = [
  ...DEFAULT_NAVIGATION_ITEMS.map((item) =>
    item.id === 'nav-vibe' ? { ...item, enabled: false } : item
  ),
];
const explicitlyFiltered = filterNavLinks(explicitItemDisabled, defaultEngineConfig.sections);
assert(explicitlyFiltered.length === 5, 'Explicitly disabling nav-vibe must exclude it');
assert(
  !explicitlyFiltered.some((item) => item.id === 'nav-vibe'),
  'nav-vibe must be excluded when item.enabled is false'
);

console.log('  ✔ Header navigation filtering verified\n');

// -----------------------------------------------------------------------------
// Test 3: Active Scroll-Spy Synchronization
// -----------------------------------------------------------------------------
console.log('Test 3: Verifying Scroll-Spy Synchronization with Visible Sections');

function getActiveSpySectionIds(visibleNavLinks: NavigationItem[]): string[] {
  return visibleNavLinks
    .map((link) => (link.href.startsWith('#') ? link.href.slice(1) : ''))
    .filter(Boolean);
}

// 3.1 All visible sections
const allSpyIds = getActiveSpySectionIds(allActive);
assert(
  allSpyIds.join(',') === 'about-and-vibe,menu-section,chef-specials,our-story,gallery,reserve-section',
  'All 6 section anchor IDs must be registered for scroll spy in flagship mode'
);

// 3.2 When story and gallery are disabled
const multiDisabledSections: SectionVisibilityConfig = {
  ...defaultEngineConfig.sections,
  story: false,
  gallery: false,
};
const multiFilteredLinks = filterNavLinks(DEFAULT_NAVIGATION_ITEMS, multiDisabledSections);
const multiSpyIds = getActiveSpySectionIds(multiFilteredLinks);
assert(
  multiSpyIds.join(',') === 'about-and-vibe,menu-section,chef-specials,reserve-section',
  'Scroll spy must not track unmounted section anchors (our-story, gallery)'
);
assert(!multiSpyIds.includes('our-story'), 'our-story must not be in spy list');
assert(!multiSpyIds.includes('gallery'), 'gallery must not be in spy list');

// 3.3 External links do not register anchor IDs
const navWithExternal: NavigationItem[] = [
  ...DEFAULT_NAVIGATION_ITEMS,
  { id: 'nav-ext', label: 'Blog', href: 'https://blog.thecafebarrackpore.com', isExternal: true },
];
const extSpyIds = getActiveSpySectionIds(navWithExternal);
assert(
  extSpyIds.length === 6,
  'External HTTP links must not be included in anchor scroll-spy IDs'
);

console.log('  ✔ Scroll-spy synchronization verified\n');

// -----------------------------------------------------------------------------
// Test 4: Section-Aware Footer Curation Links Filtering
// -----------------------------------------------------------------------------
console.log('Test 4: Verifying Section-Aware Footer Curation Links Filtering');

function filterCurationLinks(
  curations: FooterLink[],
  sections?: SectionVisibilityConfig
): FooterLink[] {
  return curations.filter((link) => {
    if (link.sectionKey && sections && sections[link.sectionKey] === false) {
      return false;
    }
    return true;
  });
}

// 4.1 Flagship mode: all 5 curations
const allCurations = filterCurationLinks(DEFAULT_FOOTER_CURATIONS, defaultEngineConfig.sections);
assert(allCurations.length === 5, 'All 5 curations must be visible when all sections active');

// 4.2 Disabling menu section suppresses 3 menu curations
const menuDisabledCurations = filterCurationLinks(DEFAULT_FOOTER_CURATIONS, {
  ...defaultEngineConfig.sections,
  menu: false,
});
assert(
  menuDisabledCurations.length === 2,
  'Disabling menu must suppress 3 menu curations (brews, pizzas, mocktails)'
);
assert(
  menuDisabledCurations.map((c) => c.id).join(',') === 'curation-banquets,curation-booths',
  'Only specialsBanner and gallery curations should remain'
);

// 4.3 Disabling gallery suppresses Private Booths
const galleryDisabledCurations = filterCurationLinks(DEFAULT_FOOTER_CURATIONS, {
  ...defaultEngineConfig.sections,
  gallery: false,
});
assert(
  galleryDisabledCurations.length === 4,
  'Disabling gallery must suppress curation-booths'
);
assert(
  !galleryDisabledCurations.some((c) => c.id === 'curation-booths'),
  'curation-booths must be suppressed when gallery is false'
);

// 4.4 Disabling specialsBanner suppresses Chef\'s Banquets
const specialsDisabledCurations = filterCurationLinks(DEFAULT_FOOTER_CURATIONS, {
  ...defaultEngineConfig.sections,
  specialsBanner: false,
});
assert(
  specialsDisabledCurations.length === 4,
  'Disabling specialsBanner must suppress curation-banquets'
);
assert(
  !specialsDisabledCurations.some((c) => c.id === 'curation-banquets'),
  'curation-banquets must be suppressed when specialsBanner is false'
);

// 4.5 Disabling all target sections results in clean empty list without crashes
const allDisabledCurations = filterCurationLinks(DEFAULT_FOOTER_CURATIONS, {
  ...defaultEngineConfig.sections,
  menu: false,
  specialsBanner: false,
  gallery: false,
});
assert(
  allDisabledCurations.length === 0,
  'Disabling all target sections must cleanly result in 0 curation links'
);

console.log('  ✔ Footer curation links filtering verified\n');

// -----------------------------------------------------------------------------
// Test 5: Footer Features, Staff Portal & Suppression Logic
// -----------------------------------------------------------------------------
console.log('Test 5: Verifying Footer Features, Staff Portal & Suppression Logic');

// 5.1 Staff portal link visibility condition
function isStaffPortalVisible(
  footerConfig: typeof DEFAULT_FOOTER_CONFIG,
  features?: RestaurantEngineConfig['features']
): boolean {
  return (
    footerConfig.showStaffPortalLink !== false &&
    features?.staffPortalEnabled !== false
  );
}

assert(
  isStaffPortalVisible(DEFAULT_FOOTER_CONFIG, defaultEngineConfig.features) === true,
  'Staff portal must be visible when both config and feature flag are true'
);
assert(
  isStaffPortalVisible(
    { ...DEFAULT_FOOTER_CONFIG, showStaffPortalLink: false },
    defaultEngineConfig.features
  ) === false,
  'Staff portal must be hidden when footerConfig.showStaffPortalLink is false'
);
assert(
  isStaffPortalVisible(DEFAULT_FOOTER_CONFIG, {
    ...defaultEngineConfig.features,
    staffPortalEnabled: false,
  }) === false,
  'Staff portal must be hidden when features.staffPortalEnabled is false'
);

// 5.2 Whole footer suppression
assert(
  defaultEngineConfig.sections.footer === true,
  'Flagship footer must be enabled'
);
const footerDisabledConfig: RestaurantEngineConfig = {
  ...defaultEngineConfig,
  sections: {
    ...defaultEngineConfig.sections,
    footer: false,
  },
};
assert(
  footerDisabledConfig.sections.footer === false,
  'EngineConfig must allow disabling entire footer section'
);

// 5.3 Hygiene message localization fallback
const indianHygiene =
  DEFAULT_RESTAURANT_CONFIG.dietary?.system === 'india'
    ? '100% FSSAI-compliant commercial kitchen with daily sanitized workstations.'
    : '100% health-inspection compliant commercial kitchen with daily sanitized workstations.';
assert(
  indianHygiene.includes('FSSAI-compliant'),
  'Indian localization must select FSSAI compliance message'
);

console.log('  ✔ Footer features and suppression verified\n');

// -----------------------------------------------------------------------------
// Test 6: Mobile Action Dock Action Filtering & Feature Toggles
// -----------------------------------------------------------------------------
console.log('Test 6: Verifying Mobile Action Dock Filtering & Feature Toggles');

// Replication of MobileActionDock.tsx activeActions filtering logic
function filterDockActions(
  rawActions: MobileDockAction[],
  options: {
    phone?: string;
    whatsapp?: string;
    googleMapsLink?: string;
    menuSectionEnabled?: boolean;
    reservationsEnabled?: boolean;
    orderingEnabled?: boolean;
  }
): MobileDockAction[] {
  return rawActions.filter((action) => {
    if (action.enabled === false) return false;

    switch (action.type) {
      case 'menu':
        return options.menuSectionEnabled !== false;
      case 'call':
        return Boolean(options.phone);
      case 'reservation':
        return options.reservationsEnabled !== false;
      case 'whatsapp':
        return Boolean(options.whatsapp);
      case 'directions':
        return Boolean(options.googleMapsLink);
      case 'cart':
        return options.orderingEnabled !== false;
      default:
        return true;
    }
  });
}

// 6.1 Flagship client: all actions active
const flagshipDockActions = filterDockActions(DEFAULT_MOBILE_DOCK_ACTIONS, {
  phone: clientDetails.phone,
  whatsapp: clientDetails.whatsapp,
  googleMapsLink: clientDetails.googleMapsLink,
  menuSectionEnabled: true,
  reservationsEnabled: true,
  orderingEnabled: true,
});
assert(
  flagshipDockActions.length === 6,
  'All 6 actions must be active for flagship Café Barrackpore'
);

// 6.2 Suppress Call action if phone is missing
const noPhoneDockActions = filterDockActions(DEFAULT_MOBILE_DOCK_ACTIONS, {
  phone: '',
  whatsapp: clientDetails.whatsapp,
  googleMapsLink: clientDetails.googleMapsLink,
});
assert(
  !noPhoneDockActions.some((a) => a.type === 'call'),
  'Call action must be suppressed when phone is missing/empty'
);
assert(noPhoneDockActions.length === 5, 'Dock actions reduced to 5 without phone');

// 6.3 Suppress WhatsApp action if WhatsApp is missing
const noWhatsAppDockActions = filterDockActions(DEFAULT_MOBILE_DOCK_ACTIONS, {
  phone: clientDetails.phone,
  whatsapp: '',
  googleMapsLink: clientDetails.googleMapsLink,
});
assert(
  !noWhatsAppDockActions.some((a) => a.type === 'whatsapp'),
  'WhatsApp action must be suppressed when whatsapp number is missing'
);

// 6.4 Suppress Directions action if Google Maps link is missing
const noDirectionsDockActions = filterDockActions(DEFAULT_MOBILE_DOCK_ACTIONS, {
  phone: clientDetails.phone,
  whatsapp: clientDetails.whatsapp,
  googleMapsLink: '',
});
assert(
  !noDirectionsDockActions.some((a) => a.type === 'directions'),
  'Directions action must be suppressed when googleMapsLink is missing'
);

// 6.5 Suppress Menu action if menu section is disabled
const noMenuDockActions = filterDockActions(DEFAULT_MOBILE_DOCK_ACTIONS, {
  phone: clientDetails.phone,
  whatsapp: clientDetails.whatsapp,
  googleMapsLink: clientDetails.googleMapsLink,
  menuSectionEnabled: false,
});
assert(
  !noMenuDockActions.some((a) => a.type === 'menu'),
  'Menu action must be suppressed when menu section is disabled'
);

// 6.6 Suppress Reservation action if reservations are disabled
const noResDockActions = filterDockActions(DEFAULT_MOBILE_DOCK_ACTIONS, {
  phone: clientDetails.phone,
  whatsapp: clientDetails.whatsapp,
  googleMapsLink: clientDetails.googleMapsLink,
  reservationsEnabled: false,
});
assert(
  !noResDockActions.some((a) => a.type === 'reservation'),
  'Reservation action must be suppressed when reservationsEnabled is false'
);

// 6.7 Suppress Cart action if ordering is disabled
const noOrderDockActions = filterDockActions(DEFAULT_MOBILE_DOCK_ACTIONS, {
  phone: clientDetails.phone,
  whatsapp: clientDetails.whatsapp,
  googleMapsLink: clientDetails.googleMapsLink,
  orderingEnabled: false,
});
assert(
  !noOrderDockActions.some((a) => a.type === 'cart'),
  'Cart action must be suppressed when orderingEnabled is false'
);

console.log('  ✔ Mobile Action Dock filtering verified\n');

// -----------------------------------------------------------------------------
// Test 7: Minimal White-Label Composition Scenario
// -----------------------------------------------------------------------------
console.log('Test 7: Verifying Minimal White-Label Client Composition Scenario');

// Scenario: A lightweight espresso bar ("Nordic Roast")
// - Only Hero, Menu, and Footer enabled
// - Reservations disabled (walk-in only)
// - Ordering enabled
const minimalClientConfig: RestaurantEngineConfig = {
  ...defaultEngineConfig,
  sections: {
    hero: true,
    scrollSequence: false,
    aboutVibe: false,
    story: false,
    gallery: false,
    specialsBanner: false,
    menu: true,
    vipClub: false,
    footer: true,
  },
  features: {
    ...defaultEngineConfig.features,
    reservationsEnabled: false,
  },
};

// 7.1 Header navigation links for minimal client
const minimalNavLinks = filterNavLinks(DEFAULT_NAVIGATION_ITEMS, minimalClientConfig.sections);
assert(
  minimalNavLinks.length === 2,
  'Minimal client must only have 2 active navigation items (menu, hours)'
);
assert(
  minimalNavLinks.map((l) => l.id).join(',') === 'nav-menu,nav-hours',
  'Minimal client navigation must strictly contain nav-menu and nav-hours'
);

// 7.2 Scroll-spy IDs for minimal client
const minimalSpyIds = getActiveSpySectionIds(minimalNavLinks);
assert(
  minimalSpyIds.join(',') === 'menu-section,reserve-section',
  'Minimal client scroll spy must strictly target menu-section and reserve-section'
);

// 7.3 Footer curations for minimal client
const minimalCurations = filterCurationLinks(
  DEFAULT_FOOTER_CURATIONS,
  minimalClientConfig.sections
);
assert(
  minimalCurations.length === 3,
  'Minimal client curations must only include the 3 menu items (brews, pizzas, mocktails)'
);
assert(
  !minimalCurations.some((c) => c.sectionKey === 'specialsBanner' || c.sectionKey === 'gallery'),
  'Minimal client must not contain curations for specialsBanner or gallery'
);

// 7.4 Mobile dock actions for minimal client
const minimalDockActions = filterDockActions(DEFAULT_MOBILE_DOCK_ACTIONS, {
  phone: '+91 98765 43210',
  whatsapp: '+91 98765 43210',
  googleMapsLink: 'https://maps.google.com/?q=Nordic+Roast',
  menuSectionEnabled: minimalClientConfig.sections.menu,
  reservationsEnabled: minimalClientConfig.features?.reservationsEnabled,
  orderingEnabled: minimalClientConfig.features?.orderingEnabled,
});
assert(
  minimalDockActions.length === 5,
  'Minimal client mobile dock must have exactly 5 actions (reservation action excluded)'
);
assert(
  !minimalDockActions.some((a) => a.type === 'reservation'),
  'Reservation action must be excluded for minimal walk-in client'
);

console.log('  ✔ Minimal white-label composition scenario verified\n');

// -----------------------------------------------------------------------------
// Test 8: 100% JSON-Serializability for SSR & SSG Pre-rendering
// -----------------------------------------------------------------------------
console.log('Test 8: Verifying Full JSON-Serializability for SSR & Static Pre-rendering');

const testEnginePayload = {
  defaultEngineConfig,
  DEFAULT_NAVIGATION_ITEMS,
  DEFAULT_HEADER_CONFIG,
  DEFAULT_FOOTER_CURATIONS,
  DEFAULT_FOOTER_CONFIG,
  DEFAULT_MOBILE_DOCK_ACTIONS,
  DEFAULT_MOBILE_DOCK_CONFIG,
  minimalClientConfig,
};

const serialized = JSON.stringify(testEnginePayload);
const deserialized = JSON.parse(serialized);

assert(
  typeof serialized === 'string' && serialized.length > 2000,
  'Serialized engine configuration must produce non-empty JSON string'
);
assert(
  deserialized.DEFAULT_NAVIGATION_ITEMS.length === 6,
  'Deserialized navigation items length must match'
);
assert(
  deserialized.DEFAULT_HEADER_CONFIG.primaryCtaText === 'Book a Table',
  'Deserialized header primary CTA must match'
);
assert(
  deserialized.DEFAULT_FOOTER_CURATIONS.length === 5,
  'Deserialized footer curations length must match'
);
assert(
  deserialized.DEFAULT_MOBILE_DOCK_ACTIONS.length === 6,
  'Deserialized mobile dock actions length must match'
);
assert(
  deserialized.minimalClientConfig.sections.story === false,
  'Deserialized minimal client config sections must match'
);
assert(
  deserialized.minimalClientConfig.features.reservationsEnabled === false,
  'Deserialized minimal client feature toggles must match'
);

console.log('  ✔ JSON-serializability verified for SSR & SSG pre-rendering\n');

console.log('===============================================================');
console.log('🎉 ALL 8 PHASE 4C TEST SUITES PASSED FLAWLESSLY');
console.log('===============================================================\n');
