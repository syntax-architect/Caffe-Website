import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { useUI } from '../context/UIContext';
import { clientDetails } from '../config/client';
import { useSiteConfig } from '../context/SiteConfigContext';
import { smoothScrollTo } from '../utils/scroll';

export const MobileActionDock: React.FC = () => {
  const { cartCount, setIsDrawerOpen } = useCart();
  const { setIsReservationOpen } = useUI();
  const { restaurantConfig } = useSiteConfig();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  const phone = restaurantConfig?.contact?.phone || clientDetails.phone;
  const businessName = restaurantConfig?.businessName || clientDetails.businessName;

  // Subtle auto-hide on fast downward scroll, reveal on upward scroll or near top/bottom
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          // Always show near top
          if (currentScrollY < 120) {
            setIsVisible(true);
          } else if (currentScrollY > lastScrollY + 15) {
            // Scrolling down fast
            setIsVisible(false);
          } else if (currentScrollY < lastScrollY - 10) {
            // Scrolling up
            setIsVisible(true);
          }
          setLastScrollY(currentScrollY);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const handleMenuScroll = (e: React.MouseEvent) => {
    e.preventDefault();
    smoothScrollTo('menu-section');
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.aside
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="lg:hidden fixed bottom-4 inset-x-4 z-40 max-w-[420px] mx-auto pointer-events-auto"
          aria-label="Mobile Quick Actions"
        >
          {/* Double-Bezel Floating Glass Island Container */}
          <div className="p-1 rounded-full bg-gradient-to-r from-[#D4AF37]/40 via-white/10 to-[#D4AF37]/40 shadow-[0_12px_40px_rgba(0,0,0,0.85)] backdrop-blur-2xl">
            <div className="flex items-center justify-between px-3 py-2 rounded-full bg-[#120B08]/92 border border-white/10 backdrop-blur-2xl">
              
              {/* Quick Action 1: Explore Menu */}
              <button
                type="button"
                onClick={handleMenuScroll}
                className="flex flex-col items-center justify-center py-1 px-2.5 rounded-full text-on-surface/80 hover:text-primary transition-colors active:scale-95 cursor-pointer group"
                aria-label="Jump to Menu"
              >
                <span className="material-symbols-outlined text-[19px] text-[#D4AF37] group-hover:scale-110 transition-transform">
                  restaurant_menu
                </span>
                <span className="font-sans text-[9px] uppercase tracking-wider font-semibold text-on-surface/90 mt-0.5">
                  Menu
                </span>
              </button>

              {/* Quick Action 2: Phone Concierge */}
              <a
                href={`tel:${phone}`}
                className="flex flex-col items-center justify-center py-1 px-2.5 rounded-full text-on-surface/80 hover:text-primary transition-colors active:scale-95 cursor-pointer group"
                aria-label={`Call ${businessName}`}
              >
                <span className="material-symbols-outlined text-[19px] text-[#D4AF37] group-hover:scale-110 transition-transform">
                  call
                </span>
                <span className="font-sans text-[9px] uppercase tracking-wider font-semibold text-on-surface/90 mt-0.5">
                  Call
                </span>
              </a>

              {/* PRIMARY CENTERPIECE: Book Table Island Pill */}
              <button
                type="button"
                onClick={() => setIsReservationOpen(true)}
                className="h-10 pl-4 pr-1.5 rounded-full bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C5A028] text-[#120B08] flex items-center justify-between gap-2 shadow-[0_4px_16px_rgba(212,175,55,0.35)] active:scale-95 transition-transform cursor-pointer"
                aria-label="Book a table reservation"
              >
                <span className="font-sans text-[11px] font-bold uppercase tracking-wider">
                  Book Table
                </span>
                <div className="w-7 h-7 rounded-full bg-[#120B08]/15 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[15px] text-[#120B08]">
                    table_restaurant
                  </span>
                </div>
              </button>

              {/* Quick Action 4: Order Bag / Cart with live badge */}
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="relative flex flex-col items-center justify-center py-1 px-2.5 rounded-full text-on-surface/80 hover:text-primary transition-colors active:scale-95 cursor-pointer group"
                aria-label={`Order bag with ${cartCount} items`}
              >
                <span className="material-symbols-outlined text-[20px] text-[#D4AF37] group-hover:scale-110 transition-transform">
                  shopping_bag
                </span>
                <span className="font-sans text-[9px] uppercase tracking-wider font-semibold text-on-surface/90 mt-0.5">
                  Bag
                </span>
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 right-1 w-4 h-4 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB] text-[#120B08] text-[9px] font-extrabold flex items-center justify-center shadow-[0_0_8px_rgba(212,175,55,0.5)]">
                    {cartCount}
                  </span>
                )}
              </button>

            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
