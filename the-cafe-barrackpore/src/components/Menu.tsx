import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { menuData } from '../data/menu';
import { useCart } from '../context/CartContext';

export const Menu: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeDiet, setActiveDiet] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const { addToCart } = useCart();

  const filteredMenu = menuData.filter((item) => {
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    const matchesDiet = activeDiet === 'all' || item.diet === activeDiet;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesDiet && matchesSearch;
  });

  const categories = [
    { id: 'all', icon: 'restaurant', label: 'Complete Menu' },
    { id: 'starters-momos', icon: 'bakery_dining', label: 'Starters & Momos' },
    { id: 'burgers-pizzas', icon: 'local_pizza', label: 'Burgers & Pizzas' },
    { id: 'soups-salads', icon: 'ramen_dining', label: 'Soups & Broths' },
    { id: 'mains-platters', icon: 'dinner_dining', label: 'Mains & Platters' },
    { id: 'sips-desserts', icon: 'local_bar', label: 'Sips & Brews' },
  ];

  return (
    <section className="w-full py-space-xl bg-background scroll-mt-20" id="menu-section">
      <div className="max-w-[1320px] mx-auto px-gutter flex flex-col gap-space-xl">
        
        {/* Header & Filter Bar */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md border-b border-outline-variant/30 pb-space-lg">
          <div>
            <div className="inline-flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-primary text-xl">menu_book</span>
              <span className="font-label-sm text-label-sm uppercase tracking-widest text-primary font-semibold">Gourmet Gastronomy</span>
            </div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold">Curated Culinary Creations</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">Handcrafted comfort bites, smoky wok delights, and nocturnal roasts in Barrackpore.</p>
          </div>
          
          {/* Search & Quick Filter Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-space-sm w-full md:w-auto">
            <div className="relative w-full sm:w-72">
              <span className="material-symbols-outlined absolute left-3 top-3.5 text-on-surface-variant text-lg">search</span>
              <input
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-container-low text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary font-body-sm text-body-sm shadow-inner border border-outline-variant/30"
                placeholder="Search dishes, momos, sips..." 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="inline-flex p-1 rounded-xl bg-surface-container-low border border-outline-variant/30">
              <button
                onClick={() => setActiveDiet('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-label-sm transition-colors ${activeDiet === 'all' ? 'bg-primary-container text-on-primary-container shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                All
              </button>
              <button
                onClick={() => setActiveDiet('veg')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-label-sm transition-colors flex items-center gap-1 ${activeDiet === 'veg' ? 'bg-primary-container text-on-primary-container shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Veg
              </button>
              <button
                onClick={() => setActiveDiet('nv')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-label-sm transition-colors flex items-center gap-1 ${activeDiet === 'nv' ? 'bg-primary-container text-on-primary-container shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-500"></span> Non-Veg
              </button>
            </div>
          </div>
        </div>

        {/* Category Navigation Tabs */}
        <div className="overflow-x-auto pb-1 scrollbar-none">
          <div className="w-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 p-1.5 bg-surface-container-low/90 backdrop-blur-md rounded-2xl border border-outline-variant/30 shadow-lg">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-label-md text-label-md transition-all cursor-pointer ${
                  activeCategory === cat.id 
                    ? 'bg-gradient-to-r from-primary-container to-tertiary-container text-on-primary-container shadow-[0_0_16px_rgba(249,115,22,0.35)] font-semibold' 
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high font-medium'
                }`}
              >
                <span className="material-symbols-outlined text-base">{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Menu Grid */}
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-md pt-space-xs">
          <AnimatePresence>
            {filteredMenu.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className="menu-item-card p-space-sm rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 transition-colors flex flex-col justify-between gap-2 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  {item.image && (
                    <img 
                      alt={item.name}
                      className="w-20 h-20 rounded-lg object-cover flex-shrink-0 shadow-md border border-outline-variant/30"
                      src={item.image}
                    />
                  )}
                  <div className="flex flex-col gap-0.5 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full inline-block ${item.diet === 'veg' ? 'bg-emerald-500' : 'bg-rose-500'}`} title={item.diet === 'veg' ? 'Veg' : 'Non-Veg'}></span>
                      <h4 className="font-headline-sm text-sm font-semibold text-on-surface">{item.name}</h4>
                    </div>
                    <p className="font-body-sm text-[11px] text-on-surface-variant/80 line-clamp-2">{item.description}</p>
                  </div>
                  {item.tag && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-container-high text-tertiary font-semibold flex-shrink-0">
                      {item.tag}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between pt-2 mt-2 border-t border-outline-variant/10">
                  <span className="font-headline-sm text-sm text-tertiary font-bold">₹{item.price}</span>
                  <button
                    onClick={() => addToCart(item)}
                    className="order-btn px-4 py-1.5 rounded-lg bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary font-label-sm text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-sm">add_shopping_cart</span> Add
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
        
        {filteredMenu.length === 0 && (
          <div className="py-20 text-center text-on-surface-variant flex flex-col items-center gap-4">
            <span className="material-symbols-outlined text-6xl opacity-50">search_off</span>
            <p className="font-body-lg">No dishes found matching your criteria.</p>
          </div>
        )}

      </div>
    </section>
  );
};
