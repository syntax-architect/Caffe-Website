import React from 'react';

export const Footer: React.FC = () => {
  return (
    <>
      <footer classname="w-full bg-surface-container-lowest text-on-surface-variant">
  <div classname="max-w-[1320px] mx-auto px-gutter pt-space-xl pb-space-lg">
    <div classname="bg-surface-container-low rounded-xl p-space-lg lg:p-space-xl mb-space-xl flex flex-col lg:flex-row items-center justify-between gap-space-lg">
      <div classname="flex flex-col gap-space-xs text-center lg:text-left"><span classname="font-label-sm text-label-sm uppercase tracking-widest text-primary">Nocturnal Dining &amp; Artisanal
          Roasts</span>
        <h3 classname="font-headline-md text-headline-md text-on-surface font-semibold">Craving an Unmatched Culinary
          Evening?</h3>
        <p classname="font-body-sm text-body-sm text-on-surface-variant">Reserve your private booth or order gourmet
          favorites directly to your doorstep in Barrackpore.</p>
      </div>
      <div classname="flex flex-wrap items-center justify-center gap-space-md"><a classname="px-space-lg py-space-sm rounded-xl font-label-lg text-label-lg bg-primary-container text-on-primary-container shadow-[0_0_20px_rgba(249,115,22,0.4)] hover:shadow-[0_0_28px_rgba(249,115,22,0.6)] transition-all" data-path="table-reservation" href="#">Reserve Table</a><a classname="px-space-lg py-space-sm rounded-xl font-label-lg text-label-lg bg-surface-container-high text-on-surface hover:bg-surface-bright hover:text-on-surface transition-all" data-path="online-ordering" href="#">Order Online</a></div>
    </div>
    <div classname="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-xl mb-space-xl">
      <div classname="flex flex-col gap-space-md">
        <div classname="flex items-center gap-space-sm">
          <div classname="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center"><span classname="material-symbols-outlined text-primary text-xl">local_cafe</span></div><span classname="font-headline-sm text-headline-sm text-on-surface font-semibold">The Cafe Barrackpore</span>
        </div>
        <p classname="font-body-sm text-body-sm text-on-surface-variant">A refined nocturnal retreat blending candlelit
          comfort with modern gastronomy, artisanal roasts, and signature beverages.</p>
        <div classname="flex items-center gap-space-sm pt-space-xs"><a classname="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-bright transition-all" href="#"><span classname="material-symbols-outlined text-lg">photo_camera</span></a><a classname="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-bright transition-all" href="#"><span classname="material-symbols-outlined text-lg">public</span></a><a classname="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-bright transition-all" href="#"><span classname="material-symbols-outlined text-lg">restaurant</span></a><a classname="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-bright transition-all" href="#"><span classname="material-symbols-outlined text-lg">delivery_dining</span></a></div>
      </div>
      <div classname="flex flex-col gap-space-md">
        <h4 classname="font-label-lg text-label-lg text-on-surface font-semibold uppercase tracking-wider">Cuisine &amp;
          Curations</h4>
        <div classname="flex flex-col gap-space-xs font-body-sm text-body-sm"><a classname="hover:text-primary transition-colors" data-path="menu-categories" href="#">Artisanal Espresso &amp;
            Brews</a><a classname="hover:text-primary transition-colors" data-path="chef-specials" href="#">Chef's
            Signature Platters</a><a classname="hover:text-primary transition-colors" data-path="menu-categories" href="#">Wood-Fired Pizzas &amp; Pastas</a><a classname="hover:text-primary transition-colors" data-path="menu-categories" href="#">Lounge Mocktails &amp; Shakes</a><a classname="hover:text-primary transition-colors" data-path="visual-gallery" href="#">Ambience &amp; Private
            Dining</a></div>
      </div>
      <div classname="flex flex-col gap-space-md">
        <h4 classname="font-label-lg text-label-lg text-on-surface font-semibold uppercase tracking-wider">Hours &amp;
          Experience</h4>
        <div classname="flex flex-col gap-space-xs font-body-sm text-body-sm">
          <div classname="flex items-start gap-space-xs"><span classname="material-symbols-outlined text-primary text-sm mt-1">schedule</span>
            <div>
              <p classname="text-on-surface font-medium">Everyday Service</p>
              <p classname="text-on-surface-variant">11:00 AM – 11:30 PM</p>
            </div>
          </div>
          <div classname="flex items-start gap-space-xs pt-space-xs"><span classname="material-symbols-outlined text-tertiary text-sm mt-1">wine_bar</span>
            <div>
              <p classname="text-on-surface font-medium">Live Acoustic Sessions</p>
              <p classname="text-on-surface-variant">Fri &amp; Sat: 7:00 PM onwards</p>
            </div>
          </div>
        </div>
      </div>
      <div classname="flex flex-col gap-space-md">
        <h4 classname="font-label-lg text-label-lg text-on-surface font-semibold uppercase tracking-wider">Visit &amp;
          Contact</h4>
        <div classname="flex flex-col gap-space-xs font-body-sm text-body-sm">
          <div classname="flex items-start gap-space-xs"><span classname="material-symbols-outlined text-primary text-sm mt-1">location_on</span>
            <p classname="text-on-surface-variant">S.N. Banerjee Road, Cantonment Area, Barrackpore, Kolkata, West Bengal
              700120</p>
          </div>
          <div classname="flex items-center gap-space-xs pt-space-xs"><span classname="material-symbols-outlined text-primary text-sm">phone_in_talk</span><a classname="hover:text-primary transition-colors" href="tel:+9198300XXXXX">+91 98300 XXXXX</a></div>
          <div classname="flex items-center gap-space-xs"><span classname="material-symbols-outlined text-primary text-sm">mail</span><span classname="text-on-surface-variant">concierge@thecafebkp.com</span></div>
        </div>
      </div>
    </div>
    <div classname="pt-space-md flex flex-col md:flex-row items-center justify-between gap-space-sm font-label-sm text-label-sm text-on-surface-variant/80">
      <p classname>© 2025 The Cafe Barrackpore. All culinary rights reserved.</p>
      <div classname="flex items-center gap-space-md"><a classname="hover:text-primary transition-colors" href="#">Privacy
          Policy</a><a classname="hover:text-primary transition-colors" href="#">Terms of Hospitality</a><a classname="hover:text-primary transition-colors" href="#">Hygiene &amp; Safety</a></div>
    </div>
  </div>
</footer>

    </>
  );
};
