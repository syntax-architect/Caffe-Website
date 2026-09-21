import React, { useState } from 'react';
import { motion, AnimatePresence, useMotionValue } from 'framer-motion';
import { useDevice } from '../hooks/useDevice';

// Mock data provided by user
const MOCK_MENU = [
  {"id":"special-chicken-bun","category":"burgers","name":"Special Chicken On A Bun","diet":"nv","price":250,"description":"Signature cafe chicken patty with house sauce and fresh greens.", "image": "/images/components/comp_img_1.webp"},
  {"id":"veggie-medley-burger","category":"burgers","name":"Veggie Medley Burger","diet":"veg","price":180,"description":"Crispy vegetable patty layered with fresh tomatoes and lettuce.", "image": "/images/components/comp_img_0.webp"},
  {"id":"chicken-cheese-pizza","category":"pizzas","name":"Chicken Cheese Pizza","diet":"nv","price":250,"description":"Hand-tossed crust loaded with roasted chicken and melted cheese.", "image": "/images/components/comp_img_2.webp"},
  {"id":"lemon-coriander-soup","category":"soups","name":"Lemon Coriander Soup","diet":"veg","price":150,"description":"Light, zesty, and refreshing clear soup with fresh coriander.", "image": "/images/components/comp_img_3.webp"}
];

const CATEGORIES = ['All', 'Burgers', 'Pizzas', 'Soups'];

export const Menu: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [hoveredImage, setHoveredImage] = useState<string | null>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const { isTouchDevice } = useDevice();

  // Handle global mouse move when an image is hovered
  React.useEffect(() => {
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

  const filteredMenu = MOCK_MENU.filter(item => {
    if (activeCategory === 'All') return true;
    return item.category.toLowerCase() === activeCategory.toLowerCase();
  });

  return (
    <section className="w-full py-16 md:py-24 bg-[#231914] scroll-mt-20" id="menu-section">
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
                x: "-50%",
                y: "-50%"
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
              <span className="material-symbols-outlined text-[#D4AF37] text-xl font-light">menu_book</span>
              <span className="font-label-sm text-xs uppercase tracking-[0.2em] text-[#D4AF37] font-semibold">Gourmet Gastronomy</span>
            </div>
            <h2 className="font-headline-lg text-3xl md:text-4xl lg:text-5xl text-[#E3DACD] font-medium tracking-tight">Curated Culinary Creations</h2>
          </div>
          
          <div className="flex flex-wrap gap-2 mt-4 md:mt-0">
            {CATEGORIES.map(category => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-4 py-2 md:px-6 md:py-2.5 rounded-full font-label-md text-[12px] md:text-[13px] transition-all duration-300 border ${
                  activeCategory === category 
                  ? 'bg-[#D4AF37] text-[#231914] border-[#D4AF37]' 
                  : 'bg-transparent text-[#E3DACD]/70 border-white/20 hover:bg-[#D4AF37] hover:border-[#D4AF37] hover:text-[#231914]'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div 
          layout
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10"
        >
          <AnimatePresence>
            {filteredMenu.map((item) => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: "-50px" }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.5 }}
                key={item.id}
                onMouseEnter={(e) => {
                  if (isTouchDevice) return;
                  mouseX.set(e.clientX);
                  mouseY.set(e.clientY);
                  setHoveredImage(item.image);
                }}
                onMouseLeave={() => setHoveredImage(null)}
                className="flex flex-col py-6 md:py-8 px-2 md:px-4 bg-transparent border-b border-white/10 hover:-translate-y-1 hover:border-b-[#D4AF37]/50 transition-all duration-300 group"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div 
                      className={`w-1.5 h-1.5 rounded-full opacity-70 ${item.diet === 'veg' ? 'bg-green-400' : 'bg-red-400'}`} 
                      title={item.diet === 'veg' ? 'Vegetarian' : 'Non-Vegetarian'}
                    />
                    <h3 className="font-headline-sm text-xl text-[#E3DACD] font-medium group-hover:text-[#D4AF37] transition-colors">{item.name}</h3>
                  </div>
                </div>
                
                <p className="font-body-md text-sm text-[#E3DACD]/60 flex-grow leading-relaxed mb-6">
                  {item.description}
                </p>
                
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                  <span className="font-sans text-2xl font-semibold tracking-tight text-[#D4AF37]">₹{item.price}</span>
                  <button 
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-white/5 text-[#E3DACD] hover:bg-[#D4AF37] hover:text-[#231914] transition-colors"
                    title="Add to order"
                    onClick={() => console.log('Add to cart clicked:', item.id)}
                  >
                    <span className="material-symbols-outlined text-lg">add</span>
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        {filteredMenu.length === 0 && (
          <div className="py-20 flex flex-col items-center justify-center text-[#E3DACD]/50">
            <span className="material-symbols-outlined text-4xl mb-4 opacity-50">search_off</span>
            <p className="font-body-lg">No culinary creations found in this category.</p>
          </div>
        )}
      </div>
    </section>
  );
};
