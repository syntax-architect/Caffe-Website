import React from 'react';
import { useUI } from '../context/UIContext';
import { smoothScrollTo } from '../utils/scroll';
import { useLogo } from '../hooks/useLogo';

const IconInstagram = () => <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>;
const IconFacebook = () => <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>;
const IconGoogle = () => <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/></svg>;
const IconZomato = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /><path d="M7 2v20" /><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" /></svg>;

export const Footer: React.FC = () => {
  const { showModal } = useUI();
  const logoUrl = useLogo();

  const handleNav = (e: React.MouseEvent, target: string) => { e.preventDefault(); smoothScrollTo(target); };
  const handleDummy = (e: React.MouseEvent, title: string, msg: string) => { e.preventDefault(); showModal(title, msg); };
  
  return (
    <>
      <footer id="reserve-section" className="w-full bg-surface-container-lowest text-on-surface-variant">
  <div className="max-w-[1320px] mx-auto px-4 md:px-gutter pt-16 md:pt-space-xl pb-8 md:pb-space-lg">
    <div className="bg-surface-container-low rounded-xl p-6 md:p-space-lg lg:p-space-xl mb-12 md:mb-space-xl flex flex-col lg:flex-row items-center justify-between gap-6 md:gap-space-lg">
      <div className="flex flex-col gap-space-xs text-center lg:text-left"><span className="font-label-sm text-label-sm uppercase tracking-widest text-[#D4AF37]">Nocturnal Dining &amp; Artisanal
          Roasts</span>
        <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">Craving an Unmatched Culinary
          Evening?</h3>
        <p className="font-body-sm text-body-sm text-on-surface-variant">Reserve your private booth or order gourmet
          favorites directly to your doorstep in Barrackpore.</p>
      </div>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-space-md w-full lg:w-auto">
        <a className="w-full sm:w-auto text-center px-8 py-4 rounded-full uppercase tracking-wider text-xs sm:text-sm font-semibold bg-[#D4AF37] text-[#231914] hover:bg-[#ebd074] transition-all" href="#" onClick={(e) => handleDummy(e, 'Table Reservation', 'The table reservation system is currently under maintenance. Please call us at +91 98300 XXXXX to book your table.')}>Reserve Table</a>
        <a className="w-full sm:w-auto text-center px-8 py-4 rounded-full uppercase tracking-wider text-xs sm:text-sm font-semibold border border-[#D4AF37]/30 text-on-surface hover:border-[#D4AF37] hover:bg-[#D4AF37]/5 transition-all" href="#" onClick={(e) => handleDummy(e, 'Online Ordering', 'Our delivery partners Swiggy and Zomato will be integrated soon.')}>Order Online</a>
      </div>
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-space-xl mb-12 md:mb-space-xl">
      <div className="col-span-2 lg:col-span-1 flex flex-col gap-space-md">
        <div className="flex items-center gap-space-sm">
          <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center overflow-hidden drop-shadow-[0_0_10px_rgba(212,175,55,0.1)]">
            <img src={logoUrl} alt="The Cafe Logo" className="w-full h-full object-contain" />
          </div>
          <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">The Cafe Barrackpore</span>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">A refined nocturnal retreat blending candlelit
          comfort with modern gastronomy, artisanal roasts, and signature beverages.</p>
        <div className="flex items-center gap-space-sm pt-space-xs">
          <a className="w-10 h-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-on-surface-variant hover:border-[#D4AF37]/40 hover:text-[#D4AF37] transition-all" href="#" onClick={(e) => handleDummy(e, 'Legal / Info', 'Detailed information regarding this policy will be uploaded before the official launch. Please contact management for immediate queries.')}><IconInstagram /></a>
          <a className="w-10 h-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-on-surface-variant hover:border-[#D4AF37]/40 hover:text-[#D4AF37] transition-all" href="#" onClick={(e) => handleDummy(e, 'Legal / Info', 'Detailed information regarding this policy will be uploaded before the official launch. Please contact management for immediate queries.')}><IconFacebook /></a>
          <a className="w-10 h-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-on-surface-variant hover:border-[#D4AF37]/40 hover:text-[#D4AF37] transition-all" href="#" onClick={(e) => handleDummy(e, 'Legal / Info', 'Detailed information regarding this policy will be uploaded before the official launch. Please contact management for immediate queries.')}><IconGoogle /></a>
          <a className="w-10 h-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-on-surface-variant hover:border-[#D4AF37]/40 hover:text-[#D4AF37] transition-all" href="#" onClick={(e) => handleDummy(e, 'Legal / Info', 'Detailed information regarding this policy will be uploaded before the official launch. Please contact management for immediate queries.')}><IconZomato /></a>
        </div>
      </div>
      <div className="col-span-1 flex flex-col gap-space-md">
        <h4 className="font-label-lg text-label-lg text-on-surface font-semibold uppercase tracking-wider">Cuisine &amp;
          Curations</h4>
        <div className="flex flex-col gap-space-xs font-body-sm text-body-sm"><a className="hover:text-[#D4AF37] transition-colors" href="#" onClick={(e) => handleNav(e, 'menu-categories')}>Artisanal Espresso &amp;
            Brews</a><a className="hover:text-[#D4AF37] transition-colors" href="#" onClick={(e) => handleNav(e, 'chef-specials')}>Chef's
            Signature Platters</a><a className="hover:text-[#D4AF37] transition-colors" href="#" onClick={(e) => handleNav(e, 'menu-categories')}>Wood-Fired Pizzas &amp; Pastas</a><a className="hover:text-[#D4AF37] transition-colors" href="#" onClick={(e) => handleNav(e, 'menu-categories')}>Lounge Mocktails &amp; Shakes</a><a className="hover:text-[#D4AF37] transition-colors" href="#" onClick={(e) => handleNav(e, 'visual-gallery')}>Ambience &amp; Private
            Dining</a></div>
      </div>
      <div className="col-span-1 flex flex-col gap-space-md">
        <h4 className="font-label-lg text-label-lg text-on-surface font-semibold uppercase tracking-wider">Hours &amp;
          Experience</h4>
        <div className="flex flex-col gap-space-xs font-body-sm text-body-sm">
          <div className="flex items-start gap-space-xs"><span className="material-symbols-outlined text-[#D4AF37] text-sm mt-1">schedule</span>
            <div>
              <p className="text-on-surface font-medium">Everyday Service</p>
              <p className="text-on-surface-variant">11:00 AM – 11:30 PM</p>
            </div>
          </div>
          <div className="flex items-start gap-space-xs pt-space-xs"><span className="material-symbols-outlined text-tertiary text-sm mt-1">wine_bar</span>
            <div>
              <p className="text-on-surface font-medium">Live Acoustic Sessions</p>
              <p className="text-on-surface-variant">Fri &amp; Sat: 7:00 PM onwards</p>
            </div>
          </div>
        </div>
      </div>
      <div className="col-span-2 lg:col-span-1 flex flex-col gap-space-md">
        <h4 className="font-label-lg text-label-lg text-on-surface font-semibold uppercase tracking-wider">Visit &amp;
          Contact</h4>
        <div className="flex flex-col gap-space-xs font-body-sm text-body-sm">
          <div className="flex items-start gap-space-xs">
            <span className="material-symbols-outlined text-[#D4AF37] text-sm mt-1 shrink-0">location_on</span>
            <a 
              href="https://maps.app.goo.gl/beaiJJ4i7puFqrxp6" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-on-surface-variant hover:text-[#D4AF37] transition-colors group flex flex-col items-start"
            >
              <span>1st floor 2, Jayanti Cinema Multiplex, 2, Barrackpore Trunk Rd, Barrackpore, West Bengal 700120</span>
              <span className="inline-flex items-center gap-1 font-label-md text-[10px] uppercase tracking-wider text-[#D4AF37] mt-2 opacity-80 group-hover:opacity-100 border border-[#D4AF37]/30 px-3 py-1.5 rounded-full">
                Get Directions <span className="material-symbols-outlined text-[12px]">open_in_new</span>
              </span>
            </a>
          </div>
          <div className="flex items-center gap-space-xs pt-space-xs"><span className="material-symbols-outlined text-[#D4AF37] text-sm">phone_in_talk</span><a className="hover:text-[#D4AF37] transition-colors" href="tel:+9198300XXXXX">+91 98300 XXXXX</a></div>
          <div className="flex items-center gap-space-xs"><span className="material-symbols-outlined text-[#D4AF37] text-sm">mail</span><span className="text-on-surface-variant">concierge@thecafebkp.com</span></div>
        </div>
      </div>
    </div>
    <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 font-label-sm text-xs text-on-surface-variant/80 text-center md:text-left">
      <p>© {new Date().getFullYear()} The Cafe Barrackpore. All culinary rights reserved.</p>
      <div className="flex flex-wrap items-center justify-center gap-4 md:gap-space-md"><a className="hover:text-[#D4AF37] transition-colors" href="#" onClick={(e) => handleDummy(e, 'Legal / Info', 'Detailed information regarding this policy will be uploaded before the official launch. Please contact management for immediate queries.')}>Privacy
          Policy</a><a className="hover:text-[#D4AF37] transition-colors" href="#" onClick={(e) => handleDummy(e, 'Legal / Info', 'Detailed information regarding this policy will be uploaded before the official launch. Please contact management for immediate queries.')}>Terms of Hospitality</a><a className="hover:text-[#D4AF37] transition-colors" href="#" onClick={(e) => handleDummy(e, 'Legal / Info', 'Detailed information regarding this policy will be uploaded before the official launch. Please contact management for immediate queries.')}>Hygiene &amp; Safety</a></div>
    </div>
  </div>
</footer>

    </>
  );
};
