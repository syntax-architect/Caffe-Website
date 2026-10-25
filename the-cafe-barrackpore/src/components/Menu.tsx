import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion } from 'motion/react';
import { useDevice } from '../hooks/useDevice';
import { useCart } from '../context/CartContext';
import { useUI } from '../context/UIContext';
import { useMenuAvailability } from '../hooks/useMenuAvailability';
import { useSiteConfig } from '../context/SiteConfigContext';
import { SectionReveal } from './SectionReveal';
import { CurvedMenuReel } from './CurvedMenuReel';
import {
  MENU_CATEGORIES_FALLBACK,
  MENU_ITEMS_FALLBACK,
} from '../data/menuFallbacks';
import type { MenuItem, MenuCategory } from '../types/menu';
import type { MenuVariant } from '../types/restaurantEngine';
import { useI18n } from '../i18n';
import { isCinematicExperience } from '../config/client';

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  'Burgers & Pizzas': 'Hand-stretched sourdough crusts flame-baked to crisp perfection & artisanal toasted brioche burgers.',
  'Starters & Momos': 'Delicate steamed Himalayan dim sums, golden hand-rolled crispy bites & clay-oven appetizers.',
  'Mains & Platters': 'Slow-simmered regional comforts, sizzling woks, and generous sharing banquets.',
  'Sips & Desserts': 'Single-origin espresso brews, botanical mocktails, and decadent twilight confections.',
  'Soups & Salads': 'Peppery restorative broths, fresh farm greens, and aromatic warm bowls.',
};

export const CategoryIcon: React.FC<{ name?: string; className?: string }> = ({ name = '', className = 'w-4 h-4' }) => {
  const cat = name.toLowerCase();
  if (cat.includes('burger') || cat.includes('pizza')) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 20c3.3 1.4 6.7 1.4 10 0 3.3 1.4 6.7 1.4 10 0L12 2z" />
        <circle cx="12" cy="10" r="1.2" fill="currentColor" />
        <circle cx="9.5" cy="15.5" r="1.1" fill="currentColor" />
        <circle cx="14.5" cy="15" r="1.1" fill="currentColor" />
      </svg>
    );
  }
  if (cat.includes('starter') || cat.includes('momo') || cat.includes('dim sum')) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 14c0 4.2 3.6 7.5 8 7.5s8-3.3 8-7.5c0-4-3-6-8-6s-8 2-8 6z" />
        <path d="M12 8V5.5c0-.8-.7-1.5-1.5-1.5s-1.5.7-1.5 1.5" />
        <path d="M8 14c1.2-1 2.5-1.5 4-1.5s2.8.5 4 1.5" />
      </svg>
    );
  }
  if (cat.includes('main') || cat.includes('platter') || cat.includes('curry')) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 18h18" />
        <path d="M4 18a8 8 0 0 1 16 0" />
        <circle cx="12" cy="7" r="1.5" />
        <path d="M7 21h10" />
      </svg>
    );
  }
  if (cat.includes('sip') || cat.includes('dessert') || cat.includes('coffee') || cat.includes('drink')) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 8h1a4 4 0 0 1 0 8h-1" />
        <path d="M3 8h14v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z" />
        <path d="M6 2v3" />
        <path d="M10 2v3" />
        <path d="M14 2v3" />
      </svg>
    );
  }
  if (cat.includes('soup') || cat.includes('salad') || cat.includes('bowl')) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11c0 5 4 9 9 9s9-4 9-9H3z" />
        <path d="M8 3c0 1.5-1 2.5-1 4" />
        <path d="M12 2c0 2-1 3-1 5" />
        <path d="M16 3c0 1.5-1 2.5-1 4" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2" />
      <path d="M15 2v20" />
      <path d="M6 2v20" />
      <path d="M6 7h4a2 2 0 0 0 2-2V2H6v5z" />
    </svg>
  );
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

export interface MenuProps {
  forcedVariant?: MenuVariant;
  isQrMode?: boolean;
}

export const Menu: React.FC<MenuProps> = ({ forcedVariant, isQrMode = false }) => {
  const [categories, setCategories] = useState<MenuCategory[]>(MENU_CATEGORIES_FALLBACK);
  const [activeCategoryId, setActiveCategoryId] = useState<string>(
    MENU_CATEGORIES_FALLBACK[0]?.id || 'burgers-pizzas'
  );
  const [menuItems, setMenuItems] = useState<MenuItem[]>(MENU_ITEMS_FALLBACK);
  const [isLoading, setIsLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(isQrMode ? 24 : 6);
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
  const { t, language } = useI18n();

  const getCategoryName = useCallback((cat?: MenuCategory) => {
    if (!cat) return '';
    return cat.translations?.[language]?.name || cat.name;
  }, [language]);

  const getItemName = useCallback((item?: MenuItem | null) => {
    if (!item) return '';
    return item.translations?.[language]?.name || item.name;
  }, [language]);

  const getItemDescription = useCallback((item?: MenuItem | null) => {
    if (!item) return '';
    return item.translations?.[language]?.description || item.description;
  }, [language]);

  const menuVariant: MenuVariant = forcedVariant || engineConfig?.variants?.menu || 'sensory-ledger';
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

    // Setup live menu update subscriptions and storage listeners across tabs
    const handleStorageUpdate = (e: StorageEvent) => {
      if (e.key === 'cafe_menu_update_event' || e.key === 'cafe_demo_menu_items') {
        loadData();
      }
    };
    const handleCustomUpdate = () => {
      loadData();
    };

    window.addEventListener('storage', handleStorageUpdate);
    window.addEventListener('cafe:menu-updated', handleCustomUpdate);

    initDataAndRealtime();

    return () => {
      isMounted = false;
      unsubscribe();
      window.removeEventListener('storage', handleStorageUpdate);
      window.removeEventListener('cafe:menu-updated', handleCustomUpdate);
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

    const localizedName = getItemName(item);
    const localizedDesc = getItemDescription(item);
    const displayImage = item.image_url || item.image;
    addToCart({
      id: item.id,
      name: localizedName,
      price: item.price,
      image: displayImage,
      category_id: item.category_id,
      category: item.category_id,
      diet: item.diet,
      description: localizedDesc,
      popular: item.popular,
      available: item.available,
      sort_order: item.sort_order,
    });
    showToast({
      title: t('menu.addedToOrder', 'Added to Order'),
      message: localizedName,
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
    <section className={`w-full ${isQrMode ? 'pt-2 md:pt-4 pb-12' : 'pt-12 md:pt-20 pb-10 md:pb-12'} bg-background scroll-mt-28`} id="menu-section">
      <div className="max-w-[1320px] mx-auto px-4 md:px-6 lg:px-12 flex flex-col gap-6 md:gap-8 relative">
        {/* Floating Image (Desktop Only - Isolated RAF GPU Transform) */}
        {!isTouchDevice && <FloatingMenuPreview imageSrc={hoveredImage} />}

        <SectionReveal className="flex flex-col gap-5 md:gap-6 border-b border-white/10 pb-6">
          {/* Header Row: Title on Left, Pure Veg Toggle & Mobile Picker on Right */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="editorial-eyebrow">{isQrMode ? t('menu.artisanalSelection', 'Artisanal Table Selection') : t('menu.curatedGastronomy', 'Curated Gastronomy')}</span>
              </div>
              <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-on-surface font-normal tracking-tight">
                {isQrMode ? t('menu.title', 'Explore The Menu') : t('menu.culinaryCollection', 'The Culinary Collection')}
              </h2>
            </div>

            {/* Controls: Pure Veg Switch & Mobile Category Picker */}
            <div className="flex items-center gap-3 self-start sm:self-end">
              {/* Pure Veg Toggle Switch */}
              <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-surface-container-low/80 border border-outline/25 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <svg
                    className={`w-3.5 h-3.5 transition-colors shrink-0 ${
                      isVegOnly ? 'text-emerald-400' : 'text-on-surface/60'
                    }`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
                    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
                  </svg>
                  <span
                    className={`font-sans text-[11px] font-semibold tracking-wider uppercase transition-colors ${
                      isVegOnly ? 'text-emerald-400' : 'text-on-surface/65'
                    }`}
                  >
                    {t('menu.pureVegOnly', 'Pure Veg Only')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsVegOnly(!isVegOnly)}
                  role="switch"
                  aria-checked={isVegOnly}
                  aria-label={t('menu.filterVeg', 'Filter vegetarian only items')}
                  className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 ease-in-out flex items-center border cursor-pointer ${
                    isVegOnly
                      ? 'bg-emerald-500/20 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.25)]'
                      : 'bg-surface-elevated/40 border-outline/25'
                  }`}
                >
                  <div
                    className={`w-3.5 h-3.5 rounded-full shadow-sm transition-transform duration-200 ease-out ${
                      isVegOnly ? 'bg-emerald-400 translate-x-4' : 'bg-on-surface/50 translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Mobile Quick Category Selector Dropdown Button */}
              <div className="relative md:hidden">
                <button
                  type="button"
                  onClick={() => setIsCategoryPickerOpen(!isCategoryPickerOpen)}
                  className="px-3 py-1.5 min-h-[38px] rounded-full bg-surface-container border border-primary/40 text-primary text-xs font-sans font-medium flex items-center gap-1.5 active:scale-95 shadow-sm hover:border-primary transition-all cursor-pointer"
                  aria-label={t('menu.allCategories', 'View all categories')}
                  aria-expanded={isCategoryPickerOpen}
                >
                  <span className="material-symbols-outlined text-[15px]">menu_book</span>
                  <span>{t('menu.categories', 'Categories')} ({categories.length})</span>
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
                        <span>{t('menu.allCategories', 'All Categories')}</span>
                        <span>{categories.length} {t('common.total', 'Total')}</span>
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
                              <CategoryIcon name={cat.name} className="w-4 h-4 shrink-0" />
                              <span>{getCategoryName(cat)}</span>
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
          </div>

          {/* Full Width Horizontally Scrollable Category Pills with Tap Chevrons & Gradient Edge Masks */}
          <div className="relative w-full">
            {/* Left Scroll Chevron & Gradient Mask */}
            {canScrollLeft && (
              <div className="absolute left-0 top-0 bottom-0 z-20 flex items-center pl-0.5 pr-6 bg-gradient-to-r from-background via-background/95 to-transparent pointer-events-none">
                <button
                  type="button"
                  onClick={() => scrollCategories('left')}
                  aria-label={t('menu.scrollPrev', 'Scroll to previous categories')}
                  className="w-7 h-7 rounded-full bg-surface-container/95 border border-primary/40 text-primary flex items-center justify-center pointer-events-auto shadow-lg hover:scale-110 active:scale-95 transition-transform cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">chevron_left</span>
                </button>
              </div>
            )}

            {/* Scroll Container */}
            <div
              ref={categoryScrollRef}
              data-lenis-prevent
              className="w-full overflow-x-auto hide-scrollbar scroll-smooth py-1"
            >
              <div className="flex items-center gap-2 sm:gap-2.5 pb-0.5">
                {categories.map((category) => {
                  const isActive = activeCategoryId === category.id;
                  return (
                    <button
                      key={category.id}
                      ref={(el) => { categoryBtnRefs.current[category.id] = el; }}
                      type="button"
                      onClick={() => handleSelectCategory(category.id)}
                      className={`relative px-4 sm:px-5 py-2.5 min-h-[42px] sm:min-h-0 rounded-full font-sans text-xs tracking-wider uppercase transition-all duration-200 whitespace-nowrap cursor-pointer border flex items-center gap-2 active:scale-95 shrink-0 ${
                        isActive
                          ? 'bg-primary text-on-primary border-primary font-bold shadow-[0_4px_16px_rgba(230,177,63,0.32)]'
                          : 'bg-surface-container-low/80 text-on-surface-variant border-outline/20 hover:border-primary/40 hover:text-on-surface hover:bg-surface-container'
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="activeCategoryPill"
                          className="absolute inset-0 bg-primary rounded-full -z-10 shadow-[0_4px_16px_rgba(230,177,63,0.32)]"
                          transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                        />
                      )}
                      <CategoryIcon name={category.name} className="w-3.5 h-3.5 z-10 shrink-0" />
                      <span className="z-10 font-semibold">{getCategoryName(category)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Scroll Chevron & Gradient Mask */}
            {canScrollRight && (
              <div className="absolute right-0 top-0 bottom-0 z-20 flex items-center pr-0.5 pl-6 bg-gradient-to-l from-background via-background/95 to-transparent pointer-events-none">
                <button
                  type="button"
                  onClick={() => scrollCategories('right')}
                  aria-label={t('menu.scrollNext', 'Scroll to more categories')}
                  className="w-7 h-7 rounded-full bg-surface-container/95 border border-primary/40 text-primary flex items-center justify-center pointer-events-auto shadow-lg hover:scale-110 active:scale-95 transition-transform cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </div>
            )}
          </div>
        </SectionReveal>

        {/* ACT IV: 3D CYLINDRICAL CURVED CULINARY REEL (Public Website Showcase) */}
        {!isQrMode && <CurvedMenuReel />}

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
                <p className="text-sm font-semibold text-white">{t('menu.orderingPausedTitle', 'Online Ordering is Temporarily Paused')}</p>
                <p className="text-xs text-on-surface/70 mt-0.5">
                  {t('menu.browsingModeDesc', 'Browse our artisanal menu below. In-person dining and counter service remain active.')}
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-flex px-3 py-1 rounded-full text-[11px] uppercase tracking-wider font-semibold bg-primary/15 text-primary border border-primary/30">
              {t('menu.browsingMode', 'Browsing Mode')}
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
                          <div className="w-full aspect-[16/10] sm:aspect-[4/3] min-h-[190px] max-h-[300px] sm:max-h-none rounded-2xl overflow-hidden relative bg-surface-container-lowest shadow-md mb-6 group/img">
                            <img
                              src={displayImage}
                              alt={getItemName(featuredItem)}
                              width="600"
                              height="450"
                              className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out will-change-transform"
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
                                <span className="badge-soldout shadow-lg">86'd · {t('menu.soldOut', 'Sold Out')}</span>
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
                              {getItemName(featuredItem)}
                            </h3>
                          </div>

                          {/* Signature Pick badge only rendered when item is an explicit signature */}
                          {activeSensoryMetadata?.isExplicitSignature && featuredItem.popular && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-widest font-semibold bg-primary/15 text-primary border border-primary/30 shrink-0">
                              {t('menu.signaturePick', 'Signature Pick')}
                            </span>
                          )}
                        </div>

                        {/* Description */}
                        {featuredItem.description && (
                          <p className="font-sans text-[13px] sm:text-sm text-on-surface/80 leading-relaxed font-light mb-4">
                            {getItemDescription(featuredItem)}
                          </p>
                        )}

                        {/* Interactive Sensory Telemetry & Chef Rating Strip (Cinematic Mode only) */}
                        {isCinematicExperience() && (
                          <div className="my-4 p-3.5 rounded-2xl bg-surface-obsidian/80 border border-outline/20 flex flex-col gap-3 font-mono text-[11px] uppercase tracking-wider">
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <span className="text-on-surface/45 block text-[9px]">{t('menu.culinaryNotes', 'CULINARY NOTES')}</span>
                              <span className="text-primary font-bold">
                                {(() => {
                                  const cat = activeCategoryName.toLowerCase();
                                  if (cat.includes('sip') || cat.includes('dessert') || cat.includes('coffee')) {
                                    return '93.4°C · 9.0 BAR';
                                  }
                                  if (cat.includes('burger') || cat.includes('pizza')) {
                                    return '450°C WOOD-FIRED';
                                  }
                                  return '290°C WOK SEAR';
                                })()}
                              </span>
                            </div>
                            <div className="border-x border-outline/20 px-2">
                              <span className="text-on-surface/45 block text-[9px]">{t('menu.craftScore', 'CRAFT SCORE')}</span>
                              <span className="text-primary font-bold">99 / 100</span>
                            </div>
                            <div className="pl-1">
                              <span className="text-on-surface/45 block text-[9px]">{t('menu.batchStatus', 'BATCH STATUS')}</span>
                              <span className="text-emerald-400 font-semibold">{t('menu.freshPrep', 'FRESH PREP')}</span>
                            </div>
                          </div>

                          {/* Animated 3-Bar Mini Sensory Meter */}
                          <div className="pt-2 border-t border-outline/15 space-y-1.5">
                            <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-widest text-on-surface/60">
                              <span>{t('menu.chefRating', 'CHEF RATING')}</span>
                              <span className="text-primary font-semibold">{t('menu.triSpectrum', 'TRI-SPECTRUM')}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="space-y-1">
                                <div className="flex justify-between font-mono text-[9px] text-on-surface/70">
                                  <span>{t('menu.craft', 'CRAFT')}</span>
                                  <span className="text-primary font-bold">99</span>
                                </div>
                                <div className="h-1 rounded-full bg-surface-container-highest overflow-hidden">
                                  <div className="h-full bg-primary rounded-full w-[99%]" />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <div className="flex justify-between font-mono text-[9px] text-on-surface/70">
                                  <span>{t('menu.aroma', 'AROMA')}</span>
                                  <span className="text-primary font-bold">97</span>
                                </div>
                                <div className="h-1 rounded-full bg-surface-container-highest overflow-hidden">
                                  <div className="h-full bg-primary rounded-full w-[97%]" />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <div className="flex justify-between font-mono text-[9px] text-on-surface/70">
                                  <span>{t('menu.balance', 'BALANCE')}</span>
                                  <span className="text-primary font-bold">98</span>
                                </div>
                                <div className="h-1 rounded-full bg-surface-container-highest overflow-hidden">
                                  <div className="h-full bg-primary rounded-full w-[98%]" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        )}

                        {/* Useful Real Kitchen Facts (Clean & Authentic) */}
                        {((featuredItem as any).prep_time_minutes || (featuredItem as any).spice_level) && (
                          <div className="my-3 flex items-center gap-3 text-xs text-on-surface/80 flex-wrap">
                            {(featuredItem as any).prep_time_minutes && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container border border-outline/20 font-sans text-xs">
                                <span className="material-symbols-outlined text-xs text-primary">schedule</span>
                                <span>{(featuredItem as any).prep_time_minutes} min prep</span>
                              </span>
                            )}
                            {(featuredItem as any).spice_level && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container border border-outline/20 font-sans text-xs">
                                <span className="material-symbols-outlined text-xs text-amber-400">local_fire_department</span>
                                <span>{(featuredItem as any).spice_level}</span>
                              </span>
                            )}
                          </div>
                        )}

                        {/* Curated Tasting Notes - De-nested editorial presentation */}
                        {activeSensoryMetadata?.tastingNotes && (
                          <div className="mb-3 text-xs sm:text-[13px] font-sans text-on-surface/90 flex items-baseline gap-2">
                            <span className="text-[10px] uppercase tracking-wider text-primary font-semibold shrink-0 inline-flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px]">award_star</span>
                              <span>{t('menu.notesLabel', 'Notes:')}</span>
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
                          <div className="flex items-center gap-1.5 flex-wrap mb-4" aria-label={t('menu.allergenWarnings', 'Allergen warnings')}>
                            <span className="text-[10px] text-amber-400/90 font-medium tracking-wider uppercase inline-flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[13px] text-amber-400">warning</span>
                              <span>{t('menu.allergensLabel', 'Allergens:')}</span>
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

                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.94 }}
                          disabled={!canAdd}
                          type="button"
                          className={`h-11 sm:h-10 min-h-[44px] px-5 sm:px-6 rounded-full text-xs font-sans font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-200 ${
                            !canAdd
                              ? 'bg-surface-elevated/40 border border-outline/20 text-on-surface-variant/40 cursor-not-allowed'
                              : isJustAdded
                              ? 'bg-primary text-on-primary border border-primary shadow-[0_0_20px_rgba(var(--color-primary-rgb),0.6)] scale-105'
                              : 'bg-primary text-on-primary hover:bg-primary/90 border border-primary shadow-lg hover:shadow-[0_4px_20px_rgba(var(--color-primary-rgb),0.4)] cursor-pointer'
                          }`}
                          title={
                            !itemAvailable
                              ? "Item is temporarily unavailable (86'd)"
                              : !isOrderingActive
                              ? "Online ordering is temporarily paused by the restaurant"
                              : `Add ${getItemName(featuredItem)} to order`
                          }
                          onClick={(e) => handleAddToCart(e, featuredItem)}
                        >
                          <span className={`material-symbols-outlined text-base transition-transform ${isJustAdded ? 'scale-110' : ''}`}>
                            {!itemAvailable ? 'block' : !isOrderingActive ? 'pause_circle' : isJustAdded ? 'check' : 'shopping_bag'}
                          </span>
                          <span>
                            {!itemAvailable ? t('menu.soldOut', 'Sold Out') : !isOrderingActive ? t('menu.orderingPaused', 'Paused') : isJustAdded ? t('menu.added', 'Added') : t('menu.addToCart', 'Add to Order')}
                          </span>
                        </motion.button>
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
                  <p className="font-serif text-xl text-on-surface">{t('menu.artisanalSoloSpotlight', 'Artisanal Solo Spotlight')}</p>
                  <p className="font-sans text-xs sm:text-sm text-on-surface/60 mt-1.5 max-w-sm">
                    {t('menu.soloSpotlightDesc', 'This creation headlines the category. Additional pairings and seasonal recipes will be introduced soon.')}
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
                                {getItemName(item)}
                              </h4>

                              {item.popular && (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] uppercase tracking-widest font-semibold bg-primary/15 text-primary border border-primary/30 shrink-0 self-center">
                                  {t('menu.chefsPick', "Chef's Pick")}
                                </span>
                              )}

                              {!itemAvailable && (
                                <span className="badge-soldout shrink-0 text-[10px] self-center">86'd · {t('menu.soldOut', 'Sold Out')}</span>
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

                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.94 }}
                              disabled={!canAdd}
                              type="button"
                              className={`h-9 min-w-[64px] px-3.5 sm:h-7 min-h-[44px] sm:min-h-0 sm:min-w-0 sm:px-3 rounded-full text-[11px] font-sans font-semibold uppercase tracking-wider flex items-center justify-center gap-1 transition-all duration-200 shrink-0 ${
                                !canAdd
                                  ? 'bg-surface-elevated/40 border border-outline/20 text-on-surface-variant/40 cursor-not-allowed'
                                  : isJustAdded
                                  ? 'bg-primary text-on-primary border border-primary shadow-[0_0_14px_rgba(var(--color-primary-rgb),0.6)] scale-105'
                                  : 'bg-primary/10 hover:bg-primary text-primary hover:text-on-primary border border-primary/30 hover:border-primary shadow-xs hover:shadow-[0_2px_10px_rgba(var(--color-primary-rgb),0.35)] cursor-pointer'
                              }`}
                              title={
                                !itemAvailable
                                  ? "Item is temporarily unavailable (86'd)"
                                  : !isOrderingActive
                                  ? "Online ordering is temporarily paused by the restaurant"
                                  : `Add ${getItemName(item)} to order`
                              }
                              onClick={(e) => handleAddToCart(e, item)}
                            >
                              <span className={`material-symbols-outlined text-[14px] transition-transform ${isJustAdded ? 'scale-110' : ''}`}>
                                {!itemAvailable ? 'block' : !isOrderingActive ? 'pause_circle' : isJustAdded ? 'check' : 'add'}
                              </span>
                              <span>{!itemAvailable ? t('menu.soldOut', 'Sold Out') : !isOrderingActive ? t('menu.orderingPaused', 'Paused') : isJustAdded ? t('menu.added', 'Added') : t('menu.add', 'Add')}</span>
                            </motion.button>
                          </div>
                        </div>

                        {/* Ledger Secondary Details: Description & Allergens */}
                        <div className="flex items-start justify-between gap-3 pl-6">
                          <div className="flex-1 min-w-0">
                            {item.description && (
                              <p className="font-sans text-[13px] sm:text-sm text-on-surface/75 leading-relaxed font-light">
                                {getItemDescription(item)}
                              </p>
                            )}

                            {item.allergens && item.allergens.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap mt-1.5" aria-label={t('menu.allergenWarnings', 'Allergen warnings')}>
                                <span className="text-[10px] text-amber-400/90 font-medium tracking-wider uppercase inline-flex items-center gap-0.5">
                                  <span className="material-symbols-outlined text-[12px] text-amber-400">warning</span>
                                  <span>{t('menu.allergensLabel', 'Allergens:')}</span>
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
                                alt={getItemName(item)}
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
                          {getItemName(item)}
                        </h3>

                        {item.popular && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] uppercase tracking-widest font-semibold bg-primary/15 text-primary border border-primary/30 shadow-xs">
                            {t('menu.chefsPick', "Chef's Pick")}
                          </span>
                        )}

                        {!itemAvailable && (
                          <span className="badge-soldout">86'd · {t('menu.soldOut', 'Sold Out')}</span>
                        )}
                      </div>

                      {/* Description */}
                      {item.description && (
                        <p className="font-sans text-xs sm:text-sm text-on-surface/65 leading-relaxed font-light line-clamp-2 mt-1">
                          {getItemDescription(item)}
                        </p>
                      )}

                      {/* Allergen Tags */}
                      {item.allergens && item.allergens.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap mt-2" aria-label={t('menu.allergenWarnings', 'Allergen warnings')}>
                          <span className="text-[10px] text-amber-400/90 font-medium tracking-wider uppercase inline-flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[13px] text-amber-400">warning</span>
                            <span>{t('menu.allergensLabel', 'Allergens:')}</span>
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
                          alt={getItemName(item)}
                          width="64"
                          height="64"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                    ) : (
                      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-primary/15 via-surface-container to-surface-obsidian border border-primary/30 flex items-center justify-center text-primary group-hover:scale-105 group-hover:bg-primary/25 transition-all duration-300 shrink-0 shadow-md">
                        <CategoryIcon name={activeCategoryName} className="w-5 h-5 sm:w-6 sm:h-6" />
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
                      className={`h-11 sm:h-9 min-h-[44px] sm:min-h-0 px-4 rounded-full text-xs font-sans font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all duration-200 active:scale-95 ${
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
                          : `Add ${getItemName(item)} to order`
                      }
                      onClick={(e) => handleAddToCart(e, item)}
                    >
                      <span className={`material-symbols-outlined text-[15px] transition-transform ${isJustAdded ? 'scale-110' : ''}`}>
                        {!itemAvailable ? 'block' : !isOrderingActive ? 'pause_circle' : isJustAdded ? 'check' : 'shopping_bag'}
                      </span>
                      <span>{!itemAvailable ? t('menu.soldOut', 'Sold Out') : !isOrderingActive ? t('menu.orderingPaused', 'Paused') : isJustAdded ? t('menu.added', 'Added') : t('menu.addToCart', 'Add to Order')}</span>
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
                {t('common.showLess', 'Show Less')}
              </button>
            )}

            {hasMore && (
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + 6)}
                className="h-11 px-7 rounded-full btn-outline-premium text-xs font-semibold cursor-pointer active:scale-95"
              >
                {t('menu.loadMore', 'Load More Items')}
              </button>
            )}
          </div>
        )}

        {!isLoading && filteredMenu.length === 0 && (
          <div className="py-20 flex flex-col items-center justify-center text-on-surface/75">
            <span className="material-symbols-outlined text-4xl mb-4 opacity-50">
              search_off
            </span>
            <p className="font-body-lg">{t('menu.noItems', 'No culinary creations found in this category.')}</p>
          </div>
        )}
      </div>
    </section>
  );
};
