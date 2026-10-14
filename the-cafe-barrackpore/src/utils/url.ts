/**
 * Public URL & Origin Resolution Utilities
 * The Café Barrackpore — Commercial Production Readiness (Phase 1K)
 */

import { clientDetails } from '../config/client';

/**
 * Returns the authoritative public base URL / origin of the restaurant platform.
 * Supports:
 * 1. Explicit PUBLIC_SITE_URL or VITE_SITE_URL environment variables (build-time / reverse proxies)
 * 2. window.location.origin in client browsers
 * 3. clientDetails.staffDomain (client config)
 * 4. Safe fallback origin
 */
export function getPublicSiteOrigin(): string {
  // 1. Process environment (build time, SSR, Node scripts)
  const proc = typeof globalThis !== 'undefined' ? (globalThis as any).process : undefined;
  if (proc?.env?.PUBLIC_SITE_URL) {
    return String(proc.env.PUBLIC_SITE_URL).replace(/\/+$/, '');
  }
  if (proc?.env?.VITE_SITE_URL) {
    return String(proc.env.VITE_SITE_URL).replace(/\/+$/, '');
  }

  // 2. Vite import.meta.env (client bundling & SSR)
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.PUBLIC_SITE_URL) {
    return String((import.meta as any).env.PUBLIC_SITE_URL).replace(/\/+$/, '');
  }
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SITE_URL) {
    return String((import.meta as any).env.VITE_SITE_URL).replace(/\/+$/, '');
  }

  // 3. Client browser runtime
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  // 4. Client configuration fallback
  if (clientDetails?.staffDomain) {
    return `https://${clientDetails.staffDomain}`.replace(/\/+$/, '');
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
