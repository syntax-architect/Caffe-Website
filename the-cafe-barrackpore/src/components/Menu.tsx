import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue } from 'framer-motion';
import { useDevice } from '../hooks/useDevice';
import { useCart } from '../context/CartContext';
import { useUI } from '../context/UIContext';
import { client, urlFor } from '../lib/sanityClient';

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

export const Menu: React.FC = () => {
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [menuItems, setMenuItems] = useState<MenuItemData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(6);
  const [isVegOnly, setIsVegOnly] = useState(false);

  const [hoveredImage, setHoveredImage] = useState<string | null>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const { isTouchDevice } = useDevice();
  const { addToCart } = useCart();
  const { showToast } = useUI();

  // Fetch data from Sanity
  useEffect(() => {
    const fetchData = async () => {
      try {
        const cats = await client.fetch(`*[_type == "category"] | order(order asc) { title }`);
        const items = await client.fetch(`*[_type == "menuItem"]{ 
          _id, name, description, price, dietType, popular, "category": category->title, image 
        }`);
        
        const catTitles = cats.map((c: any) => c.title);
        setCategories(catTitles);
        if (catTitles.length > 0) setActiveCategory(catTitles[0]);
        setMenuItems(items);
      } catch (error) {
        console.error("Error fetching menu from Sanity:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
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



  const filteredMenu = menuItems.filter(item => {
    const categoryMatch = item.category?.toLowerCase() === activeCategory.toLowerCase();
    const vegMatch = isVegOnly ? (item.dietType === 'veg' || item.dietType === 'vegan') : true;
    return categoryMatch && vegMatch;
  });

  const displayedMenu = filteredMenu.slice(0, visibleCount);
  const hasMore = visibleCount < filteredMenu.length;

  return (
    <section className="w-full py-16 md:py-24 bg-background scroll-mt-20" id="menu-section">
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
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-8"
        >
          <div>
            <div className="inline-flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-primary text-xl font-light">menu_book</span>
              <span className="font-label-sm text-xs uppercase tracking-[0.2em] text-primary font-semibold">Gourmet Gastronomy</span>
            </div>
            <h2 className="font-headline-lg text-3xl md:text-4xl lg:text-5xl text-on-surface font-medium tracking-tight">Curated Culinary Creations</h2>
          </div>
          
          <div className="flex flex-col items-start md:items-end gap-4 mt-4 md:mt-0 w-full md:w-auto">
            {/* Pure Veg Toggle */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className={`material-symbols-outlined text-sm transition-colors ${isVegOnly ? 'text-primary' : 'text-on-surface-variant'}`}>eco</span>
                <span className={`font-label-sm text-xs uppercase tracking-wider transition-colors ${isVegOnly ? 'text-primary' : 'text-on-surface-variant'}`}>Pure Veg Only</span>
              </div>
              <button
                onClick={() => setIsVegOnly(!isVegOnly)}
                className={`w-12 h-6 rounded-full p-1 transition-all duration-300 ease-in-out flex items-center border ${isVegOnly ? 'bg-primary/20 border-primary shadow-[0_0_10px_rgba(212,175,55,0.3)]' : 'bg-surface-variant border-white/10'}`}
              >
                <motion.div
                  layout
                  className={`w-4 h-4 rounded-full shadow-sm ${isVegOnly ? 'bg-primary' : 'bg-on-surface-variant'}`}
                  initial={false}
                  animate={{
                    x: isVegOnly ? 24 : 0
                  }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              </button>
            </div>

            <div className="flex flex-wrap justify-start md:justify-end gap-2">
              {categories.map(category => (
                <button
                  key={category}
                  onClick={() => {
                    setActiveCategory(category);
                    setVisibleCount(6);
                  }}
                  className={`px-4 py-2 md:px-6 md:py-2.5 rounded-full font-label-md text-[12px] md:text-[13px] transition-all duration-300 border ${
                    activeCategory === category 
                    ? 'bg-primary text-background border-primary' 
                    : 'bg-transparent text-on-surface/70 border-white/20 hover:bg-primary hover:border-primary hover:text-background'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-white/5 border border-white/10 rounded-xl h-64"></div>
            ))}
          </div>
        ) : (
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10"
          >
            <AnimatePresence mode="popLayout">
              {displayedMenu.map((item) => (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.4, type: "spring", bounce: 0.2 }}
                  key={item._id}
                  onMouseEnter={(e) => {
                    if (isTouchDevice || !item.image) return;
                    mouseX.set(e.clientX);
                    mouseY.set(e.clientY);
                    try {
                      setHoveredImage(urlFor(item.image).width(800).auto('format').quality(80).url());
                    } catch {
                      setHoveredImage(null);
                    }
                  }}
                  onMouseLeave={() => setHoveredImage(null)}
                  className="flex flex-col py-6 md:py-8 px-4 md:px-6 glass-panel rounded-2xl hover:-translate-y-2 hover:shadow-primary/20 transition-all duration-300 group"
                >
                  <div className="flex justify-between items-baseline gap-4 mb-2 border-b border-white/5 pb-2">
                    <div className="flex items-center gap-2">
                      {item.dietType !== 'none' && (
                        <div 
                          className={`w-1.5 h-1.5 rounded-full opacity-70 ${item.dietType === 'veg' ? 'bg-green-400' : 'bg-red-400'}`} 
                          title={item.dietType === 'veg' ? 'Vegetarian' : 'Non-Vegetarian'}
                        />
                      )}
                      <h3 className="font-headline-sm text-lg text-on-surface group-hover:text-primary transition-colors">{item.name}</h3>
                    </div>
                    <span className="font-serif text-xl text-primary tabular-nums shrink-0">₹{item.price}</span>
                  </div>
                  
                  <div className="flex items-end justify-between gap-4 mt-auto">
                    <p className="font-body-md text-sm text-on-surface/60 leading-relaxed pr-4">
                      {item.description}
                    </p>
                    <motion.button 
                      whileTap={{ scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 400, damping: 17 }}
                      className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 text-on-surface hover:bg-primary hover:text-background transition-colors relative z-10 shrink-0"
                      title="Add to order"
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart({
                          id: item._id,
                          name: item.name,
                          price: item.price,
                          image: item.image ? urlFor(item.image).width(400).auto('format').quality(80).url() : undefined
                        } as any);
                        showToast(`Added ${item.name} to order`);
                      }}
                    >
                      <span className="material-symbols-outlined text-base">add</span>
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {(!isLoading && (hasMore || visibleCount > 6)) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-center gap-4 mt-4 md:mt-8"
          >
            {visibleCount > 6 && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                type="button"
                onClick={() => {
                  setVisibleCount(6);
                  const menuEl = document.getElementById('menu-section');
                  if (menuEl) {
                    const y = menuEl.getBoundingClientRect().top + window.scrollY - 80;
                    window.scrollTo({ top: y, behavior: 'smooth' });
                  }
                }}
                className="px-8 py-3 rounded-full border border-white/20 text-on-surface/70 hover:bg-white/5 hover:text-on-surface transition-all duration-300 font-label-md tracking-wider uppercase"
              >
                Show Less
              </motion.button>
            )}
            
            {hasMore && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                type="button"
                onClick={() => setVisibleCount(prev => prev + 6)}
                className="px-8 py-3 rounded-full border border-primary text-primary hover:bg-primary hover:text-background transition-all duration-300 font-label-md tracking-wider uppercase"
              >
                Load More
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
