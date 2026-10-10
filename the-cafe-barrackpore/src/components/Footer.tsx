import React from 'react';
import { useUI } from '../context/UIContext';
import { useSiteConfig } from '../context/SiteConfigContext';
import { smoothScrollTo } from '../utils/scroll';
import { clientDetails } from '../config/client';

const IconInstagram = () => <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>;
const IconFacebook = () => <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>;
const IconGoogle = () => <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/></svg>;
const IconZomato = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /><path d="M7 2v20" /><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" /></svg>;

export const Footer: React.FC = () => {
  const { showModal, setIsReservationOpen } = useUI();
  const { restaurantConfig, logoUrl } = useSiteConfig();

  const businessName = restaurantConfig?.businessName || clientDetails.businessName;
  const shortName = restaurantConfig?.shortName || clientDetails.shortName;
  const displayCity = restaurantConfig?.address?.city || clientDetails.displayLocation;
  const addressLine = restaurantConfig?.address?.line1 || clientDetails.address;
  const phone = restaurantConfig?.contact?.phone || clientDetails.phone;
  const displayPhone = restaurantConfig?.contact?.displayPhone || clientDetails.displayPhone;
  const whatsapp = restaurantConfig?.contact?.whatsapp || clientDetails.whatsapp;
  const openingHours = restaurantConfig?.openingTime && restaurantConfig?.closingTime
    ? `${restaurantConfig.openingTime} – ${restaurantConfig.closingTime}`
    : '11:00 AM – 11:30 PM';
  const hygieneMsg = restaurantConfig?.dietary?.system === 'india'
    ? '100% FSSAI-compliant commercial kitchen with daily sanitized workstations.'
    : '100% health-inspection compliant commercial kitchen with daily sanitized workstations.';

  const handleNav = (e: React.MouseEvent, target: string) => { 
    e.preventDefault(); 
    smoothScrollTo(target); 
  };
  
  const handleDummy = (e: React.MouseEvent, title: string, msg: string) => { 
    e.preventDefault(); 
    showModal(title, msg); 
  };
  
  return (
    <footer id="reserve-section" className="w-full bg-[#0A0503] text-on-surface/70 border-t border-white/5 scroll-mt-28 relative overflow-hidden">
      {/* Subtle Glow */}
      <div 
        className="absolute bottom-0 right-10 w-[500px] h-[300px] bg-[#D4AF37]/5 blur-[140px] rounded-full pointer-events-none" 
        aria-hidden="true" 
      />

      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-12 pt-16 md:pt-28 pb-36 sm:pb-36 md:pb-12 pb-[max(9.5rem,calc(8rem+env(safe-area-inset-bottom)))] relative z-10">
        
        {/* Top Hospitality Callout Banner with Double-Bezel Enclosure */}
        <div className="rounded-[2.5rem] p-1.5 sm:p-2 bg-gradient-to-r from-[#221610] via-[#180F0B] to-[#120B08] ring-1 ring-[#D4AF37]/25 shadow-2xl mb-14 md:mb-20">
          <div className="rounded-[calc(2.5rem-0.5rem)] bg-gradient-to-r from-[#170E0A] via-[#130C08] to-[#0E0805] p-6 sm:p-8 lg:p-12 flex flex-col lg:flex-row items-center justify-between gap-6 lg:gap-10 border border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]">
            <div className="flex flex-col gap-2 text-center lg:text-left max-w-xl">
              <span className="editorial-eyebrow text-xs">{clientDetails.tagline1 || "Bespoke Hospitality"}</span>
              <h3 className="font-serif text-2xl sm:text-3xl md:text-4xl text-on-surface font-normal tracking-tight text-balance">
                {clientDetails.tagline2 || "An Unrivaled Dining Atmosphere"}
              </h3>
              <p className="font-sans text-xs sm:text-sm text-on-surface/75 leading-relaxed font-light mt-0.5">
                Reserve your private booth or enjoy gourmet artisanal favorites in {displayCity}.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full lg:w-auto shrink-0">
              {/* Island Button-in-Button Reserve CTA */}
              <button 
                type="button"
                onClick={() => setIsReservationOpen(true)}
                className="group/btn w-full sm:w-auto h-12 pl-6 pr-2 rounded-full bg-gradient-to-r from-primary to-[#E5C158] hover:from-[#E5C158] hover:to-primary text-[#18110c] text-xs font-sans font-bold uppercase tracking-wider transition-all duration-300 flex items-center justify-between gap-3 shadow-[0_4px_16px_rgba(212,175,55,0.25)] hover:shadow-[0_6px_22px_rgba(212,175,55,0.4)] active:scale-[0.98] cursor-pointer"
              >
                <span>Reserve a Table</span>
                <div className="w-8 h-8 rounded-full bg-[#18110c]/15 group-hover/btn:bg-[#18110c]/25 flex items-center justify-center transition-all duration-300 group-hover/btn:scale-105">
                  <span className="material-symbols-outlined text-[17px] text-[#18110c]">
                    table_restaurant
                  </span>
                </div>
              </button>

              <a 
                className="w-full sm:w-auto h-12 px-7 rounded-full text-xs font-semibold btn-outline-premium flex items-center justify-center gap-2 cursor-pointer" 
                href="#menu-section" 
                onClick={(e) => handleNav(e, 'menu-section')}
              >
                <span>Explore Menu</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </a>
            </div>
          </div>
        </div>

        {/* Directory Layout: 2-Col Grid on Mobile to eliminate empty right space, 4-Col Grid on Desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 lg:gap-12 mb-14 md:mb-16">
          
          {/* Col 1: Brand & Heritage (Full width on mobile/tablet, 1 col on desktop) */}
          <div className="col-span-2 sm:col-span-2 lg:col-span-1 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border border-[#D4AF37]/35 bg-[#160E0A] flex items-center justify-center overflow-hidden shadow-[0_0_12px_rgba(212,175,55,0.15)] shrink-0">
                <img src={logoUrl || "/logo.webp"} alt={`${businessName} Crest`} width="40" height="40" loading="lazy" decoding="async" className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-col">
                <span className="font-serif text-base text-on-surface font-semibold tracking-tight">{businessName}</span>
                <span className="font-sans text-[10px] tracking-[0.2em] uppercase text-primary/80 -mt-0.5">{shortName}</span>
              </div>
            </div>
            
            <p className="font-sans text-xs text-on-surface/65 leading-relaxed font-light max-w-md">
              {clientDetails.description}
            </p>
            
            {/* Social Icons in concentric obsidian wells */}
            <div className="flex items-center gap-2.5 pt-1">
              <a 
                className="w-9 h-9 rounded-full border border-white/10 bg-[#140D09] flex items-center justify-center text-on-surface/70 hover:border-primary hover:text-primary hover:bg-[#1E130D] transition-all cursor-pointer shadow-sm hover:scale-105" 
                href={clientDetails.instagramLink} 
                target="_blank" 
                rel="noopener noreferrer"
                aria-label="Instagram"
              >
                <IconInstagram />
              </a>
              <a 
                className="w-9 h-9 rounded-full border border-white/10 bg-[#140D09] flex items-center justify-center text-on-surface/70 hover:border-primary hover:text-primary hover:bg-[#1E130D] transition-all cursor-pointer shadow-sm hover:scale-105" 
                href={clientDetails.facebookLink} 
                target="_blank" 
                rel="noopener noreferrer"
                aria-label="Facebook"
              >
                <IconFacebook />
              </a>
              <a 
                className="w-9 h-9 rounded-full border border-white/10 bg-[#140D09] flex items-center justify-center text-on-surface/70 hover:border-primary hover:text-primary hover:bg-[#1E130D] transition-all cursor-pointer shadow-sm hover:scale-105" 
                href={clientDetails.googleMapsLink} 
                target="_blank" 
                rel="noopener noreferrer"
                aria-label="Google Maps Reviews"
              >
                <IconGoogle />
              </a>
              <a 
                className="w-9 h-9 rounded-full border border-white/10 bg-[#140D09] flex items-center justify-center text-on-surface/70 hover:border-primary hover:text-primary hover:bg-[#1E130D] transition-all cursor-pointer shadow-sm hover:scale-105" 
                href={clientDetails.zomatoLink} 
                target="_blank" 
                rel="noopener noreferrer"
                aria-label="Zomato"
              >
                <IconZomato />
              </a>
            </div>
          </div>

          {/* Col 2: Curations (Left column on mobile, 1 col on desktop) */}
          <div className="col-span-1 flex flex-col gap-3.5">
            <h4 className="font-sans text-xs uppercase tracking-widest text-on-surface font-semibold">
              Cuisine &amp; Curations
            </h4>
            <div className="flex flex-col gap-2.5 text-xs font-sans">
              <a className="text-on-surface/75 hover:text-primary transition-colors py-0.5 inline-flex items-center gap-1 group" href="#" onClick={(e) => handleNav(e, 'menu-section')}>
                <span className="w-1 h-1 rounded-full bg-primary/40 group-hover:bg-primary transition-colors" />
                <span>Single-Origin Brews</span>
              </a>
              <a className="text-on-surface/75 hover:text-primary transition-colors py-0.5 inline-flex items-center gap-1 group" href="#" onClick={(e) => handleNav(e, 'chef-specials')}>
                <span className="w-1 h-1 rounded-full bg-primary/40 group-hover:bg-primary transition-colors" />
                <span>Chef's Banquets</span>
              </a>
              <a className="text-on-surface/75 hover:text-primary transition-colors py-0.5 inline-flex items-center gap-1 group" href="#" onClick={(e) => handleNav(e, 'menu-section')}>
                <span className="w-1 h-1 rounded-full bg-primary/40 group-hover:bg-primary transition-colors" />
                <span>Wood-Fired Pizzas</span>
              </a>
              <a className="text-on-surface/75 hover:text-primary transition-colors py-0.5 inline-flex items-center gap-1 group" href="#" onClick={(e) => handleNav(e, 'menu-section')}>
                <span className="w-1 h-1 rounded-full bg-primary/40 group-hover:bg-primary transition-colors" />
                <span>Lounge Mocktails</span>
              </a>
              <a className="text-on-surface/75 hover:text-primary transition-colors py-0.5 inline-flex items-center gap-1 group" href="#" onClick={(e) => handleNav(e, 'gallery')}>
                <span className="w-1 h-1 rounded-full bg-primary/40 group-hover:bg-primary transition-colors" />
                <span>Private Booths</span>
              </a>
            </div>
          </div>

          {/* Col 3: Hours & Atmosphere (Right column on mobile, 1 col on desktop) */}
          <div className="col-span-1 flex flex-col gap-3.5">
            <h4 className="font-sans text-xs uppercase tracking-widest text-on-surface font-semibold">
              Hours &amp; Atmosphere
            </h4>
            <div className="flex flex-col gap-3 text-xs font-sans">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-primary text-base mt-0.5 shrink-0 font-light">schedule</span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-on-surface font-medium">Daily Service</p>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <p className="text-on-surface/60 font-light mt-0.5 text-[11px] sm:text-xs">{openingHours}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 pt-1">
                <span className="material-symbols-outlined text-primary text-base mt-0.5 shrink-0 font-light">music_note</span>
                <div>
                  <p className="text-on-surface font-medium">Acoustics</p>
                  <p className="text-on-surface/60 font-light mt-0.5 text-[11px] sm:text-xs">Fri &amp; Sat from 7 PM</p>
                </div>
              </div>
            </div>
          </div>

          {/* Col 4: Location & Contact (Full-width luxury card on mobile, 1 col on desktop) */}
          <div className="col-span-2 sm:col-span-2 lg:col-span-1 flex flex-col gap-3.5 p-4 sm:p-5 lg:p-0 rounded-2xl lg:rounded-none bg-[#130C08]/90 lg:bg-transparent border border-[#D4AF37]/20 lg:border-none shadow-md lg:shadow-none">
            <h4 className="font-sans text-xs uppercase tracking-widest text-on-surface font-semibold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-base font-light">location_on</span>
              <span>Visit &amp; Contact</span>
            </h4>
            <div className="flex flex-col gap-3 text-xs font-sans">
              <div className="flex flex-col gap-1">
                <span className="font-light leading-relaxed text-on-surface/75">{addressLine}</span>
                <a 
                  href={clientDetails.googleMapsLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-semibold uppercase tracking-wider mt-0.5"
                >
                  <span>Get Directions</span>
                  <span className="material-symbols-outlined text-xs">open_in_new</span>
                </a>
              </div>

              {/* Mobile Quick Action Buttons: Call & WhatsApp */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <a 
                  className="h-9 px-3 rounded-full bg-[#1C120D] border border-white/15 hover:border-primary/50 text-on-surface/90 hover:text-white transition-all font-medium inline-flex items-center justify-center gap-1.5 active:scale-95 text-[11px]" 
                  href={`tel:${phone}`}
                >
                  <span className="material-symbols-outlined text-sm text-primary">phone_in_talk</span>
                  <span className="truncate">{displayPhone}</span>
                </a>

                {whatsapp ? (
                  <a 
                    className="h-9 px-3 rounded-full bg-emerald-950/40 border border-emerald-500/35 hover:border-emerald-500/60 text-emerald-400 hover:text-emerald-300 transition-all font-medium inline-flex items-center justify-center gap-1.5 active:scale-95 text-[11px]" 
                    href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <span className="material-symbols-outlined text-sm">forum</span>
                    <span>WhatsApp</span>
                  </a>
                ) : null}
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Legal & Discrete Staff Login */}
        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 font-sans text-xs text-on-surface/75 text-center md:text-left">
          <p>© {new Date().getFullYear()} {businessName} {shortName}. All culinary &amp; brand rights reserved.</p>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            <a className="hover:text-primary transition-colors text-on-surface/80" href="/privacy">
              Privacy Policy
            </a>
            <a className="hover:text-primary transition-colors text-on-surface/80" href="/terms">
              Terms of Service
            </a>
            <a className="hover:text-primary transition-colors text-on-surface/80" href="#" onClick={(e) => handleDummy(e, 'Hygiene Standards', hygieneMsg)}>
              Hygiene &amp; Safety
            </a>
            <span className="text-white/20 hidden sm:inline">•</span>
            {/* Discrete Staff Access Link */}
            <a 
              href="/staff/login" 
              className="text-on-surface/70 hover:text-primary transition-colors inline-flex items-center gap-1 font-medium"
              title="Staff & Management Portal"
            >
              <span className="material-symbols-outlined text-[13px]">lock</span>
              <span>Staff Portal</span>
            </a>
          </div>
        </div>

      </div>
    </footer>
  );
};
