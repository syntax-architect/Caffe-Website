import React from 'react';
import { useUI } from '../context/UIContext';
import { smoothScrollTo } from '../utils/scroll';

export const Footer: React.FC = () => {
  const { showModal } = useUI();

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
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-space-md w-full lg:w-auto"><a className="w-full sm:w-auto text-center px-space-lg py-space-sm rounded-xl font-label-lg text-label-lg bg-primary-container text-[#231914]  hover: transition-all" href="#" onClick={(e) => handleDummy(e, 'Table Reservation', 'The table reservation system is currently under maintenance. Please call us at +91 98300 XXXXX to book your table.')}>Reserve Table</a><a className="w-full sm:w-auto text-center px-space-lg py-space-sm rounded-xl font-label-lg text-label-lg bg-surface-container-high text-on-surface hover:bg-surface-bright hover:text-on-surface transition-all" href="#" onClick={(e) => handleDummy(e, 'Online Ordering', 'Our delivery partners Swiggy and Zomato will be integrated soon.')}>Order Online</a></div>
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-space-xl mb-12 md:mb-space-xl">
      <div className="col-span-2 lg:col-span-1 flex flex-col gap-space-md">
        <div className="flex items-center gap-space-sm">
          <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center"><span className="material-symbols-outlined text-[#D4AF37] text-xl">local_cafe</span></div><span className="font-headline-sm text-headline-sm text-on-surface font-semibold">The Cafe Barrackpore</span>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">A refined nocturnal retreat blending candlelit
          comfort with modern gastronomy, artisanal roasts, and signature beverages.</p>
        <div className="flex items-center gap-space-sm pt-space-xs"><a className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface-variant hover:text-[#D4AF37] hover:bg-surface-bright transition-all" href="#" onClick={(e) => handleDummy(e, 'Legal / Info', 'Detailed information regarding this policy will be uploaded before the official launch. Please contact management for immediate queries.')}><span className="material-symbols-outlined text-lg">photo_camera</span></a><a className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface-variant hover:text-[#D4AF37] hover:bg-surface-bright transition-all" href="#" onClick={(e) => handleDummy(e, 'Legal / Info', 'Detailed information regarding this policy will be uploaded before the official launch. Please contact management for immediate queries.')}><span className="material-symbols-outlined text-lg">public</span></a><a className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface-variant hover:text-[#D4AF37] hover:bg-surface-bright transition-all" href="#" onClick={(e) => handleDummy(e, 'Legal / Info', 'Detailed information regarding this policy will be uploaded before the official launch. Please contact management for immediate queries.')}><span className="material-symbols-outlined text-lg">restaurant</span></a><a className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface-variant hover:text-[#D4AF37] hover:bg-surface-bright transition-all" href="#" onClick={(e) => handleDummy(e, 'Legal / Info', 'Detailed information regarding this policy will be uploaded before the official launch. Please contact management for immediate queries.')}><span className="material-symbols-outlined text-lg">delivery_dining</span></a></div>
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
          <div className="flex items-start gap-space-xs"><span className="material-symbols-outlined text-[#D4AF37] text-sm mt-1">location_on</span>
            <p className="text-on-surface-variant">S.N. Banerjee Road, Cantonment Area, Barrackpore, Kolkata, West Bengal
              700120</p>
          </div>
          <div className="flex items-center gap-space-xs pt-space-xs"><span className="material-symbols-outlined text-[#D4AF37] text-sm">phone_in_talk</span><a className="hover:text-[#D4AF37] transition-colors" href="tel:+9198300XXXXX">+91 98300 XXXXX</a></div>
          <div className="flex items-center gap-space-xs"><span className="material-symbols-outlined text-[#D4AF37] text-sm">mail</span><span className="text-on-surface-variant">concierge@thecafebkp.com</span></div>
        </div>
      </div>
    </div>
    <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 font-label-sm text-xs text-on-surface-variant/80 text-center md:text-left">
      <p>© 2025 The Cafe Barrackpore. All culinary rights reserved.</p>
      <div className="flex flex-wrap items-center justify-center gap-4 md:gap-space-md"><a className="hover:text-[#D4AF37] transition-colors" href="#" onClick={(e) => handleDummy(e, 'Legal / Info', 'Detailed information regarding this policy will be uploaded before the official launch. Please contact management for immediate queries.')}>Privacy
          Policy</a><a className="hover:text-[#D4AF37] transition-colors" href="#" onClick={(e) => handleDummy(e, 'Legal / Info', 'Detailed information regarding this policy will be uploaded before the official launch. Please contact management for immediate queries.')}>Terms of Hospitality</a><a className="hover:text-[#D4AF37] transition-colors" href="#" onClick={(e) => handleDummy(e, 'Legal / Info', 'Detailed information regarding this policy will be uploaded before the official launch. Please contact management for immediate queries.')}>Hygiene &amp; Safety</a></div>
    </div>
  </div>
</footer>

    </>
  );
};
