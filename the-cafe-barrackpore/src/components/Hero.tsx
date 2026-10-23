import React, { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { smoothScrollTo } from '../utils/scroll';
import { useUI } from '../context/UIContext';
import { useSiteConfig } from '../context/SiteConfigContext';
import { useI18n } from '../i18n';
import { getAvifSource, getResponsiveSrcSet } from '../utils/image';
import type { HeroVariant } from '../types/restaurantEngine';

interface HeroActionsProps {
  showPrimaryCta: boolean;
  primaryCtaText: string;
  primaryCtaHref: string;
  primaryCtaTarget: string;
  handleNav: (e: React.MouseEvent, target: string) => void;
  showSecondaryCta: boolean;
  secondaryCtaText: string;
  handleReservation: (e: React.MouseEvent) => void;
  alignment?: 'left' | 'center';
}

const HeroActions: React.FC<HeroActionsProps> = ({
  showPrimaryCta,
  primaryCtaText,
  primaryCtaHref,
  primaryCtaTarget,
  handleNav,
  showSecondaryCta,
  secondaryCtaText,
  handleReservation,
  alignment = 'left',
}) => {
  if (!showPrimaryCta && !showSecondaryCta) return null;

  return (
    <div
      className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-6 hero-enter-actions ${
        alignment === 'center' ? 'justify-center w-full' : ''
      }`}
    >
      {/* Primary Action: Explore Menu */}
      {showPrimaryCta && (
        <motion.a
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          href={primaryCtaHref}
          onClick={(e) => handleNav(e, primaryCtaTarget)}
          className="group relative inline-flex items-center justify-between sm:justify-center gap-4 px-6 sm:px-8 py-3.5 sm:py-4 min-h-[48px] rounded-full bg-primary text-on-primary font-sans text-xs font-semibold tracking-[0.18em] uppercase transition-all duration-300 ease-out hover:bg-on-surface hover:text-background hover:shadow-[0_0_32px_rgba(var(--color-primary-rgb),0.4)] active:scale-[0.98]"
        >
          <span>{primaryCtaText}</span>
          <span className="w-7 h-7 rounded-full bg-on-primary/10 flex items-center justify-center transition-transform duration-300 group-hover:translate-x-1 group-hover:scale-105 shrink-0">
            <svg
              className="w-3.5 h-3.5 text-on-primary group-hover:text-background"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </span>
        </motion.a>
      )}

      {/* Secondary Action: Reserve a Table */}
      {showSecondaryCta && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          type="button"
          onClick={handleReservation}
          className="group inline-flex items-center justify-center gap-2.5 px-5 sm:px-7 py-3.5 sm:py-4 min-h-[44px] rounded-full border border-outline/30 hover:border-primary/50 bg-surface-obsidian/40 hover:bg-surface-container/60 backdrop-blur-md text-on-surface/90 hover:text-primary font-sans text-xs font-medium tracking-[0.16em] uppercase transition-all duration-300 ease-out active:scale-[0.98] shadow-[0_4px_16px_rgba(0,0,0,0.15)] cursor-pointer"
        >
          <span>{secondaryCtaText}</span>
          <span className="material-symbols-outlined text-[16px] text-primary/80 group-hover:text-primary transition-colors">
            calendar_today
          </span>
        </motion.button>
      )}
    </div>
  );
};

export const Hero: React.FC = React.memo(() => {
  const { hero, restaurantConfig, engineConfig } = useSiteConfig();
  const { t } = useI18n();
  const { setIsReservationOpen } = useUI();
  const prefersReducedMotion = useReducedMotion();

  // Active Hero layout variant from engine configuration
  const activeVariant: HeroVariant = engineConfig?.variants?.hero || 'cinematic-fullscreen';

  // Pointer-responsive subtle depth on desktop with fine pointer (Zero React re-render overhead)
  const isPointerFine = useRef(false);
  const parallaxWrapperRef = useRef<HTMLDivElement>(null);
  const parallaxContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || activeVariant !== 'cinematic-fullscreen') return;
    const mediaQuery = window.matchMedia('(pointer: fine)');
    isPointerFine.current = mediaQuery.matches;

    const handleMediaChange = (e: MediaQueryListEvent) => {
      isPointerFine.current = e.matches;
      if (!e.matches) {
        if (parallaxWrapperRef.current) parallaxWrapperRef.current.style.transform = 'translate3d(0, 0, 0)';
        if (parallaxContentRef.current) parallaxContentRef.current.style.transform = 'translate3d(0, 0, 0)';
      }
    };
    mediaQuery.addEventListener('change', handleMediaChange);

    let rafId: number | null = null;
    const handlePointerMove = (e: MouseEvent) => {
      if (!isPointerFine.current || prefersReducedMotion) return;
      if (!prefersReducedMotion) {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          const centerX = window.innerWidth / 2;
          const centerY = window.innerHeight / 2;
          const normX = (e.clientX - centerX) / centerX;
          const normY = (e.clientY - centerY) / centerY;
          // Restrained subtle movement: max 6px parallax, GPU accelerated
          const x = Math.max(-1, Math.min(1, normX)) * 6;
          const y = Math.max(-1, Math.min(1, normY)) * 6;
          if (parallaxWrapperRef.current) {
            parallaxWrapperRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
          }
          if (parallaxContentRef.current) {
            parallaxContentRef.current.style.transform = `translate3d(${-x * 0.35}px, ${-y * 0.35}px, 0)`;
          }
        });
      }
    };

    const handlePointerLeave = () => {
      if (parallaxWrapperRef.current) parallaxWrapperRef.current.style.transform = 'translate3d(0, 0, 0)';
      if (parallaxContentRef.current) parallaxContentRef.current.style.transform = 'translate3d(0, 0, 0)';
    };

    window.addEventListener('mousemove', handlePointerMove, { passive: true });
    window.addEventListener('mouseleave', handlePointerLeave);

    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseleave', handlePointerLeave);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [prefersReducedMotion, activeVariant]);

  const handleNav = (e: React.MouseEvent, target: string) => {
    e.preventDefault();
    smoothScrollTo(target);
  };

  const handleReservation = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsReservationOpen(true);
  };

  // High-performance WebP hero asset with dynamic admin override support
  const isCustomHero = Boolean(hero?.src && hero.src !== '/images/hero-bar.webp');
  const heroImageSrc = hero?.src || '/images/hero-bar.webp';
  const heroMobileSrc = hero?.mobileSrc || (!isCustomHero ? '/images/hero-bar-mobile.webp' : undefined);
  const heroAvifSrc = getAvifSource(heroImageSrc);
  const heroMobileAvifSrc = getAvifSource(heroMobileSrc);
  const heroBusinessName = restaurantConfig?.businessName || 'The Lounge';
  const heroImageAlt = hero?.alt || `${heroBusinessName} — Nocturnal Cocktail & Espresso Lounge`;

  const headline = hero?.headline || 'NOCTURNAL';
  const headlineItalic = hero?.headlineItalic !== undefined ? hero.headlineItalic : 'Gastronomy.';

  const descriptionText = hero?.subtext || 
    "Where artisan coffee meets handcrafted cocktails & gourmet comfort food in a strictly premium, nocturnal setting.";

  const eyebrowBadgeText = hero?.eyebrowBadge || 
    `CAFÉ • BAR • ${(restaurantConfig?.shortName || restaurantConfig?.address?.city || 'LOUNGE').toUpperCase()}`;

  const coordinatesText = hero?.coordinates || 
    ((!restaurantConfig?.country || restaurantConfig?.country === 'IN') ? '22.76° N, 88.37° E' : '');

  const showPrimaryCta = hero?.showPrimaryCta !== false;
  const primaryCtaText = hero?.primaryCtaText || t('hero.viewMenu', 'Explore Curated Menu');
  const primaryCtaHref = hero?.primaryCtaHref || '#menu-section';
  const primaryCtaTarget = primaryCtaHref.startsWith('#') ? primaryCtaHref.slice(1) : 'menu-section';

  const isTableBookingEnabled = restaurantConfig?.isTableBookingEnabled ?? true;
  const showSecondaryCta = (hero?.showSecondaryCta !== false) && isTableBookingEnabled;
  const secondaryCtaText = hero?.secondaryCtaText || t('hero.bookTable', 'Reserve a Table');

  const establishmentLabel = hero?.establishmentLabel || t('story.badge', 'EST. CANTONMENT');
  const scrollLabel = hero?.scrollLabel || t('hero.scrollDown', 'SCROLL TO DISCOVER');

  // =========================================================================
  // VARIANT B: EDITORIAL SPLIT
  // =========================================================================
  if (activeVariant === 'editorial-split') {
    return (
      <section 
        aria-label={t('hero.title', 'Hero')}
        className="relative w-full min-h-[100dvh] bg-background text-on-surface overflow-hidden -mt-20 flex flex-col justify-between transition-colors duration-500 pt-28 sm:pt-32 lg:pt-36 pb-20 sm:pb-8"
      >
        {/* Ambient Subtle Glow */}
        <div 
          className="hidden md:block absolute top-1/4 left-1/3 w-[600px] h-[600px] rounded-full bg-primary/6 blur-[160px] pointer-events-none z-0" 
          aria-hidden="true"
        />

        {/* Main Content Grid: Balanced Typography Column + Framed Visual Showcase */}
        <div className="relative z-10 w-full max-w-[1360px] mx-auto px-6 sm:px-10 lg:px-12 flex-1 flex flex-col justify-center my-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            
            {/* Left Column: Expressive Editorial Copy */}
            <div className="lg:col-span-7 xl:col-span-7 flex flex-col items-start text-left">
              
              {/* Eyebrow badge */}
              <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-surface-container/60 border border-primary/25 backdrop-blur-md mb-6 hero-enter-eyebrow">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span className="font-sans text-[10px] sm:text-[11px] font-semibold tracking-[0.24em] uppercase text-primary">
                  {eyebrowBadgeText}
                </span>
                {coordinatesText && (
                  <>
                    <span className="text-outline/40 text-[10px] font-mono hidden sm:inline">|</span>
                    <span className="text-on-surface-variant/80 text-[10px] font-mono tracking-wider hidden sm:inline">
                      {coordinatesText}
                    </span>
                  </>
                )}
              </div>

              {/* Headline */}
              <h1 className="font-sans font-medium text-[clamp(34px,5.2vw,74px)] leading-[0.96] tracking-[-0.03em] text-on-surface mb-6">
                <span className="block uppercase select-none hero-enter-headline-1">
                  {headline}
                </span>
                {headlineItalic && (
                  <span className="block font-serif italic font-normal text-primary tracking-normal mt-1 sm:mt-1.5 pb-1 hero-enter-headline-2">
                    {headlineItalic}
                  </span>
                )}
              </h1>

              {/* Description */}
              <p className="font-sans text-base sm:text-lg text-on-surface/85 font-normal leading-relaxed max-w-[48ch] mb-8 sm:mb-10 hero-enter-copy">
                {descriptionText}
              </p>

              {/* Tactile Actions */}
              <HeroActions
                showPrimaryCta={showPrimaryCta}
                primaryCtaText={primaryCtaText}
                primaryCtaHref={primaryCtaHref}
                primaryCtaTarget={primaryCtaTarget}
                handleNav={handleNav}
                showSecondaryCta={showSecondaryCta}
                secondaryCtaText={secondaryCtaText}
                handleReservation={handleReservation}
                alignment="left"
              />
            </div>

            {/* Right Column: Double-Bezel Architectural Showcase Card */}
            <div className="lg:col-span-5 xl:col-span-5 flex items-center justify-center lg:justify-end">
              <div className="relative w-full max-w-[500px] lg:max-w-none p-2 rounded-[2.5rem] bg-gradient-to-b from-surface-container/70 via-surface-container/30 to-transparent border border-outline/25 shadow-[0_24px_60px_rgba(0,0,0,0.5),0_0_40px_rgba(var(--color-primary-rgb),0.12)] group">
                <div className="relative aspect-[4/5] sm:aspect-[16/11] lg:aspect-[4/5] w-full rounded-[calc(2.5rem-0.5rem)] overflow-hidden bg-surface-container-lowest">
                  <picture>
                    {heroMobileAvifSrc && (
                      <source
                        media="(max-width: 768px)"
                        srcSet={getResponsiveSrcSet(heroMobileSrc, 'avif') || heroMobileAvifSrc}
                        sizes="(max-width: 768px) 100vw, 500px"
                        type="image/avif"
                      />
                    )}
                    {heroMobileSrc && (
                      <source
                        media="(max-width: 768px)"
                        srcSet={getResponsiveSrcSet(heroMobileSrc, 'webp') || heroMobileSrc}
                        sizes="(max-width: 768px) 100vw, 500px"
                        type="image/webp"
                      />
                    )}
                    {heroAvifSrc && (
                      <source
                        srcSet={getResponsiveSrcSet(heroImageSrc, 'avif') || heroAvifSrc}
                        sizes="(max-width: 1024px) 100vw, 800px"
                        type="image/avif"
                      />
                    )}
                    {heroImageSrc.endsWith('.jpg') && !heroImageSrc.startsWith('http') && (
                      <source
                        srcSet={getResponsiveSrcSet(heroImageSrc, 'webp') || heroImageSrc.replace(/\.jpg$/, '.webp')}
                        sizes="(max-width: 1024px) 100vw, 800px"
                        type="image/webp"
                      />
                    )}
                    <img
                      src={heroImageSrc}
                      alt={heroImageAlt}
                      width="1200"
                      height="800"
                      className="w-full h-full object-cover filter brightness-[0.95] contrast-[1.06] saturate-[1.06] group-hover:scale-105 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                      loading="eager"
                      fetchPriority="high"
                      decoding="async"
                    />
                  </picture>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none" />
                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-[10px] uppercase tracking-wider text-primary font-mono z-10">
                    <span className="px-2.5 py-1 rounded-full bg-surface-obsidian/90 backdrop-blur-md border border-primary/30">
                      {establishmentLabel}
                    </span>
                    {coordinatesText && (
                      <span className="text-on-surface/80 hidden sm:inline">
                        {coordinatesText}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Editorial Detail & Scroll Indicator Footer */}
        <div 
          className="relative z-10 w-full max-w-[1360px] mx-auto px-6 sm:px-10 lg:px-12 pt-4 pb-24 sm:pb-6 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3 border-t border-outline/15 text-[11px] sm:text-xs tracking-[0.22em] uppercase font-sans text-on-surface-variant hero-enter-footer"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/75" />
            <span>{establishmentLabel} • {restaurantConfig?.address?.city?.toUpperCase() || 'BARRACKPORE, WEST BENGAL'}</span>
          </div>

          <a
            href="#scroll-sequence-section"
            onClick={(e) => handleNav(e, 'scroll-sequence-section')}
            className="group inline-flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors duration-300 cursor-pointer"
          >
            <span className="text-[10px] sm:text-[11px] tracking-[0.22em]">{scrollLabel}</span>
            <span className="material-symbols-outlined text-sm transition-transform duration-300 group-hover:translate-y-1">
              south
            </span>
          </a>
        </div>
      </section>
    );
  }

  // =========================================================================
  // VARIANT C: MINIMAL CENTERED
  // =========================================================================
  if (activeVariant === 'minimal-centered') {
    return (
      <section 
        aria-label={t('hero.title', 'Hero')}
        className="relative w-full min-h-[100dvh] bg-background text-on-surface overflow-hidden -mt-20 flex flex-col justify-between transition-colors duration-500 pt-28 sm:pt-36 pb-20 sm:pb-8"
      >
        {/* Soft Centered Ambient Glow */}
        <div 
          className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-primary/4 blur-[180px] pointer-events-none z-0" 
          aria-hidden="true"
        />

        {/* Main Centered Content */}
        <div className="relative z-10 w-full max-w-[1160px] mx-auto px-6 sm:px-10 lg:px-12 flex-1 flex flex-col items-center justify-center text-center my-auto">
          
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-surface-container/60 border border-primary/25 backdrop-blur-md mb-6 hero-enter-eyebrow">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="font-sans text-[10px] sm:text-[11px] font-semibold tracking-[0.24em] uppercase text-primary">
              {eyebrowBadgeText}
            </span>
            {coordinatesText && (
              <>
                <span className="text-outline/40 text-[10px] font-mono hidden sm:inline">|</span>
                <span className="text-on-surface-variant/80 text-[10px] font-mono tracking-wider hidden sm:inline">
                  {coordinatesText}
                </span>
              </>
            )}
          </div>

          {/* Centered Headline */}
          <h1 className="font-serif font-normal text-[clamp(34px,6.2vw,84px)] leading-[1.04] tracking-tight text-on-surface mb-6 max-w-[18ch] mx-auto text-balance">
            <span className="block uppercase select-none hero-enter-headline-1">
              {headline}
            </span>
            {headlineItalic && (
              <span className="block italic text-primary font-light mt-1 sm:mt-2 hero-enter-headline-2">
                {headlineItalic}
              </span>
            )}
          </h1>

          {/* Description */}
          <p className="font-sans text-base sm:text-lg text-on-surface/80 font-light leading-relaxed max-w-[54ch] mx-auto mb-8 sm:mb-10 text-balance hero-enter-copy">
            {descriptionText}
          </p>

          {/* Centered CTA Actions */}
          <HeroActions
            showPrimaryCta={showPrimaryCta}
            primaryCtaText={primaryCtaText}
            primaryCtaHref={primaryCtaHref}
            primaryCtaTarget={primaryCtaTarget}
            handleNav={handleNav}
            showSecondaryCta={showSecondaryCta}
            secondaryCtaText={secondaryCtaText}
            handleReservation={handleReservation}
            alignment="center"
          />

          {/* Photographic Focal Pedestal Well */}
          <div className="w-full max-w-[940px] mx-auto mt-8 sm:mt-12 p-2 rounded-[2.5rem] bg-gradient-to-b from-surface-container/60 via-surface-container/20 to-transparent border border-outline/20 shadow-2xl overflow-hidden group">
            <div className="relative aspect-[21/9] sm:aspect-[21/9] max-h-[340px] w-full rounded-[calc(2.5rem-0.5rem)] overflow-hidden bg-surface-container-lowest">
              <picture>
                {heroMobileAvifSrc && (
                  <source
                    media="(max-width: 768px)"
                    srcSet={getResponsiveSrcSet(heroMobileSrc, 'avif') || heroMobileAvifSrc}
                    sizes="(max-width: 768px) 100vw, 768px"
                    type="image/avif"
                  />
                )}
                {heroMobileSrc && (
                  <source
                    media="(max-width: 768px)"
                    srcSet={getResponsiveSrcSet(heroMobileSrc, 'webp') || heroMobileSrc}
                    sizes="(max-width: 768px) 100vw, 768px"
                    type="image/webp"
                  />
                )}
                {heroAvifSrc && (
                  <source
                    srcSet={getResponsiveSrcSet(heroImageSrc, 'avif') || heroAvifSrc}
                    sizes="(max-width: 1024px) 100vw, 940px"
                    type="image/avif"
                  />
                )}
                {heroImageSrc.endsWith('.jpg') && !heroImageSrc.startsWith('http') && (
                  <source
                    srcSet={getResponsiveSrcSet(heroImageSrc, 'webp') || heroImageSrc.replace(/\.jpg$/, '.webp')}
                    sizes="(max-width: 1024px) 100vw, 940px"
                    type="image/webp"
                  />
                )}
                <img
                  src={heroImageSrc}
                  alt={heroImageAlt}
                  width="1200"
                  height="600"
                  className="w-full h-full object-cover object-center filter brightness-[0.92] contrast-[1.05] group-hover:scale-105 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                />
              </picture>
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />
              <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[10px] font-mono tracking-widest uppercase text-primary">
                <span>{establishmentLabel}</span>
                {coordinatesText && <span>{coordinatesText}</span>}
              </div>
            </div>
          </div>

        </div>

        {/* Editorial Detail & Scroll Indicator Footer */}
        <div 
          className="relative z-10 w-full max-w-[1360px] mx-auto px-6 sm:px-10 lg:px-12 pt-4 pb-24 sm:pb-6 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3 border-t border-outline/15 text-[11px] sm:text-xs tracking-[0.22em] uppercase font-sans text-on-surface-variant hero-enter-footer"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/75" />
            <span>{establishmentLabel} • {restaurantConfig?.address?.city?.toUpperCase() || 'BARRACKPORE, WEST BENGAL'}</span>
          </div>

          <a
            href="#scroll-sequence-section"
            onClick={(e) => handleNav(e, 'scroll-sequence-section')}
            className="group inline-flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors duration-300 cursor-pointer"
          >
            <span className="text-[10px] sm:text-[11px] tracking-[0.22em]">{scrollLabel}</span>
            <span className="material-symbols-outlined text-sm transition-transform duration-300 group-hover:translate-y-1">
              south
            </span>
          </a>
        </div>
      </section>
    );
  }

  // =========================================================================
  // VARIANT A: CINEMATIC FULLSCREEN (Flagship Café Barrackpore Reference)
  // =========================================================================
  return (
    <section 
      aria-label={t('hero.title', 'Hero')}
      className="relative w-full min-h-[100dvh] lg:h-[100dvh] bg-background text-on-surface overflow-hidden -mt-20 flex flex-col justify-between transition-colors duration-500"
    >
      {/* 1. CINEMATIC INTEGRATED BACKGROUND IMAGE (Right-bleed architectural composition with mask reveal & scale settle) */}
      <div 
        className="absolute top-0 right-0 bottom-0 w-full md:w-[60%] lg:w-[66%] xl:w-[64%] h-full pointer-events-none select-none overflow-hidden z-0 hero-mask-reveal"
      >
        <div 
          ref={parallaxWrapperRef}
          className="relative w-full h-full transition-transform duration-300 ease-out will-change-transform"
        >
          <picture>
            {heroMobileAvifSrc && (
              <source
                media="(max-width: 768px)"
                srcSet={getResponsiveSrcSet(heroMobileSrc, 'avif') || heroMobileAvifSrc}
                sizes="(max-width: 768px) 100vw, 768px"
                type="image/avif"
                width="768"
                height="1376"
              />
            )}
            {heroMobileSrc && (
              <source
                media="(max-width: 768px)"
                srcSet={getResponsiveSrcSet(heroMobileSrc, 'webp') || heroMobileSrc}
                sizes="(max-width: 768px) 100vw, 768px"
                type="image/webp"
                width="768"
                height="1376"
              />
            )}
            {heroAvifSrc && (
              <source
                srcSet={getResponsiveSrcSet(heroImageSrc, 'avif') || heroAvifSrc}
                sizes="(max-width: 1024px) 100vw, 1376px"
                type="image/avif"
              />
            )}
            {heroImageSrc.endsWith('.jpg') && !heroImageSrc.startsWith('http') && (
              <source
                srcSet={getResponsiveSrcSet(heroImageSrc, 'webp') || heroImageSrc.replace(/\.jpg$/, '.webp')}
                sizes="(max-width: 1024px) 100vw, 1376px"
                type="image/webp"
              />
            )}
            <img
              src={heroImageSrc}
              alt={heroImageAlt}
              width="1376"
              height="768"
              className="w-full h-full object-cover object-[70%_center] lg:object-center filter brightness-[0.94] contrast-[1.08] saturate-[1.08] hero-bg-settle transform-gpu will-change-transform"
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
          </picture>

          {/* Seamless multi-stop horizontal gradient blend: pure background on left fading into subtle transparency on right */}
          <div 
            className="absolute inset-0 bg-gradient-to-r from-background via-background/85 via-35% md:via-25% to-transparent" 
          />

          {/* Delicate vertical vignette layers to anchor the scene */}
          <div className="absolute top-0 left-0 right-0 h-44 bg-gradient-to-b from-background/90 via-background/30 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-background via-background/75 to-transparent" />

          {/* Calibrated mobile readability veil: allows warm filament bar ambiance to show while protecting text contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 via-50% to-background/35 md:hidden" />
        </div>
      </div>

      {/* 2. ATMOSPHERIC AMBIENT GLOWS & SUBTLE FILM GRAIN (Hidden on mobile for optimal GPU rendering) */}
      <div 
        className="hidden md:block absolute top-1/3 left-[-5%] w-[500px] h-[500px] rounded-full bg-primary/6 blur-[140px] pointer-events-none z-0" 
        aria-hidden="true"
      />
      <div 
        className="hidden md:block absolute bottom-[-10%] right-1/4 w-[560px] h-[560px] rounded-full bg-primary-fixed-dim/8 blur-[160px] pointer-events-none z-0" 
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
      <div 
        ref={parallaxContentRef}
        className="relative z-10 w-full max-w-[1360px] mx-auto px-6 sm:px-10 lg:px-12 pt-28 sm:pt-32 lg:pt-36 pb-8 flex-1 flex flex-col justify-center transition-transform duration-300 ease-out will-change-transform"
      >
        <div className="max-w-[740px] lg:max-w-[640px] xl:max-w-[680px]">
          
          {/* Eyebrow badge with live beacon and coordinates */}
          <div
            className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-surface-container/60 border border-primary/25 backdrop-blur-md mb-4 sm:mb-6 hero-enter-eyebrow"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="font-sans text-[10px] sm:text-[11px] font-semibold tracking-[0.24em] uppercase text-primary">
              {eyebrowBadgeText}
            </span>
            {coordinatesText && (
              <>
                <span className="text-outline/40 text-[10px] font-mono hidden sm:inline">|</span>
                <span className="text-on-surface-variant/80 text-[10px] font-mono tracking-wider hidden sm:inline">
                  {coordinatesText}
                </span>
              </>
            )}
          </div>

          {/* Main Headline: Bold, high-contrast, sequential typographic reveal */}
          <h1 className="font-sans font-medium text-[clamp(34px,8vw,88px)] leading-[0.92] tracking-[-0.035em] text-on-surface mb-4 sm:mb-7">
            <span className="block uppercase select-none hero-enter-headline-1">
              {headline}
            </span>
            {headlineItalic && (
              <span className="block font-serif italic font-normal text-primary tracking-normal mt-1 sm:mt-1.5 pb-1 sm:pb-1.5 hero-enter-headline-2">
                {headlineItalic}
              </span>
            )}
          </h1>

          {/* Atmospheric description with deliberate entrance delay */}
          <p className="font-sans text-base sm:text-lg lg:text-[1.125rem] text-on-surface/90 font-normal leading-relaxed max-w-[44ch] mb-6 sm:mb-10 hero-enter-copy">
            {descriptionText}
          </p>

          {/* High-end Tactile CTA Group */}
          <HeroActions
            showPrimaryCta={showPrimaryCta}
            primaryCtaText={primaryCtaText}
            primaryCtaHref={primaryCtaHref}
            primaryCtaTarget={primaryCtaTarget}
            handleNav={handleNav}
            showSecondaryCta={showSecondaryCta}
            secondaryCtaText={secondaryCtaText}
            handleReservation={handleReservation}
            alignment="left"
          />

        </div>
      </div>

      {/* 4. EDITORIAL DETAIL & SCROLL INDICATOR FOOTER */}
      <div 
        className="relative z-10 w-full max-w-[1360px] mx-auto px-6 sm:px-10 lg:px-12 pt-4 pb-28 sm:pb-6 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3 border-t border-outline/15 text-[11px] sm:text-xs tracking-[0.22em] uppercase font-sans text-on-surface-variant hero-enter-footer"
      >
        <div className="flex items-center gap-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary/75" />
          <span>{establishmentLabel} • {restaurantConfig?.address?.city?.toUpperCase() || 'BARRACKPORE, WEST BENGAL'}</span>
        </div>

        <a
          href="#scroll-sequence-section"
          onClick={(e) => handleNav(e, 'scroll-sequence-section')}
          className="group inline-flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors duration-300 cursor-pointer"
        >
          <span className="text-[10px] sm:text-[11px] tracking-[0.22em]">{scrollLabel}</span>
          <span className="material-symbols-outlined text-sm transition-transform duration-300 group-hover:translate-y-1">
            south
          </span>
        </a>
      </div>

      {/* Valmora-Inspired Architectural Viewfinder Corner Brackets */}
      <div className="pointer-events-none absolute inset-6 sm:inset-10 z-20 hidden lg:block" aria-hidden="true">
        <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-primary/35" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-primary/35" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-primary/35" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-primary/35" />
      </div>

      {/* Top-Right Live Sanctuary Telemetry HUD (Valmora / Oddball Hybrid) */}
      <div className="hidden xl:flex items-center gap-3 absolute top-8 right-14 z-20 px-4 py-2 rounded-full bg-surface-obsidian/75 border border-outline/25 backdrop-blur-md pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-on-surface/80">
          SANCTUARY LIVE · 2200K AMBER
        </span>
        <span className="text-outline/40">|</span>
        <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-primary font-semibold">
          REEL 01 READY
        </span>
      </div>
    </section>
  );
});

Hero.displayName = 'Hero';
