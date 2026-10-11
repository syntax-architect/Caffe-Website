/**
 * Restaurant Visual Engine Foundation Types
 *
 * Reusable multi-client restaurant platform visual foundation.
 * Bridges operational localization (RestaurantLocalizationConfig) with brand
 * theme presets, design tokens, section layout variants, and visibility toggles.
 *
 * NOTE: Does not duplicate operational schemas or replace existing Supabase tables.
 */

import type { RestaurantLocalizationConfig } from './restaurantConfig';
import type { AllSiteContent } from '../services/siteContentService';

/**
 * Standard visual theme preset identifiers.
 * 'nocturnal-gold' represents the flagship Café Barrackpore identity.
 */
export type ThemePresetId =
  | 'nocturnal-gold'      // Flagship: Warm Gold #D4AF37 & Espresso #0a0807 / #160E0A
  | 'editorial-cream'     // Warm Cream: Parchment, Roasted Espresso & Terracotta Bronze
  | 'nordic-minimal'     // Contemporary: Pure Slate, Chalk & Charcoal
  | 'tuscan-trattoria'   // Rustic Mediterranean: Terracotta, Olive & Warm Cream
  | 'tokyo-modern';      // High-End Lounge: Crimson, Deep Onyx & Champagne

/**
 * Theme color tokens supporting Tailwind RGB tuple opacity syntax
 * and CSS custom property references.
 */
export interface ThemeColorTokens {
  /** Primary brand accent (e.g., Warm Gold "212 175 55" / #D4AF37) */
  primary: string;
  /** Primary fixed tone for buttons and hover states */
  primaryFixed?: string;
  /** Primary fixed dim tone for secondary accents */
  primaryFixedDim?: string;
  /** Base background (e.g., Espresso "10 8 7" / #0a0807) */
  background: string;
  /** Primary dark container surface (e.g., #0a0807 / #160E0A) */
  surface: string;
  /** Rich secondary surface container (e.g., "35 25 20" / #231914) */
  surfaceContainer: string;
  /** Deep obsidian well surface (e.g., "22 14 10" / #160E0A) */
  surfaceObsidian?: string;
  /** Elevated card/dialog surface (e.g., "46 33 26" / #2E211A) */
  surfaceElevated: string;
  /** Primary high-contrast text (e.g., Cream "227 218 205" / #E3DACD) */
  onSurface: string;
  /** Secondary reading text / captions (e.g., "209 199 187" / #D1C7BB) */
  onSurfaceVariant: string;
  /** Dark text on gold buttons/chips (e.g., "35 25 20" / #231914) */
  onPrimary: string;
  /** Hairline borders and dividers (e.g., "107 90 78" / #6B5A4E) */
  outline: string;
  /** Subtle border variant (e.g., "74 59 50" / #4A3B32) */
  outlineVariant: string;
}

/**
 * Typography pairings for heading and body copy.
 */
export interface ThemeTypographyTokens {
  /** Font family for luxury headlines (e.g. "'Playfair Display', serif") */
  headingFont: string;
  /** Font family for legible modern body copy (e.g. "Outfit, 'Outfit-Fallback', sans-serif") */
  bodyFont: string;
}

/**
 * Corner radius design tokens for consistent brand curvature.
 */
export interface ThemeRadiusTokens {
  badge: string;
  card: string;
  button: string;
  container: string;
}

/**
 * Motion and easing duration tokens for cinematic animations.
 */
export interface ThemeMotionTokens {
  editorialEase: string;
  durationFast: string;
  durationNormal: string;
  durationSlow: string;
}

/**
 * Ambient background lighting and overlay treatments.
 */
export interface ThemeAmbienceTokens {
  meshGlow: boolean;
  noiseGrain: boolean;
  scrimIntensity: 'subtle' | 'medium' | 'deep';
}

/**
 * Complete visual brand theme specification.
 */
export interface RestaurantVisualTheme {
  id: ThemePresetId;
  name: string;
  description?: string;
  colors: ThemeColorTokens;
  typography: ThemeTypographyTokens;
  radii: ThemeRadiusTokens;
  motion: ThemeMotionTokens;
  ambience: ThemeAmbienceTokens;
}

/**
 * Section layout variant options for modular page choreography.
 */
export type HeroVariant = 'cinematic-fullscreen' | 'editorial-split' | 'minimal-centered';
export type StoryVariant = 'interactive-chapters' | 'split-editorial' | 'timeline';
export type GalleryVariant = 'asymmetric-bento' | 'carousel-snap' | 'filmstrip' | 'masonry-grid';
export type SpecialsVariant = 'horizontal-platters' | 'grid' | 'spotlight';
export type MenuVariant = 'catalog-grid' | 'sensory-ledger';

export interface SectionLayoutVariants {
  hero?: HeroVariant;
  story?: StoryVariant;
  gallery?: GalleryVariant;
  specials?: SpecialsVariant;
  menu?: MenuVariant;
}

/**
 * Toggles for optional homepage sections.
 */
export interface SectionVisibilityConfig {
  hero: boolean;
  scrollSequence: boolean;
  aboutVibe: boolean;
  story: boolean;
  gallery: boolean;
  specialsBanner: boolean;
  menu: boolean;
  vipClub: boolean;
  footer: boolean;
}

/**
 * Brand narrative, marketing taglines, and social media links.
 */
export interface RestaurantBrandMetadata {
  tagline1?: string;
  tagline2?: string;
  description?: string;
  displayLocation?: string;
  googleMapsLink?: string;
  instagramLink?: string;
  facebookLink?: string;
  zomatoLink?: string;
  googleReviewLink?: string;
  elfsightId?: string;
}

/**
 * Individual configurable navigation item.
 */
export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  sectionKey?: keyof SectionVisibilityConfig;
  enabled?: boolean;
  isExternal?: boolean;
}

/**
 * Header and navigation bar configuration.
 */
export interface HeaderConfig {
  navigation?: NavigationItem[];
  primaryCtaText?: string;
  primaryCtaAction?: 'reservation' | 'menu' | 'custom';
  primaryCtaHref?: string;
  showPrimaryCta?: boolean;
  showCart?: boolean;
  showCallAction?: boolean;
  showDirectionsAction?: boolean;
}

/**
 * Footer link item.
 */
export interface FooterLink {
  id: string;
  label: string;
  href: string;
  sectionKey?: keyof SectionVisibilityConfig;
  isExternal?: boolean;
}

/**
 * Footer presentation configuration.
 */
export interface FooterConfig {
  tagline1?: string;
  tagline2?: string;
  subtext?: string;
  description?: string;
  showHospitalityBanner?: boolean;
  showSocialLinks?: boolean;
  curationLinks?: FooterLink[];
  scheduleNoticeTitle?: string;
  scheduleNoticeText?: string;
  hygieneMessage?: string;
  showStaffPortalLink?: boolean;
}

/**
 * Mobile dock action types.
 */
export type DockActionType = 'menu' | 'call' | 'reservation' | 'whatsapp' | 'directions' | 'cart';

/**
 * Individual action in the mobile floating dock.
 */
export interface MobileDockAction {
  id: string;
  type: DockActionType;
  label: string;
  enabled?: boolean;
  icon?: string;
}

/**
 * Mobile action dock configuration.
 */
export interface MobileDockConfig {
  enabled?: boolean;
  actions?: MobileDockAction[];
}

/**
 * Verified sensory tasting notes and beverage pairings associated with a specific menu item.
 */
export interface ItemSensoryMetadata {
  /** Optional verified tasting notes */
  tastingNotes?: string;
  /** Optional verified beverage pairing suggestion */
  pairing?: string;
  /** Optional custom eyebrow crest label */
  eyebrow?: string;
}

/**
 * Optional menu section configuration for Sensory Tasting Ledger.
 */
export interface MenuSectionConfig {
  /** Optional specific item ID to spotlight as featured dish */
  featuredItemId?: string;
  /** Optional custom eyebrow label above featured dish */
  featuredEyebrow?: string;
  /**
   * Optional tasting notes for the configured featuredItemId.
   * Only rendered if the active featured dish matches featuredItemId.
   */
  featuredTastingNotes?: string;
  /**
   * Optional pairing suggestion for the configured featuredItemId.
   * Only rendered if the active featured dish matches featuredItemId.
   */
  featuredPairing?: string;
  /** Optional explicit image asset for the featured dish */
  featuredImage?: string;
  /**
   * Optional map of stable menu item IDs to verified sensory metadata.
   * Allows fallback dishes to display their own authentic notes without leaking between products.
   */
  itemsMetadata?: Record<string, ItemSensoryMetadata>;
}

/**
 * Unified Restaurant Engine Configuration Interface.
 *
 * Integrates existing operational localization (currency, tax, opening hours,
 * contact, and legal schemas) with modular visual themes, layout variants,
 * and dynamic site content.
 */
export interface RestaurantEngineConfig {
  /** Existing operational localization, tax, and contact configuration */
  operational: RestaurantLocalizationConfig;
  /** Brand identity, descriptions, and social profiles */
  brand?: RestaurantBrandMetadata;
  /** Active visual theme */
  theme: RestaurantVisualTheme;
  /** Section visibility toggles */
  sections: SectionVisibilityConfig;
  /** Optional layout variants */
  variants?: SectionLayoutVariants;
  /** Optional menu section configuration */
  menu?: MenuSectionConfig;
  /** Dynamic content overrides (hero, story, vibe, gallery, specials, branding, vipClub) */
  content?: Partial<AllSiteContent>;
  /** Optional header and navigation configuration */
  header?: HeaderConfig;
  /** Optional footer configuration */
  footer?: FooterConfig;
  /** Optional mobile action dock configuration */
  mobileDock?: MobileDockConfig;
  /** Optional feature flags */
  features?: {
    orderingEnabled?: boolean;
    reservationsEnabled?: boolean;
    audioAmbianceEnabled?: boolean;
    staffPortalEnabled?: boolean;
    cookieConsentEnabled?: boolean;
  };
}
