import React, { useEffect } from 'react';
import { useSiteConfig } from '../context/SiteConfigContext';
import { clientDetails } from '../config/client';
import { Breadcrumbs } from './Breadcrumbs';

export const NotFoundPage: React.FC = () => {
  const { restaurantConfig, logoUrl } = useSiteConfig();

  const businessName = restaurantConfig?.businessName || clientDetails.businessName;
  const shortName = restaurantConfig?.shortName || clientDetails.shortName;

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = `404 — Page Not Found | ${businessName}`;
  }, [businessName]);

  return (
    <div className="min-h-screen bg-[#0E0906] text-on-surface font-sans selection:bg-[#D4AF37]/30 selection:text-[#D4AF37] flex flex-col justify-between">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-[#140D09]/90 backdrop-blur-md border-b border-white/10 px-4 sm:px-8 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <a href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-full border border-[#D4AF37]/40 bg-[#1C120D] flex items-center justify-center overflow-hidden shadow-sm group-hover:border-[#D4AF37] transition-colors">
              <img src={logoUrl || "/logo.webp"} alt={`${businessName} Crest`} className="w-full h-full object-contain" width="40" height="40" />
            </div>
            <div className="flex flex-col">
              <span className="font-serif text-base text-white font-semibold tracking-tight">{businessName}</span>
              {shortName && shortName !== businessName && (
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#D4AF37]">{shortName}</span>
              )}
            </div>
          </a>

          <a
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-xs font-semibold text-zinc-300 hover:text-white border border-white/10 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Back to Dining</span>
          </a>
        </div>
      </header>

      {/* Main 404 Hero */}
      <main className="max-w-3xl mx-auto px-4 sm:px-8 py-16 sm:py-24 text-center flex-1 flex flex-col items-center justify-center">
        <Breadcrumbs items={[{ label: '404 Not Found', current: true }]} className="justify-center" />

        {/* Monogram Crest with 404 */}
        <div className="relative mb-8">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border border-primary/30 bg-surface-container flex items-center justify-center mx-auto shadow-[0_0_40px_rgba(var(--color-primary-rgb),0.15)]">
            <span className="font-serif text-4xl sm:text-5xl font-light text-primary italic">
              404
            </span>
          </div>
          <div className="absolute -bottom-2 inset-x-0 flex justify-center">
            <span className="px-3 py-0.5 rounded-full bg-surface-obsidian border border-primary/40 font-mono text-[10px] tracking-widest text-primary uppercase">
              Lost In Nocturne
            </span>
          </div>
        </div>

        <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl text-white font-normal tracking-tight mb-4 text-balance">
          This Course Could Not Be Found
        </h1>

        <p className="font-sans text-sm sm:text-base text-zinc-400 font-light max-w-lg mx-auto mb-10 leading-relaxed">
          The table, dish, or vintage you requested does not exist or has been retired from our cellar. Let us escort you back to our curated experience.
        </p>

        {/* Quick Nav Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md">
          <a
            href="/"
            className="w-full sm:w-auto h-12 px-8 rounded-full bg-primary hover:opacity-90 active:opacity-95 text-on-primary text-xs font-sans font-semibold uppercase tracking-[0.16em] transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(var(--color-primary-rgb),0.3)] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">restaurant</span>
            <span>Return to Dining</span>
          </a>

          <a
            href="/#menu-section"
            className="w-full sm:w-auto h-12 px-8 rounded-full border border-outline/30 hover:border-primary/60 bg-surface-container/60 hover:bg-surface-container text-on-surface text-xs font-sans font-semibold uppercase tracking-[0.16em] transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">menu_book</span>
            <span>Explore Menu</span>
          </a>
        </div>
      </main>

      {/* Footer Minimal */}
      <footer className="border-t border-white/5 py-6 text-center text-xs text-zinc-500 font-sans">
        <p>© {new Date().getFullYear()} {businessName}. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default NotFoundPage;
