/**
 * Public URL & Origin Resolution Utilities
 * The Café Barrackpore — Commercial Production Readiness (Phase 1K)
 */

/**
 * Returns the authoritative public base URL / origin of the restaurant platform.
 * Supports:
 * 1. Explicit VITE_SITE_URL environment variable override (for custom domains / reverse proxies)
 * 2. window.location.origin in client browsers
 * 3. Safe fallback origin
 */
export function getPublicSiteOrigin(): string {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SITE_URL) {
    return String((import.meta as any).env.VITE_SITE_URL).replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'https://thecafe.com';
}

/**
 * Formats an authoritative QR ordering link for a specific table.
 * Standardizes to two-digit format (01-99).
 */
export function buildTableQrUrl(tableNumber: string): string {
  const origin = getPublicSiteOrigin();
  const normalized = String(tableNumber).trim().padStart(2, '0');
  return `${origin}/qr?table=${normalized}`;
}
