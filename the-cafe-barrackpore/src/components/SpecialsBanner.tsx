import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useCart } from '../context/CartContext';
import { useUI } from '../context/UIContext';
import { useSiteConfig } from '../context/SiteConfigContext';
import { useMenuAvailability } from '../hooks/useMenuAvailability';
import { formatCurrency } from '../utils/currency';
import { SectionReveal } from './SectionReveal';
import { getAvifSource } from '../utils/image';
import type { SpecialCombo, SpecialBadge } from '../services/siteContentService';
import type { SpecialsVariant } from '../types/restaurantEngine';
import {
  DEFAULT_SPECIAL_COMBOS,
  DEFAULT_SPECIAL_BADGES,
} from '../services/siteContentService';

interface PlatterTelemetrySpec {
  editionCode: string;
  tempValue: string;
  tempUnit: string;
  methodLabel: string;
  needleAngle: number; // degrees (-110 to +110)
  ledCount: number; // 1..5
  stats: { label: string; value: number }[];
}

const PLATTER_TELEMETRY: PlatterTelemetrySpec[] = [
  {
    editionCode: 'EDITION #01',
    tempValue: '290',
    tempUnit: '°C WOK',
    methodLabel: 'HIGH-FLAME CARBON STEEL',
    needleAngle: 65,
    ledCount: 4,
    stats: [
      { label: 'UMAMI & WOK HEI', value: 98 },
      { label: 'CRISP TEXTURE', value: 96 },
      { label: 'SHAREABILITY', value: 99 },
    ],
  },
  {
    editionCode: 'EDITION #02',
    tempValue: '450',
    tempUnit: '°C CHAR',
    methodLabel: 'CLAY OVEN EMBER',
    needleAngle: 95,
    ledCount: 5,
    stats: [
      { label: 'CHARCOAL SMOKE', value: 99 },
      { label: 'SPICE DEPTH', value: 96 },
      { label: 'TENDERNESS', value: 98 },
    ],
  },
  {
    editionCode: 'EDITION #03',
    tempValue: '185',
    tempUnit: '°C BOWL',
    methodLabel: 'SLOW-SIMMERED BROTH',
    needleAngle: -35,
    ledCount: 3,
    stats: [
      { label: 'AROMATIC BALANCE', value: 97 },
      { label: 'COMFORT SCORE', value: 99 },
      { label: 'PORTION VALUE', value: 98 },
    ],
  },
];

export const SpecialsBanner: React.FC = () => {
  const { addToCart } = useCart();
  const { showToast } = useUI();
  const { specials, formatPrice, restaurantConfig, engineConfig } = useSiteConfig();
  const { isAvailable } = useMenuAvailability();
  const [recentlyAddedComboId, setRecentlyAddedComboId] = useState<string | null>(null);
  const [activePlatterIdx, setActivePlatterIdx] = useState<number>(0);

  // Section visibility check
  if (specials?.enabled === false || engineConfig?.sections?.specialsBanner === false) {
    return null;
  }

  const specialsVariant: SpecialsVariant = engineConfig?.variants?.specials || 'horizontal-platters';

  const combos: SpecialCombo[] = (specials?.combos && specials.combos.length > 0)
    ? specials.combos
    : (specials as any)?.items && (specials as any).items.length > 0
    ? (specials as any).items
    : DEFAULT_SPECIAL_COMBOS;

  const badges: SpecialBadge[] = (specials?.badges && specials.badges.length > 0)
    ? specials.badges
    : DEFAULT_SPECIAL_BADGES;

  const eyebrow = specials?.eyebrow || "Chef's Signature Banquets";
  const title = specials?.title || 'Special Banquet & Hangout Platters';
  const description = specials?.description || (specials as any)?.subtitle ||
    'Generous sharing platters with sizzling pan-Asian or smoky clay oven selections, made fresh to order.';

  const activeTelemetry = PLATTER_TELEMETRY[activePlatterIdx % PLATTER_TELEMETRY.length];

  const handleAddCombo = (combo: SpecialCombo) => {
    if (!isAvailable(combo.id)) return;
    setRecentlyAddedComboId(combo.id);
    setTimeout(() => {
      setRecentlyAddedComboId((curr) => (curr === combo.id ? null : curr));
    }, 850);
    addToCart({
      id: combo.id,
      name: combo.name,
      category: combo.category,
      category_id: combo.category,
      diet: combo.diet,
      price: combo.price,
      description: combo.description,
      popular: true,
      available: true,
      sort_order: 99,
    });
    showToast({
      title: 'Added to Order',
      message: combo.name,
      subtext: `${formatPrice(combo.price)} • Chef's Banquet Special`,
      type: 'success',
    });
  };

  // Compatibility alias for addItem
  const addItem = (item: { id: string; name: string; price: number; category: string; diet?: 'veg' | 'nv' | 'all'; description: string; image: string }) => {
    const matchedCombo: SpecialCombo = combos.find((c) => c.id === item.id) || {
      id: item.id,
      name: item.name,
      category: item.category,
      diet: (item.diet as 'veg' | 'nv' | 'all') || 'nv',
      price: item.price,
      description: item.description,
      image: item.image,
      badge: 'BANQUET',
      serves: '2-3 Guests',
    };
    handleAddCombo(matchedCombo);
  };
  void addItem; // Prevent unused variable warning
  void formatCurrency;

  const renderDietaryIndicator = (diet?: string) => {
    if (restaurantConfig.dietary.system === 'india') {
      return (
        <div
          className={`w-3 h-3 rounded-xs border flex items-center justify-center ${
            diet === 'all' ? 'border-emerald-500/80' : 'border-red-500/80'
          }`}
          title={diet === 'all' ? 'Veg Option Available' : 'Non-Vegetarian'}
        >
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              diet === 'all' ? 'bg-emerald-500' : 'bg-red-500'
            }`}
          />
        </div>
      );
    }
    return (
      <span className="text-[9px] font-bold text-on-surface/80 tracking-wider">
        {diet === 'all' ? 'VEG OPT' : 'NON-VEG'}
      </span>
    );
  };

  const masterPlatter = combos[0];
  const companionPlatters = combos.slice(1);

  return (
    <section id="chef-specials" className="w-full pt-12 sm:pt-14 lg:pt-16 pb-16 sm:pb-20 lg:pb-22 bg-background relative border-t border-outline/15 scroll-mt-28 overflow-hidden">
      {/* Ambient Radial Backdrop Glow */}
      {engineConfig?.theme?.ambience?.meshGlow !== false && (
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[750px] h-[450px] bg-primary/5 blur-[140px] rounded-full pointer-events-none" 
          aria-hidden="true" 
        />
      )}

      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10 flex flex-col gap-10 lg:gap-12">
        
        {/* Top Row: Narrative and Philosophy with Viewport Reveal + Valmora Tachometer */}
        <SectionReveal className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-outline/15 pb-8">
          <div className="flex flex-col gap-3 max-w-2xl">
            <div className="inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="font-mono text-[9px] sm:text-[10px] tracking-[0.24em] uppercase text-primary/80">
                ACT V • THE SHARED TABLE
              </span>
              <span className="text-outline/40">•</span>
              <span className="editorial-eyebrow">{eyebrow}</span>
            </div>
            
            <h3 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-on-surface font-normal tracking-tight leading-[1.15] text-balance">
              {title}
            </h3>
            
            <p className="font-sans text-sm sm:text-base text-on-surface/75 leading-relaxed font-light mt-1">
              {description}
            </p>

            {/* Platter Trust Badges */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0 mt-2">
              {badges.map((badge, idx) => (
                <div
                  key={badge.text || idx}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-container border border-outline/25 text-xs text-on-surface/80 font-normal tracking-wide shadow-xs"
                >
                  {badge.icon && (
                    <span className="material-symbols-outlined text-sm font-light text-primary">{badge.icon}</span>
                  )}
                  <span>{badge.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Valmora-Inspired Live Analog Firing Tachometer */}
          <div className="flex items-center gap-5 px-5 py-4 rounded-2xl bg-surface-obsidian/90 border border-primary/30 shadow-[0_16px_45px_rgba(0,0,0,0.75)] self-start lg:self-end">
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full border border-outline/35 bg-background flex items-center justify-center shrink-0">
              {/* Top 5 Shift Indicator LEDs */}
              <div className="absolute top-2 flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((led) => (
                  <span
                    key={led}
                    className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                      led <= activeTelemetry.ledCount
                        ? 'bg-primary shadow-[0_0_8px_rgb(var(--color-primary-rgb))]'
                        : 'bg-outline/30'
                    }`}
                  />
                ))}
              </div>

              <svg viewBox="0 0 100 100" className="w-full h-full p-2">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="rgb(var(--color-primary))"
                  strokeOpacity="0.22"
                  strokeWidth="1.2"
                  strokeDasharray="2 4"
                />
                <g
                  style={{
                    transform: `rotate(${activeTelemetry.needleAngle}deg)`,
                    transformOrigin: '50px 50px',
                    transition: 'transform 650ms cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  <line
                    x1="50"
                    y1="54"
                    x2="50"
                    y2="15"
                    stroke="rgb(var(--color-primary))"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <circle cx="50" cy="50" r="3.5" fill="rgb(var(--color-primary))" />
                </g>
              </svg>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-primary font-semibold">
                  KITCHEN SPEC
                </span>
                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-bold">
                  {activeTelemetry.editionCode}
                </span>
              </div>
              <div className="font-serif text-2xl sm:text-3xl text-on-surface leading-tight mt-0.5">
                {activeTelemetry.tempValue}
                <span className="italic font-light text-primary text-base ml-1">
                  {activeTelemetry.tempUnit}
                </span>
              </div>
              <div className="font-mono text-[10px] tracking-[0.16em] uppercase text-on-surface/55 mt-0.5">
                {activeTelemetry.methodLabel}
              </div>
            </div>
          </div>
        </SectionReveal>

        {/* ------------------------------------------------------------------ */}
        {/* VARIANT A: HORIZONTAL PLATTERS (Distinct Panoramic Banquet Design) */}
        {/* ------------------------------------------------------------------ */}
        {specialsVariant === 'horizontal-platters' && combos.length >= 2 ? (
          <div className="flex flex-col gap-8">
            {/* 1. Master Sharing Banquet (Full Width Panoramic Showcase) */}
            {masterPlatter && (
              <div
                onMouseEnter={() => setActivePlatterIdx(0)}
                onFocus={() => setActivePlatterIdx(0)}
                className={`rounded-3xl lg:rounded-[2.5rem] bg-surface-container border transition-all duration-500 overflow-hidden group ${
                  activePlatterIdx === 0
                    ? 'border-primary/50 shadow-2xl -translate-y-0.5'
                    : 'border-outline/25 hover:border-primary/50 shadow-xl'
                }`}
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
                  {/* Left Column: Panoramic Gourmet Photography */}
                  <div className="lg:col-span-7 relative w-full aspect-[16/10] sm:aspect-[16/9] lg:aspect-auto min-h-[220px] max-h-[320px] sm:max-h-none lg:min-h-[440px] bg-surface-container-lowest overflow-hidden">
                    <picture className="absolute inset-0 w-full h-full">
                      {getAvifSource(masterPlatter.image) && (
                        <source srcSet={getAvifSource(masterPlatter.image)!} type="image/avif" />
                      )}
                      <img
                        src={masterPlatter.image}
                        alt={masterPlatter.name}
                        width="800"
                        height="500"
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform"
                      />
                    </picture>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-black/20 lg:to-surface-container pointer-events-none" />

                    {/* Spotlight Badges with Collectible Edition Pill */}
                    <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full bg-surface-obsidian/90 backdrop-blur-md border border-primary/40 text-[10px] uppercase tracking-widest text-primary font-semibold shadow-md">
                        {masterPlatter.badge}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-primary text-on-primary font-mono text-[10px] font-bold shadow-md">
                        {PLATTER_TELEMETRY[0].editionCode}
                      </span>
                    </div>

                    <div className="absolute top-4 right-4 z-10 flex items-center gap-2 px-3 py-1 rounded-full bg-surface-obsidian/90 backdrop-blur-md border border-outline/25 shadow-md">
                      {renderDietaryIndicator(masterPlatter.diet)}
                      <span className="text-[10px] font-sans text-on-surface/90 tracking-wider uppercase font-medium">
                        {masterPlatter.serves}
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Editorial Banquet Narrative & Oddball Stat Bars */}
                  <div className="lg:col-span-5 p-6 sm:p-8 lg:p-10 flex flex-col justify-between gap-6">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-[0.22em] text-primary font-semibold">
                          Master Banquet Selection
                        </span>
                        <span className="font-mono text-[9px] uppercase tracking-wider text-on-surface/40">
                          {PLATTER_TELEMETRY[0].editionCode}
                        </span>
                      </div>

                      <h4 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-on-surface font-normal tracking-tight group-hover:text-primary transition-colors">
                        {masterPlatter.name}
                      </h4>
                      <p className="font-sans text-sm sm:text-base text-on-surface/75 font-light leading-relaxed">
                        {masterPlatter.description}
                      </p>
                      
                      <div className="flex items-center gap-4 pt-1 text-xs font-mono text-on-surface-variant">
                        <span className="flex items-center gap-1.5 text-primary">
                          <span className="material-symbols-outlined text-sm">groups</span>
                          <span>{masterPlatter.serves}</span>
                        </span>
                        <span>•</span>
                        <span>Communal Feast</span>
                      </div>

                      {/* Oddball-Style RPG Sensory Stat Bars */}
                      <div className="mt-4 pt-3 border-t border-outline/15 space-y-2">
                        {PLATTER_TELEMETRY[0].stats.map((stat) => (
                          <div key={stat.label} className="space-y-0.5">
                            <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.16em] uppercase">
                              <span className="text-on-surface/65">{stat.label}</span>
                              <span className="text-primary font-bold">{stat.value}</span>
                            </div>
                            <div className="h-1 w-full rounded-full bg-surface-container-lowest overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all duration-700"
                                style={{ width: `${stat.value}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 pt-4 border-t border-outline/15">
                      <div className="font-serif text-3xl text-primary font-normal tabular-nums">
                        {formatPrice(masterPlatter.price)}
                      </div>

                      {isAvailable(masterPlatter.id) ? (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.96 }}
                          type="button"
                          onClick={() => handleAddCombo(masterPlatter)}
                          className={`h-11 px-6 rounded-full text-xs font-sans font-semibold uppercase tracking-[0.16em] transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
                            recentlyAddedComboId === masterPlatter.id
                              ? 'bg-primary text-on-primary shadow-[0_0_20px_rgba(var(--color-primary-rgb),0.6)] scale-[1.02]'
                              : 'bg-primary hover:bg-primary-fixed text-on-primary shadow-[0_2px_12px_rgba(var(--color-primary-rgb),0.25)] hover:shadow-[0_4px_16px_rgba(var(--color-primary-rgb),0.4)]'
                          }`}
                          title={`Add ${masterPlatter.name} to order`}
                        >
                          <span>{recentlyAddedComboId === masterPlatter.id ? 'Platter Added!' : 'Add Platter to Bag'}</span>
                          <span className={`material-symbols-outlined text-[16px] transition-transform ${recentlyAddedComboId === masterPlatter.id ? 'scale-110' : ''}`}>
                            {recentlyAddedComboId === masterPlatter.id ? 'check' : 'add_shopping_cart'}
                          </span>
                        </motion.button>
                      ) : (
                        <span className="badge-soldout">86'd · Sold Out</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Companion Platters Track (Mobile Snap Carousel with Card Peek + Desktop Grid) */}
            <div className="flex md:grid overflow-x-auto md:overflow-visible snap-x snap-mandatory md:snap-none hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 lg:gap-8 pb-2 md:pb-0">
              {companionPlatters.map((combo, idx) => {
                const platterIndex = idx + 1;
                const telemetry = PLATTER_TELEMETRY[platterIndex % PLATTER_TELEMETRY.length];
                const isJustAdded = recentlyAddedComboId === combo.id;
                const isSelected = activePlatterIdx === platterIndex;

                return (
                  <div
                    key={combo.id}
                    onMouseEnter={() => setActivePlatterIdx(platterIndex)}
                    onFocus={() => setActivePlatterIdx(platterIndex)}
                    className={`min-w-[82vw] sm:min-w-[340px] md:min-w-0 snap-center shrink-0 md:shrink rounded-3xl bg-surface-container border transition-all duration-300 overflow-hidden group flex flex-col sm:flex-row items-stretch hover:-translate-y-1.5 ${
                      isSelected
                        ? 'border-primary/50 shadow-xl'
                        : 'border-outline/25 hover:border-primary/50'
                    }`}
                  >
                    {/* Image Column */}
                    <div className="w-full sm:w-5/12 relative aspect-[16/10] sm:aspect-auto min-h-[190px] max-h-[240px] sm:max-h-none sm:min-h-[220px] bg-surface-container-lowest overflow-hidden shrink-0">
                      <picture className="absolute inset-0 w-full h-full">
                        {getAvifSource(combo.image) && (
                          <source srcSet={getAvifSource(combo.image)!} type="image/avif" />
                        )}
                        <img
                          src={combo.image}
                          alt={combo.name}
                          width="400"
                          height="300"
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform"
                        />
                      </picture>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-full bg-surface-obsidian/90 backdrop-blur-md border border-primary/40 text-[9px] uppercase tracking-wider text-primary font-semibold">
                          {combo.badge}
                        </span>
                        <span className="px-1.5 py-0.5 rounded-full bg-primary text-on-primary font-mono text-[9px] font-bold">
                          {telemetry.editionCode}
                        </span>
                      </div>
                    </div>

                    {/* Content Column */}
                    <div className="w-full sm:w-7/12 p-4 sm:p-6 flex flex-col justify-between gap-3 sm:gap-4 min-w-0">
                      <div className="flex flex-col gap-1.5 min-w-0">
                        <div className="flex items-center justify-between gap-2 min-w-0">
                          <h4 className="font-serif text-xl sm:text-2xl text-on-surface font-normal group-hover:text-primary transition-colors truncate">
                            {combo.name}
                          </h4>
                          {renderDietaryIndicator(combo.diet)}
                        </div>
                        <p className="font-sans text-xs text-on-surface/75 font-light leading-relaxed line-clamp-2">
                          {combo.description}
                        </p>
                        <span className="text-[10px] font-mono text-primary/80 uppercase tracking-wider">
                          {combo.serves}
                        </span>

                        {/* Oddball-Style RPG Sensory Stat Bars */}
                        <div className="mt-2.5 pt-2 border-t border-outline/15 space-y-1.5">
                          {telemetry.stats.map((stat) => (
                            <div key={stat.label} className="space-y-0.5">
                              <div className="flex items-center justify-between font-mono text-[9px] tracking-wider uppercase">
                                <span className="text-on-surface/65">{stat.label}</span>
                                <span className="text-primary font-bold">{stat.value}</span>
                              </div>
                              <div className="h-1 w-full rounded-full bg-surface-container-lowest overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full transition-all duration-700"
                                  style={{ width: `${stat.value}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-3 border-t border-outline/15 w-full">
                        <div className="font-serif text-xl sm:text-2xl text-primary font-normal tabular-nums shrink-0">
                          {formatPrice(combo.price)}
                        </div>

                        {isAvailable(combo.id) ? (
                          <motion.button
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.95 }}
                            type="button"
                            onClick={() => handleAddCombo(combo)}
                            className={`h-9 min-h-[44px] sm:min-h-0 px-3.5 sm:px-4 rounded-full text-[11px] font-sans font-semibold uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer shrink-0 ${
                              isJustAdded
                                ? 'bg-primary text-on-primary shadow-sm scale-105'
                                : 'bg-primary hover:bg-primary-fixed text-on-primary shadow-xs'
                            }`}
                            title={`Add ${combo.name} to order`}
                          >
                            <span>{isJustAdded ? 'Added' : 'Add +'}</span>
                          </motion.button>
                        ) : (
                          <span className="badge-soldout text-[10px] py-1 px-2.5">86'd</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile Companion Platters Discovery Hint */}
            {companionPlatters.length > 1 && (
              <div className="flex md:hidden items-center justify-center gap-2 -mt-1 text-[11px] font-sans text-on-surface/65">
                <span className="material-symbols-outlined text-xs text-primary animate-pulse">swipe</span>
                <span>Swipe to view all {companionPlatters.length} companion platters</span>
              </div>
            )}
          </div>
        ) : (
          /* ------------------------------------------------------------------ */
          /* VARIANT B: CLASSIC / MOBILE SNAP GRID (Fallback 3-Column Grid)     */
          /* ------------------------------------------------------------------ */
          <div className="flex md:grid overflow-x-auto md:overflow-visible snap-x snap-mandatory hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 lg:gap-8 pb-2 md:pb-0">
            {combos.map((combo, index) => {
              const isJustAdded = recentlyAddedComboId === combo.id;
              const isSelected = activePlatterIdx === index;
              const telemetry = PLATTER_TELEMETRY[index % PLATTER_TELEMETRY.length];

              return (
                <div
                  key={combo.id}
                  onMouseEnter={() => setActivePlatterIdx(index)}
                  onFocus={() => setActivePlatterIdx(index)}
                  className={`min-w-[85vw] max-w-[340px] sm:min-w-[320px] md:min-w-0 md:max-w-none snap-center shrink-0 group rounded-3xl bg-surface-container border transition-all duration-300 flex flex-col overflow-hidden hover:-translate-y-1.5 active:scale-[0.98] ${
                    isSelected
                      ? 'border-primary/50 shadow-2xl'
                      : 'border-outline/25 hover:border-primary/70 shadow-xl'
                  }`}
                >
                  <div className="flex flex-col h-full">
                    {/* Photo Container */}
                    <div className="relative aspect-[16/11] w-full min-h-[190px] max-h-[250px] md:max-h-none overflow-hidden bg-surface-container-lowest">
                      <picture className="absolute inset-0 w-full h-full">
                        {getAvifSource(combo.image) && (
                          <source srcSet={getAvifSource(combo.image)!} type="image/avif" />
                        )}
                        <img
                          src={combo.image}
                          alt={combo.name}
                          width="500"
                          height="340"
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover object-center transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.08] will-change-transform"
                        />
                      </picture>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />

                      <div className="absolute top-3.5 left-3.5 z-10 flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full bg-surface-obsidian/90 backdrop-blur-md border border-primary/40 text-[10px] uppercase tracking-wider text-primary font-semibold">
                          {combo.badge}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-primary text-on-primary font-mono text-[9px] font-bold">
                          {telemetry.editionCode}
                        </span>
                      </div>

                      <div className="absolute top-3.5 right-3.5 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-obsidian/90 backdrop-blur-md border border-outline/25">
                        {renderDietaryIndicator(combo.diet)}
                        <span className="text-[10px] font-sans text-on-surface/80 tracking-wider uppercase font-medium">
                          {combo.serves}
                        </span>
                      </div>
                    </div>

                    {/* Card Content & Action */}
                    <div className="p-5 sm:p-6 flex flex-col justify-between flex-1 gap-4 bg-gradient-to-b from-surface-container to-surface-container-lowest">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-baseline justify-between gap-2">
                          <h4 className="font-serif text-xl sm:text-2xl text-on-surface font-normal group-hover:text-primary transition-colors tracking-tight">
                            {combo.name}
                          </h4>
                          <div className="font-serif text-2xl text-primary font-normal tabular-nums shrink-0">
                            {formatPrice(combo.price)}
                          </div>
                        </div>

                        <p className="font-sans text-xs sm:text-[13px] text-on-surface/70 leading-relaxed font-light">
                          {combo.description}
                        </p>

                        {/* Oddball-Style RPG Sensory Stat Bars */}
                        <div className="mt-3 pt-3 border-t border-outline/15 space-y-2">
                          {telemetry.stats.map((stat) => (
                            <div key={stat.label} className="space-y-0.5">
                              <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.16em] uppercase">
                                <span className="text-on-surface/65">{stat.label}</span>
                                <span className="text-primary font-bold">{stat.value}</span>
                              </div>
                              <div className="h-1 w-full rounded-full bg-surface-container-lowest overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full transition-all duration-700"
                                  style={{ width: `${stat.value}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {isAvailable(combo.id) ? (
                        <button
                          type="button"
                          onClick={() => handleAddCombo(combo)}
                          className={`w-full h-11 sm:h-10 min-h-[44px] sm:min-h-0 px-5 rounded-full text-xs font-sans font-semibold uppercase tracking-[0.16em] transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 cursor-pointer ${
                            isJustAdded
                              ? 'bg-primary text-on-primary shadow-[0_0_20px_rgba(var(--color-primary-rgb),0.6)] scale-[1.02]'
                              : 'bg-primary hover:bg-primary-fixed text-on-primary shadow-[0_2px_12px_rgba(var(--color-primary-rgb),0.25)] hover:shadow-[0_4px_16px_rgba(var(--color-primary-rgb),0.4)]'
                          }`}
                          title={`Add ${combo.name} to order`}
                        >
                          <span>{isJustAdded ? 'Platter Added!' : 'Add Platter to Bag'}</span>
                          <span className={`material-symbols-outlined text-[16px] transition-transform ${isJustAdded ? 'scale-110' : ''}`}>
                            {isJustAdded ? 'check' : 'add_shopping_cart'}
                          </span>
                        </button>
                      ) : (
                        <div className="w-full py-2.5 text-center font-mono text-xs tracking-widest text-on-surface/40 uppercase bg-surface-container-lowest/60 rounded-full border border-outline/20">
                          86'd · Sold Out
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
