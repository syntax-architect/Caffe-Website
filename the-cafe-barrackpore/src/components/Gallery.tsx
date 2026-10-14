import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSiteConfig } from '../context/SiteConfigContext';
import { clientDetails } from '../config/client';
import { SectionReveal } from './SectionReveal';
import { getAvifSource } from '../utils/image';
import { DEFAULT_GALLERY_ITEMS, type GalleryItem } from '../services/siteContentService';
import type { GalleryVariant } from '../types/restaurantEngine';

interface GalleryPhoto {
  src: string;
  alt: string;
  caption?: string;
  tag?: string;
}

const GALLERY_METADATA: Record<number, { tag: string; caption: string }> = {
  0: { tag: "Intimate Evenings", caption: "Bespoke booth seating bathed in low filament glow." },
  1: { tag: "Wood-Fired Artisans", caption: "Hand-stretched sourdough pizzas fresh from the flame." },
  2: { tag: "Single-Origin Brews", caption: "Artisanal espresso & slow cold drip extractions." },
  3: { tag: "Acoustic Weekends", caption: "Live unplugged melodies and twilight conversations." },
};

export const Gallery: React.FC = () => {
  const { gallery, restaurantConfig, engineConfig } = useSiteConfig();
  const [selectedPhoto, setSelectedPhoto] = useState<{ index: number; data: GalleryPhoto } | null>(null);
  const businessName = restaurantConfig?.businessName || clientDetails.businessName || 'The Café';

  // Gallery layout variant from engine configuration
  const rawVariant = engineConfig?.variants?.gallery || 'asymmetric-bento';
  // Backwards-compatible alias: 'masonry-grid' maps to 'asymmetric-bento'
  const activeVariant: GalleryVariant = rawVariant === 'masonry-grid' ? 'asymmetric-bento' : rawVariant;

  const eyebrowText = gallery?.eyebrow || 'Visual Chronicles';
  const titleText = gallery?.title || 'Moments Captured at The Café';
  const descriptionText = gallery?.description || 'A glimpse into the nocturnal atmosphere, handcrafted cuisine, and acoustic energy at Barrackpore’s premier dining retreat.';

  // Support structured items with per-item tag and caption, falling back seamlessly
  const items: GalleryItem[] = gallery?.items && gallery.items.length > 0
    ? gallery.items
    : (gallery?.images && gallery.images.length > 0
        ? gallery.images.slice(0, 4).map((img, idx) => {
            const meta = GALLERY_METADATA[idx] || { tag: `${businessName} Experience`, caption: img.alt };
            return {
              id: `gallery-${idx + 1}`,
              src: img.src,
              alt: img.alt,
              tag: meta.tag,
              caption: meta.caption,
              aspectVariant: (idx === 0 ? 'tall' : idx === 1 ? 'wide' : 'square') as 'tall' | 'wide' | 'square',
            };
          })
        : DEFAULT_GALLERY_ITEMS);

  const hasElfsight = clientDetails.elfsightId && clientDetails.elfsightId !== "YOUR_ELFSIGHT_WIDGET_ID";

  useEffect(() => {
    if (hasElfsight) {
      const script = document.createElement('script');
      script.src = "https://static.elfsight.com/platform/platform.js";
      script.async = true;
      document.body.appendChild(script);
      return () => {
        document.body.removeChild(script);
      };
    }
  }, [hasElfsight]);

  // Handle escape key to close lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedPhoto !== null) {
        setSelectedPhoto(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPhoto]);

  // --------------------------------------------------------------------------
  // Variant B (Carousel-Snap) Controls & Scroll State
  // --------------------------------------------------------------------------
  const carouselRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [activeCarouselIndex, setActiveCarouselIndex] = useState(0);

  const checkCarouselScroll = useCallback(() => {
    const el = carouselRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);

    // Compute approximate active slide index
    const slideWidth = el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth + 20 : 360;
    const index = Math.round(el.scrollLeft / slideWidth);
    setActiveCarouselIndex(Math.max(0, Math.min(items.length - 1, index)));
  }, [items.length]);

  useEffect(() => {
    if (activeVariant !== 'carousel-snap') return;
    const el = carouselRef.current;
    if (!el) return;

    checkCarouselScroll();
    el.addEventListener('scroll', checkCarouselScroll, { passive: true });
    window.addEventListener('resize', checkCarouselScroll);

    return () => {
      el.removeEventListener('scroll', checkCarouselScroll);
      window.removeEventListener('resize', checkCarouselScroll);
    };
  }, [activeVariant, checkCarouselScroll]);

  const handleCarouselScroll = (direction: 'left' | 'right') => {
    const el = carouselRef.current;
    if (!el) return;
    const slideWidth = el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth + 24 : 380;
    const delta = direction === 'left' ? -slideWidth : slideWidth;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  };

  const scrollToSlide = (index: number) => {
    const el = carouselRef.current;
    if (!el) return;
    const slideWidth = el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth + 24 : 380;
    el.scrollTo({ left: index * slideWidth, behavior: 'smooth' });
  };

  // --------------------------------------------------------------------------
  // Variant C (Filmstrip) State & Keyboard Navigation
  // --------------------------------------------------------------------------
  const [activeFilmstripIndex, setActiveFilmstripIndex] = useState(0);
  const safeFilmstripIndex = Math.max(0, Math.min(activeFilmstripIndex, items.length - 1));
  const activeFilmstripItem = items[safeFilmstripIndex] || items[0];

  useEffect(() => {
    if (activeVariant !== 'filmstrip') return;
    const handleKeyNav = (e: KeyboardEvent) => {
      if (selectedPhoto !== null) return; // Let lightbox handle its own keys
      if (e.key === 'ArrowLeft') {
        setActiveFilmstripIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
      } else if (e.key === 'ArrowRight') {
        setActiveFilmstripIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener('keydown', handleKeyNav);
    return () => window.removeEventListener('keydown', handleKeyNav);
  }, [activeVariant, items.length, selectedPhoto]);

  // Helper for Asymmetric Bento grid layout
  const getSpanClass = (item: GalleryItem, idx: number) => {
    const variant = item.aspectVariant || (idx === 0 ? 'tall' : idx === 1 ? 'wide' : 'square');
    if (variant === 'tall') {
      return 'lg:col-span-1 lg:row-span-2 h-[320px] sm:h-auto lg:h-full';
    }
    if (variant === 'wide') {
      return 'lg:col-span-2 lg:row-span-1 h-[320px] sm:h-auto';
    }
    return 'lg:col-span-1 lg:row-span-1 h-[320px] sm:h-auto';
  };

  return (
    <section className="w-full pt-16 sm:pt-18 lg:pt-20 pb-12 sm:pb-14 lg:pb-16 bg-background relative border-t border-outline/15 scroll-mt-28 overflow-hidden" id="gallery">
      {/* Ambient Glow */}
      {engineConfig?.theme?.ambience?.meshGlow !== false && (
        <div 
          className="absolute top-1/3 left-1/4 w-[600px] h-[400px] bg-primary/5 blur-[140px] rounded-full pointer-events-none" 
          aria-hidden="true" 
        />
      )}

      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        
        {/* Section Header with Viewport Reveal */}
        <SectionReveal className="mb-10 md:mb-14 text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center justify-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="editorial-eyebrow">{eyebrowText}</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-on-surface font-normal tracking-tight text-balance">
            {titleText}
          </h2>
          <p className="font-sans text-sm sm:text-base text-on-surface/70 mt-3 font-light leading-relaxed">
            {descriptionText}
          </p>
        </SectionReveal>

        {hasElfsight ? (
          <div className="w-full">
            <div className={`elfsight-app-${clientDetails.elfsightId}`} data-elfsight-app-lazy></div>
          </div>
        ) : items.length === 0 ? (
          /* Graceful Empty State */
          <div className="py-20 text-center max-w-md mx-auto text-on-surface/60 flex flex-col items-center">
            <span className="material-symbols-outlined text-4xl text-primary/50 mb-3">photo_library</span>
            <p className="font-serif text-lg text-on-surface">Visual Chronicles in Preparation</p>
            <p className="font-sans text-xs text-on-surface/60 mt-1">Gourmet moments and hospitality chronicles are being curated.</p>
          </div>
        ) : activeVariant === 'carousel-snap' ? (
          /* ================================================================
             VARIANT B: CAROUSEL-SNAP (Horizontal Snap with Navigation Affordances)
             ================================================================ */
          <div className="w-full relative group/carousel">
            {/* Header controls toolbar */}
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-on-surface/70">
                <span className="text-primary font-bold">0{activeCarouselIndex + 1}</span>
                <span>/</span>
                <span>0{items.length}</span>
                <span className="hidden sm:inline text-outline/40">|</span>
                <span className="hidden sm:inline text-[11px] font-sans tracking-wider text-on-surface/60">
                  {items[activeCarouselIndex]?.tag || 'The Café Gallery'}
                </span>
              </div>

              {/* Prev / Next Chevrons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!canScrollLeft}
                  onClick={() => handleCarouselScroll('left')}
                  className="w-10 h-10 rounded-full border border-outline/30 bg-surface-container/80 hover:bg-surface-elevated text-on-surface hover:text-primary transition-all flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed shadow-md cursor-pointer active:scale-95"
                  aria-label="Previous photograph"
                >
                  <span className="material-symbols-outlined text-base">chevron_left</span>
                </button>
                <button
                  type="button"
                  disabled={!canScrollRight}
                  onClick={() => handleCarouselScroll('right')}
                  className="w-10 h-10 rounded-full border border-outline/30 bg-surface-container/80 hover:bg-surface-elevated text-on-surface hover:text-primary transition-all flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed shadow-md cursor-pointer active:scale-95"
                  aria-label="Next photograph"
                >
                  <span className="material-symbols-outlined text-base">chevron_right</span>
                </button>
              </div>
            </div>

            {/* Scroll Track */}
            <div 
              ref={carouselRef}
              className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar gap-5 sm:gap-6 py-2 px-1 -mx-4 sm:mx-0 px-4 sm:px-0"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {items.map((item, idx) => {
                const tag = item.tag || GALLERY_METADATA[idx]?.tag || "The Café Experience";
                const caption = item.caption || GALLERY_METADATA[idx]?.caption || item.alt;

                return (
                  <div
                    key={item.id || idx}
                    onClick={() => setSelectedPhoto({ index: idx, data: { src: item.src, alt: item.alt, tag, caption } })}
                    className="min-w-[85vw] sm:min-w-[340px] md:min-w-[380px] lg:min-w-[420px] aspect-[4/3] snap-center shrink-0 rounded-[2rem] overflow-hidden relative bg-surface-obsidian border border-outline/15 hover:border-primary/60 shadow-xl hover:shadow-[0_16px_36px_rgba(0,0,0,0.4),0_0_24px_rgba(var(--color-primary-rgb),0.15)] transition-all duration-300 ease-out cursor-pointer group flex flex-col hover:-translate-y-1 active:scale-[0.98]"
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 opacity-75 group-hover:opacity-45 transition-opacity duration-500 z-10 pointer-events-none" />

                      {/* Corner Tag */}
                      <div className="absolute top-3.5 left-3.5 z-20 px-3 py-1 rounded-full bg-surface-obsidian/90 backdrop-blur-md border border-primary/35 text-[10px] uppercase tracking-wider text-primary font-semibold shadow-lg">
                        {tag}
                      </div>

                      {/* Expand Button */}
                      <div className="absolute top-3.5 right-3.5 z-20 w-8 h-8 rounded-full bg-surface-obsidian/85 backdrop-blur-md border border-outline/25 flex items-center justify-center text-on-surface opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0 group-hover:border-primary/50 shadow-lg">
                        <span className="material-symbols-outlined text-sm font-light text-primary">fullscreen</span>
                      </div>

                      {/* Bottom Caption Overlay */}
                      <div className="absolute bottom-0 inset-x-0 p-4 sm:p-5 z-20 flex flex-col justify-end transform translate-y-1 group-hover:translate-y-0 transition-transform duration-300">
                        <p className="font-serif text-base sm:text-lg text-on-surface font-normal leading-snug line-clamp-2">
                          {caption}
                        </p>
                        <span className="font-sans text-[11px] text-primary/90 mt-1 uppercase tracking-wider font-medium flex items-center gap-1">
                          <span>View Photograph</span>
                          <span className="material-symbols-outlined text-xs">arrow_forward</span>
                        </span>
                      </div>

                      {/* Photo */}
                      <picture className="absolute inset-0 w-full h-full">
                        {getAvifSource(item.src) && (
                          <source srcSet={getAvifSource(item.src)!} type="image/avif" />
                        )}
                        <img 
                          loading="lazy" 
                          decoding="async" 
                          width="600" 
                          height="450" 
                          src={item.src} 
                          alt={item.alt || "The Café Hospitality"}
                          className="w-full h-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.07] will-change-transform"
                        />
                      </picture>
                  </div>
                );
              })}
            </div>

            {/* Pagination dots & Mobile Swipe Indicator */}
            <div className="flex items-center justify-center gap-2 mt-6">
              {items.map((_, dotIdx) => (
                <button
                  key={dotIdx}
                  type="button"
                  onClick={() => scrollToSlide(dotIdx)}
                  className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                    dotIdx === activeCarouselIndex
                      ? 'w-6 bg-primary'
                      : 'w-1.5 bg-outline/40 hover:bg-outline'
                  }`}
                  aria-label={`Scroll to photograph ${dotIdx + 1}`}
                />
              ))}
            </div>

            <div className="flex sm:hidden justify-center items-center gap-2 mt-3 text-[10px] text-on-surface/50 uppercase tracking-widest font-mono">
              <span className="material-symbols-outlined text-xs">swipe</span>
              <span>Swipe photographs</span>
            </div>
          </div>
        ) : activeVariant === 'filmstrip' ? (
          /* ================================================================
             VARIANT C: FILMSTRIP (Prominent Showcase + Synchronized Filmstrip Thumbnails)
             ================================================================ */
          <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
            
            {/* Featured Showcase Display Card */}
            <div 
              onClick={() => {
                const tag = activeFilmstripItem?.tag || GALLERY_METADATA[safeFilmstripIndex]?.tag || "The Café Experience";
                const caption = activeFilmstripItem?.caption || GALLERY_METADATA[safeFilmstripIndex]?.caption || activeFilmstripItem?.alt;
                setSelectedPhoto({
                  index: safeFilmstripIndex,
                  data: { src: activeFilmstripItem.src, alt: activeFilmstripItem.alt, tag, caption },
                });
              }}
              className="w-full aspect-[16/10] sm:aspect-[16/9] rounded-[2.5rem] overflow-hidden relative bg-surface-obsidian border border-outline/25 shadow-2xl hover:border-primary/60 transition-all duration-500 cursor-pointer group/showcase mb-6 sm:mb-8"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/30 z-10 pointer-events-none" />

                {/* Top Badge: Tag & Index */}
                <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                  <span className="px-3.5 py-1 rounded-full bg-surface-obsidian/90 backdrop-blur-md border border-primary/35 text-[10px] uppercase tracking-wider text-primary font-semibold shadow-lg">
                    {activeFilmstripItem?.tag || GALLERY_METADATA[safeFilmstripIndex]?.tag || "The Café Experience"}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-surface-obsidian/85 backdrop-blur-md border border-outline/25 text-[10px] font-mono text-on-surface/75">
                    0{safeFilmstripIndex + 1} / 0{items.length}
                  </span>
                </div>

                {/* Top Right Fullscreen Icon */}
                <div className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-surface-obsidian/85 backdrop-blur-md border border-outline/25 flex items-center justify-center text-primary group-hover/showcase:border-primary/60 transition-colors shadow-lg">
                  <span className="material-symbols-outlined text-base">fullscreen</span>
                </div>

                {/* Bottom Showcase Caption Overlay */}
                <div className="absolute bottom-0 inset-x-0 p-5 sm:p-7 z-20 flex flex-col justify-end">
                  <p className="font-serif text-lg sm:text-2xl text-on-surface font-normal leading-snug drop-shadow-md">
                    {activeFilmstripItem?.caption || GALLERY_METADATA[safeFilmstripIndex]?.caption || activeFilmstripItem?.alt}
                  </p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/10">
                    <span className="font-sans text-xs text-primary/90 uppercase tracking-widest font-medium flex items-center gap-1.5">
                      <span>Click to view in luxury theater mode</span>
                      <span className="material-symbols-outlined text-xs">arrow_forward</span>
                    </span>
                    <span className="text-[10px] font-mono text-on-surface/50 uppercase tracking-wider hidden sm:inline">
                      Use Left / Right arrow keys to navigate
                    </span>
                  </div>
                </div>

                {/* Featured Photo */}
                <img
                  key={activeFilmstripItem?.src}
                  src={activeFilmstripItem?.src}
                  alt={activeFilmstripItem?.alt || "The Café Showcase"}
                  width="1200"
                  height="800"
                  className="w-full h-full object-cover filter brightness-[0.95] contrast-[1.06] group-hover/showcase:scale-105 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  loading="eager"
                  decoding="async"
                />
            </div>

            {/* Synchronized Filmstrip Thumbnail Track */}
            <div className="w-full flex items-center justify-center gap-3 sm:gap-4 overflow-x-auto hide-scrollbar py-2 px-2">
              {items.map((item, idx) => (
                <button
                  key={item.id || idx}
                  type="button"
                  onClick={() => setActiveFilmstripIndex(idx)}
                  aria-label={`View photo ${idx + 1}: ${item.tag || item.alt}`}
                  className={`group relative w-20 h-14 sm:w-28 sm:h-20 rounded-2xl overflow-hidden border-2 transition-all duration-300 shrink-0 cursor-pointer ${
                    idx === safeFilmstripIndex
                      ? 'border-primary shadow-[0_0_20px_rgba(var(--color-primary-rgb),0.35)] scale-105 opacity-100 ring-2 ring-primary/20'
                      : 'border-outline/25 opacity-60 hover:opacity-100 hover:border-outline/60'
                  }`}
                >
                  <img
                    src={item.src}
                    alt={item.alt}
                    width="120"
                    height="80"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                  <span className="absolute bottom-1 right-1.5 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm bg-black/75 text-primary">
                    0{idx + 1}
                  </span>
                </button>
              ))}
            </div>

          </div>
        ) : (
          /* ================================================================
             VARIANT A: ASYMMETRIC BENTO GRID (Flagship Café Barrackpore Reference)
             ================================================================ */
          <div className="w-full">
            <div className="flex sm:grid overflow-x-auto sm:overflow-visible snap-x snap-mandatory sm:snap-none hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 auto-rows-[300px] sm:auto-rows-[310px] pb-2 sm:pb-0">
              {items.slice(0, 4).map((item, idx) => {
                const tag = item.tag || GALLERY_METADATA[idx]?.tag || "The Café Experience";
                const caption = item.caption || GALLERY_METADATA[idx]?.caption || item.alt;
                const spanClass = getSpanClass(item, idx);

                return (
                  <div 
                    key={item.id || idx}
                    onClick={() => setSelectedPhoto({ index: idx, data: { src: item.src, alt: item.alt, tag, caption } })}
                    className={`${spanClass} min-w-[82vw] sm:min-w-0 snap-center shrink-0 sm:shrink rounded-[2rem] overflow-hidden relative h-full w-full bg-surface-obsidian border border-outline/15 hover:border-primary/60 shadow-xl hover:shadow-[0_16px_36px_rgba(0,0,0,0.4),0_0_24px_rgba(var(--color-primary-rgb),0.15)] transition-all duration-500 ease-out cursor-pointer group flex flex-col hover:-translate-y-1 active:scale-[0.98]`}
                  >
                    {/* Subtle Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 opacity-75 group-hover:opacity-45 transition-opacity duration-500 z-10 pointer-events-none" />

                      {/* Corner Category Tag */}
                      <div className="absolute top-3.5 left-3.5 sm:top-4 sm:left-4 z-20 px-3 py-1 sm:px-3.5 sm:py-1 rounded-full bg-surface-obsidian/90 backdrop-blur-md border border-primary/35 text-[10px] uppercase tracking-wider text-primary font-semibold shadow-lg">
                        {tag}
                      </div>

                      {/* Concentric Expand Button */}
                      <div className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 z-20 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-surface-obsidian/85 backdrop-blur-md border border-outline/25 flex items-center justify-center text-on-surface opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0 group-hover:border-primary/50 shadow-lg">
                        <span className="material-symbols-outlined text-sm font-light text-primary">fullscreen</span>
                      </div>

                      {/* Bottom Caption Overlay */}
                      <div className="absolute bottom-0 inset-x-0 p-4 sm:p-5 z-20 flex flex-col justify-end transform translate-y-1 group-hover:translate-y-0 transition-transform duration-300">
                        <p className="font-serif text-base sm:text-lg text-on-surface font-normal leading-snug line-clamp-2">
                          {caption}
                        </p>
                        <span className="font-sans text-[11px] text-primary/90 mt-1 uppercase tracking-wider font-medium flex items-center gap-1">
                          <span>View Photograph</span>
                          <span className="material-symbols-outlined text-xs">arrow_forward</span>
                        </span>
                      </div>

                      {/* Photography Image with Restrained Zoom */}
                      <picture className="absolute inset-0 w-full h-full">
                        {getAvifSource(item.src) && (
                          <source srcSet={getAvifSource(item.src)!} type="image/avif" />
                        )}
                        <img 
                          loading="lazy" 
                          decoding="async" 
                          width="600" 
                          height="450" 
                          src={item.src} 
                          alt={item.alt || `${businessName} Hospitality`}
                          className="w-full h-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.07] will-change-transform"
                        />
                      </picture>
                  </div>
                );
              })}
            </div>

            {/* Mobile Swipe Hint */}
            <div className="flex sm:hidden justify-center items-center gap-2 mt-4 text-[10px] text-on-surface/50 uppercase tracking-widest font-mono">
              <span className="material-symbols-outlined text-xs">swipe</span>
              <span>Swipe photographs</span>
            </div>
          </div>
        )}

      </div>

      {/* Luxury Fullscreen Lightbox Modal (Shared across all variants) */}
      <AnimatePresence>
        {selectedPhoto && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[250] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-4 sm:p-8"
            onClick={() => setSelectedPhoto(null)}
          >
            {/* Top Close Bar */}
            <div className="absolute top-6 left-6 right-6 flex items-center justify-between text-on-surface z-30 max-w-5xl mx-auto w-full">
              <div className="flex items-center gap-3">
                <span className="font-sans text-xs uppercase tracking-widest text-primary font-semibold">
                  {String(selectedPhoto.index + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
                </span>
                <span className="text-outline/40">|</span>
                <span className="font-sans text-xs uppercase tracking-wider text-on-surface/75">
                  {selectedPhoto.data.tag}
                </span>
              </div>
              <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setSelectedPhoto(null)}
                className="w-10 h-10 rounded-full bg-surface-container/80 hover:bg-surface-elevated border border-outline/30 flex items-center justify-center text-on-surface transition-colors cursor-pointer"
                aria-label="Close photograph lightbox"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </motion.button>
            </div>

            {/* Modal Image Container with Double Bezel */}
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 360, damping: 26 }}
              className="relative max-w-4xl max-h-[75vh] rounded-[2rem] p-1.5 bg-gradient-to-b from-surface-container to-surface-obsidian border border-primary/35 shadow-2xl bg-surface-container"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="rounded-[calc(2rem-0.375rem)] overflow-hidden max-h-[calc(75vh-12px)]">
                <img 
                  src={selectedPhoto.data.src} 
                  alt={selectedPhoto.data.alt} 
                  width="1200" 
                  height="800" 
                  decoding="async" 
                  className="w-full h-full max-h-[75vh] object-contain"
                />
              </div>
            </motion.div>

            {/* Modal Caption */}
            <div className="mt-6 text-center max-w-xl z-30" onClick={(e) => e.stopPropagation()}>
              <p className="font-serif text-lg sm:text-xl text-on-surface font-light">
                {selectedPhoto.data.caption}
              </p>
              <p className="font-sans text-xs text-primary/80 mt-1 uppercase tracking-widest">
                {businessName}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
