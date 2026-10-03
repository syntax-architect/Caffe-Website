import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { clientDetails } from '../config/client';
import { useUI } from '../context/UIContext';
import { useSiteConfig } from '../context/SiteConfigContext';

export const Header: React.FC = () => {
  const { cartCount, setIsDrawerOpen } = useCart();
  const { setIsReservationOpen } = useUI();
  const { restaurantConfig, logoUrl } = useSiteConfig();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const businessName = restaurantConfig?.businessName || clientDetails.businessName;
  const shortName = restaurantConfig?.shortName || clientDetails.shortName;
  const phone = restaurantConfig?.contact?.phone || clientDetails.phone;
  const address = restaurantConfig?.address?.line1 || clientDetails.address;
  const openingHours = `${restaurantConfig?.openingTime || '11:00 AM'} – ${restaurantConfig?.closingTime || '11:00 PM'}`;

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
        >
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border border-[#D4AF37]/35 bg-[#160E0A] flex items-center justify-center transition-all duration-300 group-hover:border-[#D4AF37] group-hover:shadow-[0_0_15px_rgba(212,175,55,0.3)] overflow-hidden shrink-0">
            <img 
              src={logoUrl || "/logo.webp"} 
              alt={`${businessName} Crest`} 
              width="44"
              height="44"
              className="w-full h-full object-contain" 
              loading="lazy"
              fetchPriority="low"
              decoding="async" 
            />
          </div>
          <div className="flex flex-col">
            <span className="font-serif text-base sm:text-lg tracking-tight text-on-surface font-semibold group-hover:text-primary transition-colors">
              {businessName}
            </span>
            <span className="font-sans text-[10px] tracking-[0.25em] uppercase text-primary/80 -mt-0.5 font-medium">
              {shortName}
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
            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
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
              <svg className="w-4 h-4 text-[#18110c]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M10 14h4M6 18h12M7 6v14M17 6v14" />
              </svg>
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

      {/* Editorial Luxury Mobile Navigation Modal Overlay with Staggered Mask Reveal */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 top-0 bg-black/85 backdrop-blur-xl z-40 lg:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, y: -20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className="lg:hidden fixed top-20 left-0 right-0 max-h-[calc(100dvh-5.5rem)] bg-gradient-to-b from-[#160E0A] via-[#120B08] to-[#0D0705] border-b border-[#D4AF37]/35 shadow-[0_30px_70px_rgba(0,0,0,0.9)] z-50 overflow-y-auto rounded-b-[2rem]"
            >
              <div className="max-w-[1320px] mx-auto px-5 py-6 flex flex-col gap-6">
                
                {/* Brand Monogram & Live Service Status Strip */}
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full border border-[#D4AF37]/40 bg-[#1A110C] flex items-center justify-center text-primary text-xs font-serif font-bold">
                      TCB
                    </div>
                    <div className="flex flex-col">
                      <span className="font-serif text-sm font-semibold text-on-surface">The Café Barrackpore</span>
                      <span className="font-sans text-[9px] uppercase tracking-[0.2em] text-primary/80">Cantonment Dining</span>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-sans font-semibold uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Open Now</span>
                  </div>
                </div>

                {/* Staggered Numerated Editorial Links */}
                <nav className="flex flex-col gap-1">
                  {navLinks.map((link, idx) => (
                    <motion.a 
                      key={link.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.04, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                      className="group flex items-center justify-between py-3.5 px-3 rounded-xl border-b border-white/5 active:bg-white/5 active:text-primary transition-all duration-200" 
                      href={`#${link.id}`} 
                      onClick={(e) => handleNavClick(e, link.id)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-sans text-[11px] uppercase tracking-widest text-[#D4AF37]/50 font-bold group-hover:text-primary transition-colors">
                          0{idx + 1}
                        </span>
                        <span className="font-serif text-xl sm:text-2xl text-on-surface group-hover:text-primary transition-colors font-normal">
                          {link.label}
                        </span>
                      </div>
                      <span className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-primary group-hover:bg-[#D4AF37]/20 transition-all">
                        <span className="material-symbols-outlined text-[15px] transform group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
                      </span>
                    </motion.a>
                  ))}
                </nav>
                
                {/* Mobile CTAs */}
                <div className="flex flex-col gap-2.5 pt-1">
                  <button 
                    type="button"
                    onClick={() => { setIsReservationOpen(true); setIsMobileMenuOpen(false); }}
                    className="group relative w-full h-12 rounded-full bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C5A028] text-[#120B08] text-xs font-sans font-bold uppercase tracking-wider flex items-center justify-between pl-6 pr-2 shadow-[0_4px_20px_rgba(212,175,55,0.3)] active:scale-[0.98] transition-transform cursor-pointer"
                  >
                    <span>Reserve a Table</span>
                    <div className="w-8 h-8 rounded-full bg-[#120B08]/15 flex items-center justify-center transition-transform group-hover:scale-105">
                      <span className="material-symbols-outlined text-[16px] text-[#120B08]">table_restaurant</span>
                    </div>
                  </button>

                  <div className="grid grid-cols-2 gap-2.5">
                    <a
                      href={`tel:${phone}`}
                      className="h-11 rounded-full border border-white/15 bg-white/5 text-on-surface text-[11px] font-sans font-semibold uppercase tracking-wider flex items-center justify-center gap-2 active:bg-white/10 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px] text-primary">call</span>
                      <span>Call Concierge</span>
                    </a>
                    <a
                      href={clientDetails.googleMapsLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-11 rounded-full border border-white/15 bg-white/5 text-on-surface text-[11px] font-sans font-semibold uppercase tracking-wider flex items-center justify-center gap-2 active:bg-white/10 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px] text-primary">directions</span>
                      <span>Directions</span>
                    </a>
                  </div>
                </div>

                {/* Restaurant Hours & Location Micro-Footer */}
                <div className="pt-4 border-t border-white/10 flex flex-col gap-1.5 text-[11px] text-on-surface/65 font-sans">
                  <div className="flex items-center gap-2 text-primary font-medium">
                    <span className="material-symbols-outlined text-sm">schedule</span>
                    <span>Daily Service: {openingHours}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">location_on</span>
                    <span className="truncate">{address}</span>
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
