import React, { useState, useEffect } from 'react';

export const CookieConsent: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem('cafe_cookie_consent');
      if (!consent) {
        setIsVisible(true);
      }
    } catch {
      // Storage unavailable
    }
  }, []);

  const handleConsent = (choice: 'all' | 'essential') => {
    try {
      localStorage.setItem('cafe_cookie_consent', JSON.stringify({ choice, timestamp: Date.now() }));
      window.dispatchEvent(new CustomEvent('cafe:cookie_consent_changed', { detail: { choice } }));
      if (choice === 'all') {
        import('../services/analyticsService').then((m) => m.initAnalytics());
      }
    } catch {
      // Ignore
    }
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div
      role="region"
      aria-label="Cookie Consent Banner"
      aria-labelledby="cookie-consent-title"
      className="fixed bottom-[max(1rem,calc(0.75rem+env(safe-area-inset-bottom,0px)))] sm:bottom-6 left-4 right-4 sm:left-6 sm:right-auto sm:max-w-md z-40 animate-in fade-in slide-in-from-bottom duration-500 pointer-events-auto"
    >
      <div className="p-[1px] rounded-2xl bg-gradient-to-r from-primary/45 via-primary-fixed-dim/25 to-primary/45 shadow-[0_16px_40px_rgba(0,0,0,0.85)] border border-outline/25 backdrop-blur-xl">
        <div className="p-3.5 sm:p-4 rounded-[calc(1rem-1px)] bg-surface-obsidian/95 text-on-surface flex flex-col gap-2.5">
          {/* Header & Details */}
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0 text-primary mt-0.5">
              <span className="material-symbols-outlined text-[17px]">cookie</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 id="cookie-consent-title" className="text-xs font-mono font-semibold tracking-wider text-on-surface uppercase">
                  Dining Privacy &amp; Cookies
                </h3>
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-on-surface/50 shrink-0">
                  <a href="/privacy" className="hover:text-primary underline transition-colors">Privacy</a>
                  <span>·</span>
                  <a href="/terms" className="hover:text-primary underline transition-colors">Terms</a>
                </div>
              </div>
              <p className="text-[11px] text-on-surface/75 mt-0.5 leading-snug line-clamp-2">
                Essential local storage preserves your table QR order, dining cart, and language preferences.
              </p>
            </div>
          </div>

          {/* Single-Click Action Buttons in Pill Layout */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline/15">
            <button
              type="button"
              onClick={() => handleConsent('essential')}
              className="px-3.5 py-1.5 rounded-full font-mono text-[10px] tracking-wider uppercase font-medium text-on-surface/75 hover:text-on-surface bg-surface-container hover:bg-surface-elevated border border-outline/25 transition-all cursor-pointer active:scale-95"
            >
              Essential Only
            </button>
            <button
              type="button"
              onClick={() => handleConsent('all')}
              className="px-4 py-1.5 rounded-full font-mono text-[10px] tracking-wider uppercase font-bold text-on-primary bg-primary hover:bg-primary-fixed shadow-sm transition-all cursor-pointer active:scale-95"
            >
              Accept All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;

