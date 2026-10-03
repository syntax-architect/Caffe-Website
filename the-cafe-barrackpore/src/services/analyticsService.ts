/**
 * Analytics and Verification Service
 * Handles privacy-compliant Google Analytics (GA4) / Plausible tracking
 * gated strictly by user Cookie Consent (GDPR/DPDP compliant).
 */

const CONSENT_STORAGE_KEY = 'cafe_cookie_consent';
export const CONSENT_CHANGE_EVENT = 'cafe:cookie_consent_changed';

export interface ConsentRecord {
  choice: 'all' | 'essential';
  timestamp: number;
}

export function getStoredConsent(): ConsentRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function hasAnalyticsConsent(): boolean {
  const consent = getStoredConsent();
  return consent?.choice === 'all';
}

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
    plausible?: (event: string, options?: any) => void;
  }
}

/**
 * Initializes Google Analytics 4 or Plausible analytics if consent has been granted.
 */
export function initAnalytics(): void {
  if (typeof window === 'undefined') return;

  if (!hasAnalyticsConsent()) {
    return;
  }

  // 1. Google Analytics 4 (GA4)
  const gaId =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GA_MEASUREMENT_ID) ||
    (window as any).__GA_MEASUREMENT_ID__;

  if (gaId && !document.getElementById('ga4-script')) {
    const script = document.createElement('script');
    script.id = 'ga4-script';
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    function gtag(..._args: any[]) {
      window.dataLayer?.push(arguments);
    }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', gaId, {
      anonymize_ip: true,
      cookie_flags: 'SameSite=None;Secure',
    });
  }

  // 2. Plausible Analytics (Privacy-first alternative)
  const plausibleDomain =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PLAUSIBLE_DOMAIN) ||
    (window as any).__PLAUSIBLE_DOMAIN__;

  if (plausibleDomain && !document.getElementById('plausible-script')) {
    const script = document.createElement('script');
    script.id = 'plausible-script';
    script.defer = true;
    script.setAttribute('data-domain', plausibleDomain);
    script.src = 'https://plausible.io/js/script.js';
    document.head.appendChild(script);
  }
}

/**
 * Tracks a custom event if analytics consent is granted.
 */
export function trackEvent(eventName: string, params: Record<string, any> = {}): void {
  if (typeof window === 'undefined' || !hasAnalyticsConsent()) return;

  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  }

  if (typeof window.plausible === 'function') {
    window.plausible(eventName, { props: params });
  }
}
