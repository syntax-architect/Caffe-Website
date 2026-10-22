import React, { useState, useEffect } from 'react';
import { useSiteConfig } from '../context/SiteConfigContext';

export const AnnouncementBanner: React.FC = () => {
  const { restaurantConfig, features } = useSiteConfig();
  const [isDismissed, setIsDismissed] = useState(false);

  const bannerText = restaurantConfig.announcementBanner?.trim();

  useEffect(() => {
    if (typeof window !== 'undefined' && bannerText) {
      const dismissedKey = `dismissed_banner_${bannerText.slice(0, 20)}`;
      if (sessionStorage.getItem(dismissedKey)) {
        setIsDismissed(true);
      } else {
        setIsDismissed(false);
      }
    }
  }, [bannerText]);

  if (features?.specials_banner === false || !bannerText || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(`dismissed_banner_${bannerText.slice(0, 20)}`, 'true');
      } catch {
        // ignore
      }
    }
  };

  return (
    <div
      role="alert"
      className="relative z-50 bg-gradient-to-r from-[#1A1208] via-[#2A1D0D] to-[#1A1208] border-b border-[#D4AF37]/30 text-white px-4 py-2 text-xs font-sans shadow-md"
    >
      <div className="max-w-[1320px] mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 justify-center text-center">
          <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-ping shrink-0" />
          <span className="px-2 py-0.5 rounded-full text-[9px] uppercase tracking-widest font-mono font-bold bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30 shrink-0">
            Notice
          </span>
          <span className="text-zinc-200 font-medium tracking-wide leading-relaxed">
            {bannerText}
          </span>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="text-zinc-400 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10 shrink-0"
          aria-label="Dismiss announcement"
        >
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      </div>
    </div>
  );
};
