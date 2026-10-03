import React from 'react';
import { useCart } from '../context/CartContext';
import { useUI } from '../context/UIContext';
import { useSiteConfig } from '../context/SiteConfigContext';

interface SpecialCombo {
  id: string;
  name: string;
  category: string;
  diet: 'all' | 'nv' | 'veg';
  price: number;
  badge: string;
  serves: string;
  description: string;
  image: string;
}

const SPECIAL_COMBOS: SpecialCombo[] = [
  {
    id: 'combo-chinese-platter',
    name: 'Chinese Platter',
    category: 'mains-platters',
    diet: 'nv',
    price: 380,
    badge: 'CHINESE BANQUET',
    serves: '2–3 Guests',
    description: 'Delicate steamed momos, golden spring rolls & wok-tossed spicy chilli bites.',
    image: '/images/platters/platter-chinese.webp',
  },
  {
    id: 'combo-tandoori-platter',
    name: 'Tandoori Platter',
    category: 'mains-platters',
    diet: 'nv',
    price: 450,
    badge: 'TANDOORI ROYALE',
    serves: '2–3 Guests',
    description: 'Smoky clay oven kebabs, succulent tikka, fresh mint chutney & garlic butter naan.',
    image: '/images/platters/platter-tandoori.webp',
  },
  {
    id: 'combo-rice-noodles-bowl',
    name: 'Rice & Noodles Bowl',
    category: 'mains-platters',
    diet: 'all',
    price: 240,
    badge: 'PAN-ASIAN SHARING',
    serves: '1–2 Guests',
    description: 'Wok-tossed Hakka noodles, fragrant fried rice & crispy Manchurian gravy.',
    image: '/images/platters/platter-bowl.webp',
  },
];

export const SpecialsBanner: React.FC = () => {
  const { addToCart } = useCart();
  const { showToast } = useUI();
  const { specials, formatPrice, restaurantConfig } = useSiteConfig();
  const combos = (specials?.combos && specials.combos.length > 0)
    ? specials.combos
    : SPECIAL_COMBOS;

  return (
    <section id="chef-specials" className="w-full py-20 lg:py-28 bg-[#0D0705] relative border-t border-white/5 scroll-mt-28 overflow-hidden">
      {/* Ambient Radial Backdrop Glow */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-[#D4AF37]/5 blur-[120px] rounded-full pointer-events-none" 
        aria-hidden="true" 
      />

      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        
        {/* Double-Bezel Master Enclosure */}
        <div className="rounded-[2.5rem] p-1.5 sm:p-2 bg-gradient-to-br from-[#221610] via-[#180F0B] to-[#0F0805] ring-1 ring-[#D4AF37]/25 shadow-[0_30px_70px_rgba(0,0,0,0.7)]">
          <div className="rounded-[calc(2.5rem-0.5rem)] bg-[#120B08]/95 p-6 sm:p-10 lg:p-12 border border-white/5 flex flex-col gap-10 lg:gap-12 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]">
            
            {/* Top Row: Narrative and Philosophy */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-white/10 pb-8">
              <div className="flex flex-col gap-3 max-w-2xl">
                <div className="inline-flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="editorial-eyebrow">Chef's Signature Banquets</span>
                </div>
                
                <h3 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-on-surface font-normal tracking-tight leading-[1.15] text-balance">
                  {specials.title || 'Special Banquet & Hangout Platters'}
                </h3>
                
                <p className="font-sans text-sm sm:text-base text-on-surface/75 leading-relaxed font-light mt-1">
                  {specials.description || 'Generous sharing platters featuring sizzling pan-Asian favorites and smoky clay-oven delicacies, freshly prepped for group table conversations.'}
                </p>
              </div>

              {/* Platter Trust Badges */}
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#18100C] border border-[#D4AF37]/25 text-xs text-primary font-medium tracking-wide">
                  <span className="material-symbols-outlined text-sm font-light">groups</span>
                  <span>Ideal for 2–3 Guests</span>
                </div>
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#18100C] border border-white/10 text-xs text-on-surface/75 font-medium tracking-wide">
                  <span className="material-symbols-outlined text-sm font-light text-primary">skillet</span>
                  <span>Made Fresh to Order</span>
                </div>
              </div>
            </div>

            {/* 3-Platter Double-Bezel Card Carousel (Horizontal Snap on Mobile, 3-Col Grid on Desktop) */}
            <div className="flex md:grid overflow-x-auto md:overflow-visible snap-x snap-mandatory hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 pb-2 md:pb-0">
              {combos.map((combo) => (
                <div
                  key={combo.id}
                  className="min-w-[86vw] max-w-[340px] sm:min-w-[320px] md:min-w-0 md:max-w-none snap-center flex-shrink-0 group rounded-[2rem] p-1.5 bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10 hover:border-[#D4AF37]/50 shadow-xl transition-all duration-500 flex flex-col hover:-translate-y-1.5"
                >
                  <div className="rounded-[calc(2rem-0.375rem)] bg-[#160E0A] overflow-hidden flex flex-col h-full border border-white/5">
                    
                    {/* High-Resolution Gourmet Photo Container */}
                    <div className="relative aspect-[16/11] w-full overflow-hidden bg-[#0D0705]">
                      <img
                        src={combo.image}
                        alt={combo.name}
                        width="500"
                        height="340"
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#160E0A] via-transparent to-black/30 pointer-events-none" />

                      {/* Top Badges */}
                      <div className="absolute top-3.5 left-3.5 z-10 flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full bg-[#120B08]/90 backdrop-blur-md border border-[#D4AF37]/40 text-[10px] uppercase tracking-wider text-primary font-semibold">
                          {combo.badge}
                        </span>
                      </div>

                      <div className="absolute top-3.5 right-3.5 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#120B08]/90 backdrop-blur-md border border-white/10">
                        {/* Configurable dietary indicator badge */}
                        {restaurantConfig.dietary.system === 'india' ? (
                          <div
                            className={`w-3 h-3 rounded-sm border flex items-center justify-center ${
                              combo.diet === 'all'
                                ? 'border-emerald-500/80'
                                : 'border-red-500/80'
                            }`}
                            title={combo.diet === 'all' ? 'Veg Option Available' : 'Non-Vegetarian'}
                          >
                            <div
                              className={`w-1.5 h-1.5 rounded-full ${
                                combo.diet === 'all' ? 'bg-emerald-500' : 'bg-red-500'
                              }`}
                            />
                          </div>
                        ) : (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase border ${
                              combo.diet === 'all'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-stone-500/10 text-stone-300 border-stone-500/30'
                            }`}
                            title={combo.diet === 'all' ? 'Veg Option Available' : 'Non-Vegetarian'}
                          >
                            {combo.diet === 'all' ? 'Veg' : 'Non-Veg'}
                          </span>
                        )}
                        <span className="font-sans text-[10px] text-on-surface/80 font-medium">
                          {combo.serves}
                        </span>
                      </div>
                    </div>

                    {/* Card Content & Action */}
                    <div className="p-5 sm:p-6 flex flex-col justify-between flex-1 gap-5">
                      <div className="flex flex-col gap-2.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <h4 className="font-serif text-xl sm:text-2xl text-on-surface font-normal group-hover:text-primary transition-colors tracking-tight">
                            {combo.name}
                          </h4>
                          <div className="font-serif text-2xl text-primary font-normal tabular-nums shrink-0">
                            {formatPrice(combo.price)}
                          </div>
                        </div>

                        <p className="font-sans text-xs sm:text-[13px] text-on-surface/70 leading-relaxed font-light">
                          {combo.description}
                        </p>
                      </div>

                      {/* Island Button-in-Button CTA */}
                      <button
                        type="button"
                        onClick={() => {
                          addToCart({
                            id: combo.id,
                            name: combo.name,
                            category: combo.category,
                            category_id: combo.category,
                            diet: combo.diet,
                            price: combo.price,
                            description: combo.description,
                            popular: true,
                            available: true,
                            sort_order: 99,
                          });
                          showToast({
                            title: 'Added to Order',
                            message: combo.name,
                            subtext: `${formatPrice(combo.price)} • Chef's Banquet Special`,
                            type: 'success',
                          });
                        }}
                        className="group/btn w-full h-11 pl-4 pr-1.5 rounded-full bg-gradient-to-r from-primary to-[#E5C158] hover:from-[#E5C158] hover:to-primary text-[#18110c] text-xs font-sans font-bold uppercase tracking-wider transition-all duration-300 flex items-center justify-between shadow-[0_4px_16px_rgba(212,175,55,0.25)] hover:shadow-[0_6px_22px_rgba(212,175,55,0.4)] active:scale-[0.98] cursor-pointer"
                        title={`Add ${combo.name} to order`}
                      >
                        <span>Add Platter to Bag</span>
                        <div className="w-8 h-8 rounded-full bg-[#18110c]/15 group-hover/btn:bg-[#18110c]/25 flex items-center justify-center transition-all duration-300 group-hover/btn:translate-x-0.5">
                          <span className="material-symbols-outlined text-[17px] text-[#18110c]">
                            add_shopping_cart
                          </span>
                        </div>
                      </button>

                    </div>

                  </div>
                </div>
              ))}
            </div>

            {/* Mobile Carousel Swipe Indicator */}
            <div className="flex md:hidden items-center justify-center gap-1.5 pt-2 text-[10px] uppercase tracking-wider text-[#D4AF37]/80 font-sans">
              <span className="material-symbols-outlined text-sm">swipe</span>
              <span>Swipe horizontally to view banquet platters</span>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
};
