import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useCart } from '../context/CartContext';
import { useUI } from '../context/UIContext';
import { useSiteConfig } from '../context/SiteConfigContext';
import { useI18n } from '../i18n';
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
  const containerRef = useRef<HTMLDivElement>(null);

  const [offset, setOffset] = useState<number>(0);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [selectedDish, setSelectedDish] = useState<SignatureDishItem | null>(null);

  // Physics & drag state
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startOffsetRef = useRef(0);
  const velocityRef = useRef(0);
  const lastSampleRef = useRef<{ x: number; t: number }>({ x: 0, t: performance.now() });
  const hasMovedSignificantRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef(performance.now());

  // Screen-size detection
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateSize = () => {
      setIsMobile(window.innerWidth < 820);
    };
    updateSize();
    window.addEventListener('resize', updateSize, { passive: true });
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Geometry configuration based on viewport width
  const cardPitch = isMobile ? 160 : 210;
  const totalWidth = SIGNATURE_REEL_DISHES.length * cardPitch;

  // Discrete nudge for Chevrons and Keyboard arrows
  const nudge = useCallback((direction: number) => {
    // direction: +1 = previous / rightward spin, -1 = next / leftward spin
    velocityRef.current = direction * 16;
  }, []);

  // 60fps Physics & Auto-Scroll Loop
  const tickPhysics = useCallback(() => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000);
    lastTimeRef.current = now;

    if (!isDraggingRef.current && !isPaused && !selectedDish) {
      if (Math.abs(velocityRef.current) > 0.3) {
        // Momentum decay (decays ~95% per second)
        velocityRef.current *= Math.pow(0.95, dt * 60);
        setOffset((prev) => (prev + velocityRef.current * dt * 60) % totalWidth);
      } else {
        // Continuous steady auto-scroll (42px/s right-to-left)
        setOffset((prev) => (prev - 42 * dt) % totalWidth);
      }
    }

    rafRef.current = requestAnimationFrame(tickPhysics);
  }, [totalWidth, isPaused, selectedDish]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tickPhysics);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [tickPhysics]);

  // Keyboard navigation & Escape-to-close listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedDish) {
        setSelectedDish(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDish]);

  // Pointer drag interaction handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    hasMovedSignificantRef.current = false;
    startXRef.current = e.clientX;
    startOffsetRef.current = offset;
    velocityRef.current = 0;
    lastSampleRef.current = { x: e.clientX, t: performance.now() };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - startXRef.current;
    if (Math.abs(dx) > 5) {
      hasMovedSignificantRef.current = true;
    }

    const now = performance.now();
    const dt = Math.max(8, now - lastSampleRef.current.t);
    const instDx = e.clientX - lastSampleRef.current.x;
    velocityRef.current = (instDx / dt) * 16;
    lastSampleRef.current = { x: e.clientX, t: now };

    setOffset(startOffsetRef.current + dx);
  };

  const handlePointerUp = () => {
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

  return (
    <div className="relative w-full overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-b from-surface-obsidian via-surface-container-lowest to-surface-obsidian p-4 sm:p-6 lg:p-8 shadow-[0_25px_80px_rgba(0,0,0,0.85)] mb-8 sm:mb-12 select-none">
      {/* Background warm gold ambient lighting flare */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[340px] bg-primary/10 blur-[130px] pointer-events-none rounded-full" />

      {/* Header Eyebrow & Live Status Bar */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-outline/15">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
          <span className="font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.22em] text-primary font-bold">
            {t('curvedReel.badge', "CHEF'S SIGNATURE SELECTION")} · 3D REEL
          </span>
        </div>
        <div className="font-mono text-[10px] tracking-widest uppercase text-on-surface/60 flex items-center gap-3">
          <span className="hidden sm:inline">{t('curvedReel.cylindricalPerspective', 'CYLINDRICAL PERSPECTIVE')}</span>
          <span>•</span>
          <span className="text-primary/90 font-semibold">{t('curvedReel.amberWarmth', '2200K AMBER')}</span>
        </div>
      </div>

      {/* Hand-Drawn Gold Craft Doodles with Curving SVG Arrows (Desktop View) */}
      <div className="relative w-full">
        <div className="absolute top-2 left-6 lg:left-12 font-serif italic text-primary/85 text-xs sm:text-sm hidden md:flex items-center gap-3 pointer-events-none z-20">
          <span className="drop-shadow-[0_0_10px_rgba(var(--color-primary-rgb),0.4)]">
            ✨ {t('curvedReel.title', 'Hand-Crafted Signatures')}
          </span>
          <svg className="w-10 h-10 text-primary/70 animate-pulse" viewBox="0 0 40 40" fill="none" stroke="currentColor">
            <path
              d="M4 10 C 16 6, 28 14, 30 28 M30 28 L 22 24 M30 28 L 31 20"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className="absolute top-2 right-6 lg:right-12 font-serif italic text-primary/85 text-xs sm:text-sm hidden md:flex items-center gap-3 pointer-events-none z-20">
          <svg className="w-10 h-10 text-primary/70 rotate-45 animate-pulse" viewBox="0 0 40 40" fill="none" stroke="currentColor">
            <path
              d="M4 10 C 16 6, 28 14, 30 28 M30 28 L 22 24 M30 28 L 31 20"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="drop-shadow-[0_0_10px_rgba(var(--color-primary-rgb),0.4)]">
            {t('curvedReel.subtitle', 'Pulled at 9 Bars Pressure')} ☕
          </span>
        </div>

        {/* Left / Right Floating Chevrons (Desktop) */}
        <button
          type="button"
          aria-label={t('common.previous', 'Previous signature dishes')}
          onClick={() => nudge(1)}
          className="hidden md:flex absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-surface-obsidian/90 hover:bg-primary border border-primary/35 hover:border-primary text-primary hover:text-on-primary items-center justify-center transition-all duration-300 shadow-[0_6px_24px_rgba(0,0,0,0.85)] hover:scale-110 active:scale-95 cursor-pointer backdrop-blur-md group"
        >
          <span className="material-symbols-outlined text-xl transition-transform group-hover:-translate-x-0.5">chevron_left</span>
        </button>

        <button
          type="button"
          aria-label={t('common.next', 'Next signature dishes')}
          onClick={() => nudge(-1)}
          className="hidden md:flex absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-surface-obsidian/90 hover:bg-primary border border-primary/35 hover:border-primary text-primary hover:text-on-primary items-center justify-center transition-all duration-300 shadow-[0_6px_24px_rgba(0,0,0,0.85)] hover:scale-110 active:scale-95 cursor-pointer backdrop-blur-md group"
        >
          <span className="material-symbols-outlined text-xl transition-transform group-hover:translate-x-0.5">chevron_right</span>
        </button>

        {/* 3D Cylindrical Reel Stage */}
        <div
          ref={containerRef}
          tabIndex={0}
          role="region"
          aria-label={t('curvedReel.ariaLabel', '3D Cylindrical Signature Menu Reel')}
          aria-roledescription="carousel"
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              e.preventDefault();
              nudge(1);
            } else if (e.key === 'ArrowRight') {
              e.preventDefault();
              nudge(-1);
            }
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => {
            setIsPaused(false);
            isDraggingRef.current = false;
          }}
          className="relative w-full h-[320px] sm:h-[380px] lg:h-[420px] overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing my-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-2xl"
          style={{
            touchAction: 'pan-y',
            perspective: '1200px',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Edge Blur Vignette Masks */}
          <div className="absolute left-0 top-0 bottom-0 w-12 sm:w-20 bg-gradient-to-r from-surface-obsidian via-surface-obsidian/80 to-transparent z-20 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-12 sm:w-20 bg-gradient-to-l from-surface-obsidian via-surface-obsidian/80 to-transparent z-20 pointer-events-none" />

          {/* Cards projection loop */}
          {SIGNATURE_REEL_DISHES.map((dish, idx) => {
            // Infinite wrapping calculation
            const rawOffset = ((idx * cardPitch + offset) % totalWidth + totalWidth) % totalWidth;
            const centeredOffset = rawOffset > totalWidth / 2 ? rawOffset - totalWidth : rawOffset;

            // Distance from viewport center (normalized 0..1)
            const maxSpan = isMobile ? 320 : 540;
            const normDist = Math.min(1.0, Math.abs(centeredOffset) / maxSpan);

            // Cylinder curvature mathematics:
            // 1. Width expands outward
            const baseW = isMobile ? 140 : 180;
            const expandW = isMobile ? 32 : 48;
            const cardWidth = baseW + expandW * Math.pow(normDist, 2);

            // 2. Height expands on outer perimeter like an inside cylinder
            const baseH = isMobile ? 220 : 280;
            const expandH = isMobile ? 65 : 92;
            const cardHeight = baseH + expandH * Math.pow(normDist, 2.4);

            // 3. Center push outward
            const pushX = centeredOffset * (1 + 0.08 * Math.pow(normDist, 2));

            // 4. Subtle arched vertical dip
            const dipY = Math.pow(normDist, 2) * -14;

            // 5. Cylindrical 3D perspective rotation (degrees)
            const rotateY = (centeredOffset / maxSpan) * 18;

            // 6. Layer depth & edge fade
            const zIndex = Math.round(100 - normDist * 60);
            const opacity = Math.max(0.25, 1 - Math.pow(normDist, 3.2));

            const avifSrc = getAvifSource(dish.image);

            return (
              <div
                key={dish.id}
                onClick={() => {
                  if (!hasMovedSignificantRef.current) {
                    setSelectedDish(dish);
                  }
                }}
                className="absolute transition-transform will-change-transform rounded-2xl overflow-hidden border border-primary/30 bg-surface-obsidian/95 shadow-[0_20px_50px_rgba(0,0,0,0.85)] group backdrop-blur-xl cursor-pointer"
                style={{
                  width: `${cardWidth}px`,
                  height: `${cardHeight}px`,
                  transform: `translate3d(${pushX}px, ${dipY}px, 0) rotateY(${rotateY}deg)`,
                  zIndex,
                  opacity,
                  transformStyle: 'preserve-3d',
                }}
              >
                {/* Authentic Food Photograph with AVIF Picture fallback */}
                <picture>
                  {avifSrc && <source srcSet={avifSrc} type="image/avif" />}
                  <img
                    src={dish.image}
                    alt={dish.name}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover brightness-[0.86] transition-transform duration-700 group-hover:scale-108 pointer-events-none"
                  />
                </picture>

                {/* Dark Vignette Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-surface-obsidian via-surface-obsidian/40 to-transparent pointer-events-none" />

                {/* Top Badge: Frame Code & Diet status */}
                <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none z-10">
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-obsidian/85 backdrop-blur-md border border-primary/30 font-mono text-[9px] uppercase tracking-wider text-primary font-semibold">
                    <span className={`w-1.5 h-1.5 rounded-full ${dish.diet === 'veg' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                    <span>{dish.tag}</span>
                  </div>
                  <span className="font-mono text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-obsidian/80 text-on-surface/70 border border-outline/20">
                    {dish.craftTelemetry}
                  </span>
                </div>

                {/* Bottom Dish Information & 1-Tap Quick Add */}
                <div className="absolute bottom-2.5 left-2.5 right-2.5 z-10">
                  <span className="font-mono text-[8px] sm:text-[9px] uppercase tracking-widest text-primary/80 block mb-0.5">
                    {dish.category}
                  </span>
                  <h4 className="font-serif text-xs sm:text-sm lg:text-base text-on-surface font-medium leading-snug line-clamp-1 mb-1">
                    {dish.name}
                  </h4>
                  <div className="flex items-center justify-between pt-1 border-t border-outline/15">
                    <span className="font-mono text-xs sm:text-sm text-primary font-bold">
                      {formatPrice(dish.price)}
                    </span>
                    <button
                      type="button"
                      aria-label={`Add ${dish.name} to order`}
                      onClick={(e) => handleQuickAdd(e, dish)}
                      className="px-2.5 py-1 rounded-full bg-primary text-on-primary font-sans font-semibold text-[11px] sm:text-xs flex items-center gap-1 shadow-[0_0_12px_rgba(var(--color-primary-rgb),0.4)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-xs">add</span>
                      <span>{t('menu.add', 'ADD')}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Telemetry & Navigation Instructions */}
      <div className="relative z-10 pt-3 border-t border-outline/15 flex flex-wrap items-center justify-between gap-3 font-mono text-[10px] tracking-[0.2em] uppercase text-on-surface/50">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-xs text-primary animate-pulse">drag_indicator</span>
          <span>{t('curvedReel.dragHint', 'DRAG OR SWIPE TO SPIN • HOVER TO PAUSE • CLICK CARD FOR CRAFT NOTES')}</span>
        </div>
        <div className="flex items-center gap-2 text-primary font-semibold">
          <span>8 {t('curvedReel.badge', 'SIGNATURE CREATIONS')}</span>
          <span>•</span>
          <span>{t('curvedReel.addToOrder', 'TAP ADD TO ORDER')}</span>
        </div>
      </div>

      {/* Sensory Dish Detail Modal */}
      {selectedDish && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dish-modal-title"
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
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
              <span className="material-symbols-outlined text-sm">close</span>
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
                <span className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface-obsidian/80 text-on-surface/80 border border-outline/20">
                  {selectedDish.craftTelemetry}
                </span>
              </div>
            </div>

            {/* Title & Category */}
            <div className="mb-4">
              <span className="font-mono text-[10px] uppercase tracking-widest text-primary/80 block mb-1">
                {selectedDish.category} • {selectedDish.accentNote}
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

            {/* Sensory Tri-Spectrum Craft Strip */}
            <div className="mb-5 p-3 rounded-xl bg-surface-container-lowest/80 border border-outline/20 space-y-2 font-mono text-[9px] uppercase tracking-wider">
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
                <span className="material-symbols-outlined text-sm">add_shopping_cart</span>
                <span>{t('curvedReel.addToOrder', 'Add to Order')} · {formatPrice(selectedDish.price)}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
