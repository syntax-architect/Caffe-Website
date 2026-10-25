import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { useUI } from '../context/UIContext';
import { useSiteConfig } from '../context/SiteConfigContext';
import { useI18n } from '../i18n';
import { isCinematicExperience } from '../config/client';
import { getAvifSource } from '../utils/image';
import type { MenuItem } from '../types/menu';

export interface SignatureDishItem {
  id: string;
  name: string;
  subtitle: string;
  category: string;
  price: number;
  diet: 'veg' | 'nv';
  image: string;
  tag: string;
  accentNote: string;
  craftTelemetry: string;
}

export const SIGNATURE_REEL_DISHES: SignatureDishItem[] = [
  {
    id: 'truffle-margherita-pizza',
    name: 'Truffle Margherita Pizza',
    subtitle: 'Hand-stretched 48h cold fermented crust',
    category: 'WOOD-FIRED HEARTH',
    price: 180,
    diet: 'veg',
    image: '/images/gallery-pizza.webp',
    tag: 'CHEF #01',
    accentNote: '450°C Stone Blistered',
    craftTelemetry: '48H FERMENT',
  },
  {
    id: 'gourmet-brioche-burger',
    name: 'Artisanal Brioche Burger',
    subtitle: 'Flame-seared patty & melted aged cheddar',
    category: 'CHEF SELECTION',
    price: 250,
    diet: 'nv',
    image: '/images/menu/gourmet-burger.webp',
    tag: 'CHEF #02',
    accentNote: 'Smoked Onion Relish',
    craftTelemetry: 'HAND-CRAFTED',
  },
  {
    id: 'platter-tandoori',
    name: 'Royal Tandoori Banquet',
    subtitle: 'Charcoal-roasted kebabs with mint crema',
    category: 'CLAY OVEN',
    price: 450,
    diet: 'nv',
    image: '/images/platters/platter-tandoori.webp',
    tag: 'CHEF #03',
    accentNote: 'Charcoal Embers',
    craftTelemetry: '450°C EMBER',
  },
  {
    id: 'single-origin-espresso',
    name: 'Single-Origin Arabica Pour',
    subtitle: 'High-elevation beans extracted at 9 bars',
    category: 'ARTISAN COFFEE',
    price: 160,
    diet: 'veg',
    image: '/images/gallery-beans.webp',
    tag: 'CHEF #04',
    accentNote: '9-Bar Golden Crema',
    craftTelemetry: 'MICRON GRIND',
  },
  {
    id: 'platter-chinese',
    name: 'Wok-Tossed Canton Platter',
    subtitle: 'High-flame wok hei & crispy dim sums',
    category: 'HIGH FLAME',
    price: 390,
    diet: 'nv',
    image: '/images/platters/platter-chinese.webp',
    tag: 'CHEF #05',
    accentNote: 'Crisp Wok Hei Glaze',
    craftTelemetry: '290°C WOK',
  },
  {
    id: 'botanical-cold-pour',
    name: 'Twilight Botanical Elixir',
    subtitle: 'Cold-clarified citrus & infused lavender',
    category: 'NOCTURNE BAR',
    price: 190,
    diet: 'veg',
    image: '/images/story-pour.webp',
    tag: 'CHEF #06',
    accentNote: 'Cold-Drip Infused',
    craftTelemetry: 'ZERO PROOF',
  },
  {
    id: 'platter-bowl',
    name: 'Himalayan Noodle Broth',
    subtitle: 'Slow-simmered aromatics & fresh dumplings',
    category: 'COMFORT BOWLS',
    price: 260,
    diet: 'veg',
    image: '/images/platters/platter-bowl.webp',
    tag: 'CHEF #07',
    accentNote: '12-Hour Slow Simmer',
    craftTelemetry: 'RESTFUL UMAMI',
  },
  {
    id: 'classic-margherita',
    name: 'Bocconcini Basil Slices',
    subtitle: 'San Marzano tomatoes & fresh basil leaves',
    category: 'WOOD-FIRED HEARTH',
    price: 210,
    diet: 'veg',
    image: '/images/components/comp_img_3.webp',
    tag: 'CHEF #08',
    accentNote: 'Sweet Garden Basil',
    craftTelemetry: 'NAPOLI CRAFT',
  },
];

export const CurvedMenuReel: React.FC = () => {
  const { addToCart, setIsDrawerOpen } = useCart();
  const { showToast } = useUI();
  const { formatPrice } = useSiteConfig();
  const { t } = useI18n();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [selectedDish, setSelectedDish] = useState<SignatureDishItem | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Drag-to-scroll state
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasDraggedSignificantlyRef = useRef(false);

  // Update scroll indicator buttons state
  const checkScrollBounds = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    checkScrollBounds();
    el.addEventListener('scroll', checkScrollBounds, { passive: true });
    window.addEventListener('resize', checkScrollBounds, { passive: true });
    return () => {
      el.removeEventListener('scroll', checkScrollBounds);
      window.removeEventListener('resize', checkScrollBounds);
    };
  }, [checkScrollBounds]);

  // Smooth step scroll via buttons or keys
  const scrollByAmount = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const scrollAmount = el.clientWidth > 640 ? 320 : 280;
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  // Drag-to-scroll handlers for desktop mouse
  const handleMouseDown = (e: React.MouseEvent) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    isDraggingRef.current = true;
    hasDraggedSignificantlyRef.current = false;
    startXRef.current = e.pageX - el.offsetLeft;
    scrollLeftRef.current = el.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startXRef.current) * 1.4;
    if (Math.abs(walk) > 6) {
      hasDraggedSignificantlyRef.current = true;
    }
    el.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleQuickAdd = (e: React.MouseEvent, dish: SignatureDishItem) => {
    e.stopPropagation();
    const menuItem: MenuItem = {
      id: dish.id,
      name: dish.name,
      price: dish.price,
      category: dish.category,
      category_id: 'burgers-pizzas',
      diet: dish.diet,
      description: dish.subtitle,
      available: true,
      sort_order: 1,
      popular: true,
      tag: dish.tag,
      image: dish.image,
    };
    addToCart(menuItem);
    setIsDrawerOpen(true);
    showToast({
      title: t('curvedReel.added', 'Added to Order'),
      message: dish.name,
      subtext: `${formatPrice(dish.price)} • ${dish.craftTelemetry}`,
      type: 'success',
    });
  };

  // Keyboard escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedDish) {
        setSelectedDish(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDish]);

  return (
    <section
      id="chef-specials"
      className="relative w-full overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-b from-[#140D09] via-[#0E0907] to-[#140D09] p-5 sm:p-7 lg:p-8 shadow-[0_25px_80px_rgba(0,0,0,0.85)] mb-8 sm:mb-12 select-none"
    >
      {/* Background warm gold ambient lighting flare */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[340px] bg-primary/10 blur-[130px] pointer-events-none rounded-full" />

      {/* Header Bar */}
      <div className="relative z-10 flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-outline/15">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--color-primary-rgb),0.8)]" />
            <span className="font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.22em] text-primary font-bold">
              {t('curvedReel.badge', "CHEF'S SIGNATURE SELECTION")}
            </span>
          </div>
          <h3 className="font-serif text-2xl sm:text-3xl text-on-surface font-semibold tracking-tight">
            {t('curvedReel.title', 'Curated Culinary Feasts')}
          </h3>
          <p className="font-sans text-xs sm:text-sm text-on-surface/65 mt-1 max-w-xl leading-relaxed">
            {t('curvedReel.subtitle', 'Swipe or touch to explore our signature flame-charred hearth dishes.')}
          </p>
        </div>

        {/* Carousel Chevron Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="font-mono text-[10px] tracking-widest uppercase text-on-surface/50 hidden sm:inline mr-2">
            8 {t('curvedReel.badge', 'CREATIONS')}
          </span>
          <button
            type="button"
            aria-label={t('common.previous', 'Previous signature dishes')}
            onClick={() => scrollByAmount('left')}
            disabled={!canScrollLeft}
            className={`w-10 h-10 rounded-full border border-primary/30 bg-surface-obsidian/90 text-primary flex items-center justify-center transition-all duration-200 shadow-md cursor-pointer ${
              canScrollLeft
                ? 'hover:bg-primary hover:text-on-primary hover:scale-105 active:scale-95'
                : 'opacity-40 cursor-not-allowed border-outline/20'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            aria-label={t('common.next', 'Next signature dishes')}
            onClick={() => scrollByAmount('right')}
            disabled={!canScrollRight}
            className={`w-10 h-10 rounded-full border border-primary/30 bg-surface-obsidian/90 text-primary flex items-center justify-center transition-all duration-200 shadow-md cursor-pointer ${
              canScrollRight
                ? 'hover:bg-primary hover:text-on-primary hover:scale-105 active:scale-95'
                : 'opacity-40 cursor-not-allowed border-outline/20'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Smooth Showcase Track */}
      <div className="relative w-full my-4">
        {/* Subtle Edge Vignettes */}
        <div className="absolute left-0 top-0 bottom-0 w-8 sm:w-14 bg-gradient-to-r from-[#140D09] to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-8 sm:w-14 bg-gradient-to-l from-[#140D09] to-transparent z-10 pointer-events-none" />

        <div
          ref={scrollContainerRef}
          data-lenis-prevent
          tabIndex={0}
          role="region"
          aria-label={t('curvedReel.ariaLabel', 'Signature Menu Carousel')}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="flex gap-4 sm:gap-6 overflow-x-auto py-3 px-2 custom-scrollbar snap-x snap-mandatory scroll-smooth cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
          style={{ touchAction: 'pan-x pan-y' }}
        >
          {SIGNATURE_REEL_DISHES.map((dish) => {
            const avifSrc = getAvifSource(dish.image);

            return (
              <div
                key={dish.id}
                onClick={() => {
                  if (!hasDraggedSignificantlyRef.current) {
                    setSelectedDish(dish);
                  }
                }}
                className="w-[240px] sm:w-[275px] shrink-0 snap-start flex flex-col rounded-2xl border border-primary/25 bg-[#120D0A]/95 hover:border-primary/60 transition-all duration-300 shadow-[0_12px_36px_rgba(0,0,0,0.7)] hover:shadow-[0_16px_45px_rgba(212,175,55,0.18)] hover:-translate-y-1 group cursor-pointer overflow-hidden"
              >
                {/* Food Photograph */}
                <div className="relative w-full h-[180px] sm:h-[200px] overflow-hidden bg-[#0A0705]">
                  <picture>
                    {avifSrc && <source srcSet={avifSrc} type="image/avif" />}
                    <img
                      src={dish.image}
                      alt={dish.name}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover brightness-[0.88] transition-transform duration-500 ease-out group-hover:scale-106 pointer-events-none"
                    />
                  </picture>

                  {/* Dark Vignette Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#120D0A] via-transparent to-black/30 pointer-events-none" />

                  {/* Badges */}
                  <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none z-10">
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-obsidian/90 border border-primary/30 font-mono text-[9px] uppercase tracking-wider text-primary font-semibold">
                      <span className={`w-1.5 h-1.5 rounded-full ${dish.diet === 'veg' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                      <span>{dish.tag}</span>
                    </div>
                    {isCinematicExperience() && (
                      <span className="font-mono text-[11px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-obsidian/85 text-on-surface/80 border border-outline/20">
                        {dish.craftTelemetry}
                      </span>
                    )}
                  </div>
                </div>

                {/* Dish Information */}
                <div className="p-4 flex flex-col justify-between flex-1 bg-[#120D0A]">
                  <div>
                    <span className="font-mono text-[9px] uppercase tracking-widest text-primary/80 block mb-1">
                      {dish.category}
                    </span>
                    <h4 className="font-serif text-base sm:text-lg text-on-surface font-semibold leading-snug line-clamp-1 group-hover:text-primary transition-colors">
                      {dish.name}
                    </h4>
                    <p className="font-sans text-xs text-on-surface/65 line-clamp-2 mt-1 leading-relaxed">
                      {dish.subtitle}
                    </p>
                  </div>

                  {/* Price & Quick Add */}
                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-outline/15">
                    <span className="font-mono text-sm sm:text-base text-primary font-bold">
                      {formatPrice(dish.price)}
                    </span>
                    <button
                      type="button"
                      aria-label={`Add ${dish.name} to order`}
                      onClick={(e) => handleQuickAdd(e, dish)}
                      className="px-3 py-1.5 rounded-full bg-primary/20 hover:bg-primary border border-primary/40 hover:border-primary text-primary hover:text-on-primary font-sans font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all duration-200 cursor-pointer active:scale-95"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      <span>{t('menu.add', 'ADD')}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Info Strip */}
      <div className="relative z-10 pt-3 border-t border-outline/15 flex flex-wrap items-center justify-between gap-3 font-mono text-[10px] tracking-[0.2em] uppercase text-on-surface/50">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          <span>{t('curvedReel.dragHint', 'SWIPE OR DRAG TO EXPLORE • CLICK CARD FOR CRAFT NOTES')}</span>
        </div>
        <div className="flex items-center gap-2 text-primary font-semibold">
          <span>8 {t('curvedReel.badge', 'SIGNATURE SELECTIONS')}</span>
          <span>•</span>
          <span>{t('curvedReel.addToOrder', 'ADD TO ORDER')}</span>
        </div>
      </div>

      {/* Sensory Dish Detail Modal */}
      {selectedDish && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dish-modal-title"
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
          onClick={() => setSelectedDish(null)}
        >
          <div
            className="relative w-full max-w-lg rounded-3xl bg-surface-obsidian border border-primary/35 p-5 sm:p-7 shadow-[0_25px_90px_rgba(0,0,0,0.95)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Close Button */}
            <button
              type="button"
              aria-label={t('common.close', 'Close dish details')}
              onClick={() => setSelectedDish(null)}
              className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-surface-container-high/80 hover:bg-primary text-on-surface hover:text-on-primary flex items-center justify-center transition-all cursor-pointer border border-outline/20"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Modal Image Header */}
            <div className="relative w-full h-48 sm:h-56 rounded-2xl overflow-hidden mb-5 border border-outline/20">
              <picture>
                {getAvifSource(selectedDish.image) && (
                  <source srcSet={getAvifSource(selectedDish.image)!} type="image/avif" />
                )}
                <img
                  src={selectedDish.image}
                  alt={selectedDish.name}
                  className="w-full h-full object-cover brightness-[0.88]"
                />
              </picture>
              <div className="absolute inset-0 bg-gradient-to-t from-surface-obsidian via-surface-obsidian/30 to-transparent" />
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-surface-obsidian/85 backdrop-blur-md border border-primary/30 font-mono text-[9px] uppercase tracking-wider text-primary font-semibold flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${selectedDish.diet === 'veg' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                  <span>{selectedDish.tag}</span>
                </span>
                {isCinematicExperience() && (
                  <span className="font-mono text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface-obsidian/80 text-on-surface/80 border border-outline/20">
                    {selectedDish.craftTelemetry}
                  </span>
                )}
              </div>
            </div>

            {/* Title & Category */}
            <div className="mb-4">
              <span className="font-mono text-[10px] uppercase tracking-widest text-primary/80 block mb-1">
                {dishCategoryLabel(selectedDish.category, selectedDish.accentNote)}
              </span>
              <div className="flex items-baseline justify-between gap-3">
                <h3 id="dish-modal-title" className="font-serif text-xl sm:text-2xl text-on-surface font-semibold">
                  {selectedDish.name}
                </h3>
                <span className="font-mono text-lg sm:text-xl text-primary font-bold">
                  {formatPrice(selectedDish.price)}
                </span>
              </div>
              <p className="font-sans text-xs sm:text-sm text-on-surface/75 mt-1.5 leading-relaxed">
                {selectedDish.subtitle}
              </p>
            </div>

            {/* Sensory Tri-Spectrum Craft Strip (Cinematic Mode only) */}
            {isCinematicExperience() && (
              <div className="mb-5 p-3 rounded-xl bg-surface-container-lowest/80 border border-outline/20 space-y-2 font-mono text-[11px] uppercase tracking-wider">
              <div className="flex justify-between text-on-surface/60">
                <span>{t('curvedReel.chefSensory', 'CHEF SENSORY CALIBRATION')}</span>
                <span className="text-primary font-semibold">{t('curvedReel.authenticProfile', 'AUTHENTIC PROFILE')}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-outline/15">
                <div>
                  <div className="flex justify-between text-on-surface/70 mb-1">
                    <span>{t('curvedReel.craft', 'CRAFT')}</span>
                    <span className="text-primary font-bold">99%</span>
                  </div>
                  <div className="h-1 rounded-full bg-surface-container-highest overflow-hidden">
                    <div className="h-full bg-primary w-[99%]" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-on-surface/70 mb-1">
                    <span>{t('curvedReel.aroma', 'AROMA')}</span>
                    <span className="text-primary font-bold">97%</span>
                  </div>
                  <div className="h-1 rounded-full bg-surface-container-highest overflow-hidden">
                    <div className="h-full bg-primary w-[97%]" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-on-surface/70 mb-1">
                    <span>{t('curvedReel.balance', 'BALANCE')}</span>
                    <span className="text-primary font-bold">98%</span>
                  </div>
                  <div className="h-1 rounded-full bg-surface-container-highest overflow-hidden">
                    <div className="h-full bg-primary w-[98%]" />
                  </div>
                </div>
              </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center gap-3 pt-3 border-t border-outline/15">
              <button
                type="button"
                onClick={() => setSelectedDish(null)}
                className="flex-1 py-2.5 rounded-full border border-outline/30 hover:bg-surface-container text-on-surface font-sans text-xs font-medium transition-colors cursor-pointer text-center"
              >
                {t('common.close', 'Close')}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  handleQuickAdd(e, selectedDish);
                  setSelectedDish(null);
                }}
                className="flex-1 py-2.5 rounded-full bg-primary text-on-primary font-sans font-semibold text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.4)] hover:scale-102 active:scale-98 transition-all cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <span>{t('curvedReel.addToOrder', 'Add to Order')} · {formatPrice(selectedDish.price)}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

function dishCategoryLabel(category: string, accentNote: string): string {
  return `${category} • ${accentNote}`;
}
