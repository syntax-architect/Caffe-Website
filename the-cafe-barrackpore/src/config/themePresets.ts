/**
 * Restaurant Visual Theme Presets
 *
 * Provides strongly-typed brand visual themes for the restaurant platform:
 * 1. 'nocturnal-gold': The flagship Café Barrackpore identity (espresso, obsidian, warm gold).
 * 2. 'editorial-cream': Warm cream and parchment canvas with deep roasted espresso typography
 *    and warm terracotta bronze accents.
 */

import type { RestaurantVisualTheme, ThemePresetId } from '../types/restaurantEngine';

export const FLAGSHIP_THEME_NOCTURNAL_GOLD: RestaurantVisualTheme = {
  id: 'nocturnal-gold',
  name: 'Nocturnal Gold',
  description: 'The Café Barrackpore flagship aesthetic: deep espresso, obsidian surfaces, and warm gold accents.',
  colors: {
    primary: '212 175 55',           // #D4AF37 Warm Gold
    primaryFixed: '245 208 88',       // #F5D058 Bright Gold
    primaryFixedDim: '195 159 43',   // #C39F2B
    background: '10 8 7',            // #0a0807 Deep Espresso
    surface: '10 8 7',               // #0a0807 Baseline dark canvas
    surfaceContainer: '35 25 20',    // #231914 Rich warm espresso surface
    surfaceObsidian: '22 14 10',     // #160E0A Deep Obsidian well
    surfaceElevated: '46 33 26',     // #2E211A Elevated card/dialog
    onSurface: '227 218 205',        // #E3DACD Warm Cream text
    onSurfaceVariant: '209 199 187',  // #D1C7BB Muted body text
    onPrimary: '35 25 20',           // #231914 Dark on gold
    outline: '107 90 78',            // #6B5A4E Muted outline
    outlineVariant: '74 59 50',      // #4A3B32 Subtle hairline
  },
  typography: {
    headingFont: "'Playfair Display', serif",
    bodyFont: "Outfit, 'Outfit-Fallback', sans-serif",
  },
  radii: {
    badge: '9999px',
    card: '1.5rem',
    button: '9999px',
    container: '2.5rem',
  },
  motion: {
    editorialEase: 'cubic-bezier(0.16, 1, 0.3, 1)',
    durationFast: '200ms',
    durationNormal: '400ms',
    durationSlow: '700ms',
  },
  ambience: {
    meshGlow: true,
    noiseGrain: true,
    scrimIntensity: 'medium',
  },
};

export const THEME_EDITORIAL_CREAM: RestaurantVisualTheme = {
  id: 'editorial-cream',
  name: 'Editorial Cream',
  description: 'Warm cream and parchment paper canvas with deep roasted espresso typography and terracotta bronze accents.',
  colors: {
    primary: '158 71 42',            // #9E472A Warm Terracotta Bronze
    primaryFixed: '184 94 62',        // #B85E3E Terracotta Bronze Bright
    primaryFixedDim: '184 94 62',    // #B85E3E
    background: '247 244 238',       // #F7F4EE Warm Parchment Canvas
    surface: '250 247 242',          // #FAF7F2 Warm Cream Surface
    surfaceContainer: '238 232 222',  // #EEE8DE Linen Container
    surfaceObsidian: '228 220 208',  // #E4DCD0 Deep Linen Well
    surfaceElevated: '255 255 255',  // #FFFFFF Crisp Elevated Card
    onSurface: '34 26 22',           // #221A16 Deep Roasted Espresso Text
    onSurfaceVariant: '92 80 72',    // #5C5048 Muted Charcoal Text
    onPrimary: '250 247 242',        // #FAF7F2 Cream on Accent
    outline: '196 184 170',          // #C4B8AA Subtle Parchment Outline
    outlineVariant: '218 209 198',   // #DAD1C6 Hairline Divider
  },
  typography: {
    headingFont: "'Playfair Display', serif",
    bodyFont: "Outfit, 'Outfit-Fallback', sans-serif",
  },
  radii: {
    badge: '9999px',
    card: '1.5rem',
    button: '9999px',
    container: '2.5rem',
  },
  motion: {
    editorialEase: 'cubic-bezier(0.16, 1, 0.3, 1)',
    durationFast: '200ms',
    durationNormal: '400ms',
    durationSlow: '700ms',
  },
  ambience: {
    meshGlow: false,
    noiseGrain: true,
    scrimIntensity: 'subtle',
  },
};

export const THEME_PRESETS: Partial<Record<ThemePresetId, RestaurantVisualTheme>> = {
  'nocturnal-gold': FLAGSHIP_THEME_NOCTURNAL_GOLD,
  'editorial-cream': THEME_EDITORIAL_CREAM,
};

/**
 * Safely resolves a theme preset by ID, falling back to the flagship nocturnal-gold.
 */
export function getThemePreset(id?: ThemePresetId | string): RestaurantVisualTheme {
  if (!id) return FLAGSHIP_THEME_NOCTURNAL_GOLD;
  return THEME_PRESETS[id as ThemePresetId] || FLAGSHIP_THEME_NOCTURNAL_GOLD;
}

export type { ThemePresetId };
