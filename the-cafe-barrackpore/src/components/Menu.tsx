import React, { useState } from 'react';
import { motion, AnimatePresence, useMotionValue } from 'framer-motion';
import { useDevice } from '../hooks/useDevice';

// Mock data provided by user
const MOCK_MENU = [
  // Soups
  { id: "hot-and-sour-soup", category: "Soups", name: "Hot And Sour Soup", diet: "nv", price: 130, description: "(Veg/chicken)", image: "/images/components/comp_img_3.webp" },
  { id: "lemon-coriander-soup", category: "Soups", name: "Lemon Coriander Soup", diet: "veg", price: 150, description: "Light, zesty, and refreshing clear soup.", image: "/images/components/comp_img_3.webp" },
  { id: "chicken-clear-soup", category: "Soups", name: "Chicken Clear Soup", diet: "nv", price: 150, description: "(Add on- egg, chicken)", image: "/images/components/comp_img_3.webp" },
  { id: "fish-bowl-soup", category: "Soups", name: "Fish Bowl Soup", diet: "nv", price: 200, description: "Classic fish bowl clear soup.", image: "/images/components/comp_img_3.webp" },
  { id: "chicken-manchow-soup", category: "Soups", name: "Chicken Manchow Soup", diet: "nv", price: 200, description: "Spicy and tangy thick soup.", image: "/images/components/comp_img_3.webp" },
  { id: "american-chopsuey", category: "Soups", name: "American Chopsuey", diet: "nv", price: 300, description: "Crispy noodles with sweet and sour sauce.", image: "/images/components/comp_img_3.webp" },

  // Salads
  { id: "green-salad", category: "Salads", name: "Green Salad", diet: "veg", price: 90, description: "Fresh seasonal greens.", image: "/images/components/comp_img_0.webp" },
  { id: "chicken-salad", category: "Salads", name: "Chicken Salad", diet: "nv", price: 200, description: "Roasted chicken with fresh greens.", image: "/images/components/comp_img_1.webp" },
  { id: "pasta-salad", category: "Salads", name: "Pasta Salad", diet: "veg", price: 250, description: "(Add on- mushroom/egg/chicken)", image: "/images/components/comp_img_0.webp" },

  // Burgers & Sandwiches
  { id: "veggie-medley-burger", category: "Burgers & Sandwiches", name: "Veggie Medley Burger", diet: "veg", price: 180, description: "Crispy vegetable patty layered with fresh tomatoes and lettuce.", image: "/images/components/comp_img_0.webp" },
  { id: "paneer-burger-1patty", category: "Burgers & Sandwiches", name: "Paneer Burger (1 patty)", diet: "veg", price: 200, description: "Spiced paneer patty.", image: "/images/components/comp_img_0.webp" },
  { id: "paneer-burger-2patty", category: "Burgers & Sandwiches", name: "Paneer Burger (2 patty)", diet: "veg", price: 220, description: "Double spiced paneer patty.", image: "/images/components/comp_img_0.webp" },
  { id: "special-chicken-bun", category: "Burgers & Sandwiches", name: "Special Chicken On A Bun", diet: "nv", price: 250, description: "Signature cafe chicken patty with house sauce.", image: "/images/components/comp_img_1.webp" },
  { id: "cheese-blast-sandwich", category: "Burgers & Sandwiches", name: "Cheese Blast Sandwich", diet: "veg", price: 150, description: "Loaded with melted cheese.", image: "/images/components/comp_img_2.webp" },
  { id: "veg-sweet-corn-sandwich", category: "Burgers & Sandwiches", name: "Veg Sweet Corn Sandwich", diet: "veg", price: 180, description: "(Add on- paneer)", image: "/images/components/comp_img_0.webp" },
  { id: "chicken-cheese-toastie", category: "Burgers & Sandwiches", name: "Chicken Cheese Toastie", diet: "nv", price: 220, description: "Toasted chicken and cheese.", image: "/images/components/comp_img_1.webp" },
  { id: "buffalo-chicken-grilled-sandwich", category: "Burgers & Sandwiches", name: "Buffalo Chicken Grilled Sandwich", diet: "nv", price: 300, description: "Spicy buffalo chicken grilled.", image: "/images/components/comp_img_1.webp" },
  { id: "chipotle-chicken-sandwich", category: "Burgers & Sandwiches", name: "Chipotle Chicken Sandwich", diet: "nv", price: 300, description: "Chipotle spiced chicken.", image: "/images/components/comp_img_1.webp" },
  { id: "club-house", category: "Burgers & Sandwiches", name: "Club House", diet: "nv", price: 250, description: "(Chicken/veg)", image: "/images/components/comp_img_1.webp" },

  // Pizzas & Pasta
  { id: "margherita-pizza", category: "Pizzas & Pasta", name: "Margherita Pizza", diet: "veg", price: 180, description: "Classic cheese and tomato pizza.", image: "/images/components/comp_img_2.webp" },
  { id: "chicken-cheese-pizza", category: "Pizzas & Pasta", name: "Chicken Cheese Pizza", diet: "nv", price: 250, description: "Hand-tossed crust loaded with roasted chicken.", image: "/images/components/comp_img_2.webp" },
  { id: "white-sauce-pasta-veg", category: "Pizzas & Pasta", name: "White Sauce Pasta (Veg)", diet: "veg", price: 180, description: "Creamy white sauce pasta.", image: "/images/components/comp_img_2.webp" },
  { id: "white-sauce-pasta-chicken", category: "Pizzas & Pasta", name: "White Sauce Pasta (Chicken)", diet: "nv", price: 200, description: "Creamy white sauce pasta with chicken.", image: "/images/components/comp_img_2.webp" },
  { id: "red-sauce-pasta-veg", category: "Pizzas & Pasta", name: "Red Sauce Pasta (Veg)", diet: "veg", price: 200, description: "Tangy red tomato sauce pasta.", image: "/images/components/comp_img_2.webp" },
  { id: "red-sauce-pasta-chicken", category: "Pizzas & Pasta", name: "Red Sauce Pasta (Chicken)", diet: "nv", price: 220, description: "Tangy red tomato sauce pasta with chicken.", image: "/images/components/comp_img_2.webp" },

  // Momos
  { id: "veg-steam-momo", category: "Momos", name: "Veg Steam Momo", diet: "veg", price: 150, description: "Steamed vegetable dumplings.", image: "/images/components/comp_img_1.webp" },
  { id: "chicken-steam-momo", category: "Momos", name: "Chicken Steam Momo", diet: "nv", price: 280, description: "Steamed chicken dumplings.", image: "/images/components/comp_img_1.webp" },
  { id: "chicken-pahadi-momo-steam", category: "Momos", name: "Chicken Pahadi Momo (Steam)", diet: "nv", price: 200, description: "Pahadi spiced chicken dumplings.", image: "/images/components/comp_img_1.webp" },
  { id: "chicken-pahadi-momo-fried", category: "Momos", name: "Chicken Pahadi Momo (Fried)", diet: "nv", price: 220, description: "Crispy fried pahadi spiced dumplings.", image: "/images/components/comp_img_1.webp" },
  { id: "chicken-pahadi-momo-pan-fried", category: "Momos", name: "Chicken Pahadi Momo (Pan Fried)", diet: "nv", price: 250, description: "Pan fried in spicy sauce.", image: "/images/components/comp_img_1.webp" },

  // Quick Bites
  { id: "fish-spring-roll", category: "Quick Bites", name: "Fish Spring Roll (Pure Vetki)", diet: "nv", price: 200, description: "Crispy rolls stuffed with Vetki fish.", image: "/images/components/comp_img_0.webp" },
  { id: "fish-and-chips", category: "Quick Bites", name: "Fish And Chips (Pure Vetki)", diet: "nv", price: 250, description: "Classic battered fish with fries.", image: "/images/components/comp_img_1.webp" },
  { id: "fish-goujons", category: "Quick Bites", name: "Fish Goujons", diet: "nv", price: 240, description: "Crispy fish fingers.", image: "/images/components/comp_img_1.webp" },
  { id: "golden-fried-prawn", category: "Quick Bites", name: "Golden Fried Prawn", diet: "nv", price: 350, description: "Crispy fried prawns.", image: "/images/components/comp_img_1.webp" },
  { id: "prawn-tempura", category: "Quick Bites", name: "Prawn Tempura", diet: "nv", price: 380, description: "Japanese style fried prawns.", image: "/images/components/comp_img_1.webp" },
  { id: "thai-lemon-fish", category: "Quick Bites", name: "Thai Lemon Fish", diet: "nv", price: 280, description: "Zesty thai style fish.", image: "/images/components/comp_img_1.webp" },
  { id: "thai-lemon-chicken", category: "Quick Bites", name: "Thai Lemon Chicken", diet: "nv", price: 250, description: "Zesty thai style chicken.", image: "/images/components/comp_img_1.webp" },
  { id: "chicken-spring-roll", category: "Quick Bites", name: "Chicken Spring Roll", diet: "nv", price: 180, description: "Crispy rolls stuffed with chicken.", image: "/images/components/comp_img_1.webp" },
  { id: "crispy-chicken-wings", category: "Quick Bites", name: "Crispy Chicken Wings", diet: "nv", price: 300, description: "Deep fried chicken wings.", image: "/images/components/comp_img_1.webp" },
  { id: "drums-of-heaven", category: "Quick Bites", name: "Drums Of Heaven", diet: "nv", price: 300, description: "Chicken lollipops tossed in sauce.", image: "/images/components/comp_img_1.webp" },
  { id: "chicken-strips", category: "Quick Bites", name: "Chicken Strips", diet: "nv", price: 250, description: "Crispy fried chicken strips.", image: "/images/components/comp_img_1.webp" },
  { id: "french-fries", category: "Quick Bites", name: "French Fries", diet: "veg", price: 150, description: "Classic salted fries.", image: "/images/components/comp_img_0.webp" },
  { id: "cheesy-french-fries", category: "Quick Bites", name: "Cheesy French Fries", diet: "veg", price: 180, description: "Fries loaded with cheese.", image: "/images/components/comp_img_0.webp" },
  { id: "crispy-chilli-babycorn", category: "Quick Bites", name: "Crispy Chilli Babycorn", diet: "veg", price: 190, description: "Spicy and crispy babycorn.", image: "/images/components/comp_img_0.webp" },

  // Beverages
  { id: "masala-cold-drinks", category: "Beverages", name: "Masala Cold Drinks", diet: "veg", price: 100, description: "Spiced refreshing cold drink.", image: "/images/components/comp_img_3.webp" },
  { id: "lime-corial", category: "Beverages", name: "Lime Corial", diet: "veg", price: 120, description: "Sweet and tangy lime drink.", image: "/images/components/comp_img_3.webp" },
  { id: "basil-lemon-mojito", category: "Beverages", name: "Basil Lemon Mojito", diet: "veg", price: 150, description: "Fresh basil and lemon.", image: "/images/components/comp_img_3.webp" },
  { id: "blue-curacoa-lemonade", category: "Beverages", name: "Blue Curacoa Lemonade", diet: "veg", price: 150, description: "Vibrant blue citrus lemonade.", image: "/images/components/comp_img_3.webp" },
  { id: "sunset-paradise", category: "Beverages", name: "Sunset Paradise", diet: "veg", price: 200, description: "Tropical sunset drink.", image: "/images/components/comp_img_3.webp" },
  { id: "the-summer-in-the-glass", category: "Beverages", name: "The Summer In The Glass", diet: "veg", price: 200, description: "Refreshing summer cooler.", image: "/images/components/comp_img_3.webp" },
  { id: "masala-tea", category: "Beverages", name: "Masala Tea", diet: "veg", price: 120, description: "Indian spiced tea.", image: "/images/components/comp_img_3.webp" },
  { id: "cappucino", category: "Beverages", name: "Cappucino", diet: "veg", price: 120, description: "Classic espresso and milk foam.", image: "/images/components/comp_img_3.webp" },
  { id: "oreo-shake", category: "Beverages", name: "Oreo Shake", diet: "veg", price: 150, description: "Thick shake with crushed Oreos.", image: "/images/components/comp_img_3.webp" },
  { id: "kitkat-shake", category: "Beverages", name: "Kitkat Shake", diet: "veg", price: 150, description: "Thick shake with crushed Kitkat.", image: "/images/components/comp_img_3.webp" },
  { id: "butterscotch-shake", category: "Beverages", name: "Butterscotch Shake", diet: "veg", price: 180, description: "Caramel and butterscotch shake.", image: "/images/components/comp_img_3.webp" },

  // Main Course & Platters
  { id: "fried-rice", category: "Main Course & Platters", name: "Fried Rice", diet: "veg", price: 160, description: "(Veg/egg/chicken/mixed)", image: "/images/components/comp_img_1.webp" },
  { id: "hakka-noodles", category: "Main Course & Platters", name: "Hakka Noodles", diet: "veg", price: 150, description: "(Veg/egg/chicken/mixed)", image: "/images/components/comp_img_1.webp" },
  { id: "veg-manchurian", category: "Main Course & Platters", name: "Veg Manchurian", diet: "veg", price: 150, description: "(Dry/gravy)", image: "/images/components/comp_img_0.webp" },
  { id: "chilli-chicken", category: "Main Course & Platters", name: "Chilli Chicken", diet: "nv", price: 180, description: "(Dry/gravy)", image: "/images/components/comp_img_1.webp" },
  { id: "hunan-chicken", category: "Main Course & Platters", name: "Hunan Chicken", diet: "nv", price: 200, description: "Spicy hunan style chicken.", image: "/images/components/comp_img_1.webp" },
  { id: "kung-pao-chicken", category: "Main Course & Platters", name: "Kung Pao Chicken", diet: "nv", price: 250, description: "Classic sweet and spicy chicken.", image: "/images/components/comp_img_1.webp" },
  { id: "chinese-platter", category: "Main Course & Platters", name: "Chinese Platter", diet: "nv", price: 350, description: "Spring Roll, Chicken Wings, Lollipop, Cheese Balls", image: "/images/components/comp_img_1.webp" },
  { id: "tandoori-platter", category: "Main Course & Platters", name: "Tandoori Platter", diet: "nv", price: 400, description: "Reshmi Kebab, Tikka Kebab, Hara Kebab, Sheek Kebab", image: "/images/components/comp_img_1.webp" },
  { id: "combo-1", category: "Main Course & Platters", name: "Combo 1", diet: "nv", price: 250, description: "French Fries + Burger + Masala Coke", image: "/images/components/comp_img_1.webp" },
  { id: "combo-2", category: "Main Course & Platters", name: "Combo 2", diet: "nv", price: 350, description: "Fried Rice/Noodles + Chilli Chicken + Lollypop", image: "/images/components/comp_img_1.webp" },
  { id: "combo-3", category: "Main Course & Platters", name: "Combo 3", diet: "nv", price: 380, description: "Egg Rice/Noodles + Kung Pao Chicken + Wings", image: "/images/components/comp_img_1.webp" }
];

const CATEGORIES = ['Soups', 'Salads', 'Burgers & Sandwiches', 'Pizzas & Pasta', 'Momos', 'Quick Bites', 'Beverages', 'Main Course & Platters'];

export const Menu: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string>(CATEGORIES[0]);
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
