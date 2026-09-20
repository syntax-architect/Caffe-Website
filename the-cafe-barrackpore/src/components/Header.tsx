import React, { useEffect, useState } from 'react';
import { useCart } from '../context/CartContext';

export const Header: React.FC = () => {
  const { cartCount, setIsDrawerOpen } = useCart();
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <header className="fixed top-0 w-full z-50 bg-surface-container-lowest/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="h-20 max-w-[1320px] mx-auto px-gutter flex items-center justify-between gap-space-md">
        <div className="flex items-center gap-space-lg">
          <a className="flex items-center gap-space-sm group" href="#" onClick={(e) => handleNavClick(e, 'root')}>
            <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center shadow-[0_0_16px_rgba(249,115,22,0.25)] group-hover:shadow-[0_0_24px_rgba(249,115,22,0.4)] transition-all">
              <span className="material-symbols-outlined text-primary text-2xl">local_cafe</span>
            </div>
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm tracking-tight text-on-surface font-semibold group-hover:text-primary transition-colors">The Cafe</span>
              <span className="font-label-sm text-label-sm tracking-widest uppercase text-tertiary -mt-1">Barrackpore</span>
            </div>
          </a>
          <nav className="hidden xl:flex items-center gap-space-xs p-1 bg-surface-container-low/60 rounded-full">
            <a className="px-space-md py-space-xs rounded-full font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors" href="#" onClick={(e) => handleNavClick(e, 'about-and-vibe')}>About & Vibe</a>
            <a className="px-space-md py-space-xs rounded-full font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors" href="#" onClick={(e) => handleNavClick(e, 'menu-section')}>Menu</a>
            <a className="px-space-md py-space-xs rounded-full font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors" href="#" onClick={(e) => handleNavClick(e, 'chef-specials')}>Specials</a>
            <a className="px-space-md py-space-xs rounded-full font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors" href="#" onClick={(e) => handleNavClick(e, 'visit-and-hours')}>Visit</a>
          </nav>
        </div>
        <div className="flex items-center gap-space-md">
          <button 
            onClick={toggleTheme}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface transition-all"
            title="Toggle Theme"
          >
            <span className="material-symbols-outlined text-xl">{isDark ? 'light_mode' : 'dark_mode'}</span>
          </button>
          
          <button 
            onClick={() => setIsDrawerOpen(true)}
            className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface transition-all"
            title="View Order Bag"
          >
            <span className="material-symbols-outlined text-primary text-xl">shopping_bag</span>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary-container text-on-primary-container font-label-sm text-[11px] font-bold flex items-center justify-center shadow-[0_0_10px_rgba(249,115,22,0.6)]">
                {cartCount}
              </span>
            )}
          </button>
          <a className="hidden lg:flex items-center gap-space-xs font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors" href="tel:+9198300XXXXX">
            <span className="material-symbols-outlined text-primary text-lg">call</span>
            <span>+91 98300 XXXXX</span>
          </a>
          <div className="hidden sm:flex items-center gap-space-sm">
            <a className="px-space-md py-space-sm rounded-xl font-label-md text-label-md text-secondary bg-secondary-container/10 hover:bg-secondary-container/20 hover:text-on-surface transition-all" href="#" onClick={(e) => handleNavClick(e, 'menu-section')}>Explore Menu</a>
            <a className="px-space-md py-space-sm rounded-xl font-label-md text-label-md text-on-primary-container bg-primary-container shadow-[0_0_16px_rgba(249,115,22,0.35)] hover:shadow-[0_0_24px_rgba(249,115,22,0.55)] transition-all flex items-center gap-space-xs" href="#">
              <span className="material-symbols-outlined text-sm">table_restaurant</span>
              <span>Book a Table</span>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
};
