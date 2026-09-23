import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';

export const Header: React.FC = () => {
  const { cartCount, setIsDrawerOpen } = useCart();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      const y = element.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <header className={`fixed top-0 w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-black/40 backdrop-blur-md border-b border-white/5' : 'bg-transparent'}`}>
      <div className="h-20 max-w-[1320px] mx-auto px-4 md:px-6 lg:px-12 flex items-center justify-between gap-4 md:gap-6">
        
        <div className="flex items-center gap-10">
          <a className="flex items-center gap-3 group" href="#" onClick={(e) => handleNavClick(e, 'root')}>
            <div className="w-10 h-10 rounded-full border border-white/10 bg-[#231914] flex items-center justify-center transition-all group-hover:border-[#D4AF37]/50 overflow-hidden drop-shadow-[0_0_10px_rgba(212,175,55,0.1)]">
              <img src="/logo.png" alt="The Cafe Logo" className="w-full h-full object-contain" fetchPriority="high" decoding="sync" />
            </div>
            <div className="flex flex-col">
              <span className="font-headline-sm text-base sm:text-lg tracking-tight text-[#E3DACD] font-medium group-hover:text-[#D4AF37] transition-colors">The Cafe</span>
              <span className="font-label-sm text-[9px] sm:text-[10px] tracking-widest uppercase text-[#D4AF37]/80 -mt-1">Barrackpore</span>
            </div>
          </a>
          
          <nav className="hidden xl:flex items-center gap-1 p-1 bg-white/5 rounded-full border border-white/5">
            <a className="px-5 py-2 rounded-full font-label-md text-sm text-[#E3DACD]/80 hover:text-[#231914] hover:bg-[#D4AF37] transition-colors" href="#" onClick={(e) => handleNavClick(e, 'about-and-vibe')}>About & Vibe</a>
            <a className="px-5 py-2 rounded-full font-label-md text-sm text-[#E3DACD]/80 hover:text-[#231914] hover:bg-[#D4AF37] transition-colors" href="#" onClick={(e) => handleNavClick(e, 'menu-section')}>Menu</a>
            <a className="px-5 py-2 rounded-full font-label-md text-sm text-[#E3DACD]/80 hover:text-[#231914] hover:bg-[#D4AF37] transition-colors" href="#" onClick={(e) => handleNavClick(e, 'chef-specials')}>Specials</a>
            <a className="px-5 py-2 rounded-full font-label-md text-sm text-[#E3DACD]/80 hover:text-[#231914] hover:bg-[#D4AF37] transition-colors" href="#" onClick={(e) => handleNavClick(e, 'reserve-section')}>Visit</a>
          </nav>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsDrawerOpen(true)}
            className="relative flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-[#E3DACD] transition-all"
            title="View Order Bag"
          >
            <span className="material-symbols-outlined text-[#D4AF37] text-xl font-light">shopping_bag</span>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#D4AF37] text-[#231914] font-label-sm text-[11px] font-bold flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
          
          <div className="hidden sm:flex items-center gap-3">
            <a className="px-6 py-2 rounded-full font-label-md text-sm text-[#D4AF37] border border-[#D4AF37]/30 hover:border-[#D4AF37] hover:bg-[#D4AF37]/5 transition-all" href="#" onClick={(e) => handleNavClick(e, 'menu-section')}>
              Explore Menu
            </a>
            <a className="px-6 py-2 rounded-full font-label-md text-sm text-[#231914] bg-[#D4AF37] hover:bg-[#ebd074] transition-all flex items-center gap-2" href="#" onClick={(e) => handleNavClick(e, 'reserve-section')}>
              <span className="material-symbols-outlined text-[16px] font-light">table_restaurant</span>
              <span>Book a Table</span>
            </a>
          </div>

          <button 
            className="xl:hidden relative flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-[#E3DACD] transition-all"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <span className="material-symbols-outlined">{isMobileMenuOpen ? 'close' : 'menu'}</span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="xl:hidden absolute top-full left-0 w-full bg-[#231914]/95 backdrop-blur-lg border-b border-white/10 shadow-xl"
          >
            <nav className="flex flex-col px-6 py-8 gap-6">
              <a className="font-headline-sm text-2xl text-[#E3DACD]" href="#" onClick={(e) => { handleNavClick(e, 'about-and-vibe'); setIsMobileMenuOpen(false); }}>About & Vibe</a>
              <a className="font-headline-sm text-2xl text-[#E3DACD]" href="#" onClick={(e) => { handleNavClick(e, 'menu-section'); setIsMobileMenuOpen(false); }}>Menu</a>
              <a className="font-headline-sm text-2xl text-[#E3DACD]" href="#" onClick={(e) => { handleNavClick(e, 'chef-specials'); setIsMobileMenuOpen(false); }}>Specials</a>
              <a className="font-headline-sm text-2xl text-[#E3DACD]" href="#" onClick={(e) => { handleNavClick(e, 'reserve-section'); setIsMobileMenuOpen(false); }}>Visit</a>
              
              <div className="flex flex-col gap-4 mt-6 pt-6 border-t border-white/10 sm:hidden">
                 <a className="px-6 py-3.5 text-center rounded-full font-label-md text-sm text-[#D4AF37] border border-[#D4AF37]/30" href="#" onClick={(e) => { handleNavClick(e, 'menu-section'); setIsMobileMenuOpen(false); }}>
                  Explore Menu
                </a>
                <a className="px-6 py-3.5 text-center rounded-full font-label-md text-sm text-[#231914] bg-[#D4AF37] flex items-center justify-center gap-2" href="#" onClick={(e) => { handleNavClick(e, 'reserve-section'); setIsMobileMenuOpen(false); }}>
                  <span className="material-symbols-outlined text-[18px]">table_restaurant</span>
                  Book a Table
                </a>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
