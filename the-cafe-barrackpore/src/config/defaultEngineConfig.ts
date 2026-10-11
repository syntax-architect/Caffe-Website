/**
 * Default Restaurant Engine Configuration
 * Flagship Client: The Café Barrackpore
 *
 * This configuration serves as the unified entry point for restaurant identity,
 * operational localization, visual theme tokens, section toggles, and layout variants.
 *
 * Source of Truth Precedence:
 * 1. Operational settings (tax, currency, hours, contact, address) -> DEFAULT_RESTAURANT_CONFIG
 * 2. Brand & social metadata -> clientDetails
 * 3. Visual design tokens -> 'nocturnal-gold' preset
 * 4. Content defaults -> DEFAULT_SITE_CONTENT
 */

import type {
  RestaurantEngineConfig,
  RestaurantVisualTheme,
  NavigationItem,
  HeaderConfig,
  FooterLink,
  FooterConfig,
  MobileDockAction,
  MobileDockConfig,
} from '../types/restaurantEngine';
import { DEFAULT_RESTAURANT_CONFIG } from './restaurantPresets';
import { clientDetails } from './client';
import { DEFAULT_SITE_CONTENT } from '../services/siteContentService';
import {
  FLAGSHIP_THEME_NOCTURNAL_GOLD,
  THEME_EDITORIAL_CREAM,
  THEME_PRESETS,
  getThemePreset,
} from './themePresets';

export {
  FLAGSHIP_THEME_NOCTURNAL_GOLD,
  THEME_EDITORIAL_CREAM,
  THEME_PRESETS,
  getThemePreset,
};
export type { RestaurantVisualTheme };

export const DEFAULT_NAVIGATION_ITEMS: NavigationItem[] = [
  { id: 'nav-vibe', label: 'About & Vibe', href: '#about-and-vibe', sectionKey: 'aboutVibe', enabled: true },
  { id: 'nav-menu', label: 'Curated Menu', href: '#menu-section', sectionKey: 'menu', enabled: true },
  { id: 'nav-specials', label: 'Chef Specials', href: '#chef-specials', sectionKey: 'specialsBanner', enabled: true },
  { id: 'nav-story', label: 'Our Story', href: '#our-story', sectionKey: 'story', enabled: true },
  { id: 'nav-gallery', label: 'Gallery', href: '#gallery', sectionKey: 'gallery', enabled: true },
  { id: 'nav-hours', label: 'Visit & Hours', href: '#reserve-section', sectionKey: 'footer', enabled: true },
];

export const DEFAULT_HEADER_CONFIG: HeaderConfig = {
  navigation: DEFAULT_NAVIGATION_ITEMS,
  primaryCtaText: 'Book a Table',
  primaryCtaAction: 'reservation',
  showPrimaryCta: true,
  showCart: true,
  showCallAction: true,
  showDirectionsAction: true,
};

export const DEFAULT_FOOTER_CURATIONS: FooterLink[] = [
  { id: 'curation-brews', label: 'Single-Origin Brews', href: '#menu-section', sectionKey: 'menu' },
  { id: 'curation-banquets', label: "Chef's Banquets", href: '#chef-specials', sectionKey: 'specialsBanner' },
  { id: 'curation-pizzas', label: 'Wood-Fired Pizzas', href: '#menu-section', sectionKey: 'menu' },
  { id: 'curation-mocktails', label: 'Lounge Mocktails', href: '#menu-section', sectionKey: 'menu' },
  { id: 'curation-booths', label: 'Private Booths', href: '#gallery', sectionKey: 'gallery' },
];

export const DEFAULT_FOOTER_CONFIG: FooterConfig = {
  tagline1: clientDetails.tagline1 || 'Bespoke Hospitality',
  tagline2: clientDetails.tagline2 || 'An Unrivaled Dining Atmosphere',
  subtext: `Reserve your private booth or enjoy gourmet artisanal favorites in ${clientDetails.displayLocation}.`,
  description: clientDetails.description,
  showHospitalityBanner: true,
  showSocialLinks: true,
  curationLinks: DEFAULT_FOOTER_CURATIONS,
  scheduleNoticeTitle: 'Acoustics',
  scheduleNoticeText: 'Fri & Sat from 7 PM',
  showStaffPortalLink: true,
};

export const DEFAULT_MOBILE_DOCK_ACTIONS: MobileDockAction[] = [
  { id: 'dock-menu', type: 'menu', label: 'Menu', enabled: true },
  { id: 'dock-call', type: 'call', label: 'Call', enabled: true },
  { id: 'dock-reservation', type: 'reservation', label: 'Book', enabled: true },
  { id: 'dock-whatsapp', type: 'whatsapp', label: 'Chat', enabled: true },
  { id: 'dock-directions', type: 'directions', label: 'Map', enabled: true },
  { id: 'dock-cart', type: 'cart', label: 'Bag', enabled: true },
];

export const DEFAULT_MOBILE_DOCK_CONFIG: MobileDockConfig = {
  enabled: true,
  actions: DEFAULT_MOBILE_DOCK_ACTIONS,
};

export const defaultEngineConfig: RestaurantEngineConfig = {
  operational: DEFAULT_RESTAURANT_CONFIG,
  brand: {
    tagline1: clientDetails.tagline1,
    tagline2: clientDetails.tagline2,
    description: clientDetails.description,
    displayLocation: clientDetails.displayLocation,
    googleMapsLink: clientDetails.googleMapsLink,
    instagramLink: clientDetails.instagramLink,
    facebookLink: clientDetails.facebookLink,
    zomatoLink: clientDetails.zomatoLink,
    googleReviewLink: clientDetails.googleReviewLink,
    elfsightId: clientDetails.elfsightId,
  },
  theme: FLAGSHIP_THEME_NOCTURNAL_GOLD,
  sections: {
    hero: true,
    scrollSequence: true,
    aboutVibe: true,
    story: true,
    gallery: true,
    specialsBanner: true,
    menu: true,
    vipClub: true,
    footer: true,
  },
  variants: {
    hero: 'cinematic-fullscreen',
    story: 'interactive-chapters',
    gallery: 'asymmetric-bento',
    specials: 'horizontal-platters',
    menu: 'sensory-ledger',
  },
  menu: {
    featuredItemId: 'special-chicken-on-a-bun',
    featuredEyebrow: "Chef's Signature Selection",
    featuredTastingNotes: "Flame-Charred Brioche • Melted Cheddar • House Smoked Relish",
    featuredPairing: "Pairs with Single-Origin Cold Brew or Botanical Tonic",
    itemsMetadata: {
      'special-chicken-on-a-bun': {
        tastingNotes: "Flame-Charred Brioche • Melted Cheddar • House Smoked Relish",
        pairing: "Pairs with Single-Origin Cold Brew or Botanical Tonic",
        eyebrow: "Chef's Signature Selection",
      },
    },
  },
  content: DEFAULT_SITE_CONTENT,
  header: DEFAULT_HEADER_CONFIG,
  footer: DEFAULT_FOOTER_CONFIG,
  mobileDock: DEFAULT_MOBILE_DOCK_CONFIG,
  features: {
    orderingEnabled: true,
    reservationsEnabled: true,
    audioAmbianceEnabled: true,
    staffPortalEnabled: true,
    cookieConsentEnabled: true,
  },
};
