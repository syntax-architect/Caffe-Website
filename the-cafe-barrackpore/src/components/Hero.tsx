import React from 'react';
import { smoothScrollTo } from '../utils/scroll';
import { useUI } from '../context/UIContext';
import { useSiteConfig } from '../context/SiteConfigContext';

export const Hero: React.FC = React.memo(() => {
  const { hero, restaurantConfig } = useSiteConfig();
  const { setIsReservationOpen } = useUI();

  const handleNav = (e: React.MouseEvent, target: string) => {
    e.preventDefault();
    smoothScrollTo(target);
  };

  const handleReservation = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsReservationOpen(true);
  };

  // High-performance WebP hero asset
  const heroImageSrc = (hero?.src && !hero.src.includes('hero-cinematic'))
    ? hero.src
    : '/images/hero-bar.webp';
  const heroImageAlt = hero?.alt || 'The Café Barrackpore — Nocturnal Cocktail & Espresso Lounge';

  const descriptionText = hero?.subtext || 
    "Where artisan coffee meets handcrafted cocktails & gourmet comfort food in a strictly premium, nocturnal setting.";

  return (
    <section 
      aria-label="Hero"
      className="relative w-full min-h-[100dvh] lg:h-[100dvh] bg-[#070504] overflow-hidden -mt-20 flex flex-col justify-between"
    >
      {/* 1. CINEMATIC INTEGRATED BACKGROUND IMAGE (Right-bleed architectural composition) */}
      <div 
        className="absolute top-0 right-0 bottom-0 w-full md:w-[60%] lg:w-[66%] xl:w-[64%] h-full pointer-events-none select-none overflow-hidden z-0"
      >
        <div className="relative w-full h-full">
          <picture>
            <source media="(max-width: 768px)" srcSet="/images/hero-bar-mobile.webp" type="image/webp" />
            <img
              src={heroImageSrc}
              alt={heroImageAlt}
              width="1200"
              height="800"
              className="w-full h-full object-cover object-[70%_center] lg:object-center filter brightness-[0.94] contrast-[1.08] saturate-[1.08]"
              loading="eager"
            />
          </picture>

          {/* Seamless multi-stop horizontal gradient blend: pure obsidian espresso on left fading into warm amber hospitality glow on right */}
          <div 
            className="absolute inset-0 bg-gradient-to-r from-[#070504] via-[#070504]/85 via-35% md:via-25% to-transparent" 
          />

          {/* Delicate vertical vignette layers to anchor the scene */}
          <div className="absolute top-0 left-0 right-0 h-44 bg-gradient-to-b from-[#070504]/90 via-[#070504]/30 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[#070504] via-[#070504]/75 to-transparent" />

          {/* Deep mobile readability veil with smooth upward fade */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#070504] via-[#070504]/85 via-45% to-[#070504]/60 md:hidden" />
        </div>
      </div>

      {/* 2. ATMOSPHERIC AMBIENT GLOWS & SUBTLE FILM GRAIN (Hidden on mobile for optimal GPU rendering) */}
      <div 
        className="hidden md:block absolute top-1/3 left-[-5%] w-[500px] h-[500px] rounded-full bg-[#D4AF37]/6 blur-[140px] pointer-events-none z-0" 
        aria-hidden="true"
      />
      <div 
        className="hidden md:block absolute bottom-[-10%] right-1/4 w-[560px] h-[560px] rounded-full bg-[#9d4300]/8 blur-[160px] pointer-events-none z-0" 
        aria-hidden="true"
      />
      <div 
        className="hidden md:block absolute inset-0 z-[1] opacity-[0.035] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
        aria-hidden="true"
      />

      {/* 3. MAIN HERO CONTENT CONTAINER (Vertically centered, intentional optical spacing) */}
      <div className="relative z-10 w-full max-w-[1360px] mx-auto px-6 sm:px-10 lg:px-12 pt-28 sm:pt-32 lg:pt-36 pb-8 flex-1 flex flex-col justify-center">
        <div className="max-w-[740px] lg:max-w-[640px] xl:max-w-[680px]">
          
          {/* Eyebrow badge with live beacon and coordinates */}
          <div
            className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/[0.03] border border-[#D4AF37]/25 backdrop-blur-md mb-6"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-pulse" />
            <span className="font-sans text-[10px] sm:text-[11px] font-semibold tracking-[0.24em] uppercase text-[#D4AF37]">
              CAFÉ • BAR • BARRACKPORE
            </span>
            <span className="text-white/20 text-[10px] font-mono hidden sm:inline">|</span>
            <span className="text-[#E3DACD]/50 text-[10px] font-mono tracking-wider hidden sm:inline">
              22.76° N, 88.37° E
            </span>
          </div>

          {/* Main Headline: Bold, high-contrast, instantaneous paint */}
          <h1 className="font-sans font-medium text-[clamp(48px,6.8vw,92px)] leading-[0.92] tracking-[-0.035em] text-[#F5F2F0] mb-6 sm:mb-7">
            <span className="block uppercase select-none">
              NOCTURNAL
            </span>
            <span className="block font-serif italic font-normal text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] via-[#F3C766] to-[#E3DACD] tracking-normal mt-1 sm:mt-1.5">
              Gastronomy.
            </span>
          </h1>

          {/* Atmospheric description with instant clarity */}
          <p className="font-sans text-base sm:text-lg lg:text-[1.125rem] text-[#E3DACD] font-normal leading-relaxed max-w-[44ch] mb-8 sm:mb-10">
            {descriptionText}
          </p>

          {/* High-end Tactile CTA Group */}
          <div
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-6"
          >
            {/* Primary Action: Explore Menu */}
            <a
              href="#menu-section"
              onClick={(e) => handleNav(e, 'menu-section')}
              className="group relative inline-flex items-center justify-between sm:justify-center gap-4 px-8 py-4 rounded-full bg-[#D4AF37] text-[#070504] font-sans text-xs font-semibold tracking-[0.18em] uppercase transition-all duration-300 ease-out hover:bg-[#E3DACD] hover:shadow-[0_0_32px_rgba(212,175,55,0.4)] active:scale-[0.98]"
            >
              <span>Explore Curated Menu</span>
              <span className="w-7 h-7 rounded-full bg-[#070504]/10 flex items-center justify-center transition-transform duration-300 group-hover:translate-x-1 group-hover:scale-105 shrink-0">
                <svg
                  className="w-3.5 h-3.5 text-[#070504]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </span>
            </a>

            {/* Secondary Action: Reserve a Table */}
            <button
              onClick={handleReservation}
              className="group inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-full border border-white/20 hover:border-[#D4AF37]/60 bg-black/30 hover:bg-[#D4AF37]/15 backdrop-blur-md text-[#E3DACD] hover:text-white font-sans text-xs font-medium tracking-[0.18em] uppercase transition-all duration-300 ease-out active:scale-[0.98] shadow-[0_4px_16px_rgba(0,0,0,0.3)]"
            >
              <span>Reserve a Table</span>
              <span className="material-symbols-outlined text-[16px] text-[#D4AF37] opacity-80 group-hover:opacity-100 transition-opacity">
                calendar_today
              </span>
            </button>
          </div>

        </div>
      </div>

      {/* 4. EDITORIAL DETAIL & SCROLL INDICATOR FOOTER */}
      <div 
        className="relative z-10 w-full max-w-[1360px] mx-auto px-6 sm:px-10 lg:px-12 pt-4 pb-24 sm:pb-6 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3 border-t border-white/10 text-[11px] sm:text-xs tracking-[0.22em] uppercase font-sans text-[#E3DACD]/55"
      >
        <div className="flex items-center gap-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]/75" />
          <span>EST. CANTONMENT • {restaurantConfig?.address?.city?.toUpperCase() || 'BARRACKPORE, WEST BENGAL'}</span>
        </div>

        <a
          href="#scroll-sequence-section"
          onClick={(e) => handleNav(e, 'scroll-sequence-section')}
          className="group inline-flex items-center gap-2 text-[#E3DACD]/60 hover:text-[#D4AF37] transition-colors duration-300 cursor-pointer"
        >
          <span className="text-[10px] sm:text-[11px] tracking-[0.22em]">SCROLL TO DISCOVER</span>
          <span className="material-symbols-outlined text-sm transition-transform duration-300 group-hover:translate-y-1">
            south
          </span>
        </a>
      </div>
    </section>
  );
});

Hero.displayName = 'Hero';
