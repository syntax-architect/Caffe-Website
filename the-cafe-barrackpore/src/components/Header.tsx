import React, { useEffect, useState, useMemo } from 'react';
import { useCart } from '../context/CartContext';
import { clientDetails } from '../config/client';
import { useUI } from '../context/UIContext';
import { useSiteConfig } from '../context/SiteConfigContext';
import {
  DEFAULT_NAVIGATION_ITEMS,
  DEFAULT_HEADER_CONFIG,
} from '../config/defaultEngineConfig';
import type { NavigationItem } from '../types/restaurantEngine';

export const Header: React.FC = React.memo(() => {
  const { cartCount, setIsDrawerOpen } = useCart();
  const { setIsReservationOpen } = useUI();
  const { restaurantConfig, engineConfig, logoUrl } = useSiteConfig();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('');

  const businessName = restaurantConfig?.businessName || clientDetails.businessName;
  const shortName = restaurantConfig?.shortName || clientDetails.shortName;
  const phone = restaurantConfig?.contact?.phone || clientDetails.phone;
  const address = restaurantConfig?.address?.line1 || clientDetails.address;
  const openingHours = `${restaurantConfig?.openingTime || '11:00 AM'} – ${restaurantConfig?.closingTime || '11:00 PM'}`;
  const googleMapsLink = engineConfig?.brand?.googleMapsLink || clientDetails.googleMapsLink;

  const headerConfig = engineConfig?.header || DEFAULT_HEADER_CONFIG;
  const rawNavItems: NavigationItem[] = headerConfig.navigation && headerConfig.navigation.length > 0
    ? headerConfig.navigation
    : DEFAULT_NAVIGATION_ITEMS;

  const sections = engineConfig?.sections;

  // Filter navigation items by explicit item toggle and section visibility
  const visibleNavLinks = useMemo(() => {
    return rawNavItems.filter((link) => {
      if (link.enabled === false) return false;
      if (link.sectionKey && sections && sections[link.sectionKey] === false) return false;
      return true;
    });
  }, [rawNavItems, sections]);

  const activeSpySectionIds = useMemo(() => {
    return visibleNavLinks
      .map((link) => (link.href.startsWith('#') ? link.href.slice(1) : ''))
      .filter(Boolean);
  }, [visibleNavLinks]);

  useEffect(() => {
    let ticking = false;

    const updateScrollAndActive = () => {
      const scrollY = window.scrollY;
      setIsScrolled(scrollY > 25);

      // Hero / Top of page — no link highlighted
      if (scrollY < 180) {
        setActiveSection('');
        return;
      }

      // Near bottom of page — highlight last visible section
      const isAtBottom = window.innerHeight + scrollY >= document.documentElement.scrollHeight - 70;
      if (isAtBottom && activeSpySectionIds.length > 0) {
        setActiveSection(activeSpySectionIds[activeSpySectionIds.length - 1]);
        return;
      }

      // Focal reading line: 35% down viewport
      const focalLine = window.innerHeight * 0.35;

      const elements = activeSpySectionIds
        .map((id) => ({ id, el: document.getElementById(id) }))
        .filter((item): item is { id: string; el: HTMLElement } => Boolean(item.el));

      // 1. Check if section bounds contain the focal line
      for (const { id, el } of elements) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= focalLine && rect.bottom > focalLine) {
          setActiveSection(id);
          return;
        }
      }

      // 2. Fallback: last section whose top has crossed the focal line
      for (let i = elements.length - 1; i >= 0; i--) {
        const { id, el } = elements[i];
        const rect = el.getBoundingClientRect();
        if (rect.top <= focalLine) {
          setActiveSection(id);
          return;
        }
      }
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          updateScrollAndActive();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    updateScrollAndActive();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [activeSpySectionIds]);

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

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('http://') || href.startsWith('https://')) {
      // External link - allow default navigation
      setIsMobileMenuOpen(false);
      document.body.style.overflow = '';
      return;
    }

    e.preventDefault();
    setIsMobileMenuOpen(false);
    document.body.style.overflow = '';

    const id = href.startsWith('#') ? href.slice(1) : href;

    if (id === 'root' || !id) {
      setActiveSection('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      const headerOffset = 75;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - headerOffset;
      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: 'smooth'
      });
    }
  };

  const handlePrimaryCtaClick = () => {
    setIsMobileMenuOpen(false);
    if (headerConfig.primaryCtaAction === 'menu') {
      const menuEl = document.getElementById('menu-section');
      if (menuEl) {
        menuEl.scrollIntoView({ behavior: 'smooth' });
      }
    } else if (headerConfig.primaryCtaAction === 'custom' && headerConfig.primaryCtaHref) {
      window.location.href = headerConfig.primaryCtaHref;
    } else {
      setIsReservationOpen(true);
    }
  };

  const isCartEnabled = headerConfig.showCart !== false &&
    restaurantConfig?.isOrderingEnabled !== false &&
    engineConfig?.features?.orderingEnabled !== false;

  const showPrimaryCta = headerConfig.showPrimaryCta !== false &&
    engineConfig?.features?.reservationsEnabled !== false;

  // On desktop navigation, render primary links (excluding reserve-section if handled by button CTA)
  const desktopNavLinks = visibleNavLinks.filter((l) => l.href !== '#reserve-section').slice(0, 5);

  return (
    <header className={`fixed top-0 w-full z-50 transition-[background-color,backdrop-filter,border-color,box-shadow,padding] duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${isScrolled ? 'bg-surface/92 backdrop-blur-xl border-b border-primary/25 shadow-[0_10px_30px_rgba(0,0,0,0.65)] py-3' : 'bg-transparent py-5'}`}>
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-12 flex items-center justify-between gap-4">
        
        {/* Brand Crest & Monogram */}
        <a 
          className="flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl p-1" 
          href="#" 
          onClick={(e) => handleNavClick(e, 'root')}
        >
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border border-primary/35 bg-surface-container flex items-center justify-center transition-all duration-300 group-hover:border-primary group-hover:shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.3)] overflow-hidden shrink-0">
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
            <span className="font-sans text-base sm:text-lg tracking-tight text-on-surface font-semibold group-hover:text-primary transition-colors">
              {businessName}
            </span>
            <span className="font-sans text-[10px] tracking-[0.25em] uppercase text-primary/80 -mt-0.5 font-medium">
              {shortName}
            </span>
          </div>
        </a>
        
        {/* Architectural Desktop Navigation with Active Section Indicator */}
        {desktopNavLinks.length > 0 && (
          <nav className="hidden lg:flex items-center gap-7 px-6 py-2 rounded-full bg-surface-container/60 backdrop-blur-md border border-outline/20 shadow-lg">
            {desktopNavLinks.map((link) => {
              const linkSectionId = link.href.startsWith('#') ? link.href.slice(1) : '';
              const isActive = activeSection === linkSectionId;
              return (
                <a 
                  key={link.id}
                  className={`font-sans text-[12px] uppercase tracking-[0.16em] transition-colors relative py-1 group font-medium ${
                    isActive ? 'text-primary' : 'text-on-surface/75 hover:text-primary'
                  }`} 
                  href={link.href}
                  target={link.isExternal ? '_blank' : undefined}
                  rel={link.isExternal ? 'noopener noreferrer' : undefined}
                  onClick={(e) => handleNavClick(e, link.href)}
                >
                  <span>{link.label}</span>
                  <span 
                    className={`absolute bottom-0 left-0 h-[1.5px] bg-primary transition-all duration-300 ease-out ${
                      isActive ? 'w-full shadow-[0_0_8px_rgba(var(--color-primary-rgb),0.6)]' : 'w-0 group-hover:w-full'
                    }`} 
                  />
                </a>
              );
            })}
          </nav>
        )}
        
        {/* Right Actions & Tactile Controls */}
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          {/* Order Bag / Cart Button with Glow Badge */}
          {isCartEnabled && (
            <button 
              onClick={() => setIsDrawerOpen(true)}
              className="relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full border border-outline/20 bg-surface-container/80 hover:border-primary/50 hover:bg-surface-container-high text-on-surface transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95 cursor-pointer shadow-md"
              aria-label={`View order bag with ${cartCount} items`}
              title="View Order Bag"
            >
              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-on-primary font-sans text-[11px] font-extrabold flex items-center justify-center shadow-[0_2px_8px_rgba(var(--color-primary-rgb),0.4)] animate-in zoom-in duration-200">
                  {cartCount}
                </span>
              )}
            </button>
          )}
          
          {/* Refined Luxury Primary CTA (Desktop) */}
          {showPrimaryCta && (
            <button 
              type="button"
              onClick={handlePrimaryCtaClick}
              className="hidden sm:inline-flex items-center gap-2 h-9 px-5 rounded-full bg-primary hover:opacity-90 active:opacity-95 text-on-primary font-sans text-[11px] font-semibold tracking-[0.18em] uppercase transition-all duration-300 shadow-[0_2px_12px_rgba(var(--color-primary-rgb),0.25)] hover:shadow-[0_4px_16px_rgba(var(--color-primary-rgb),0.4)] active:scale-95 cursor-pointer shrink-0"
            >
              <span>
                {restaurantConfig?.isTableBookingEnabled !== false
                  ? (headerConfig.primaryCtaText || 'Book a Table')
                  : 'Walk-Ins Welcome'}
              </span>
              <span className="material-symbols-outlined text-[15px] font-light">
                {restaurantConfig?.isTableBookingEnabled !== false ? 'table_restaurant' : 'storefront'}
              </span>
            </button>
          )}

          {/* Mobile Menu Fluid Hamburger Morph */}
          <button 
            className="lg:hidden relative flex items-center justify-center w-10 h-10 rounded-full border border-outline/20 bg-surface-container/80 hover:bg-surface-container-high text-on-surface transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer active:scale-95"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isMobileMenuOpen}
          >
            <div className="w-5 h-4 relative flex flex-col justify-between items-center">
              <span 
                className={`w-full h-0.5 bg-on-surface rounded-full transition-all duration-300 transform origin-center ${
                  isMobileMenuOpen ? 'rotate-45 translate-y-[7px] bg-primary' : ''
                }`} 
              />
              <span 
                className={`w-full h-0.5 bg-on-surface rounded-full transition-all duration-200 ${
                  isMobileMenuOpen ? 'opacity-0' : 'opacity-100'
                }`} 
              />
              <span 
                className={`w-full h-0.5 bg-on-surface rounded-full transition-all duration-300 transform origin-center ${
                  isMobileMenuOpen ? '-rotate-45 -translate-y-[7px] bg-primary' : ''
                }`} 
              />
            </div>
          </button>
        </div>
      </div>

      {/* Editorial Luxury Mobile Navigation Modal Overlay */}
      <div
        className={`fixed inset-0 top-0 bg-black/85 backdrop-blur-xl z-40 lg:hidden transition-opacity duration-300 ${
          isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMobileMenuOpen(false)}
        aria-hidden="true"
      />
      <div 
        className={`lg:hidden fixed top-20 left-0 right-0 max-h-[calc(100dvh-5.5rem)] bg-surface-container/98 border-b border-primary/35 shadow-[0_30px_70px_rgba(0,0,0,0.9)] z-50 overflow-y-auto overscroll-contain rounded-b-[2rem] transition-all duration-300 ease-out transform ${
          isMobileMenuOpen ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto' : 'opacity-0 -translate-y-4 scale-98 pointer-events-none'
        }`}
      >
        <div className="max-w-[1320px] mx-auto px-5 py-6 flex flex-col gap-6">
          
          {/* Brand Monogram & Live Service Status Strip */}
          <div className="flex items-center justify-between pb-4 border-b border-outline/15">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full border border-primary/40 bg-surface-container-low flex items-center justify-center text-primary text-xs font-serif font-bold">
                {businessName.split(/\s+/).filter(Boolean).map((w: string) => w[0]).join('').slice(0, 3).toUpperCase() || 'TCB'}
              </div>
              <div className="flex flex-col">
                <span className="font-serif text-sm font-semibold text-on-surface">{businessName}</span>
                <span className="font-sans text-[9px] uppercase tracking-[0.2em] text-primary/80">
                  {restaurantConfig?.address?.city || shortName || 'Dining'}
                </span>
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-sans font-semibold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Open Now</span>
            </div>
          </div>

          {/* Staggered Numerated Editorial Links with Active Section Highlight */}
          <nav className="flex flex-col gap-1">
            {visibleNavLinks.map((link, idx) => {
              const linkSectionId = link.href.startsWith('#') ? link.href.slice(1) : '';
              const isActive = activeSection === linkSectionId;
              return (
                <a 
                  key={link.id}
                  className={`group flex items-center justify-between py-3.5 px-3 rounded-xl border-b border-outline/10 active:bg-surface-container transition-all duration-200 ${
                    isActive ? 'bg-primary/10 text-primary' : 'text-on-surface'
                  }`} 
                  href={link.href}
                  target={link.isExternal ? '_blank' : undefined}
                  rel={link.isExternal ? 'noopener noreferrer' : undefined}
                  onClick={(e) => handleNavClick(e, link.href)}
                >
                  <div className="flex items-center gap-3">
                    <span className={`font-sans text-[11px] uppercase tracking-widest font-bold transition-colors ${
                      isActive ? 'text-primary' : 'text-primary/60 group-hover:text-primary'
                    }`}>
                      0{idx + 1}
                    </span>
                    <span className={`font-serif text-xl sm:text-2xl transition-colors font-normal ${
                      isActive ? 'text-primary' : 'text-on-surface group-hover:text-primary'
                    }`}>
                      {link.label}
                    </span>
                  </div>
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                    isActive ? 'bg-primary/25 text-primary' : 'bg-surface-container text-primary group-hover:bg-primary/20'
                  }`}>
                    <span className="material-symbols-outlined text-[15px] transform group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
                  </span>
                </a>
              );
            })}
          </nav>
          
          {/* Mobile CTAs */}
          <div className="flex flex-col gap-2.5 pt-1">
            {showPrimaryCta && (
              <button 
                type="button"
                onClick={handlePrimaryCtaClick}
                className="group relative w-full h-12 rounded-full bg-primary text-on-primary text-xs font-sans font-bold uppercase tracking-wider flex items-center justify-between pl-6 pr-2 shadow-[0_4px_20px_rgba(var(--color-primary-rgb),0.3)] active:scale-[0.98] transition-transform cursor-pointer"
              >
                <span>
                  {restaurantConfig?.isTableBookingEnabled !== false
                    ? (headerConfig.primaryCtaText || 'Reserve a Table')
                    : 'Walk-Ins Welcome'}
                </span>
                <div className="w-8 h-8 rounded-full bg-on-primary/15 flex items-center justify-center transition-transform group-hover:scale-105">
                  <span className="material-symbols-outlined text-[16px] text-on-primary">
                    {restaurantConfig?.isTableBookingEnabled !== false ? 'table_restaurant' : 'storefront'}
                  </span>
                </div>
              </button>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              {phone && headerConfig.showCallAction !== false ? (
                <a
                  href={`tel:${phone}`}
                  className="h-11 rounded-full border border-outline/25 bg-surface-container/60 text-on-surface text-[11px] font-sans font-semibold uppercase tracking-wider flex items-center justify-center gap-2 active:bg-surface-container transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px] text-primary">call</span>
                  <span>Call Concierge</span>
                </a>
              ) : null}
              {googleMapsLink && headerConfig.showDirectionsAction !== false ? (
                <a
                  href={googleMapsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-11 rounded-full border border-outline/25 bg-surface-container/60 text-on-surface text-[11px] font-sans font-semibold uppercase tracking-wider flex items-center justify-center gap-2 active:bg-surface-container transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px] text-primary">directions</span>
                  <span>Directions</span>
                </a>
              ) : null}
            </div>
          </div>

          {/* Restaurant Hours & Location Micro-Footer */}
          <div className="pt-4 border-t border-white/10 flex flex-col gap-1.5 text-[11px] text-on-surface/65 font-sans">
            <div className="flex items-center gap-2 text-primary font-medium">
              <span className="material-symbols-outlined text-sm">schedule</span>
              <span>Daily Service: {openingHours}</span>
            </div>
            {address && (
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">location_on</span>
                <span className="truncate">{address}</span>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
});

Header.displayName = 'Header';
