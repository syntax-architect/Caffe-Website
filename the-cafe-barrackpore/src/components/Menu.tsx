import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useDevice } from '../hooks/useDevice';
import { useCart } from '../context/CartContext';
import { useUI } from '../context/UIContext';
import { useMenuAvailability } from '../hooks/useMenuAvailability';
import { useSiteConfig } from '../context/SiteConfigContext';
import { SectionReveal } from './SectionReveal';
import {
  MENU_CATEGORIES_FALLBACK,
  MENU_ITEMS_FALLBACK,
} from '../data/menuFallbacks';
import type { MenuItem, MenuCategory } from '../types/menu';
import type { MenuVariant } from '../types/restaurantEngine';

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  'Burgers & Pizzas': 'Hand-stretched sourdough crusts flame-baked to crisp perfection & artisanal toasted brioche burgers.',
  'Starters & Momos': 'Delicate steamed Himalayan dim sums, golden hand-rolled crispy bites & clay-oven appetizers.',
  'Mains & Platters': 'Slow-simmered regional comforts, sizzling woks, and generous sharing banquets.',
  'Sips & Desserts': 'Single-origin espresso brews, botanical mocktails, and decadent twilight confections.',
  'Soups & Salads': 'Peppery restorative broths, fresh farm greens, and aromatic warm bowls.',
};

const getCategoryIcon = (categoryName: string): string => {
  const cat = categoryName?.toLowerCase() || '';
  if (cat.includes('burger') || cat.includes('pizza')) return 'local_pizza';
  if (cat.includes('starter') || cat.includes('momo')) return 'ramen_dining';
  if (cat.includes('main') || cat.includes('platter')) return 'skillet';
  if (cat.includes('sip') || cat.includes('dessert') || cat.includes('coffee')) return 'local_cafe';
  if (cat.includes('soup') || cat.includes('salad')) return 'soup_kitchen';
  return 'restaurant_menu';
};

interface FloatingMenuPreviewProps {
  imageSrc: string | null;
}

const FloatingMenuPreview: React.FC<FloatingMenuPreviewProps> = React.memo(({ imageSrc }) => {
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!imageSrc) return;

    let rafId: number | null = null;
    let targetX = 0;
    let targetY = 0;

    const onMouseMove = (e: MouseEvent) => {
      targetX = e.clientX + 20;
      targetY = e.clientY + 20;
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          if (imgRef.current) {
            imgRef.current.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
          }
          rafId = null;
        });
      }
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [imageSrc]);

  if (!imageSrc) return null;

  return (
    <img
      ref={imgRef}
      src={imageSrc}
      loading="lazy"
      decoding="async"
      width="256"
      height="256"
      alt="Menu Preview"
      className="hidden lg:block fixed top-0 left-0 z-[100] w-64 h-64 object-cover rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 pointer-events-none will-change-transform animate-fade-in"
      style={{
        transform: 'translate3d(-9999px, -9999px, 0)',
      }}
    />
  );
});

export const Menu: React.FC = () => {
  const [categories, setCategories] = useState<MenuCategory[]>(MENU_CATEGORIES_FALLBACK);
  const [activeCategoryId, setActiveCategoryId] = useState<string>(
    MENU_CATEGORIES_FALLBACK[0]?.id || 'burgers-pizzas'
  );
  const [menuItems, setMenuItems] = useState<MenuItem[]>(MENU_ITEMS_FALLBACK);
  const [isLoading, setIsLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(6);
  const [isVegOnly, setIsVegOnly] = useState(false);
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);

  const [hoveredImage, setHoveredImage] = useState<string | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const categoryBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const { isTouchDevice } = useDevice();
  const { addToCart } = useCart();
  const { showToast } = useUI();
  const { isAvailable } = useMenuAvailability();
  const { formatPrice, restaurantConfig, engineConfig } = useSiteConfig();
  const menuVariant: MenuVariant = engineConfig?.variants?.menu || 'sensory-ledger';
  const menuSectionConfig = engineConfig?.menu;

  // Load categories and items from Supabase tables & subscribe to Realtime updates
  useEffect(() => {
    let isMounted = true;
    let unsubscribe: () => void = () => {};

    const loadData = async () => {
      try {
        const { fetchMenuCategories, fetchMenuItems } = await import('../services/menuService');
        const [cats, items] = await Promise.all([
          fetchMenuCategories(),
          fetchMenuItems(),
        ]);
        if (!isMounted) return;

        if (Array.isArray(cats) && cats.length > 0) {
          setCategories(cats);
          setActiveCategoryId((prev) =>
            cats.some((c) => c.id === prev) ? prev : cats[0].id
          );
        }

        if (Array.isArray(items) && items.length > 0) {
          setMenuItems(items);
        }
      } catch (err) {
        console.warn('[Menu] Failed to load menu from Supabase, using fallback:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    const initDataAndRealtime = async () => {
      await loadData();
      if (!isMounted) return;
      try {
        const { subscribeToMenuRealtime } = await import('../services/menuService');
        unsubscribe = subscribeToMenuRealtime(() => {
          loadData();
        });
      } catch {
        // Fallback gracefully
      }
    };

    const isPublicPage = typeof window !== 'undefined' && !window.location.pathname.startsWith('/staff');
    if (isPublicPage) {
      return;
    }

    // On staff management routes, load dynamic menu and subscribe to realtime updates
    initDataAndRealtime();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Monitor category scroll position to toggle navigation chevrons and gradient edge masks
  const checkScroll = () => {
    const el = categoryScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 8);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 8);
  };

  useEffect(() => {
    const el = categoryScrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [categories]);

  const scrollCategories = (direction: 'left' | 'right') => {
    const el = categoryScrollRef.current;
    if (!el) return;
    const scrollAmount = direction === 'left' ? -220 : 220;
    el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  const handleSelectCategory = (catId: string) => {
    setActiveCategoryId(catId);
    setVisibleCount(6);
    setIsCategoryPickerOpen(false);
    const btn = categoryBtnRefs.current[catId];
    if (btn) {
      btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  };

  const activeCategoryObj =
    categories.find((c) => c.id === activeCategoryId) || categories[0];
  const activeCategoryName = activeCategoryObj?.name || 'Burgers & Pizzas';

  const filteredMenu = menuItems.filter((item) => {
    const categoryMatch =
      item.category_id === activeCategoryId ||
      item.category === activeCategoryId ||
      item.category === activeCategoryName;
    const isVeg = item.diet === 'veg' || item.diet === 'vegan';
    const vegMatch = isVegOnly ? isVeg : true;
    return categoryMatch && vegMatch;
  });

  const featuredConfigId = menuSectionConfig?.featuredItemId;
  const featuredConfigImage = menuSectionConfig?.featuredImage;

  const featuredItem = useMemo(() => {
    if (filteredMenu.length === 0) return null;

    const hasRealImage = (item: MenuItem) =>
      Boolean(
        (item.id === featuredConfigId && featuredConfigImage) ||
        item.image_url ||
        item.image
      );

    // 1. Configured featured item IF it is available in filteredMenu AND has a usable real image
    if (featuredConfigId) {
      const configuredWithImage = filteredMenu.find(
        (item) => item.id === featuredConfigId && item.available && isAvailable(item.id) && hasRealImage(item)
      );
      if (configuredWithImage) return configuredWithImage;
    }

    // 2. First available popular item in the category with an authentic image
    const popularWithImage = filteredMenu.find(
      (item) => item.popular && item.available && isAvailable(item.id) && hasRealImage(item)
    );
    if (popularWithImage) return popularWithImage;

    // 3. First available item in the category with an authentic image
    const availableWithImage = filteredMenu.find(
      (item) => item.available && isAvailable(item.id) && hasRealImage(item)
    );
    if (availableWithImage) return availableWithImage;

    // 4. If no item in this category has an authentic image:
    // 4a. Check if the configured item is present and available (even without image)
    if (featuredConfigId) {
      const configuredNoImage = filteredMenu.find(
        (item) => item.id === featuredConfigId && item.available && isAvailable(item.id)
      );
      if (configuredNoImage) return configuredNoImage;
    }

    // 4b. First available popular item
    const firstPopular = filteredMenu.find(
      (item) => item.popular && item.available && isAvailable(item.id)
    );
    if (firstPopular) return firstPopular;

    // 4c. First available item
    const firstAvailable = filteredMenu.find(
      (item) => item.available && isAvailable(item.id)
    );
    if (firstAvailable) return firstAvailable;

    // 5. Ultimate fallback to first item in filtered list
    return filteredMenu[0] || null;
  }, [filteredMenu, featuredConfigId, featuredConfigImage, isAvailable]);

  // Resolve sensory tasting notes, beverage pairing, and eyebrow for the selected item
  // Ensures metadata STRICTLY corresponds to the resolved featuredItem (no carryover on fallbacks)
  const activeSensoryMetadata = useMemo(() => {
    if (!featuredItem) return null;

    // 1. Direct item property (e.g. from menu item data model)
    const itemNotes = featuredItem.tasting_notes;
    const itemPairing = featuredItem.pairing;

    // 2. Stable item ID dictionary in menuSectionConfig
    const mappedMeta = menuSectionConfig?.itemsMetadata?.[featuredItem.id];
    const mappedNotes = mappedMeta?.tastingNotes;
    const mappedPairing = mappedMeta?.pairing;

    // 3. Section config top-level metadata — ONLY if the selected item is the configured item!
    const isConfiguredItem = Boolean(featuredConfigId && featuredItem.id === featuredConfigId);
    const configNotes = isConfiguredItem ? menuSectionConfig?.featuredTastingNotes : undefined;
    const configPairing = isConfiguredItem ? menuSectionConfig?.featuredPairing : undefined;

    // Check if item is explicitly designated as a chef signature
    const isExplicitSignature = Boolean(
      isConfiguredItem ||
      (mappedMeta as unknown as { isSignature?: boolean })?.isSignature ||
      (mappedMeta?.eyebrow && /signature/i.test(mappedMeta.eyebrow)) ||
      (featuredItem as unknown as { is_signature?: boolean; isSignature?: boolean }).is_signature ||
      (featuredItem as unknown as { is_signature?: boolean; isSignature?: boolean }).isSignature
    );

    const tastingNotes = itemNotes || mappedNotes || configNotes || null;
    const pairing = itemPairing || mappedPairing || configPairing || null;
    const eyebrow =
      mappedMeta?.eyebrow ||
      (isConfiguredItem ? menuSectionConfig?.featuredEyebrow : null) ||
      (isExplicitSignature ? "Chef's Signature Selection" : "Featured in this category");

    return {
      tastingNotes,
      pairing,
      eyebrow,
      isExplicitSignature,
    };
  }, [featuredItem, featuredConfigId, menuSectionConfig]);

  const ledgerItems = useMemo(() => {
    if (!featuredItem) return filteredMenu;
    return filteredMenu.filter((i) => i.id !== featuredItem.id);
  }, [filteredMenu, featuredItem]);

  const displayedCatalogMenu = filteredMenu.slice(0, visibleCount);
  const displayedLedgerItems = ledgerItems.slice(0, visibleCount);

  const hasMore =
    menuVariant === 'sensory-ledger'
      ? visibleCount < ledgerItems.length
      : visibleCount < filteredMenu.length;

  const handleAddToCart = (e: React.MouseEvent, item: MenuItem) => {
    e.stopPropagation();
    const isOrderingActive = restaurantConfig.isOrderingEnabled !== false;
    const itemAvailable = item.available && isAvailable(item.id);
    if (!itemAvailable || !isOrderingActive) return;

    setRecentlyAddedId(item.id);
    setTimeout(() => {
      setRecentlyAddedId((curr) => (curr === item.id ? null : curr));
    }, 850);

    const displayImage = item.image_url || item.image;
    addToCart({
      id: item.id,
      name: item.name,
      price: item.price,
      image: displayImage,
      category_id: item.category_id,
      category: item.category_id,
      diet: item.diet,
      description: item.description,
      popular: item.popular,
      available: item.available,
      sort_order: item.sort_order,
    });
    showToast({
      title: 'Added to Order',
      message: item.name,
      subtext: `${formatPrice(item.price)}`,
      type: 'success',
    });
  };

  const renderDietaryBadge = (item: MenuItem) => {
    if (!item.diet || item.diet === 'all') return null;

    if (restaurantConfig.dietary.system === 'india') {
      return (
        <div
          className={`w-3.5 h-3.5 rounded-sm border shrink-0 flex items-center justify-center ${
            item.diet === 'veg' || item.diet === 'vegan'
              ? 'border-emerald-500/80'
              : 'border-red-500/80'
          }`}
          title={
            item.diet === 'veg'
              ? 'Vegetarian'
              : item.diet === 'vegan'
              ? 'Vegan'
              : 'Non-Vegetarian'
          }
        >
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              item.diet === 'veg' || item.diet === 'vegan'
                ? 'bg-emerald-500'
                : 'bg-red-500'
            }`}
          />
        </div>
      );
    }

    return (
      <span
        className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase shrink-0 border ${
          item.diet === 'veg'
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            : item.diet === 'vegan'
            ? 'bg-teal-500/10 text-teal-400 border-teal-500/30'
            : 'bg-stone-500/10 text-stone-300 border-stone-500/30'
        }`}
        title={
          item.diet === 'veg'
            ? 'Vegetarian'
            : item.diet === 'vegan'
            ? 'Vegan'
            : 'Non-Vegetarian'
        }
      >
        {item.diet === 'veg'
          ? 'Veg'
          : item.diet === 'vegan'
          ? 'Vegan'
          : 'Non-Veg'}
      </span>
    );
  };

  return (
    <section className="w-full pt-14 md:pt-20 pb-10 md:pb-12 bg-background scroll-mt-28" id="menu-section">
      <div className="max-w-[1320px] mx-auto px-4 md:px-6 lg:px-12 flex flex-col gap-8 md:gap-12 relative">
        {/* Floating Image (Desktop Only - Isolated RAF GPU Transform) */}
        {!isTouchDevice && <FloatingMenuPreview imageSrc={hoveredImage} />}

        <SectionReveal
          className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-8"
        >
          <div>
            <div className="inline-flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="editorial-eyebrow">Curated Gastronomy</span>
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-on-surface font-normal tracking-tight">
              The Culinary Collection
            </h2>
          </div>

          <div className="flex flex-col items-start md:items-end gap-3.5 mt-2 md:mt-0 w-full md:w-auto">
            {/* Top Controls Row: Pure Veg Toggle + Mobile All Categories Quick Picker */}
            <div className="flex items-center justify-between w-full md:w-auto gap-3">
              {/* Pure Veg Toggle Switch */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`material-symbols-outlined text-sm transition-colors ${
                      isVegOnly ? 'text-emerald-400' : 'text-on-surface/60'
                    }`}
                  >
                    eco
                  </span>
                  <span
                    className={`font-sans text-xs uppercase tracking-wider transition-colors ${
                      isVegOnly ? 'text-emerald-400 font-semibold' : 'text-on-surface/60'
                    }`}
                  >
                    Pure Veg Only
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsVegOnly(!isVegOnly)}
                  role="switch"
                  aria-checked={isVegOnly}
                  aria-label="Filter vegetarian only items"
                  className={`w-11 h-6 rounded-full p-0.5 transition-all duration-300 ease-in-out flex items-center border cursor-pointer ${
                    isVegOnly
                      ? 'bg-emerald-500/20 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.25)]'
                      : 'bg-surface-elevated/40 border-outline/25'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full shadow-sm transition-transform duration-200 ease-out ${
                      isVegOnly ? 'bg-emerald-400 translate-x-5' : 'bg-on-surface/50 translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Mobile Quick Category Selector Dropdown Button */}
              <div className="relative md:hidden">
                <button
                  type="button"
                  onClick={() => setIsCategoryPickerOpen(!isCategoryPickerOpen)}
                  className="px-3 py-1.5 rounded-full bg-surface-container border border-primary/40 text-primary text-xs font-sans font-medium flex items-center gap-1.5 active:scale-95 shadow-sm hover:border-primary transition-all cursor-pointer"
                  aria-label="View all categories"
                  aria-expanded={isCategoryPickerOpen}
                >
                  <span className="material-symbols-outlined text-[15px]">menu_book</span>
                  <span>Categories ({categories.length})</span>
                  <span
                    className="material-symbols-outlined text-sm transition-transform duration-200"
                    style={{ transform: isCategoryPickerOpen ? 'rotate(180deg)' : 'none' }}
                  >
                    expand_more
                  </span>
                </button>

                {/* Mobile Quick Category Dropdown Menu */}
                {isCategoryPickerOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsCategoryPickerOpen(false)}
                      aria-hidden="true"
                    />
                    <div className="absolute right-0 top-full mt-2 z-50 w-64 p-2 rounded-2xl bg-surface-obsidian/98 backdrop-blur-2xl border border-primary/50 shadow-[0_12px_40px_rgba(0,0,0,0.85)] animate-fade-in flex flex-col gap-1">
                      <div className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-primary font-semibold border-b border-outline/15 flex items-center justify-between">
                        <span>All Categories</span>
                        <span>{categories.length} Total</span>
                      </div>
                      {categories.map((cat) => {
                        const isActive = activeCategoryId === cat.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => handleSelectCategory(cat.id)}
                            className={`px-3 py-2 rounded-xl text-xs font-sans text-left flex items-center justify-between transition-colors cursor-pointer ${
                              isActive
                                ? 'bg-primary/20 text-primary font-bold border border-primary/40'
                                : 'text-on-surface/80 hover:bg-surface-elevated/50 hover:text-on-surface'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-sm">{getCategoryIcon(cat.name)}</span>
                              <span>{cat.name}</span>
                            </span>
                            {isActive && <span className="material-symbols-outlined text-xs text-primary">check</span>}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Mobile Category Discovery Hint */}
            <div className="flex md:hidden items-center justify-between w-full px-0.5 text-[11px] font-sans text-on-surface/65">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="font-medium text-on-surface/80">{categories.length} Categories</span>
              </span>
              <span className="flex items-center gap-1 text-primary text-[10px] uppercase tracking-wider font-semibold">
                <span>Swipe or tap arrows</span>
                <span className="material-symbols-outlined text-xs animate-pulse">arrow_forward</span>
              </span>
            </div>

            {/* Horizontally Scrollable Category Pills with Tap Chevrons & Gradient Edge Masks */}
            <div className="relative w-full md:w-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              {/* Left Scroll Chevron & Gradient Mask */}
              {canScrollLeft && (
                <div className="absolute left-0 top-0 bottom-0 z-20 flex items-center pl-1 sm:pl-0 pr-5 bg-gradient-to-r from-background via-background/95 to-transparent pointer-events-none">
                  <button
                    type="button"
                    onClick={() => scrollCategories('left')}
                    aria-label="Scroll to previous categories"
                    className="w-7 h-7 rounded-full bg-surface-container/95 border border-primary/40 text-primary flex items-center justify-center pointer-events-auto shadow-lg hover:scale-110 active:scale-95 transition-transform cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">chevron_left</span>
                  </button>
                </div>
              )}

              {/* Scroll Container */}
              <div
                ref={categoryScrollRef}
                className="w-full md:w-auto overflow-x-auto hide-scrollbar scroll-smooth"
              >
                <div className="flex items-center gap-2 pb-1">
                  {categories.map((category) => {
                    const isActive = activeCategoryId === category.id;
                    return (
                      <button
                        key={category.id}
                        ref={(el) => { categoryBtnRefs.current[category.id] = el; }}
                        type="button"
                        onClick={() => handleSelectCategory(category.id)}
                        className={`px-3.5 sm:px-4 py-2 rounded-full font-sans text-xs uppercase tracking-wider transition-all duration-200 whitespace-nowrap cursor-pointer border flex items-center gap-1.5 active:scale-95 shrink-0 ${
                          isActive
                            ? 'bg-primary text-on-primary border-primary font-bold shadow-[0_2px_12px_rgba(var(--color-primary-rgb),0.35)]'
                            : 'bg-surface-container-low/80 text-on-surface-variant border-outline/20 hover:border-primary/40 hover:text-on-surface'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[15px]">
                          {getCategoryIcon(category.name)}
                        </span>
                        <span>{category.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Scroll Chevron & Gradient Mask */}
              {canScrollRight && (
                <div className="absolute right-0 top-0 bottom-0 z-20 flex items-center pr-1 sm:pr-0 pl-5 bg-gradient-to-l from-background via-background/95 to-transparent pointer-events-none">
                  <button
                    type="button"
                    onClick={() => scrollCategories('right')}
                    aria-label="Scroll to more categories"
                    className="w-7 h-7 rounded-full bg-surface-container/95 border border-primary/40 text-primary flex items-center justify-center pointer-events-auto shadow-lg hover:scale-110 active:scale-95 transition-transform cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </SectionReveal>

        {/* Category Narrative Lead */}
        {CATEGORY_DESCRIPTIONS[activeCategoryName] && (
          <div
            key={activeCategoryName}
            className="flex items-center gap-3 -mt-4 mb-1 animate-fade-in"
          >
            <span className="w-8 h-[1px] bg-primary/40 hidden sm:block" />
            <p className="font-serif italic text-sm sm:text-base text-primary/85 font-light">
              {CATEGORY_DESCRIPTIONS[activeCategoryName]}
            </p>
          </div>
        )}

        {restaurantConfig.isOrderingEnabled === false && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
              <div>
                <p className="text-sm font-semibold text-white">Online Ordering is Temporarily Paused</p>
                <p className="text-xs text-on-surface/70 mt-0.5">
                  Browse our artisanal menu below. In-person dining and counter service remain active.
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-flex px-3 py-1 rounded-full text-[11px] uppercase tracking-wider font-semibold bg-primary/15 text-primary border border-primary/30">
              Browsing Mode
            </span>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse bg-surface-container/60 border border-outline/15 rounded-2xl h-52"
              />
            ))}
          </div>
        ) : menuVariant === 'sensory-ledger' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
            {/* Left Column: Signature Showcase (lg:col-span-5) */}
            {featuredItem && (
              <div className="lg:col-span-5 w-full lg:sticky lg:top-28">
                {(() => {
                  const itemAvailable = featuredItem.available && isAvailable(featuredItem.id);
                  const isOrderingActive = restaurantConfig.isOrderingEnabled !== false;
                  const canAdd = itemAvailable && isOrderingActive;
                  const isJustAdded = recentlyAddedId === featuredItem.id;
                  const displayImage =
                    (featuredItem.id === featuredConfigId && featuredConfigImage) ||
                    featuredItem.image_url ||
                    featuredItem.image;

                  return (
                    <div
                      onMouseEnter={() => {
                        if (isTouchDevice || !displayImage) return;
                        setHoveredImage(displayImage);
                      }}
                      onMouseLeave={() => setHoveredImage(null)}
                      className={`relative p-6 sm:p-8 rounded-3xl bg-surface-container border border-outline/30 hover:border-primary/60 shadow-xl transition-all duration-300 ease-out group flex flex-col justify-between overflow-hidden ${
                        itemAvailable
                          ? 'cursor-pointer'
                          : 'opacity-75 grayscale-[25%] bg-surface-container-lowest/80 border-outline/20'
                      }`}
                    >
                      {/* Top Subtle Amber Glow Line on Hover */}
                      <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-primary/0 group-hover:via-primary/80 to-transparent transition-all duration-500 pointer-events-none" />

                      <div>
                        {/* Signature Food Photography Frame OR Compact Editorial Fallback */}
                        {displayImage ? (
                          <div className="w-full aspect-[16/10] sm:aspect-[4/3] rounded-2xl overflow-hidden relative bg-surface-container-lowest shadow-md mb-6 group/img">
                            <img
                              src={displayImage}
                              alt={featuredItem.name}
                              width="600"
                              height="450"
                              className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out will-change-transform"
                              loading="eager"
                              decoding="async"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />

                            {/* Spotlight Crest Badge */}
                            <div className="absolute top-3 left-3 flex items-center gap-2">
                              <span className="px-3 py-1 rounded-full text-[10px] uppercase tracking-widest font-semibold bg-primary text-on-primary shadow-lg flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-xs">auto_awesome</span>
                                <span>{activeSensoryMetadata?.eyebrow || (activeSensoryMetadata?.isExplicitSignature ? "Chef's Signature Selection" : "Featured in this category")}</span>
                              </span>
                            </div>

                            {!itemAvailable && (
                              <div className="absolute top-3 right-3">
                                <span className="badge-soldout shadow-lg">86'd · Sold Out</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Compact Editorial Fallback: Elegant Crest without large empty placeholder */
                          <div className="mb-4">
                            <span className="px-3 py-1 rounded-full text-[10px] uppercase tracking-widest font-semibold bg-primary/10 text-primary border border-primary/25 inline-flex items-center gap-1.5 shadow-xs">
                              <span className="material-symbols-outlined text-xs">auto_awesome</span>
                              <span>{activeSensoryMetadata?.eyebrow || (activeSensoryMetadata?.isExplicitSignature ? "Chef's Signature Selection" : "Featured in this category")}</span>
                            </span>
                          </div>
                        )}

                        {/* Dish Identity Header */}
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {renderDietaryBadge(featuredItem)}
                            <h3
                              className={`font-serif text-2xl sm:text-3xl font-normal leading-tight transition-colors ${
                                itemAvailable
                                  ? 'text-on-surface group-hover:text-primary'
                                  : 'text-on-surface/50 line-through'
                              }`}
                            >
                              {featuredItem.name}
                            </h3>
                          </div>

                          {/* Signature Pick badge only rendered when item is an explicit signature */}
                          {activeSensoryMetadata?.isExplicitSignature && featuredItem.popular && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-widest font-semibold bg-primary/15 text-primary border border-primary/30 shrink-0">
                              Signature Pick
                            </span>
                          )}
                        </div>

                        {/* Description */}
                        {featuredItem.description && (
                          <p className="font-sans text-[13px] sm:text-sm text-on-surface/80 leading-relaxed font-light mb-4">
                            {featuredItem.description}
                          </p>
                        )}

                        {/* Curated Tasting Notes - De-nested editorial presentation */}
                        {activeSensoryMetadata?.tastingNotes && (
                          <div className="mb-3 text-xs sm:text-[13px] font-sans text-on-surface/90 flex items-baseline gap-2">
                            <span className="text-[10px] uppercase tracking-wider text-primary font-semibold shrink-0 inline-flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px]">award_star</span>
                              <span>Notes:</span>
                            </span>
                            <span className="font-serif italic">{activeSensoryMetadata.tastingNotes}</span>
                          </div>
                        )}

                        {/* Curated Beverage Pairing - De-nested editorial presentation */}
                        {activeSensoryMetadata?.pairing && (
                          <div className="mb-4 flex items-center gap-2 text-xs sm:text-[13px] text-on-surface/85">
                            <span className="material-symbols-outlined text-sm text-primary">local_bar</span>
                            <span className="font-sans italic">{activeSensoryMetadata.pairing}</span>
                          </div>
                        )}

                        {/* Allergen Tags */}
                        {featuredItem.allergens && featuredItem.allergens.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap mb-4" aria-label="Allergen warnings">
                            <span className="text-[10px] text-amber-400/90 font-medium tracking-wider uppercase inline-flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[13px] text-amber-400">warning</span>
                              <span>Allergens:</span>
                            </span>
                            {featuredItem.allergens.map((allergen) => (
                              <span
                                key={allergen}
                                className="px-1.5 py-0.5 rounded text-[9px] font-sans font-medium tracking-wide bg-amber-500/10 text-amber-300 border border-amber-500/25"
                              >
                                {allergen}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Bottom Row: Price & Primary Cart Action */}
                      <div className="flex items-center justify-between gap-4 pt-4 border-t border-outline/20 mt-2">
                        <div className="font-serif text-2xl sm:text-3xl text-primary font-normal tabular-nums">
                          {formatPrice(featuredItem.price)}
                        </div>

                        <button
                          disabled={!canAdd}
                          type="button"
                          className={`h-11 sm:h-10 min-h-[44px] px-5 sm:px-6 rounded-full text-xs font-sans font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-200 active:scale-95 ${
                            !canAdd
                              ? 'bg-surface-elevated/40 border border-outline/20 text-on-surface-variant/40 cursor-not-allowed'
                              : isJustAdded
                              ? 'bg-primary text-on-primary border border-primary shadow-[0_0_20px_rgba(var(--color-primary-rgb),0.6)] scale-105'
                              : 'bg-primary text-on-primary hover:bg-primary/90 border border-primary shadow-lg hover:shadow-[0_4px_20px_rgba(var(--color-primary-rgb),0.4)] cursor-pointer hover:scale-[1.02]'
                          }`}
                          title={
                            !itemAvailable
                              ? "Item is temporarily unavailable (86'd)"
                              : !isOrderingActive
                              ? "Online ordering is temporarily paused by the restaurant"
                              : `Add ${featuredItem.name} to order`
                          }
                          onClick={(e) => handleAddToCart(e, featuredItem)}
                        >
                          <span className={`material-symbols-outlined text-base transition-transform ${isJustAdded ? 'scale-110' : ''}`}>
                            {!itemAvailable ? 'block' : !isOrderingActive ? 'pause_circle' : isJustAdded ? 'check' : 'shopping_bag'}
                          </span>
                          <span>
                            {!itemAvailable ? 'Sold Out' : !isOrderingActive ? 'Paused' : isJustAdded ? 'Added' : 'Add to Order'}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Right Column: Editorial Menu Ledger (lg:col-span-7) */}
            <div className={featuredItem ? "lg:col-span-7 w-full flex flex-col gap-4" : "lg:col-span-12 w-full flex flex-col gap-4"}>
              {displayedLedgerItems.length === 0 ? (
                <div className="rounded-3xl bg-surface-container/30 border border-outline/25 p-8 sm:p-12 text-center flex flex-col items-center justify-center min-h-[260px] text-on-surface/70">
                  <span className="material-symbols-outlined text-4xl mb-3 text-primary/70 font-light">restaurant</span>
                  <p className="font-serif text-xl text-on-surface">Artisanal Solo Spotlight</p>
                  <p className="font-sans text-xs sm:text-sm text-on-surface/60 mt-1.5 max-w-sm">
                    This creation headlines the category. Additional pairings and seasonal recipes will be introduced soon.
                  </p>
                </div>
              ) : (
                <div className="rounded-3xl bg-surface-container/30 border border-outline/25 p-5 sm:p-7 shadow-lg flex flex-col divide-y divide-outline/10">
                  {displayedLedgerItems.map((item) => {
                    const itemAvailable = item.available && isAvailable(item.id);
                    const isOrderingActive = restaurantConfig.isOrderingEnabled !== false;
                    const canAdd = itemAvailable && isOrderingActive;
                    const isJustAdded = recentlyAddedId === item.id;
                    const displayImage = item.image_url || item.image;

                    return (
                      <div
                        key={item.id}
                        onMouseEnter={() => {
                          if (isTouchDevice || !displayImage) return;
                          setHoveredImage(displayImage);
                        }}
                        onMouseLeave={() => setHoveredImage(null)}
                        className={`py-4 sm:py-5 first:pt-0 last:pb-0 flex flex-col gap-2 group transition-colors duration-200 rounded-xl px-2 sm:px-3 -mx-2 sm:-mx-3 hover:bg-surface-elevated/25 ${
                          itemAvailable ? '' : 'opacity-65 grayscale-[30%]'
                        }`}
                      >
                        {/* Ledger Primary Line: Name, Diet, Dotted Leader, Price, Add Button */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4">
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            <div className="pt-1 shrink-0">
                              {renderDietaryBadge(item)}
                            </div>

                            <div className="flex items-baseline gap-2 flex-wrap min-w-0">
                              <h4
                                className={`font-serif text-base sm:text-lg font-medium leading-snug transition-colors ${
                                  itemAvailable
                                    ? 'text-on-surface group-hover:text-primary'
                                    : 'text-on-surface/50 line-through'
                                }`}
                              >
                                {item.name}
                              </h4>

                              {item.popular && (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] uppercase tracking-widest font-semibold bg-primary/15 text-primary border border-primary/30 shrink-0 self-center">
                                  Chef's Pick
                                </span>
                              )}

                              {!itemAvailable && (
                                <span className="badge-soldout shrink-0 text-[10px] self-center">86'd</span>
                              )}
                            </div>

                            {/* Editorial Dotted Hairline Leader Line (lg screen space permitting) */}
                            <div className="hidden lg:block flex-1 border-b border-dotted border-outline/30 mx-3 min-w-[28px] self-center" />
                          </div>

                          {/* Price & Tactile Add Button */}
                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-0.5 self-end sm:self-auto w-full sm:w-auto">
                            <span className="font-serif text-base sm:text-lg text-primary font-normal tabular-nums">
                              {formatPrice(item.price)}
                            </span>

                            <button
                              disabled={!canAdd}
                              type="button"
                              className={`h-9 min-w-[64px] px-3.5 sm:h-7 sm:min-w-0 sm:px-3 rounded-full text-[11px] font-sans font-semibold uppercase tracking-wider flex items-center justify-center gap-1 transition-all duration-200 active:scale-95 shrink-0 ${
                                !canAdd
                                  ? 'bg-surface-elevated/40 border border-outline/20 text-on-surface-variant/40 cursor-not-allowed'
                                  : isJustAdded
                                  ? 'bg-primary text-on-primary border border-primary shadow-[0_0_14px_rgba(var(--color-primary-rgb),0.6)] scale-105'
                                  : 'bg-primary/10 hover:bg-primary text-primary hover:text-on-primary border border-primary/30 hover:border-primary shadow-xs hover:shadow-[0_2px_10px_rgba(var(--color-primary-rgb),0.35)] cursor-pointer hover:scale-105'
                              }`}
                              title={
                                !itemAvailable
                                  ? "Item is temporarily unavailable (86'd)"
                                  : !isOrderingActive
                                  ? "Online ordering is temporarily paused by the restaurant"
                                  : `Add ${item.name} to order`
                              }
                              onClick={(e) => handleAddToCart(e, item)}
                            >
                              <span className={`material-symbols-outlined text-[14px] transition-transform ${isJustAdded ? 'scale-110' : ''}`}>
                                {!itemAvailable ? 'block' : !isOrderingActive ? 'pause_circle' : isJustAdded ? 'check' : 'add'}
                              </span>
                              <span>{!itemAvailable ? 'Sold Out' : !isOrderingActive ? 'Paused' : isJustAdded ? 'Added' : 'Add'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Ledger Secondary Details: Description & Allergens */}
                        <div className="flex items-start justify-between gap-3 pl-6">
                          <div className="flex-1 min-w-0">
                            {item.description && (
                              <p className="font-sans text-[13px] sm:text-sm text-on-surface/75 leading-relaxed font-light">
                                {item.description}
                              </p>
                            )}

                            {item.allergens && item.allergens.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap mt-1.5" aria-label="Allergen warnings">
                                <span className="text-[10px] text-amber-400/90 font-medium tracking-wider uppercase inline-flex items-center gap-0.5">
                                  <span className="material-symbols-outlined text-[12px] text-amber-400">warning</span>
                                  <span>Allergens:</span>
                                </span>
                                {item.allergens.map((allergen) => (
                                  <span
                                    key={allergen}
                                    className="px-1.5 py-0.5 rounded text-[9px] font-sans font-medium tracking-wide bg-amber-500/10 text-amber-300 border border-amber-500/25"
                                  >
                                    {allergen}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Inline Mobile Thumbnail Preview */}
                          {displayImage && (
                            <div className="w-10 h-10 sm:hidden rounded-lg overflow-hidden shrink-0 border border-outline/25 bg-surface-container-lowest">
                              <img
                                src={displayImage}
                                alt={item.name}
                                width="40"
                                height="40"
                                className="w-full h-full object-cover"
                                loading="lazy"
                                decoding="async"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {displayedCatalogMenu.map((item) => {
              const itemAvailable = item.available && isAvailable(item.id);
              const displayImage = item.image_url || item.image;
              const isOrderingActive = restaurantConfig.isOrderingEnabled !== false;
              const canAdd = itemAvailable && isOrderingActive;
              const isJustAdded = recentlyAddedId === item.id;

              return (
                <div
                  key={item.id}
                  onMouseEnter={() => {
                    if (isTouchDevice || !displayImage) return;
                    setHoveredImage(displayImage);
                  }}
                  onMouseLeave={() => setHoveredImage(null)}
                  className={`relative p-4 sm:p-6 rounded-2xl bg-gradient-to-br from-surface-container via-surface-obsidian to-surface-container-lowest border border-outline/30 hover:border-primary/80 shadow-lg hover:shadow-[0_16px_36px_rgba(0,0,0,0.4),0_0_20px_rgba(var(--color-primary-rgb),0.18)] transition-all duration-300 ease-out group flex flex-col justify-between gap-3.5 sm:gap-4 overflow-hidden active:scale-[0.98] hover:-translate-y-1.5 ${
                    itemAvailable
                      ? 'cursor-pointer'
                      : 'opacity-65 grayscale-[30%] bg-surface-container-lowest/80 border-outline/20'
                  }`}
                >
                  {/* Top Subtle Amber Glow Line on Hover */}
                  <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-primary/0 group-hover:via-primary/90 to-transparent transition-all duration-500 pointer-events-none" />

                  {/* Top Row: Name, Diet Icon, Sold Out & Mobile Thumbnail / Gastronomic Crest */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {renderDietaryBadge(item)}

                        <h3
                          className={`font-serif text-base sm:text-lg font-medium leading-snug transition-colors ${
                            itemAvailable
                              ? 'text-on-surface group-hover:text-primary'
                              : 'text-on-surface/50 line-through'
                          }`}
                        >
                          {item.name}
                        </h3>

                        {item.popular && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] uppercase tracking-widest font-semibold bg-primary/15 text-primary border border-primary/30 shadow-xs">
                            Chef's Pick
                          </span>
                        )}

                        {!itemAvailable && (
                          <span className="badge-soldout">86'd · Sold Out</span>
                        )}
                      </div>

                      {/* Description */}
                      {item.description && (
                        <p className="font-sans text-xs sm:text-sm text-on-surface/65 leading-relaxed font-light line-clamp-2 mt-1">
                          {item.description}
                        </p>
                      )}

                      {/* Allergen Tags */}
                      {item.allergens && item.allergens.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap mt-2" aria-label="Allergen warnings">
                          <span className="text-[10px] text-amber-400/90 font-medium tracking-wider uppercase inline-flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[13px] text-amber-400">warning</span>
                            <span>Allergens:</span>
                          </span>
                          {item.allergens.map((allergen) => (
                            <span
                              key={allergen}
                              className="px-1.5 py-0.5 rounded text-[9px] font-sans font-medium tracking-wide bg-amber-500/10 text-amber-300 border border-amber-500/25"
                            >
                              {allergen}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Photography image OR Gastronomic Category Crest */}
                    {displayImage ? (
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden shrink-0 border border-primary/30 bg-surface-container-lowest shadow-md">
                        <img
                          src={displayImage}
                          alt={item.name}
                          width="64"
                          height="64"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                    ) : (
                      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-primary/15 via-surface-container to-surface-obsidian border border-primary/30 flex items-center justify-center text-primary group-hover:scale-105 group-hover:bg-primary/25 transition-all duration-300 shrink-0 shadow-md">
                        <span className="material-symbols-outlined text-lg sm:text-xl font-light">
                          {getCategoryIcon(activeCategoryName)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Bottom Row: Price & Tactile Action Button */}
                  <div className="flex items-center justify-between gap-4 pt-3 border-t border-outline/15">
                    <div className="font-serif text-xl sm:text-2xl text-primary font-normal tabular-nums">
                      {formatPrice(item.price)}
                    </div>

                    <button
                      disabled={!canAdd}
                      type="button"
                      className={`h-8 px-4 rounded-full text-xs font-sans font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all duration-200 active:scale-95 ${
                        !canAdd
                          ? 'bg-surface-elevated/40 border border-outline/20 text-on-surface-variant/40 cursor-not-allowed'
                          : isJustAdded
                          ? 'bg-primary text-on-primary border border-primary shadow-[0_0_18px_rgba(var(--color-primary-rgb),0.6)] scale-105'
                          : 'bg-primary/10 hover:bg-primary text-primary hover:text-on-primary border border-primary/30 hover:border-primary shadow-sm hover:shadow-[0_2px_12px_rgba(var(--color-primary-rgb),0.35)] cursor-pointer hover:scale-105'
                      }`}
                      title={
                        !itemAvailable
                          ? "Item is temporarily unavailable (86'd)"
                          : !isOrderingActive
                          ? "Online ordering is temporarily paused by the restaurant"
                          : `Add ${item.name} to order`
                      }
                      onClick={(e) => handleAddToCart(e, item)}
                    >
                      <span className={`material-symbols-outlined text-[15px] transition-transform ${isJustAdded ? 'scale-110' : ''}`}>
                        {!itemAvailable ? 'block' : !isOrderingActive ? 'pause_circle' : isJustAdded ? 'check' : 'add'}
                      </span>
                      <span>{!itemAvailable ? 'Sold Out' : !isOrderingActive ? 'Paused' : isJustAdded ? 'Added' : 'Add'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!isLoading && (hasMore || visibleCount > 6) && (
          <div
            className="flex justify-center gap-4 mt-6 md:mt-8"
          >
            {visibleCount > 6 && (
              <button
                type="button"
                onClick={() => {
                  setVisibleCount(6);
                  const menuEl = document.getElementById('menu-section');
                  if (menuEl) {
                    const y = menuEl.getBoundingClientRect().top + window.scrollY - 80;
                    window.scrollTo({ top: y, behavior: 'smooth' });
                  }
                }}
                className="h-11 px-7 rounded-full border border-outline/30 text-on-surface/80 hover:bg-surface-elevated/40 hover:text-on-surface transition-all text-xs font-sans font-semibold tracking-wider uppercase cursor-pointer active:scale-95"
              >
                Show Less
              </button>
            )}

            {hasMore && (
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + 6)}
                className="h-11 px-7 rounded-full btn-outline-premium text-xs font-semibold cursor-pointer active:scale-95"
              >
                Load More Items
              </button>
            )}
          </div>
        )}

        {!isLoading && filteredMenu.length === 0 && (
          <div className="py-20 flex flex-col items-center justify-center text-on-surface/75">
            <span className="material-symbols-outlined text-4xl mb-4 opacity-50">
              search_off
            </span>
            <p className="font-body-lg">No culinary creations found in this category.</p>
          </div>
        )}
      </div>
    </section>
  );
};
