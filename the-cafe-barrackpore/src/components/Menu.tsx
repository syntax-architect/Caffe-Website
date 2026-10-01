import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue } from 'framer-motion';
import { useDevice } from '../hooks/useDevice';
import { useCart } from '../context/CartContext';
import { useUI } from '../context/UIContext';
import { client, urlFor } from '../lib/sanityClient';
import { menuData } from '../data/menu';
import { useMenuAvailability } from '../hooks/useMenuAvailability';
import { useSiteConfig } from '../context/SiteConfigContext';
import { getPersistedMenuItems, MENU_UPDATED_EVENT } from '../services/contentPersistenceService';
import type { PersistedMenuItem } from '../services/contentPersistenceService';

export interface MenuItemData {
  _id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  dietType: string;
  popular: boolean;
  image?: any;
}

const categoryMap: Record<string, string> = {
  'burgers-pizzas': 'Burgers & Pizzas',
  'starters-momos': 'Starters & Momos',
  'sips-desserts': 'Sips & Desserts',
  'soups-salads': 'Soups & Salads',
  'mains-platters': 'Mains & Platters'
};

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  'Burgers & Pizzas': 'Hand-stretched sourdough crusts flame-baked to crisp perfection & artisanal toasted brioche burgers.',
  'Starters & Momos': 'Delicate steamed Himalayan dim sums, golden hand-rolled crispy bites & clay-oven appetizers.',
  'Mains & Platters': 'Slow-simmered regional comforts, sizzling woks, and generous sharing banquets.',
  'Sips & Desserts': 'Single-origin espresso brews, botanical mocktails, and decadent twilight confections.',
  'Soups & Salads': 'Peppery restorative broths, fresh farm greens, and aromatic warm bowls.'
};

const getFallbackMenu = (): { categories: string[]; items: MenuItemData[] } => {
  const persisted = getPersistedMenuItems();
  const categories = [
    'Burgers & Pizzas',
    'Starters & Momos',
    'Mains & Platters',
    'Sips & Desserts',
    'Soups & Salads'
  ];

  const items: MenuItemData[] = menuData.map(item => {
    let dietType = 'none';
    if (item.diet === 'veg') dietType = 'veg';
    else if (item.diet === 'nv') dietType = 'non-veg';
    else if (item.diet === 'vegan') dietType = 'vegan';

    const override = persisted[item.id];

    return {
      _id: item.id,
      name: override?.name || item.name,
      description: override?.description || item.description,
      price: override?.price ?? item.price,
      category: categoryMap[item.category] || item.category,
      dietType: override ? (override.diet === 'nv' ? 'non-veg' : override.diet === 'vegan' ? 'vegan' : 'veg') : dietType,
      popular: !!item.tag,
      image: item.image
    };
  });

  return { categories, items };
};

const getCategoryIcon = (category: string): string => {
  const cat = category?.toLowerCase() || '';
  if (cat.includes('burger') || cat.includes('pizza')) return 'local_pizza';
  if (cat.includes('starter') || cat.includes('momo')) return 'ramen_dining';
  if (cat.includes('main') || cat.includes('platter')) return 'skillet';
  if (cat.includes('sip') || cat.includes('dessert') || cat.includes('coffee')) return 'local_cafe';
  if (cat.includes('soup') || cat.includes('salad')) return 'soup_kitchen';
  return 'restaurant_menu';
};

export const Menu: React.FC = () => {
  const fallback = getFallbackMenu();
  const [categories, setCategories] = useState<string[]>(fallback.categories);
  const [activeCategory, setActiveCategory] = useState<string>(fallback.categories[0] || '');
  const [menuItems, setMenuItems] = useState<MenuItemData[]>(fallback.items);
  const [isLoading, setIsLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(6);
  const [isVegOnly, setIsVegOnly] = useState(false);

  const [hoveredImage, setHoveredImage] = useState<string | null>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const { isTouchDevice } = useDevice();
  const { addToCart } = useCart();
  const { showToast } = useUI();
  const { isAvailable } = useMenuAvailability();
  const { formatPrice, restaurantConfig } = useSiteConfig();

  // Fetch latest data from Sanity with resilient fallback
  useEffect(() => {
    let isCancelled = false;

    const fetchData = async () => {
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Sanity request timed out')), 8000)
        );

        const fetchPromise = Promise.all([
          client.fetch(`*[_type == "category"] | order(order asc) { title }`),
          client.fetch(`*[_type == "menuItem"]{ 
            _id, name, description, price, dietType, popular, "category": category->title, image 
          }`)
        ]);

        const [cats, items] = (await Promise.race([fetchPromise, timeoutPromise])) as [any[], any[]];
        
        if (isCancelled) return;

        const catTitles: string[] = Array.isArray(cats) ? cats.map((c: any) => c?.title).filter(Boolean) : [];
        const validItems: MenuItemData[] = Array.isArray(items)
          ? items.filter((item: any) => item && item._id && item.name && typeof item.price === 'number')
          : [];

        if (catTitles.length > 0 && validItems.length > 0) {
          setCategories(catTitles);
          setActiveCategory(prev => (catTitles.includes(prev) ? prev : catTitles[0]));

          const persisted = getPersistedMenuItems();
          const mergedItems = validItems.map((item) => {
            const override = persisted[item._id];
            if (override) {
              return {
                ...item,
                name: override.name || item.name,
                description: override.description || item.description,
                price: override.price ?? item.price,
                dietType: override.diet === 'nv' ? 'non-veg' : override.diet === 'vegan' ? 'vegan' : 'veg',
              };
            }
            return item;
          });

          setMenuItems(mergedItems);
        } else {
          console.warn("Sanity returned empty or invalid menu data, retaining local fallback.");
        }
      } catch (error) {
        console.warn("Unable to fetch menu from Sanity, retaining local fallback:", error);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Listen to live menu item updates from staff dashboard
  useEffect(() => {
    const handleMenuUpdated = (e: Event) => {
      const custom = e as CustomEvent<PersistedMenuItem>;
      if (custom.detail) {
        const updated = custom.detail;
        setMenuItems((prev) =>
          prev.map((item) => {
            if (item._id === updated.id) {
              return {
                ...item,
                name: updated.name,
                description: updated.description,
                price: updated.price,
                dietType: updated.diet === 'nv' ? 'non-veg' : updated.diet === 'vegan' ? 'vegan' : 'veg',
              };
            }
            return item;
          })
        );
      }
    };

    window.addEventListener(MENU_UPDATED_EVENT, handleMenuUpdated);
    return () => {
      window.removeEventListener(MENU_UPDATED_EVENT, handleMenuUpdated);
    };
  }, []);

  // Handle global mouse move when an image is hovered
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };

    if (hoveredImage && !isTouchDevice) {
      window.addEventListener('mousemove', handleMouseMove);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [hoveredImage, isTouchDevice, mouseX, mouseY]);



  const resolveImageUrl = (img: any, width: number = 800) => {
    if (!img) return undefined;
    if (typeof img === 'string') return img;
    try {
      return urlFor(img).width(width).auto('format').quality(80).url();
    } catch {
      return undefined;
    }
  };

  const filteredMenu = menuItems.filter(item => {
    const categoryMatch = item.category?.toLowerCase() === activeCategory.toLowerCase();
    const vegMatch = isVegOnly ? (item.dietType === 'veg' || item.dietType === 'vegan') : true;
    return categoryMatch && vegMatch;
  });

  const displayedMenu = filteredMenu.slice(0, visibleCount);
  const hasMore = visibleCount < filteredMenu.length;

  return (
    <section className="w-full py-16 md:py-24 bg-background scroll-mt-28" id="menu-section">
      <div className="max-w-[1320px] mx-auto px-4 md:px-6 lg:px-12 flex flex-col gap-8 md:gap-12 relative">
        
        {/* Floating Image (Desktop Only) */}
        <AnimatePresence>
          {hoveredImage && (
            <motion.img
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              src={hoveredImage}
              loading="lazy"
              alt="Menu Preview"
              className="hidden lg:block fixed z-[100] w-64 h-64 object-cover rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 pointer-events-none"
              style={{
                left: mouseX,
                top: mouseY,
                x: "20px",
                y: "20px"
              }}
            />
          )}
        </AnimatePresence>

        <motion.div 
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-8"
        >
          <div>
            <div className="inline-flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="editorial-eyebrow">Curated Gastronomy</span>
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-on-surface font-normal tracking-tight">The Culinary Collection</h2>
          </div>
          
          <div className="flex flex-col items-start md:items-end gap-4 mt-2 md:mt-0 w-full md:w-auto">
            {/* Pure Veg Toggle Switch */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className={`material-symbols-outlined text-sm transition-colors ${isVegOnly ? 'text-emerald-400' : 'text-on-surface/60'}`}>eco</span>
                <span className={`font-sans text-xs uppercase tracking-wider transition-colors ${isVegOnly ? 'text-emerald-400 font-semibold' : 'text-on-surface/60'}`}>Pure Veg Only</span>
              </div>
              <button
                type="button"
                onClick={() => setIsVegOnly(!isVegOnly)}
                role="switch"
                aria-checked={isVegOnly}
                aria-label="Filter vegetarian only items"
                className={`w-11 h-6 rounded-full p-0.5 transition-all duration-300 ease-in-out flex items-center border cursor-pointer ${isVegOnly ? 'bg-emerald-500/20 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.25)]' : 'bg-white/5 border-white/10'}`}
              >
                <motion.div
                  layout
                  className={`w-4 h-4 rounded-full shadow-sm ${isVegOnly ? 'bg-emerald-400' : 'bg-on-surface/50'}`}
                  initial={false}
                  animate={{
                    x: isVegOnly ? 20 : 0
                  }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              </button>
            </div>

            {/* Horizontally Scrollable Category Pills */}
            <div className="w-full md:w-auto overflow-x-auto hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
              <div className="flex items-center gap-2 pb-1">
                {categories.map(category => {
                  const isActive = activeCategory === category;
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => {
                        setActiveCategory(category);
                        setVisibleCount(6);
                      }}
                      className={`px-3.5 sm:px-4 py-2 rounded-full font-sans text-xs uppercase tracking-wider transition-all duration-200 whitespace-nowrap cursor-pointer border flex items-center gap-1.5 active:scale-95 ${
                        isActive 
                        ? 'bg-gradient-to-r from-primary to-[#F3E5AB] text-[#18110c] border-primary font-bold shadow-[0_2px_12px_rgba(212,175,55,0.35)]' 
                        : 'bg-[#140D09]/80 text-on-surface/75 border-white/10 hover:border-primary/40 hover:text-white'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px]">{getCategoryIcon(category)}</span>
                      <span>{category}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Category Narrative Lead */}
        {CATEGORY_DESCRIPTIONS[activeCategory] && (
          <motion.div
            key={activeCategory}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center gap-3 -mt-4 mb-1"
          >
            <span className="w-8 h-[1px] bg-primary/40 hidden sm:block" />
            <p className="font-serif italic text-sm sm:text-base text-primary/85 font-light">
              {CATEGORY_DESCRIPTIONS[activeCategory]}
            </p>
          </motion.div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-[#170E0A] border border-white/5 rounded-2xl h-52"></div>
            ))}
          </div>
        ) : (
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6"
          >
            <AnimatePresence mode="popLayout">
              {displayedMenu.map((item) => {
                const available = isAvailable(item._id);
                const resolvedImg = resolveImageUrl(item.image, 300);

                return (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    whileHover={available ? { y: -5, transition: { duration: 0.25, ease: "easeOut" } } : undefined}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    key={item._id}
                    onMouseEnter={() => {
                      if (isTouchDevice || !item.image) return;
                      const resolvedHighRes = resolveImageUrl(item.image, 800);
                      setHoveredImage(resolvedHighRes || null);
                    }}
                    onMouseLeave={() => setHoveredImage(null)}
                    className={`relative p-4 sm:p-6 rounded-2xl bg-gradient-to-br from-[#1C120D] via-[#160E0A] to-[#120B08] border border-[#8B6B23]/35 hover:border-[#D4AF37] shadow-lg hover:shadow-[0_12px_32px_rgba(212,175,55,0.18)] transition-all duration-300 group flex flex-col justify-between gap-3.5 sm:gap-4 overflow-hidden active:scale-[0.99] ${
                      available
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
                          {/* Dietary Badge (Configurable: India FSSAI or International badge) */}
                          {item.dietType !== 'none' && (
                            restaurantConfig.dietary.system === 'india' ? (
                              <div 
                                className={`w-3.5 h-3.5 rounded-sm border shrink-0 flex items-center justify-center ${
                                  item.dietType === 'veg' || item.dietType === 'vegan'
                                    ? 'border-emerald-500/80' 
                                    : 'border-red-500/80'
                                }`}
                                title={item.dietType === 'veg' ? 'Vegetarian' : item.dietType === 'vegan' ? 'Vegan' : 'Non-Vegetarian'}
                              >
                                <div className={`w-1.5 h-1.5 rounded-full ${item.dietType === 'veg' || item.dietType === 'vegan' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                              </div>
                            ) : (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase shrink-0 border ${
                                  item.dietType === 'veg'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                    : item.dietType === 'vegan'
                                    ? 'bg-teal-500/10 text-teal-400 border-teal-500/30'
                                    : 'bg-stone-500/10 text-stone-300 border-stone-500/30'
                                }`}
                                title={item.dietType === 'veg' ? 'Vegetarian' : item.dietType === 'vegan' ? 'Vegan' : 'Non-Vegetarian'}
                              >
                                {item.dietType === 'veg' ? 'Veg' : item.dietType === 'vegan' ? 'Vegan' : 'Non-Veg'}
                              </span>
                            )
                          )}

                          <h3 className={`font-serif text-base sm:text-lg font-medium leading-snug transition-colors ${
                            available ? 'text-on-surface group-hover:text-primary' : 'text-on-surface/50 line-through'
                          }`}>
                            {item.name}
                          </h3>

                          {item.popular && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] uppercase tracking-widest font-semibold bg-[#D4AF37]/15 text-primary border border-[#D4AF37]/30 shadow-xs">
                              Chef's Pick
                            </span>
                          )}

                          {!available && (
                            <span className="badge-soldout">
                              86'd · Sold Out
                            </span>
                          )}
                        </div>

                        {/* Description */}
                        <p className="font-sans text-xs sm:text-sm text-on-surface/65 leading-relaxed font-light line-clamp-2 mt-1">
                          {item.description}
                        </p>
                      </div>

                      {/* Photography image OR Gastronomic Category Crest */}
                      {resolvedImg ? (
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden shrink-0 border border-[#D4AF37]/30 bg-[#120B08] shadow-md">
                          <img 
                            src={resolvedImg} 
                            alt={item.name} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            loading="lazy" 
                          />
                        </div>
                      ) : (
                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-[#D4AF37]/15 via-[#1A110C] to-[#120B08] border border-[#D4AF37]/30 flex items-center justify-center text-primary group-hover:scale-105 group-hover:bg-[#D4AF37]/25 transition-all duration-300 shrink-0 shadow-md">
                          <span className="material-symbols-outlined text-lg sm:text-xl font-light">
                            {getCategoryIcon(item.category)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Row: Price & Tactile Action Button */}
                    <div className="flex items-center justify-between gap-4 pt-3 border-t border-white/5">
                      <div className="font-serif text-xl sm:text-2xl text-primary font-normal tabular-nums">
                        {formatPrice(item.price)}
                      </div>

                      <motion.button 
                        whileHover={available ? { scale: 1.05 } : undefined}
                        whileTap={available ? { scale: 0.92 } : undefined}
                        disabled={!available}
                        type="button"
                        className={`h-8 px-4 rounded-full text-xs font-sans font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all duration-200 ${
                          available
                            ? 'bg-primary/10 hover:bg-primary text-primary hover:text-[#18110c] border border-primary/30 hover:border-primary shadow-sm hover:shadow-[0_2px_12px_rgba(212,175,55,0.35)] cursor-pointer'
                            : 'bg-stone-900 border border-stone-800 text-stone-500 cursor-not-allowed'
                        }`}
                        title={available ? `Add ${item.name} to order` : "Item is temporarily unavailable (86'd)"}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!available) return;
                          addToCart({
                            id: item._id,
                            name: item.name,
                            price: item.price,
                            image: resolveImageUrl(item.image, 400)
                          } as any);
                          showToast({
                            title: 'Added to Order',
                            message: item.name,
                            subtext: `${formatPrice(item.price)}`,
                            type: 'success',
                          });
                        }}
                      >
                        <span className="material-symbols-outlined text-[15px]">
                          {available ? 'add' : 'block'}
                        </span>
                        <span>{available ? 'Add' : 'Sold Out'}</span>
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}

        {(!isLoading && (hasMore || visibleCount > 6)) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-center gap-4 mt-6 md:mt-8"
          >
            {visibleCount > 6 && (
              <motion.button
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={() => {
                  setVisibleCount(6);
                  const menuEl = document.getElementById('menu-section');
                  if (menuEl) {
                    const y = menuEl.getBoundingClientRect().top + window.scrollY - 80;
                    window.scrollTo({ top: y, behavior: 'smooth' });
                  }
                }}
                className="h-11 px-7 rounded-full border border-white/20 text-on-surface/80 hover:bg-white/5 hover:text-white transition-all text-xs font-sans font-semibold tracking-wider uppercase cursor-pointer"
              >
                Show Less
              </motion.button>
            )}
            
            {hasMore && (
              <motion.button
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={() => setVisibleCount(prev => prev + 6)}
                className="h-11 px-7 rounded-full btn-outline-premium text-xs font-semibold cursor-pointer"
              >
                Load More Items
              </motion.button>
            )}
          </motion.div>
        )}

        {!isLoading && filteredMenu.length === 0 && (
          <div className="py-20 flex flex-col items-center justify-center text-on-surface/50">
            <span className="material-symbols-outlined text-4xl mb-4 opacity-50">search_off</span>
            <p className="font-body-lg">No culinary creations found in this category.</p>
          </div>
        )}
      </div>
    </section>
  );
};
