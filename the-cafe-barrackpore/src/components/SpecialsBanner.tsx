import React from 'react';

export const SpecialsBanner: React.FC = () => {
  return (
    <>
      <section id="chef-specials" className="w-full py-12 sm:py-space-lg bg-surface-container-low relative">
  <div className="max-w-[1320px] mx-auto px-4 sm:px-gutter">
    <div className="rounded-xl bg-gradient-to-r from-surface-container via-surface-container-high to-surface-container p-6 sm:p-space-lg lg:p-space-xl shadow-xl flex flex-col lg:flex-row items-center justify-between gap-6 lg:gap-space-lg">
      <div className="flex flex-col gap-space-xs max-w-xl text-center lg:text-left">
        <div className="inline-flex items-center justify-center lg:justify-start gap-space-xs">
          <span className="material-symbols-outlined text-[#D4AF37] text-xl">workspace_premium</span>
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-[#D4AF37] font-bold">House
            Signature Combos</span>
        </div>
        <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">Special Banquet &amp; Hangout
          Platters</h3>
        <p className="font-body-sm text-body-sm text-on-surface-variant">Generous sharing platters with sizzling
          pan-Asian or smoky clay oven selections, made fresh to order.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-space-md w-full lg:w-auto">
        <div className="p-5 sm:p-space-md rounded-xl bg-surface-container-lowest/80 flex flex-col gap-1 min-w-[170px]">
          <span className="font-label-sm text-label-sm text-tertiary">CHINESE PLATTER</span>
          <span className="font-sans text-2xl text-on-surface font-bold tracking-tight">₹380</span>
          <span className="font-body-sm text-body-sm text-on-surface-variant">Momos, Spring Roll &amp; Crispy Chilli
            Bites</span>
        </div>
        <div className="p-space-md rounded-xl bg-surface-container-lowest/80 flex flex-col gap-1 min-w-[170px]">
          <span className="font-label-sm text-label-sm text-tertiary">TANDOORI PLATTER</span>
          <span className="font-sans text-2xl text-on-surface font-bold tracking-tight">₹450</span>
          <span className="font-body-sm text-body-sm text-on-surface-variant">Smoky Kebabs, Mint Coulis &amp; Flaky
            Naan</span>
        </div>
        <div className="p-space-md rounded-xl bg-surface-container-lowest/80 flex flex-col gap-1 min-w-[170px]">
          <span className="font-label-sm text-label-sm text-tertiary">RICE &amp; NOODLES BOWL</span>
          <span className="font-sans text-2xl text-on-surface font-bold tracking-tight">₹240</span>
          <span className="font-body-sm text-body-sm text-on-surface-variant">With Chilli Chicken or Veg Manchurian
            Gravy</span>
        </div>
      </div>
    </div>
  </div>
</section>

    </>
  );
};
