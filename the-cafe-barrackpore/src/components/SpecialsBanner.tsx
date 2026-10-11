import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import { useUI } from '../context/UIContext';
import { useSiteConfig } from '../context/SiteConfigContext';
import { SectionReveal } from './SectionReveal';
import type { SpecialCombo, SpecialBadge } from '../services/siteContentService';
import type { SpecialsVariant } from '../types/restaurantEngine';
import {
  DEFAULT_SPECIAL_COMBOS,
  DEFAULT_SPECIAL_BADGES,
} from '../services/siteContentService';

export const SpecialsBanner: React.FC = () => {
  const { addToCart } = useCart();
  const { showToast } = useUI();
  const { specials, formatPrice, restaurantConfig, engineConfig } = useSiteConfig();
  const [recentlyAddedComboId, setRecentlyAddedComboId] = useState<string | null>(null);

  // Section visibility check
  if (specials?.enabled === false || engineConfig?.sections?.specialsBanner === false) {
    return null;
  }

  const specialsVariant: SpecialsVariant = engineConfig?.variants?.specials || 'horizontal-platters';

  const combos: SpecialCombo[] = (specials?.combos && specials.combos.length > 0)
    ? specials.combos
    : DEFAULT_SPECIAL_COMBOS;

  const badges: SpecialBadge[] = (specials?.badges && specials.badges.length > 0)
    ? specials.badges
    : DEFAULT_SPECIAL_BADGES;

  const eyebrow = specials?.eyebrow || "Chef's Signature Banquets";
  const title = specials?.title || 'Special Banquet & Hangout Platters';
  const description = specials?.description ||
    'Generous sharing platters with sizzling pan-Asian or smoky clay oven selections, made fresh to order.';

  const handleAddCombo = (combo: SpecialCombo) => {
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
    <section id="chef-specials" className="w-full py-20 lg:py-28 bg-background relative border-t border-outline/15 scroll-mt-28 overflow-hidden">
      {/* Ambient Radial Backdrop Glow */}
      {engineConfig?.theme?.ambience?.meshGlow !== false && (
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" 
          aria-hidden="true" 
        />
      )}

      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10 flex flex-col gap-10 lg:gap-12">
        
        {/* Top Row: Narrative and Philosophy with Viewport Reveal */}
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
          </div>

          {/* Platter Trust Badges */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
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
        </SectionReveal>

        {/* ------------------------------------------------------------------ */}
        {/* VARIANT A: HORIZONTAL PLATTERS (Distinct Panoramic Banquet Design) */}
        {/* ------------------------------------------------------------------ */}
        {specialsVariant === 'horizontal-platters' && combos.length >= 2 ? (
          <div className="flex flex-col gap-8">
            {/* 1. Master Sharing Banquet (Full Width Panoramic Showcase) */}
            {masterPlatter && (
              <div className="rounded-3xl lg:rounded-[2.5rem] bg-surface-container border border-outline/25 hover:border-primary/50 shadow-2xl transition-all duration-500 overflow-hidden group">
                <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
                  {/* Left Column: Panoramic Gourmet Photography */}
                  <div className="lg:col-span-7 relative min-h-[280px] sm:min-h-[340px] lg:min-h-[420px] bg-surface-container-lowest overflow-hidden">
                    <img
                      src={masterPlatter.image}
                      alt={masterPlatter.name}
                      width="800"
                      height="500"
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-black/20 lg:to-surface-container pointer-events-none" />

                    {/* Spotlight Badges */}
                    <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full bg-surface-obsidian/90 backdrop-blur-md border border-primary/40 text-[10px] uppercase tracking-widest text-primary font-semibold shadow-md">
                        {masterPlatter.badge}
                      </span>
                    </div>

                    <div className="absolute top-4 right-4 z-10 flex items-center gap-2 px-3 py-1 rounded-full bg-surface-obsidian/90 backdrop-blur-md border border-outline/25 shadow-md">
                      {renderDietaryIndicator(masterPlatter.diet)}
                      <span className="text-[10px] font-sans text-on-surface/90 tracking-wider uppercase font-medium">
                        {masterPlatter.serves}
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Editorial Banquet Narrative */}
                  <div className="lg:col-span-5 p-6 sm:p-8 lg:p-10 flex flex-col justify-between gap-6">
                    <div className="flex flex-col gap-3">
                      <span className="text-[10px] uppercase tracking-[0.22em] text-primary font-semibold">
                        Master Banquet Selection
                      </span>
                      <h4 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-on-surface font-normal tracking-tight group-hover:text-primary transition-colors">
                        {masterPlatter.name}
                      </h4>
                      <p className="font-sans text-sm sm:text-base text-on-surface/75 font-light leading-relaxed">
                        {masterPlatter.description}
                      </p>
                      
                      <div className="flex items-center gap-4 pt-2 text-xs font-mono text-on-surface-variant">
                        <span className="flex items-center gap-1.5 text-primary">
                          <span className="material-symbols-outlined text-sm">groups</span>
                          <span>{masterPlatter.serves}</span>
                        </span>
                        <span>•</span>
                        <span>Communal Feast</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 pt-4 border-t border-outline/15">
                      <div className="font-serif text-3xl text-primary font-normal tabular-nums">
                        {formatPrice(masterPlatter.price)}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddCombo(masterPlatter)}
                        className={`h-11 px-6 rounded-full text-xs font-sans font-semibold uppercase tracking-[0.16em] transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 cursor-pointer ${
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
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Companion Platters Track (Mobile Snap Carousel with Card Peek + Desktop Grid) */}
            <div className="flex md:grid overflow-x-auto md:overflow-visible snap-x snap-mandatory md:snap-none hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 lg:gap-8 pb-2 md:pb-0">
              {companionPlatters.map((combo) => {
                const isJustAdded = recentlyAddedComboId === combo.id;
                return (
                  <div
                    key={combo.id}
                    className="min-w-[82vw] sm:min-w-[340px] md:min-w-0 snap-center shrink-0 md:shrink rounded-3xl bg-surface-container border border-outline/25 hover:border-primary/50 shadow-xl transition-all duration-300 overflow-hidden group flex flex-col sm:flex-row items-stretch"
                  >
                    {/* Image Column */}
                    <div className="sm:w-5/12 relative min-h-[200px] sm:min-h-[220px] bg-surface-container-lowest overflow-hidden">
                      <img
                        src={combo.image}
                        alt={combo.name}
                        width="400"
                        height="300"
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-full bg-surface-obsidian/90 backdrop-blur-md border border-primary/40 text-[9px] uppercase tracking-wider text-primary font-semibold">
                          {combo.badge}
                        </span>
                      </div>
                    </div>

                    {/* Content Column */}
                    <div className="sm:w-7/12 p-5 sm:p-6 flex flex-col justify-between gap-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-serif text-xl sm:text-2xl text-on-surface font-normal group-hover:text-primary transition-colors">
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
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-3 border-t border-outline/15">
                        <div className="font-serif text-2xl text-primary font-normal tabular-nums">
                          {formatPrice(combo.price)}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAddCombo(combo)}
                          className={`h-10 sm:h-9 min-h-[44px] sm:min-h-0 px-4 rounded-full text-[11px] font-sans font-semibold uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer ${
                            isJustAdded
                              ? 'bg-primary text-on-primary shadow-sm scale-105'
                              : 'bg-primary hover:bg-primary-fixed text-on-primary shadow-xs'
                          }`}
                          title={`Add ${combo.name} to order`}
                        >
                          <span>{isJustAdded ? 'Added' : 'Add +'}</span>
                        </button>
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
          /* VARIANT B: CLASSIC / MOBILE SNAP GRID                              */
          /* ------------------------------------------------------------------ */
          <div className="flex md:grid overflow-x-auto md:overflow-visible snap-x snap-mandatory hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 lg:gap-8 pb-2 md:pb-0">
            {combos.map((combo) => {
              const isJustAdded = recentlyAddedComboId === combo.id;
              return (
                <div
                  key={combo.id}
                  className="min-w-[85vw] max-w-[340px] sm:min-w-[320px] md:min-w-0 md:max-w-none snap-center shrink-0 group rounded-3xl bg-surface-container border border-outline/25 hover:border-primary/70 shadow-xl transition-all duration-300 flex flex-col overflow-hidden hover:-translate-y-1.5 active:scale-[0.98]"
                >
                  <div className="flex flex-col h-full">
                    {/* Photo Container */}
                    <div className="relative aspect-[16/11] w-full overflow-hidden bg-surface-container-lowest">
                      <img
                        src={combo.image}
                        alt={combo.name}
                        width="500"
                        height="340"
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.08] will-change-transform"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />

                      <div className="absolute top-3.5 left-3.5 z-10 flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full bg-surface-obsidian/90 backdrop-blur-md border border-primary/40 text-[10px] uppercase tracking-wider text-primary font-semibold">
                          {combo.badge}
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
                    <div className="p-5 sm:p-6 flex flex-col justify-between flex-1 gap-5 bg-gradient-to-b from-surface-container to-surface-container-lowest">
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
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddCombo(combo)}
                        className={`w-full h-10 px-5 rounded-full text-xs font-sans font-semibold uppercase tracking-[0.16em] transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 cursor-pointer ${
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
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Mobile Carousel Swipe Indicator (only on smaller screens) */}
        <div className="flex md:hidden items-center justify-center gap-1.5 pt-2 text-[10px] uppercase tracking-wider text-primary/80 font-sans">
          <span className="material-symbols-outlined text-sm">swipe</span>
          <span>Swipe horizontally to view banquet platters</span>
        </div>

      </div>
    </section>
  );
};
