/**
 * RTL (Right-to-Left) Layout Support Utility
 * Global Restaurant Platform — Bidirectional Text Support
 *
 * Provides CSS class helpers and layout utilities for Arabic and other RTL languages.
 * Uses CSS logical properties for automatic RTL adaptation.
 */

/**
 * Returns directional CSS class based on the current language direction.
 * Example: rtlClass('ml-4', 'mr-4', direction) → 'ml-4' for LTR, 'mr-4' for RTL
 */
export function rtlClass(
  ltrClass: string,
  rtlClassStr: string,
  direction: 'ltr' | 'rtl'
): string {
  return direction === 'rtl' ? rtlClassStr : ltrClass;
}

/**
 * Conditional RTL flip for icons, arrows, and directional elements.
 */
export function rtlFlip(direction: 'ltr' | 'rtl'): React.CSSProperties {
  return direction === 'rtl' ? { transform: 'scaleX(-1)' } : {};
}

/**
 * RTL-aware text alignment.
 */
export function rtlTextAlign(direction: 'ltr' | 'rtl'): 'left' | 'right' {
  return direction === 'rtl' ? 'right' : 'left';
}

/**
 * Returns CSS logical properties for consistent LTR/RTL spacing.
 * Instead of margin-left/margin-right, uses margin-inline-start/end.
 */
export const LOGICAL_PROPERTIES = {
  // Margin
  marginStart: 'margin-inline-start' as const,
  marginEnd: 'margin-inline-end' as const,
  // Padding
  paddingStart: 'padding-inline-start' as const,
  paddingEnd: 'padding-inline-end' as const,
  // Border
  borderStart: 'border-inline-start' as const,
  borderEnd: 'border-inline-end' as const,
  // Position
  insetStart: 'inset-inline-start' as const,
  insetEnd: 'inset-inline-end' as const,
};

/**
 * Returns appropriate font family for the given language.
 * Arabic and other scripts may need specific font stacks.
 */
export function getLanguageFontFamily(language: string): string {
  switch (language) {
    case 'ar':
      return '"Noto Sans Arabic", "Segoe UI", "Tahoma", sans-serif';
    case 'ja':
      return '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", sans-serif';
    case 'zh':
      return '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';
    case 'ko':
      return '"Noto Sans KR", "Apple SD Gothic Neo", sans-serif';
    case 'hi':
      return '"Noto Sans Devanagari", "Mangal", sans-serif';
    case 'th':
      return '"Noto Sans Thai", "Sarabun", sans-serif';
    default:
      return 'inherit';
  }
}

// React import for the CSSProperties type
import type React from 'react';
