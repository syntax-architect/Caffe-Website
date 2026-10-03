import React, { useState, useEffect } from 'react';
import { useDevice } from '../hooks/useDevice';
import { useCart } from '../context/CartContext';
import { useUI } from '../context/UIContext';
import { useMenuAvailability } from '../hooks/useMenuAvailability';
import { useSiteConfig } from '../context/SiteConfigContext';
import {
  MENU_CATEGORIES_FALLBACK,
  MENU_ITEMS_FALLBACK,
} from '../data/menuFallbacks';
import type { MenuItem, MenuCategory } from '../types/menu';

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

export const Menu: React.FC = () => {
  const [categories, setCategories] = useState<MenuCategory[]>(MENU_CATEGORIES_FALLBACK);
  const [activeCategoryId, setActiveCategoryId] = useState<string>(
    MENU_CATEGORIES_FALLBACK[0]?.id || 'burgers-pizzas'
  );
  const [menuItems, setMenuItems] = useState<MenuItem[]>(MENU_ITEMS_FALLBACK);
  const [isLoading, setIsLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(6);
  const [isVegOnly, setIsVegOnly] = useState(false);

  const [hoveredImage, setHoveredImage] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const { isTouchDevice } = useDevice();
  const { addToCart } = useCart();
  const { showToast } = useUI();
  const { isAvailable } = useMenuAvailability();
  const { formatPrice, restaurantConfig } = useSiteConfig();

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

  // Handle global mouse move when an image is hovered (desktop only)
  useEffect(() => {
    if (!hoveredImage || isTouchDevice) return;
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [hoveredImage, isTouchDevice]);

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

  const displayedMenu = filteredMenu.slice(0, visibleCount);
  const hasMore = visibleCount < filteredMenu.length;

  return (
    <section className="w-full py-16 md:py-24 bg-background scroll-mt-28" id="menu-section">
      <div className="max-w-[1320px] mx-auto px-4 md:px-6 lg:px-12 flex flex-col gap-8 md:gap-12 relative">
        {/* Floating Image (Desktop Only) */}
        {hoveredImage && (
          <img
            src={hoveredImage}
            loading="lazy"
            decoding="async"
            width="256"
            height="256"
            alt="Menu Preview"
            className="hidden lg:block fixed z-[100] w-64 h-64 object-cover rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 pointer-events-none transition-transform duration-75 animate-fade-in"
            style={{
              left: `${mousePos.x + 20}px`,
              top: `${mousePos.y + 20}px`,
            }}
          />
        )}

        <div
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

          <div className="flex flex-col items-start md:items-end gap-4 mt-2 md:mt-0 w-full md:w-auto">
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
                    : 'bg-white/5 border-white/10'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full shadow-sm transition-transform duration-200 ease-out ${
                    isVegOnly ? 'bg-emerald-400 translate-x-5' : 'bg-on-surface/50 translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Horizontally Scrollable Category Pills */}
            <div className="w-full md:w-auto overflow-x-auto hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
              <div className="flex items-center gap-2 pb-1">
                {categories.map((category) => {
                  const isActive = activeCategoryId === category.id;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => {
                        setActiveCategoryId(category.id);
                        setVisibleCount(6);
                      }}
                      className={`px-3.5 sm:px-4 py-2 rounded-full font-sans text-xs uppercase tracking-wider transition-all duration-200 whitespace-nowrap cursor-pointer border flex items-center gap-1.5 active:scale-95 ${
                        isActive
                          ? 'bg-gradient-to-r from-primary to-[#F3E5AB] text-[#18110c] border-primary font-bold shadow-[0_2px_12px_rgba(212,175,55,0.35)]'
                          : 'bg-[#140D09]/80 text-on-surface/75 border-white/10 hover:border-primary/40 hover:text-white'
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
          </div>
        </div>

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

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse bg-[#170E0A] border border-white/5 rounded-2xl h-52"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {displayedMenu.map((item) => {
              const itemAvailable = item.available && isAvailable(item.id);
              const displayImage = item.image_url || item.image;

              return (
                <div
                  key={item.id}
                  onMouseEnter={() => {
                    if (isTouchDevice || !displayImage) return;
                    setHoveredImage(displayImage);
                  }}
                  onMouseLeave={() => setHoveredImage(null)}
                  className={`relative p-4 sm:p-6 rounded-2xl bg-gradient-to-br from-[#1C120D] via-[#160E0A] to-[#120B08] border border-[#8B6B23]/35 hover:border-[#D4AF37] shadow-lg hover:shadow-[0_12px_32px_rgba(212,175,55,0.18)] transition-all duration-300 group flex flex-col justify-between gap-3.5 sm:gap-4 overflow-hidden active:scale-[0.99] hover:-translate-y-1 ${
                    itemAvailable
                      ? 'cursor-pointer'
                      : 'opacity-65 grayscale-[30%] bg-[#130B07] border-stone-800/60'
                  }`}
                >
                    {/* Top Subtle Amber Glow Line on Hover */}
                    <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#D4AF37]/0 group-hover:via-[#D4AF37]/80 to-transparent transition-all duration-500 pointer-events-none" />

                    {/* Top Row: Name, Diet Icon, Sold Out & Mobile Thumbnail / Gastronomic Crest */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Dietary Badge */}
                          {item.diet && item.diet !== 'all' && (
                            restaurantConfig.dietary.system === 'india' ? (
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
                            ) : (
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
                            )
                          )}

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
                            <span className="px-2 py-0.5 rounded-full text-[9px] uppercase tracking-widest font-semibold bg-[#D4AF37]/15 text-primary border border-[#D4AF37]/30 shadow-xs">
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
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden shrink-0 border border-[#D4AF37]/30 bg-[#120B08] shadow-md">
                          <img
                            src={displayImage}
                            alt={item.name}
                            width="64"
                            height="64"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                      ) : (
                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-[#D4AF37]/15 via-[#1A110C] to-[#120B08] border border-[#D4AF37]/30 flex items-center justify-center text-primary group-hover:scale-105 group-hover:bg-[#D4AF37]/25 transition-all duration-300 shrink-0 shadow-md">
                          <span className="material-symbols-outlined text-lg sm:text-xl font-light">
                            {getCategoryIcon(activeCategoryName)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Row: Price & Tactile Action Button */}
                    <div className="flex items-center justify-between gap-4 pt-3 border-t border-white/5">
                      <div className="font-serif text-xl sm:text-2xl text-primary font-normal tabular-nums">
                        {formatPrice(item.price)}
                      </div>

                      <button
                        disabled={!itemAvailable}
                        type="button"
                        className={`h-8 px-4 rounded-full text-xs font-sans font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all duration-200 active:scale-95 ${
                          itemAvailable
                            ? 'bg-primary/10 hover:bg-primary text-primary hover:text-[#18110c] border border-primary/30 hover:border-primary shadow-sm hover:shadow-[0_2px_12px_rgba(212,175,55,0.35)] cursor-pointer hover:scale-105'
                            : 'bg-stone-900 border border-stone-800 text-stone-500 cursor-not-allowed'
                        }`}
                        title={
                          itemAvailable
                            ? `Add ${item.name} to order`
                            : "Item is temporarily unavailable (86'd)"
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!itemAvailable) return;
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
                        }}
                      >
                        <span className="material-symbols-outlined text-[15px]">
                          {itemAvailable ? 'add' : 'block'}
                        </span>
                        <span>{itemAvailable ? 'Add' : 'Sold Out'}</span>
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
                className="h-11 px-7 rounded-full border border-white/20 text-on-surface/80 hover:bg-white/5 hover:text-white transition-all text-xs font-sans font-semibold tracking-wider uppercase cursor-pointer active:scale-95"
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
