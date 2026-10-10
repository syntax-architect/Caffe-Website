import React, { useState } from 'react';
import { useSiteConfig } from '../context/SiteConfigContext';

export const VIPClub: React.FC = () => {
  const { vipClub } = useSiteConfig();
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const vipImageSrc = vipClub?.src || '/images/vip-nocturnal-circle.jpg';
  const vipImageAlt = vipClub?.alt || 'The Café Barrackpore Nocturnal VIP Salon';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsLoading(true);
    // Simulate luxury reservation and concierge API intake
    setTimeout(() => {
      setIsLoading(false);
      setIsSubscribed(true);
    }, 700);
  };

  return (
    <section 
      className="w-full py-20 lg:py-28 bg-[#070403] border-t border-white/5 relative scroll-mt-28 overflow-hidden" 
      id="vip-club"
    >
      {/* 1. Cinematic Ambient Backlighting */}
      <div 
        className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_50%,_rgba(212,175,55,0.08),_transparent_75%)] pointer-events-none" 
        aria-hidden="true" 
      />
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] bg-[#D4AF37]/6 blur-[160px] rounded-full pointer-events-none" 
        aria-hidden="true" 
      />

      <div className="max-w-[1120px] mx-auto px-4 sm:px-6 relative z-10">
        
        {/* Double-Bezel Gold Foil Master Shell with Machined Luxury Depth */}
        <div
          className="group relative rounded-[2.5rem] p-1.5 sm:p-2 bg-gradient-to-b from-[#D4AF37]/55 via-[#F3E5AB]/30 to-[#D4AF37]/50 shadow-[0_35px_90px_rgba(0,0,0,0.95),0_0_50px_rgba(212,175,55,0.18)] ring-1 ring-white/15"
        >
          {/* Inner Core Enclosure with Integrated Photographic Speakeasy Atmosphere */}
          <div className="relative rounded-[calc(2.5rem-0.5rem)] overflow-hidden bg-[#0A0604] px-5 py-8 sm:px-12 sm:py-14 lg:px-16 lg:py-16 border border-[#D4AF37]/25 flex flex-col items-center text-center gap-6 sm:gap-7 shadow-[inset_0_1px_2px_rgba(255,255,255,0.2)]">
            
            {/* 2. PHOTOGRAPHIC CINEMATIC BACKGROUND IMAGE */}
            <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
              <img
                src={vipImageSrc}
                alt={vipImageAlt}
                className="w-full h-full object-cover object-[center_35%] filter brightness-[0.88] contrast-[1.08] saturate-[1.12] scale-[1.02] transition-transform duration-1000 ease-out group-hover:scale-105"
                loading="lazy"
                decoding="async"
              />

              {/* Seamless Scrim Overlays: Calibrated for rich visible photography while guaranteeing 100% typography contrast */}
              <div className="absolute inset-0 bg-gradient-to-b from-[#070403]/75 via-[#070403]/45 to-[#070403]/85" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(7,4,3,0.40)_0%,_rgba(7,4,3,0.70)_65%,_rgba(7,4,3,0.95)_100%)]" />
              
              {/* Subtle Tungsten Warmth behind the crest */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[550px] h-[300px] bg-[#D4AF37]/20 blur-[100px] rounded-full" />
            </div>

            {/* Concentric Golden Inner Hairline Frame */}
            <div className="absolute inset-3 sm:inset-4 rounded-[calc(2.5rem-1rem)] border border-[#D4AF37]/20 pointer-events-none shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]" />

            {/* 3. Prestigious Crest & Badge Header */}
            <div className="relative z-10 flex flex-col items-center gap-2.5">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#140C08]/90 border border-[#D4AF37]/45 backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.7)] text-[10px] tracking-[0.24em] uppercase text-[#E5C158] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-pulse" />
                <span>PRIVATE MEMBERS' SALON</span>
              </div>

              <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full border border-[#D4AF37]/60 bg-gradient-to-b from-[#251710]/95 to-[#120B07]/95 flex items-center justify-center text-[#E5C158] shadow-[0_0_35px_rgba(212,175,55,0.35)] mt-1 backdrop-blur-md">
                <span className="material-symbols-outlined text-2xl sm:text-3xl font-light text-primary">hotel_class</span>
                <div className="absolute -inset-1 rounded-full border border-[#D4AF37]/25 pointer-events-none" />
              </div>
            </div>

            {/* 4. Luxury Typography Header */}
            <div className="relative z-10 flex flex-col gap-2 max-w-xl">
              <span className="editorial-eyebrow text-[#D4AF37] font-semibold tracking-[0.22em] text-xs">Connoisseurs' Privileges</span>
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-[3.25rem] text-[#FAF6F0] font-normal tracking-tight text-balance leading-tight drop-shadow-[0_3px_14px_rgba(0,0,0,0.95)]">
                Join the <span className="italic font-light text-[#D4AF37]">Nocturnal Circle</span>
              </h2>
              <p className="font-sans text-xs sm:text-base text-[#FAF6F0]/90 leading-relaxed font-light mt-1 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
                Receive discreet invitations to weekend acoustic line-ups, secret seasonal chef previews, and priority booth reservations.
              </p>
            </div>

            {/* 5. 3 Luxury Perks Double-Bezel Glass Wells */}
            <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 w-full max-w-2xl my-1">
              
              {/* Perk 1: Priority */}
              <div className="group/perk rounded-2xl p-[1px] bg-gradient-to-b from-white/20 via-white/[0.05] to-[#D4AF37]/35 hover:to-[#D4AF37]/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(212,175,55,0.2)]">
                <div className="rounded-[calc(1rem-1px)] bg-[#100906]/85 backdrop-blur-xl p-4 sm:p-5 flex flex-col items-center text-center gap-2 h-full border border-white/10">
                  <div className="w-10 h-10 rounded-full bg-[#1C120C] border border-[#D4AF37]/40 flex items-center justify-center text-primary group-hover/perk:scale-110 group-hover/perk:border-[#D4AF37] group-hover/perk:bg-[#2A1B12] transition-all duration-300 shadow-inner">
                    <span className="material-symbols-outlined text-lg sm:text-xl font-light">event_seat</span>
                  </div>
                  <span className="font-sans text-xs sm:text-sm font-semibold text-[#FAF6F0] tracking-wide">Priority</span>
                  <span className="font-sans text-[11px] text-[#FAF6F0]/70 font-light">Weekend prime booth access</span>
                </div>
              </div>
              
              {/* Perk 2: Secret Menus */}
              <div className="group/perk rounded-2xl p-[1px] bg-gradient-to-b from-white/20 via-white/[0.05] to-[#D4AF37]/35 hover:to-[#D4AF37]/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(212,175,55,0.2)]">
                <div className="rounded-[calc(1rem-1px)] bg-[#100906]/85 backdrop-blur-xl p-4 sm:p-5 flex flex-col items-center text-center gap-2 h-full border border-white/10">
                  <div className="w-10 h-10 rounded-full bg-[#1C120C] border border-[#D4AF37]/40 flex items-center justify-center text-primary group-hover/perk:scale-110 group-hover/perk:border-[#D4AF37] group-hover/perk:bg-[#2A1B12] transition-all duration-300 shadow-inner">
                    <span className="material-symbols-outlined text-lg sm:text-xl font-light">restaurant_menu</span>
                  </div>
                  <span className="font-sans text-xs sm:text-sm font-semibold text-[#FAF6F0] tracking-wide">Secret Menus</span>
                  <span className="font-sans text-[11px] text-[#FAF6F0]/70 font-light">Off-menu seasonal tastings</span>
                </div>
              </div>
              
              {/* Perk 3: Live Acoustix */}
              <div className="group/perk rounded-2xl p-[1px] bg-gradient-to-b from-white/20 via-white/[0.05] to-[#D4AF37]/35 hover:to-[#D4AF37]/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(212,175,55,0.2)]">
                <div className="rounded-[calc(1rem-1px)] bg-[#100906]/85 backdrop-blur-xl p-4 sm:p-5 flex flex-col items-center text-center gap-2 h-full border border-white/10">
                  <div className="w-10 h-10 rounded-full bg-[#1C120C] border border-[#D4AF37]/40 flex items-center justify-center text-primary group-hover/perk:scale-110 group-hover/perk:border-[#D4AF37] group-hover/perk:bg-[#2A1B12] transition-all duration-300 shadow-inner">
                    <span className="material-symbols-outlined text-lg sm:text-xl font-light">music_note</span>
                  </div>
                  <span className="font-sans text-xs sm:text-sm font-semibold text-[#FAF6F0] tracking-wide">Live Acoustix</span>
                  <span className="font-sans text-[11px] text-[#FAF6F0]/70 font-light">Reserved guest artist rows</span>
                </div>
              </div>

            </div>

            {/* 6. Subscription Form & Interactive States */}
            <div className="relative z-10 w-full max-w-md mt-1">
              {isSubscribed ? (
                <div 
                  key="subscribed"
                  className="flex flex-col items-center gap-2.5 p-6 sm:p-8 rounded-2xl bg-gradient-to-b from-[#1C120B]/95 to-[#100906]/95 border border-[#D4AF37]/50 shadow-[0_15px_40px_rgba(0,0,0,0.8),0_0_30px_rgba(212,175,55,0.2)] backdrop-blur-xl transition-all duration-300 animate-fade-in"
                >
                  <div className="w-12 h-12 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37] flex items-center justify-center text-primary shadow-inner">
                    <span className="material-symbols-outlined text-2xl font-light">verified</span>
                  </div>
                  <h3 className="font-serif text-xl sm:text-2xl text-[#FAF6F0] font-normal">Welcome to the Inner Circle</h3>
                  <p className="font-sans text-xs text-[#FAF6F0]/80 font-light max-w-xs">
                    Your invitation has been recorded. Discreet seasonal invitations will arrive in your private inbox.
                  </p>
                </div>
              ) : (
                <form 
                  key="form"
                  className="w-full flex flex-col sm:flex-row gap-3 items-center" 
                  onSubmit={handleSubmit}
                >
                  <div className="flex-1 w-full relative group/input">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-[#FAF6F0]/50 group-focus-within/input:text-[#E5C158] transition-colors">
                      <span className="material-symbols-outlined text-base font-light">mail</span>
                    </div>
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your private email" 
                      required
                      className="w-full h-12 bg-[#090503]/90 border border-white/25 focus:border-[#D4AF37] ring-1 ring-transparent focus:ring-[#D4AF37]/50 rounded-full pl-12 pr-5 text-sm text-[#FAF6F0] placeholder:text-[#FAF6F0]/40 focus:outline-none transition-all duration-300 shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] backdrop-blur-md"
                      aria-label="Email address for Inner Circle"
                    />
                  </div>
                  
                  {/* Island Button-in-Button Submission CTA */}
                  <button 
                    type="submit"
                    disabled={isLoading}
                    className="group/btn w-full sm:w-auto h-12 pl-7 pr-2.5 rounded-full bg-gradient-to-r from-primary via-[#E5C158] to-primary hover:brightness-110 active:scale-[0.98] text-[#120B07] text-xs font-sans font-bold uppercase tracking-wider transition-all duration-300 flex items-center justify-between gap-3 shadow-[0_4px_22px_rgba(212,175,55,0.35)] hover:shadow-[0_8px_32px_rgba(212,175,55,0.55)] disabled:opacity-70 cursor-pointer shrink-0"
                  >
                    {isLoading ? (
                      <span className="w-5 h-5 border-2 border-[#120B07] border-t-transparent rounded-full animate-spin mx-auto" />
                    ) : (
                      <>
                        <span>Join Privileges</span>
                        <div className="w-8 h-8 rounded-full bg-[#120B07]/15 group-hover/btn:bg-[#120B07]/25 flex items-center justify-center transition-all duration-300 group-hover/btn:translate-x-1">
                          <span className="material-symbols-outlined text-[17px] text-[#120B07]">
                            arrow_forward
                          </span>
                        </div>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* 7. Discreet Trust & Hospitality Badge */}
            <div className="relative z-10 inline-flex items-center gap-2 font-sans text-[11px] text-[#FAF6F0]/60 tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              <span className="material-symbols-outlined text-[14px] text-[#D4AF37]">verified_user</span>
              <span>Discreet hospitality notifications only • Strictly no spam • Unsubscribe anytime</span>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
};
