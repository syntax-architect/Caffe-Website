import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { clientDetails } from '../config/client';
import { useUI } from '../context/UIContext';

export const Header: React.FC = () => {
  const { cartCount, setIsDrawerOpen } = useCart();
  const { setIsReservationOpen } = useUI();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 25);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open to prevent background jitter
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  // Close mobile menu on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileMenuOpen]);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setIsMobileMenuOpen(false);
    document.body.style.overflow = '';
    const element = document.getElementById(id);
    if (element) {
      setTimeout(() => {
        const y = element.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      }, 50);
    }
  };

  const navLinks = [
    { label: 'About & Vibe', id: 'about-and-vibe' },
    { label: 'Curated Menu', id: 'menu-section' },
    { label: 'Chef Specials', id: 'chef-specials' },
    { label: 'Our Story', id: 'our-story' },
    { label: 'Gallery', id: 'gallery' },
    { label: 'Visit & Hours', id: 'reserve-section' },
  ];

  return (
    <header className={`fixed top-0 w-full z-50 transition-all duration-500 ${isScrolled ? 'bg-[#0D0705]/90 backdrop-blur-xl border-b border-[#D4AF37]/20 shadow-[0_10px_30px_rgba(0,0,0,0.6)] py-3' : 'bg-transparent py-5'}`}>
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-12 flex items-center justify-between gap-4">
        
        {/* Brand Crest & Monogram */}
        <a 
          className="flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl p-1" 
          href="#" 
          onClick={(e) => handleNavClick(e, 'root')}
          aria-label={`${clientDetails.businessName} Home`}
        >
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border border-[#D4AF37]/35 bg-[#160E0A] flex items-center justify-center transition-all duration-300 group-hover:border-[#D4AF37] group-hover:shadow-[0_0_15px_rgba(212,175,55,0.3)] overflow-hidden shrink-0">
            <img 
              src="/logo.webp" 
              alt={`${clientDetails.businessName} Crest`} 
              className="w-full h-full object-contain" 
              fetchPriority="high" 
              decoding="sync" 
            />
          </div>
          <div className="flex flex-col">
            <span className="font-serif text-base sm:text-lg tracking-tight text-on-surface font-semibold group-hover:text-primary transition-colors">
              {clientDetails.businessName}
            </span>
            <span className="font-sans text-[10px] tracking-[0.25em] uppercase text-primary/80 -mt-0.5 font-medium">
              {clientDetails.shortName}
            </span>
          </div>
        </a>
        
        {/* Architectural Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-7 px-6 py-2 rounded-full bg-[#160E0A]/60 backdrop-blur-md border border-white/10 shadow-lg">
          {navLinks.slice(0, 5).map((link) => (
            <a 
              key={link.id}
              className="font-sans text-[12px] uppercase tracking-[0.16em] text-on-surface/75 hover:text-primary transition-colors relative py-1 group font-medium" 
              href={`#${link.id}`} 
              onClick={(e) => handleNavClick(e, link.id)}
            >
              <span>{link.label}</span>
              <span className="absolute bottom-0 left-0 w-0 h-[1.5px] bg-primary group-hover:w-full transition-all duration-300 ease-out" />
            </a>
          ))}
        </nav>
        
        {/* Right Actions & Tactile Controls */}
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          {/* Order Bag / Cart Button with Glow Badge */}
          <button 
            onClick={() => setIsDrawerOpen(true)}
            className="relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full border border-white/10 bg-[#160E0A]/80 hover:border-[#D4AF37]/50 hover:bg-[#20140E] text-on-surface transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95 cursor-pointer shadow-md"
            aria-label={`View order bag with ${cartCount} items`}
            title="View Order Bag"
          >
            <span className="material-symbols-outlined text-primary text-xl font-light">shopping_bag</span>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-r from-primary to-[#F3E5AB] text-[#18110c] font-sans text-[11px] font-extrabold flex items-center justify-center shadow-[0_2px_8px_rgba(212,175,55,0.4)] animate-in zoom-in duration-200">
                {cartCount}
              </span>
            )}
          </button>
          
          {/* Island Button-in-Button Book a Table CTA (Desktop) */}
          <button 
            type="button"
            onClick={() => setIsReservationOpen(true)}
            className="hidden sm:flex group/btn h-10 sm:h-11 pl-4 pr-1.5 rounded-full bg-gradient-to-r from-primary to-[#E5C158] hover:from-[#E5C158] hover:to-primary text-[#18110c] text-[11px] font-sans font-bold uppercase tracking-wider transition-all duration-300 items-center justify-between gap-2.5 shadow-[0_4px_14px_rgba(212,175,55,0.2)] hover:shadow-[0_6px_20px_rgba(212,175,55,0.35)] active:scale-[0.98] cursor-pointer shrink-0"
          >
            <span>Book a Table</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#18110c]/15 group-hover/btn:bg-[#18110c]/25 flex items-center justify-center transition-all duration-300 group-hover/btn:scale-105">
              <span className="material-symbols-outlined text-[15px] sm:text-[16px] text-[#18110c]">
                table_restaurant
              </span>
            </div>
          </button>

          {/* Mobile Menu Fluid Hamburger Morph */}
          <button 
            className="lg:hidden relative flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-[#160E0A]/80 hover:bg-white/10 text-on-surface transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer active:scale-95"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isMobileMenuOpen}
          >
            <div className="w-5 h-4 relative flex flex-col justify-between items-center">
              <span 
                className={`w-full h-0.5 bg-[#E3DACD] rounded-full transition-all duration-300 transform origin-center ${
                  isMobileMenuOpen ? 'rotate-45 translate-y-[7px] bg-primary' : ''
                }`} 
              />
              <span 
                className={`w-full h-0.5 bg-[#E3DACD] rounded-full transition-all duration-200 ${
                  isMobileMenuOpen ? 'opacity-0' : 'opacity-100'
                }`} 
              />
              <span 
                className={`w-full h-0.5 bg-[#E3DACD] rounded-full transition-all duration-300 transform origin-center ${
                  isMobileMenuOpen ? '-rotate-45 -translate-y-[7px] bg-primary' : ''
                }`} 
              />
            </div>
          </button>
        </div>
      </div>

      {/* Editorial Mobile Navigation Modal Overlay with Staggered Mask Reveal */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 top-0 bg-black/80 backdrop-blur-md z-40 lg:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, y: -15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="lg:hidden fixed top-20 left-0 right-0 max-h-[calc(100dvh-5rem)] bg-[#0E0806] border-b border-[#D4AF37]/30 shadow-2xl z-50 overflow-y-auto"
            >
              <div className="max-w-[1320px] mx-auto px-6 py-8 flex flex-col gap-6">
                
                {/* Staggered Links */}
                <nav className="flex flex-col gap-1.5">
                  {navLinks.map((link, idx) => (
                    <motion.a 
                      key={link.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03, duration: 0.25 }}
                      className="font-serif text-2xl text-[#FDFBF7] hover:text-primary transition-colors flex items-center justify-between py-3 border-b border-white/10 active:text-primary active:bg-white/5 px-2 rounded-lg" 
                      href={`#${link.id}`} 
                      onClick={(e) => handleNavClick(e, link.id)}
                    >
                      <span>{link.label}</span>
                      <span className="material-symbols-outlined text-primary text-xl">arrow_forward</span>
                    </motion.a>
                  ))}
                </nav>
                
                {/* Mobile CTAs */}
                <div className="flex flex-col gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => { setIsReservationOpen(true); setIsMobileMenuOpen(false); }}
                    className="w-full h-12 rounded-full bg-gradient-to-r from-primary to-[#E5C158] text-[#18110c] text-xs font-sans font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">table_restaurant</span>
                    <span>Book a Table Reservation</span>
                  </button>
                  <a 
                    className="w-full h-12 rounded-full border border-white/15 bg-white/5 text-on-surface text-xs font-sans font-semibold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer" 
                    href="#menu-section" 
                    onClick={(e) => handleNavClick(e, 'menu-section')}
                  >
                    <span>Browse Full Menu</span>
                    <span className="material-symbols-outlined text-[16px]">restaurant_menu</span>
                  </a>
                </div>

                {/* Restaurant Quick Info Footer in Mobile Menu */}
                <div className="pt-4 border-t border-white/10 flex flex-col gap-2 text-[12px] text-on-surface/65 font-sans">
                  <div className="flex items-center gap-2 text-primary font-medium">
                    <span className="material-symbols-outlined text-sm">schedule</span>
                    <span>Daily Service: 11:00 AM – 11:30 PM</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">location_on</span>
                    <span>{clientDetails.address}</span>
                  </div>
                </div>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
};
