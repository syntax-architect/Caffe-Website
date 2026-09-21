import React, { useEffect, useState } from 'react';
import { useCart } from '../context/CartContext';

export const Header: React.FC = () => {
  const { cartCount, setIsDrawerOpen } = useCart();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <header className={`fixed top-0 w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-black/40 backdrop-blur-md border-b border-white/5' : 'bg-transparent'}`}>
      <div className="h-20 max-w-[1320px] mx-auto px-6 lg:px-12 flex items-center justify-between gap-6">
        
        <div className="flex items-center gap-10">
          <a className="flex items-center gap-3 group" href="#" onClick={(e) => handleNavClick(e, 'root')}>
            <div className="w-10 h-10 rounded-full border border-white/10 bg-[#231914] flex items-center justify-center transition-all group-hover:border-[#D4AF37]/50">
              <span className="material-symbols-outlined text-[#D4AF37] text-xl font-light">local_cafe</span>
            </div>
            <div className="flex flex-col">
              <span className="font-headline-sm text-lg tracking-tight text-[#E3DACD] font-medium group-hover:text-[#D4AF37] transition-colors">The Cafe</span>
              <span className="font-label-sm text-[10px] tracking-widest uppercase text-[#D4AF37]/80 -mt-1">Barrackpore</span>
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
        </div>
      </div>
    </header>
  );
};
