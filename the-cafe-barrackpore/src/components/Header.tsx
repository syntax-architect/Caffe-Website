import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useCart } from '../context/CartContext';
import { clientDetails, isCleanExperience } from '../config/client';
import { useUI } from '../context/UIContext';
import { useSiteConfig } from '../context/SiteConfigContext';
import {
  DEFAULT_HEADER_CONFIG,
} from '../config/defaultEngineConfig';
import type { SectionVisibilityConfig } from '../types/restaurantEngine';
import { smoothScrollTo } from '../utils/scroll';
import { useI18n } from '../i18n';
import { LanguageSwitcher } from './LanguageSwitcher';

/**
 * All website sections in their exact, canonical top-to-bottom narrative sequence.
 * 100% synchronized with the page architecture in App.tsx.
 */
export interface OrderedSectionItem {
  id: string;
  label: string;
  shortLabel: string;
  icon: string;
  href: string;
  sectionKey?: keyof SectionVisibilityConfig;
  badge?: string;
  chapterIndex: number;
  chapterTitle: string;
  description: string;
}

export const ORDERED_FLAGSHIP_SECTIONS: OrderedSectionItem[] = [
  {
    id: 'sec-vibe',
    label: 'Atmosphere & Vibe',
    shortLabel: 'Home',
    icon: 'local_cafe',
    href: '#about-and-vibe',
    sectionKey: 'aboutVibe',
    badge: 'Ambience',
    chapterIndex: 1,
    chapterTitle: 'Act I • Atmosphere',
    description: 'Nocturnal acoustics, warm amber lighting & salon design',
  },
  {
    id: 'sec-menu',
    label: 'Curated Menu',
    shortLabel: 'Curated Menu',
    icon: 'restaurant_menu',
    href: '#menu-section',
    sectionKey: 'menu',
    badge: 'Cuisine',
    chapterIndex: 2,
    chapterTitle: 'Act II • Cuisine',
    description: 'Artisanal sourdough, gourmet mains & wood-fired pizza',
  },
  {
    id: 'sec-specials',
    label: "Chef's Specials",
    shortLabel: 'Specials',
    icon: 'star',
    href: '#chef-specials',
    sectionKey: 'specialsBanner',
    badge: 'Signature',
    chapterIndex: 3,
    chapterTitle: 'Act III • Signatures',
    description: 'Flame-charred communal feasts & signature platters',
  },
  {
    id: 'sec-story',
    label: 'Heritage & Roots',
    shortLabel: 'Our Story',
    icon: 'menu_book',
    href: '#our-story',
    sectionKey: 'story',
    badge: 'Heritage',
    chapterIndex: 4,
    chapterTitle: 'Act IV • Heritage',
    description: 'Decades of artisan roasting & specialty coffee culture',
  },
  {
    id: 'sec-gallery',
    label: 'Moments Gallery',
    shortLabel: 'Gallery',
    icon: 'photo_camera',
    href: '#gallery',
    sectionKey: 'gallery',
    badge: 'Visuals',
    chapterIndex: 5,
    chapterTitle: 'Act V • Visuals',
    description: 'Candid dining glimpses, latte art & interior angles',
  },
  {
    id: 'sec-vip',
    label: 'Nocturnal VIP Circle',
    shortLabel: 'VIP Club',
    icon: 'workspace_premium',
    href: '#vip-club',
    sectionKey: 'vipClub',
    badge: 'Private',
    chapterIndex: 6,
    chapterTitle: 'Act VI • VIP Circle',
    description: 'Secret pours, priority table access & tasting invitations',
  },
  {
    id: 'sec-hours',
    label: 'Visit, Hours & Tables',
    shortLabel: 'Reservations',
    icon: 'calendar_month',
    href: '#reserve-section',
    sectionKey: 'footer',
    badge: 'Concierge',
    chapterIndex: 7,
    chapterTitle: 'Act VII • Concierge',
    description: 'Daily service schedule, location map & table reservations',
  },
];

export const Header: React.FC = React.memo(() => {
  const { cartCount, setIsDrawerOpen } = useCart();
  const { setIsReservationOpen } = useUI();
  const { restaurantConfig, engineConfig, logoUrl } = useSiteConfig();
  const { t } = useI18n();
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
  const sections = engineConfig?.sections;

  // Active ordered flagship items respecting dynamic section toggles and active language
  const enabledOrderedSections = useMemo(() => {
    if (isCleanExperience()) {
      const cleanNavItems: OrderedSectionItem[] = [
        {
          id: 'sec-clean-menu',
          label: t('nav.menu', 'Menu'),
          shortLabel: t('nav.menu', 'Menu'),
          icon: 'restaurant_menu',
          href: '#menu-section',
          sectionKey: 'menu',
          chapterIndex: 1,
          chapterTitle: t('nav.menu', 'Menu'),
          description: t('nav.menu', 'Curated Culinary Menu'),
        },
        {
          id: 'sec-clean-platters',
          label: t('nav.platters', 'Platters'),
          shortLabel: t('nav.platters', 'Platters'),
          icon: 'star',
          href: '#chef-specials',
          sectionKey: 'specialsBanner',
          chapterIndex: 2,
          chapterTitle: t('nav.platters', 'Platters'),
          description: t('nav.platters', "Chef's Signature Banquets"),
        },
        {
          id: 'sec-clean-story',
          label: t('nav.story', 'Story'),
          shortLabel: t('nav.story', 'Story'),
          icon: 'menu_book',
          href: '#our-story',
          sectionKey: 'story',
          chapterIndex: 3,
          chapterTitle: t('nav.story', 'Story'),
          description: t('nav.story', 'Heritage & Philosophy'),
        },
        {
          id: 'sec-clean-gallery',
          label: t('nav.gallery', 'Gallery'),
          shortLabel: t('nav.gallery', 'Gallery'),
          icon: 'photo_camera',
          href: '#gallery',
          sectionKey: 'gallery',
          chapterIndex: 4,
          chapterTitle: t('nav.gallery', 'Gallery'),
          description: t('nav.gallery', 'Chronicles & Spaces'),
        },
        {
          id: 'sec-clean-vip',
          label: t('nav.vip', 'VIP'),
          shortLabel: t('nav.vip', 'VIP'),
          icon: 'workspace_premium',
          href: '#vip-club',
          sectionKey: 'vipClub',
          chapterIndex: 5,
          chapterTitle: t('nav.vip', 'VIP'),
          description: t('nav.vip', 'Private Dining & Tastings'),
        },
        {
          id: 'sec-clean-reserve',
          label: t('nav.reserve', 'Reserve'),
          shortLabel: t('nav.reserve', 'Reserve'),
          icon: 'calendar_month',
          href: '#reserve-section',
          sectionKey: 'footer',
          chapterIndex: 6,
          chapterTitle: t('nav.reserve', 'Reserve'),
          description: t('nav.reserve', 'Table Bookings & Concierge'),
        },
      ];

      return cleanNavItems.filter((item) => {
        if (item.sectionKey && sections && sections[item.sectionKey] === false) return false;
        return true;
      });
    }

    return ORDERED_FLAGSHIP_SECTIONS.filter((item) => {
      if (item.sectionKey && sections && sections[item.sectionKey] === false) return false;
      return true;
    }).map((item) => {
      let label = item.label;
      let shortLabel = item.shortLabel;
      if (item.sectionKey === 'aboutVibe') {
        label = t('nav.act1', item.label);
        shortLabel = t('nav.home', item.shortLabel);
      } else if (item.sectionKey === 'menu') {
        label = t('nav.act2', item.label);
        shortLabel = t('nav.menu', item.shortLabel);
      } else if (item.sectionKey === 'specialsBanner') {
        label = t('nav.act3', item.label);
        shortLabel = t('nav.specials', item.shortLabel);
      } else if (item.sectionKey === 'story') {
        label = t('nav.act4', item.label);
        shortLabel = t('nav.ourStory', item.shortLabel);
      } else if (item.sectionKey === 'gallery') {
        label = t('nav.act5', item.label);
        shortLabel = t('nav.gallery', item.shortLabel);
      } else if (item.sectionKey === 'vipClub') {
        label = t('nav.act6', item.label);
        shortLabel = t('nav.vipClub', item.shortLabel);
      } else if (item.sectionKey === 'footer') {
        label = t('nav.act7', item.label);
        shortLabel = t('nav.reservations', item.shortLabel);
      }
      const max14 = (s: string) => (s && s.length > 14 ? s.slice(0, 13) + '…' : s);
      return {
        ...item,
        label: max14(label),
        shortLabel: max14(shortLabel),
      };
    });
  }, [sections, t]);

  // All anchor IDs to track with scroll-spy
  const activeSpySectionIds = useMemo(() => {
    return enabledOrderedSections
      .map((item) => (item.href.startsWith('#') ? item.href.slice(1) : ''))
      .filter(Boolean);
  }, [enabledOrderedSections]);

  // Scroll spy effect with smooth focal line detection and zero-redundancy updates
  useEffect(() => {
    let ticking = false;
    let lastActive = '';
    let lastScrolled = typeof window !== 'undefined' ? window.scrollY > 25 : false;
    setIsScrolled(lastScrolled);

    const updateScrollAndActive = () => {
      const scrollY = window.scrollY;
      const nextScrolled = scrollY > 25;
      if (nextScrolled !== lastScrolled) {
        lastScrolled = nextScrolled;
        setIsScrolled(nextScrolled);
      }

      // Hero / Top of page — no link highlighted
      if (scrollY < 180) {
        if (lastActive !== '') {
          lastActive = '';
          setActiveSection('');
        }
        return;
      }

      // Near bottom of page — highlight last visible section
      const isAtBottom = window.innerHeight + scrollY >= document.documentElement.scrollHeight - 70;
      if (isAtBottom && activeSpySectionIds.length > 0) {
        const bottomSection = activeSpySectionIds[activeSpySectionIds.length - 1];
        if (lastActive !== bottomSection) {
          lastActive = bottomSection;
          setActiveSection(bottomSection);
        }
        return;
      }

      // Focal reading line: 35% down viewport
      const focalLine = window.innerHeight * 0.35;

      const elements = activeSpySectionIds
        .map((id) => ({ id, el: document.getElementById(id) }))
        .filter((item): item is { id: string; el: HTMLElement } => Boolean(item.el));

      let matchedId = '';
      for (const { id, el } of elements) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= focalLine && rect.bottom > focalLine) {
          matchedId = id;
          break;
        }
      }

      if (!matchedId) {
        for (let i = elements.length - 1; i >= 0; i--) {
          const { id, el } = elements[i];
          const rect = el.getBoundingClientRect();
          if (rect.top <= focalLine) {
            matchedId = id;
            break;
          }
        }
      }

      if (matchedId && matchedId !== lastActive) {
        lastActive = matchedId;
        setActiveSection(matchedId);
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

  // Lock body scroll when mobile menu is open
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

  // Escape key close handlers
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
      smoothScrollTo('root');
      return;
    }

    setActiveSection(id);
    smoothScrollTo(id);
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

  return (
    <header className={`fixed top-0 w-full z-50 transition-[background-color,backdrop-filter,border-color,box-shadow,padding] duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${isScrolled ? 'bg-surface/94 backdrop-blur-xl border-b border-primary/25 shadow-[0_10px_30px_rgba(0,0,0,0.65)] py-2 sm:py-2.5' : 'bg-transparent py-2.5 sm:py-4'}`}>
      <div className="max-w-[1400px] mx-auto px-2.5 sm:px-4 lg:px-6 xl:px-8 flex items-center justify-between gap-1.5 sm:gap-3">
        
        {/* Brand Crest & Monogram with WCAG AA 4.5:1 Contrast Scrim */}
        <a 
          className="flex items-center gap-1.5 sm:gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl px-2 py-1 bg-surface-obsidian/75 backdrop-blur-md border border-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.45)] shrink min-w-0 cursor-pointer" 
          href="/" 
          onClick={(e) => handleNavClick(e, 'root')}
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-primary/35 bg-surface-container flex items-center justify-center transition-all duration-300 group-hover:border-primary group-hover:shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.3)] overflow-hidden shrink-0">
            <img 
              src={logoUrl || "/logo.webp"} 
              alt={`${businessName} Crest`} 
              width="40"
              height="40"
              className="w-full h-full object-contain" 
              loading="lazy"
              fetchPriority="low"
              decoding="async" 
            />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-sans text-xs sm:text-base font-semibold tracking-tight text-[#FAF6F0] group-hover:text-primary transition-colors truncate max-w-[85px] min-[360px]:max-w-[110px] min-[400px]:max-w-[150px] sm:max-w-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
              {businessName}
            </span>
            <span className="font-sans text-[8.5px] sm:text-[11px] tracking-[0.18em] sm:tracking-[0.25em] uppercase text-[#F3E5AB] -mt-0.5 font-medium truncate max-w-[85px] min-[360px]:max-w-[110px] min-[400px]:max-w-[150px] sm:max-w-none hidden min-[340px]:block drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              {shortName}
            </span>
          </div>
        </a>
        
        {/* Responsive Desktop Navigation Bar — shrinks gracefully to icon-only before any clipping */}
        <nav 
          data-testid="header-desktop-nav"
          className="hidden lg:flex items-center px-1.5 min-[1440px]:px-3 py-1.5 rounded-full bg-surface-container/75 backdrop-blur-xl border border-outline/25 shadow-[0_8px_24px_rgba(0,0,0,0.55)] relative shrink"
          aria-label={t('a11y.navigation', 'Chronological Website Navigation')}
        >
          <div className="flex items-center gap-0.5 xl:gap-1">
            {enabledOrderedSections.map((item) => {
              const itemSecId = item.href.slice(1);
              const isActive = activeSection === itemSecId;
              return (
                <a
                  key={item.id}
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item.href)}
                  title={item.shortLabel}
                  aria-label={item.shortLabel}
                  className={`font-sans text-[10.5px] xl:text-[11.5px] uppercase tracking-[0.08em] min-[1440px]:tracking-[0.12em] font-medium px-2 min-[1440px]:px-3.5 py-1.5 rounded-full transition-all duration-300 relative whitespace-nowrap group cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'text-primary bg-primary/15 shadow-[inset_0_0_12px_rgba(var(--color-primary-rgb),0.2)] font-semibold border border-primary/35'
                      : 'text-on-surface/75 hover:text-primary hover:bg-surface-container-high/60 border border-transparent'
                  }`}
                >
                  <span className="material-symbols-outlined text-[17px] shrink-0" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span data-testid="nav-item-text" className="hidden min-[1440px]:inline">
                    {item.shortLabel}
                  </span>
                  {/* Glowing gold active bottom indicator */}
                  <span
                    className={`absolute bottom-0.5 left-2 right-2 h-[1.5px] bg-primary transition-all duration-300 rounded-full ${
                      isActive ? 'opacity-100 shadow-[0_0_8px_rgba(var(--color-primary-rgb),0.9)]' : 'opacity-0 group-hover:opacity-50'
                    }`}
                  />
                </a>
              );
            })}
          </div>
        </nav>
        
        {/* Right Actions & Tactile Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Multi-Language Switcher */}
          <LanguageSwitcher variant="header" />

          {/* Order Bag / Cart Button with Glow Badge */}
          {isCartEnabled && (
            <motion.button 
              data-testid="header-cart-button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsDrawerOpen(true)}
              className="relative flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-full border border-outline/20 bg-surface-container/80 hover:border-primary/50 hover:bg-surface-container-high text-on-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer shadow-md shrink-0"
              aria-label={t('a11y.openCart', `View order bag with ${cartCount} items`)}
              title={t('cart.title', 'View Order Bag')}
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              {cartCount > 0 && (
                <motion.span 
                  key={cartCount}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                  className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-primary text-on-primary font-sans text-[9px] sm:text-[11px] font-extrabold flex items-center justify-center shadow-[0_2px_8px_rgba(var(--color-primary-rgb),0.4)]"
                >
                  {cartCount}
                </motion.span>
              )}
            </motion.button>
          )}
          
          {/* Refined Luxury Primary CTA (Book Button) */}
          {showPrimaryCta && (
            <motion.button 
              data-testid="header-book-button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={handlePrimaryCtaClick}
              className="inline-flex items-center justify-center gap-1 sm:gap-1.5 h-8 sm:h-9 px-2 sm:px-3.5 xl:px-4 2xl:px-5 rounded-full bg-primary hover:opacity-90 active:opacity-95 text-on-primary font-sans text-[10px] sm:text-[11px] font-semibold tracking-[0.06em] sm:tracking-[0.12em] uppercase transition-all duration-300 shadow-[0_2px_12px_rgba(var(--color-primary-rgb),0.25)] hover:shadow-[0_4px_16px_rgba(var(--color-primary-rgb),0.4)] cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[14px] sm:text-[16px] shrink-0" aria-hidden="true">
                calendar_today
              </span>
              <span className="hidden sm:inline">
                {restaurantConfig?.isTableBookingEnabled !== false
                  ? (headerConfig.primaryCtaText || t('hero.bookTable', 'Book a Table'))
                  : t('nav.walkIns', 'Walk-Ins Welcome')}
              </span>
              <span className="sm:hidden">
                {restaurantConfig?.isTableBookingEnabled !== false
                  ? (headerConfig.primaryCtaText ? headerConfig.primaryCtaText.slice(0, 4) : t('hero.book', 'Book'))
                  : t('nav.walkInsShort', 'Walk-In')}
              </span>
            </motion.button>
          )}

          {/* Mobile Menu Fluid Hamburger Morph */}
          <motion.button 
            data-testid="header-mobile-menu-trigger"
            whileTap={{ scale: 0.92 }}
            className="lg:hidden relative flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-full border border-outline/20 bg-surface-container/80 hover:bg-surface-container-high text-on-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer shrink-0"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? t('a11y.closeMenu', 'Close navigation menu') : t('a11y.openMenu', 'Open navigation menu')}
            aria-expanded={isMobileMenuOpen}
          >
            <div className="w-4 h-3 sm:w-5 sm:h-3.5 relative flex flex-col justify-between items-center">
              <span 
                className={`w-full h-0.5 bg-on-surface rounded-full transition-all duration-300 transform origin-center ${
                  isMobileMenuOpen ? 'rotate-45 translate-y-[5px] sm:translate-y-[6px] bg-primary' : ''
                }`} 
              />
              <span 
                className={`w-full h-0.5 bg-on-surface rounded-full transition-all duration-200 ${
                  isMobileMenuOpen ? 'opacity-0' : 'opacity-100'
                }`} 
              />
              <span 
                className={`w-full h-0.5 bg-on-surface rounded-full transition-all duration-300 transform origin-center ${
                  isMobileMenuOpen ? '-rotate-45 -translate-y-[5px] sm:-translate-y-[6px] bg-primary' : ''
                }`} 
              />
            </div>
          </motion.button>
        </div>
      </div>

      {/* Editorial Luxury Mobile Navigation Modal Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              key="mobile-nav-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 top-0 bg-black/85 backdrop-blur-xl z-40 lg:hidden pointer-events-auto"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-hidden="true"
            />
            <motion.div 
              key="mobile-nav-drawer"
              initial={{ opacity: 0, y: -20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              data-lenis-prevent
              className="lg:hidden fixed top-20 left-0 right-0 max-h-[calc(100dvh-5.5rem)] bg-surface-container/98 border-b border-primary/35 shadow-[0_30px_70px_rgba(0,0,0,0.9)] z-50 overflow-y-auto overscroll-contain rounded-b-[2rem] pointer-events-auto custom-scrollbar"
            >
              <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-5 flex flex-col gap-5">
                
                {/* Brand Monogram & Live Service Status Strip */}
                <div className="flex items-center justify-between pb-3.5 border-b border-outline/15">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full border border-primary/40 bg-surface-container-low flex items-center justify-center text-primary text-xs font-serif font-bold">
                      {businessName.split(/\s+/).filter(Boolean).map((w: string) => w[0]).join('').slice(0, 3).toUpperCase() || 'TCB'}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-serif text-sm font-semibold text-on-surface">{businessName}</span>
                      <span className="font-sans text-[11px] uppercase tracking-[0.2em] text-primary/80">
                        {restaurantConfig?.address?.city || shortName || 'Hospitality'}
                      </span>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-sans font-semibold uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{t('header.openNow', 'Open Now')}</span>
                  </div>
                </div>

                {/* Navigation in Chronological Order */}
                <nav className="flex flex-col gap-1.5" aria-label={t('a11y.navigation', 'Mobile Navigation')}>
                  {enabledOrderedSections.map((item, idx) => {
                    const itemSectionId = item.href.slice(1);
                    const isActive = activeSection === itemSectionId;
                    const displayIndex = enabledOrderedSections.findIndex((s) => s.id === item.id) + 1;
                    return (
                      <motion.a 
                        key={item.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.02 * idx, duration: 0.2 }}
                        className={`group flex items-center justify-between min-h-[52px] py-2.5 px-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                          isActive 
                            ? 'bg-primary/15 border-primary/30 text-primary shadow-sm' 
                            : 'border-outline/10 hover:bg-surface-container active:bg-surface-container text-on-surface'
                        }`} 
                        href={item.href}
                        onClick={(e) => handleNavClick(e, item.href)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-sans text-[11px] font-extrabold tracking-wider transition-colors ${
                            isActive ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container text-primary/90 group-hover:bg-primary/20 group-hover:text-primary'
                          }`}>
                            {displayIndex < 10 ? `0${displayIndex}` : displayIndex}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`font-serif text-base tracking-tight font-medium truncate ${
                                isActive ? 'text-primary font-semibold' : 'text-on-surface group-hover:text-primary'
                              }`}>
                                {item.shortLabel}
                              </span>
                              {item.badge && (
                                <span className="text-[11px] font-sans font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary/90 border border-primary/20 shrink-0">
                                  {item.badge}
                                </span>
                              )}
                            </div>
                            <span className="font-sans text-[11px] text-on-surface/60 truncate">
                              {item.description}
                            </span>
                          </div>
                        </div>
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ml-2 transition-all ${
                          isActive ? 'bg-primary/25 text-primary' : 'bg-surface-container text-primary/70 group-hover:bg-primary/20 group-hover:text-primary'
                        }`}>
                          <span className="material-symbols-outlined text-[15px] transform group-hover:translate-x-0.5 transition-transform">
                            arrow_forward
                          </span>
                        </span>
                      </motion.a>
                    );
                  })}
                </nav>
                
                {/* Mobile Language Switcher */}
                <div className="py-2.5 border-t border-outline/15">
                  <LanguageSwitcher variant="mobile" />
                </div>

                {/* Mobile Direct Action Buttons */}
                <div className="flex flex-col gap-2 pt-1 border-t border-outline/15">
                  {showPrimaryCta && (
                    <button 
                      type="button"
                      onClick={handlePrimaryCtaClick}
                      className="group relative w-full h-12 rounded-full bg-primary text-on-primary text-xs font-sans font-bold uppercase tracking-wider flex items-center justify-between pl-6 pr-2 shadow-[0_4px_20px_rgba(var(--color-primary-rgb),0.3)] active:scale-[0.98] transition-transform cursor-pointer"
                    >
                      <span>
                        {restaurantConfig?.isTableBookingEnabled !== false
                          ? (headerConfig.primaryCtaText || t('hero.bookTable', 'Reserve a Table'))
                          : t('nav.walkIns', 'Walk-Ins Welcome')}
                      </span>
                      <div className="w-8 h-8 rounded-full bg-on-primary/15 flex items-center justify-center transition-transform group-hover:scale-105">
                        <span className="material-symbols-outlined text-[16px] text-on-primary">
                          {restaurantConfig?.isTableBookingEnabled !== false ? 'calendar_today' : 'storefront'}
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
                        <span>{t('contact.drawerTitle', 'Call Concierge')}</span>
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
                        <span>{t('footer.findUs', 'Directions')}</span>
                      </a>
                    ) : null}
                  </div>
                </div>

                {/* Restaurant Hours & Location Micro-Footer */}
                <div className="pt-3 border-t border-outline/10 flex flex-col gap-1.5 text-[11px] text-on-surface/65 font-sans">
                  <div className="flex items-center gap-2 text-primary font-medium">
                    <span className="material-symbols-outlined text-sm">schedule</span>
                    <span>{t('footer.openingHours', 'Daily Service')}: {openingHours}</span>
                  </div>
                  {address && (
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">location_on</span>
                      <span className="truncate">{address}</span>
                    </div>
                  )}
                </div>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
});

Header.displayName = 'Header';
