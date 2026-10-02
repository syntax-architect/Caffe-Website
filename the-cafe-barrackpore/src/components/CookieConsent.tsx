import React, { useState, useEffect } from 'react';

export const CookieConsent: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem('cafe_cookie_consent');
      if (!consent) {
        // Small delay so it smoothly slides up after page load
        const timer = setTimeout(() => setIsVisible(true), 1200);
        return () => clearTimeout(timer);
      }
    } catch {
      // Storage unavailable
    }
  }, []);

  const handleConsent = (choice: 'all' | 'essential') => {
    try {
      localStorage.setItem('cafe_cookie_consent', JSON.stringify({ choice, timestamp: Date.now() }));
    } catch {
      // Ignore
    }
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <aside
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent banner"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom duration-500"
    >
      <div className="p-1 rounded-2xl bg-gradient-to-r from-[#D4AF37]/50 via-amber-600/40 to-[#D4AF37]/50 shadow-[0_12px_40px_rgba(0,0,0,0.85)] border border-[#D4AF37]/30">
        <div className="p-4 sm:p-5 rounded-[calc(1rem-0.125rem)] bg-[#140D09] flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center shrink-0 text-[#D4AF37]">
              <span className="material-symbols-outlined text-[18px]">cookie</span>
            </div>
            <div className="flex-1">
              <h3 className="text-xs font-serif font-bold text-white tracking-wide">
                Bespoke Dining Experience &amp; Privacy
              </h3>
              <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                We use essential cookies and local storage to preserve your table QR session, save cart selections, and remember your language preferences.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/5">
            <div className="flex items-center gap-2 text-[10px] text-zinc-400">
              <a href="/privacy" className="hover:text-[#D4AF37] underline transition-colors">Privacy</a>
              <span>·</span>
              <a href="/terms" className="hover:text-[#D4AF37] underline transition-colors">Terms</a>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleConsent('essential')}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              >
                Essential Only
              </button>
              <button
                type="button"
                onClick={() => handleConsent('all')}
                className="px-3.5 py-1.5 rounded-lg text-[11px] font-bold text-[#140D09] bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB] hover:from-[#F3E5AB] hover:to-[#D4AF37] shadow-sm transition-all cursor-pointer"
              >
                Accept All
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default CookieConsent;
