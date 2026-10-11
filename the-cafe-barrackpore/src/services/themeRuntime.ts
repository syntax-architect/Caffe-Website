/**
 * Theme Runtime Service
 *
 * Provides a pure, testable mapping from RestaurantVisualTheme tokens to
 * CSS custom properties, and SSR-safe runtime injection into the document.
 */

import React, { useEffect, useMemo } from 'react';
import type { RestaurantVisualTheme } from '../types/restaurantEngine';
import { FLAGSHIP_THEME_NOCTURNAL_GOLD } from '../config/themePresets';
import { useSiteConfig } from '../context/SiteConfigContext';

/**
 * Normalizes a color value (hex, comma-separated rgb, or space-separated rgb)
 * into a space-separated RGB triplet ("R G B") compatible with Tailwind `<alpha-value>`.
 */
export function normalizeToRgbTriplet(val?: string, fallback = '212 175 55'): string {
  if (!val || typeof val !== 'string') return fallback;
  const trimmed = val.trim();

  // Already space-separated "R G B"
  if (/^\d{1,3}\s+\d{1,3}\s+\d{1,3}$/.test(trimmed)) {
    return trimmed;
  }

  // Comma-separated "R, G, B" or "rgb(R, G, B)"
  const rgbMatch = trimmed.match(/^rgba?\(?\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
  if (rgbMatch) {
    return `${rgbMatch[1]} ${rgbMatch[2]} ${rgbMatch[3]}`;
  }
  if (/^\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}$/.test(trimmed)) {
    return trimmed.split(',').map((s) => s.trim()).join(' ');
  }

  // Hex format "#RGB" or "#RRGGBB"
  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return `${r} ${g} ${b}`;
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `${r} ${g} ${b}`;
    }
  }

  return fallback;
}

/**
 * Converts a space-separated RGB triplet into a standard hex code "#RRGGBB".
 */
export function rgbTripletToHex(triplet: string): string {
  const parts = triplet.split(/\s+/).map((n) => Number.parseInt(n, 10));
  if (parts.length < 3 || parts.some(Number.isNaN)) return '#000000';
  const clamp = (n: number) => Math.max(0, Math.min(255, n));
  const toHex = (n: number) => clamp(n).toString(16).padStart(2, '0');
  return `#${toHex(parts[0])}${toHex(parts[1])}${toHex(parts[2])}`.toUpperCase();
}

/**
 * Pure, testable mapping from typed RestaurantVisualTheme tokens to
 * CSS custom properties consumed by Tailwind and CSS stylesheets.
 */
export function themeToCssVariables(theme?: Partial<RestaurantVisualTheme>): Record<string, string> {
  const colors = theme?.colors;
  const typography = theme?.typography;
  const radii = theme?.radii;
  const motion = theme?.motion;

  const primaryRgb = normalizeToRgbTriplet(colors?.primary, '212 175 55');
  const primaryFixedRgb = normalizeToRgbTriplet(colors?.primaryFixed || colors?.primary, '245 208 88');
  const primaryFixedDimRgb = normalizeToRgbTriplet(colors?.primaryFixedDim || colors?.primary, '195 159 43');
  const bgRgb = normalizeToRgbTriplet(colors?.background, '10 8 7');
  const surfaceRgb = normalizeToRgbTriplet(colors?.surface || colors?.background, '10 8 7');
  const surfaceContainerRgb = normalizeToRgbTriplet(colors?.surfaceContainer, '35 25 20');
  const surfaceObsidianRgb = normalizeToRgbTriplet(colors?.surfaceObsidian || colors?.surface, '22 14 10');
  const surfaceElevatedRgb = normalizeToRgbTriplet(colors?.surfaceElevated || colors?.surfaceContainer, '46 33 26');
  const onSurfaceRgb = normalizeToRgbTriplet(colors?.onSurface, '227 218 205');
  const onSurfaceVariantRgb = normalizeToRgbTriplet(colors?.onSurfaceVariant, '209 199 187');
  const onPrimaryRgb = normalizeToRgbTriplet(colors?.onPrimary, '35 25 20');
  const outlineRgb = normalizeToRgbTriplet(colors?.outline, '107 90 78');
  const outlineVariantRgb = normalizeToRgbTriplet(colors?.outlineVariant || colors?.outline, '74 59 50');

  return {
    '--color-primary': primaryRgb,
    '--color-primary-rgb': primaryRgb.split(' ').join(', '),
    '--color-primary-hex': rgbTripletToHex(primaryRgb),
    '--color-primary-fixed': primaryFixedRgb,
    '--color-primary-fixed-dim': primaryFixedDimRgb,
    '--color-surface-tint': primaryRgb,

    '--color-background': bgRgb,
    '--color-background-rgb': bgRgb.split(' ').join(', '),
    '--color-background-hex': rgbTripletToHex(bgRgb),

    '--color-surface': surfaceRgb,
    '--color-surface-obsidian': surfaceObsidianRgb,
    '--color-surface-elevated': surfaceElevatedRgb,
    '--color-surface-container': surfaceContainerRgb,
    '--color-surface-container-low': surfaceObsidianRgb,
    '--color-surface-container-lowest': bgRgb,
    '--color-surface-container-high': surfaceElevatedRgb,
    '--color-surface-container-highest': surfaceElevatedRgb,

    '--color-on-surface': onSurfaceRgb,
    '--color-on-surface-variant': onSurfaceVariantRgb,
    '--color-on-background': onSurfaceRgb,
    '--color-on-primary': onPrimaryRgb,

    '--color-outline': outlineRgb,
    '--color-outline-variant': outlineVariantRgb,

    '--font-heading': typography?.headingFont || "'Playfair Display', serif",
    '--font-body': typography?.bodyFont || "Outfit, 'Outfit-Fallback', sans-serif",

    '--radius-badge': radii?.badge || '9999px',
    '--radius-card': radii?.card || '1.5rem',
    '--radius-button': radii?.button || '9999px',
    '--radius-container': radii?.container || '2.5rem',

    '--ease-editorial': motion?.editorialEase || 'cubic-bezier(0.16, 1, 0.3, 1)',
    '--duration-fast': motion?.durationFast || '200ms',
    '--duration-normal': motion?.durationNormal || '400ms',
    '--duration-slow': motion?.durationSlow || '700ms',
  };
}

/**
 * Generates an inlined CSS string for a theme, perfect for SSR pre-rendering
 * and preventing any Flash of Wrong Theme (FOWT).
 */
export function generateThemeCssString(
  theme?: Partial<RestaurantVisualTheme>,
  selector = ':root'
): string {
  const vars = themeToCssVariables(theme);
  const declarations = Object.entries(vars)
    .map(([key, val]) => `  ${key}: ${val};`)
    .join('\n');
  return `${selector} {\n${declarations}\n}`;
}

/**
 * Safely applies the theme to the live document root.
 * SSR-safe: does nothing if window or document is undefined.
 */
export function applyThemeToDocument(theme: RestaurantVisualTheme): void {
  if (typeof document === 'undefined') return;
  const vars = themeToCssVariables(theme);
  const root = document.documentElement;
  root.setAttribute('data-theme', theme.id);
  for (const [key, val] of Object.entries(vars)) {
    root.style.setProperty(key, val);
  }
}

/**
 * ThemeRuntime React Component
 *
 * Injects `<style id="theme-tokens">` into the React render tree (SSR-safe),
 * and synchronizes live CSS properties on `document.documentElement`.
 */
export const ThemeRuntime: React.FC = () => {
  const { engineConfig } = useSiteConfig();
  const theme = engineConfig?.theme || FLAGSHIP_THEME_NOCTURNAL_GOLD;

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  const cssString = useMemo(() => generateThemeCssString(theme), [theme]);

  return React.createElement('style', {
    id: 'theme-tokens',
    dangerouslySetInnerHTML: { __html: cssString },
  });
};
