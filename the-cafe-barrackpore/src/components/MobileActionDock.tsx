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
            <div className="flex items-center justify-between px-2 py-2 rounded-full bg-[#120B08]/92 border border-white/10 backdrop-blur-2xl">
              
              {/* Quick Action 1: Explore Menu */}
              <button
                type="button"
                onClick={handleMenuScroll}
                className="flex flex-col items-center justify-center py-1 px-2 rounded-full text-on-surface/80 hover:text-primary transition-colors active:scale-95 cursor-pointer group"
                aria-label="View Menu"
              >
                <svg className="w-4 h-4 text-[#D4AF37] group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span className="font-sans text-[8px] uppercase tracking-wider font-semibold text-on-surface/90 mt-0.5">
                  Menu
                </span>
              </button>

              {/* Quick Action 2: Phone Concierge */}
              <a
                href={`tel:${phone}`}
                className="flex flex-col items-center justify-center py-1 px-2 rounded-full text-on-surface/80 hover:text-primary transition-colors active:scale-95 cursor-pointer group"
                aria-label={`Call ${businessName}`}
              >
                <svg className="w-4 h-4 text-[#D4AF37] group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span className="font-sans text-[8px] uppercase tracking-wider font-semibold text-on-surface/90 mt-0.5">
                  Call
                </span>
              </a>

              {/* PRIMARY CENTERPIECE: Book Table Island Pill */}
              <button
                type="button"
                onClick={() => setIsReservationOpen(true)}
                className="h-10 pl-3.5 pr-1.5 rounded-full bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C5A028] text-[#120B08] flex items-center justify-between gap-1.5 shadow-[0_4px_16px_rgba(212,175,55,0.35)] active:scale-95 transition-transform cursor-pointer"
                aria-label="Book a table reservation"
              >
                <span className="font-sans text-[10px] font-bold uppercase tracking-wider">
                  Book
                </span>
                <div className="w-7 h-7 rounded-full bg-[#120B08]/15 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#120B08]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M10 14h4M6 18h12M7 6v14M17 6v14" />
                  </svg>
                </div>
              </button>

              {/* Quick Action: WhatsApp */}
              <a
                href={`https://wa.me/${(restaurantConfig?.contact?.whatsapp || clientDetails.whatsapp).replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center py-1 px-2 rounded-full text-on-surface/80 hover:text-emerald-400 transition-colors active:scale-95 cursor-pointer group"
                aria-label="Chat on WhatsApp"
              >
                <svg className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span className="font-sans text-[8px] uppercase tracking-wider font-semibold text-on-surface/90 mt-0.5">
                  Chat
                </span>
              </a>

              {/* Quick Action: Google Maps */}
              <a
                href={clientDetails.googleMapsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center py-1 px-2 rounded-full text-on-surface/80 hover:text-sky-400 transition-colors active:scale-95 cursor-pointer group"
                aria-label="Map directions on Google Maps"
              >
                <svg className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="font-sans text-[8px] uppercase tracking-wider font-semibold text-on-surface/90 mt-0.5">
                  Map
                </span>
              </a>

              {/* Quick Action: Order Bag / Cart with live badge */}
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="relative flex flex-col items-center justify-center py-1 px-2 rounded-full text-on-surface/80 hover:text-primary transition-colors active:scale-95 cursor-pointer group"
                aria-label={`Order bag with ${cartCount} items`}
              >
                <svg className="w-4 h-4 text-[#D4AF37] group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <span className="font-sans text-[8px] uppercase tracking-wider font-semibold text-on-surface/90 mt-0.5">
                  Bag
                </span>
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 right-0.5 w-4 h-4 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB] text-[#120B08] text-[9px] font-extrabold flex items-center justify-center shadow-[0_0_8px_rgba(212,175,55,0.5)]">
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
