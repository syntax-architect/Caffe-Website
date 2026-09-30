import React, { useState } from 'react';
import { motion } from 'framer-motion';

export const VIPClub: React.FC = () => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      setIsSubscribed(true);
    }, 700);
  };

  return (
    <section className="w-full py-20 lg:py-28 bg-[#110B08] border-t border-white/5 relative scroll-mt-28 overflow-hidden" id="vip-club">
      {/* Ambient Gold Radial Glow */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[450px] bg-[#D4AF37]/5 blur-[130px] rounded-full pointer-events-none" 
        aria-hidden="true" 
      />

      <div className="max-w-[960px] mx-auto px-4 sm:px-6 relative z-10">
        
        {/* Double-Bezel Gold Foil Master Shell */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-[2.5rem] p-1.5 sm:p-2 bg-gradient-to-r from-[#D4AF37]/35 via-[#F3E5AB]/40 to-[#D4AF37]/35 shadow-[0_30px_70px_rgba(0,0,0,0.8)]"
        >
          <div className="rounded-[calc(2.5rem-0.5rem)] bg-gradient-to-b from-[#180F0B] via-[#130C08] to-[#0E0805] p-8 sm:p-12 lg:p-16 border border-white/5 flex flex-col items-center text-center gap-8 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
            
            {/* Crest Emblem */}
            <div className="w-14 h-14 rounded-full border border-[#D4AF37]/40 bg-[#160E0A] flex items-center justify-center text-primary shadow-[0_0_20px_rgba(212,175,55,0.18)]">
              <span className="material-symbols-outlined text-2xl font-light">hotel_class</span>
            </div>

            {/* Typography Header */}
            <div className="flex flex-col gap-3 max-w-xl">
              <span className="editorial-eyebrow">Connoisseurs' Privileges</span>
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-on-surface font-normal tracking-tight text-balance">
                Join the <span className="text-primary italic font-light">Nocturnal Circle</span>
              </h2>
              <p className="font-sans text-sm sm:text-base text-on-surface/75 leading-relaxed font-light mt-1">
                Receive discreet invitations to weekend acoustic line-ups, secret seasonal chef previews, and priority booth reservations.
              </p>
            </div>

            {/* 3 Luxury Perks Double-Bezel Wells */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl my-2">
              <div className="p-4 rounded-2xl bg-[#0D0705]/80 border border-white/10 hover:border-[#D4AF37]/35 transition-colors flex flex-col items-center gap-1.5 shadow-md">
                <span className="material-symbols-outlined text-primary text-xl font-light">event_seat</span>
                <span className="font-sans text-xs font-semibold text-on-surface">Priority Seating</span>
                <span className="font-sans text-[11px] text-on-surface/60 font-light">Weekend prime booth access</span>
              </div>
              
              <div className="p-4 rounded-2xl bg-[#0D0705]/80 border border-white/10 hover:border-[#D4AF37]/35 transition-colors flex flex-col items-center gap-1.5 shadow-md">
                <span className="material-symbols-outlined text-primary text-xl font-light">restaurant_menu</span>
                <span className="font-sans text-xs font-semibold text-on-surface">Secret Menus</span>
                <span className="font-sans text-[11px] text-on-surface/60 font-light">Off-menu seasonal tastings</span>
              </div>
              
              <div className="p-4 rounded-2xl bg-[#0D0705]/80 border border-white/10 hover:border-[#D4AF37]/35 transition-colors flex flex-col items-center gap-1.5 shadow-md">
                <span className="material-symbols-outlined text-primary text-xl font-light">music_note</span>
                <span className="font-sans text-xs font-semibold text-on-surface">Acoustic Access</span>
                <span className="font-sans text-[11px] text-on-surface/60 font-light">Reserved guest artist rows</span>
              </div>
            </div>

            {/* Subscription Form / Confirmation State */}
            {isSubscribed ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-2 flex flex-col items-center gap-2 p-6 rounded-2xl bg-primary/10 border border-primary/30 w-full max-w-md"
              >
                <span className="material-symbols-outlined text-primary text-3xl font-light">verified</span>
                <h3 className="font-serif text-xl text-on-surface font-semibold">Welcome to the Inner Circle</h3>
                <p className="font-sans text-xs text-on-surface/80 font-light">Your preference has been registered. Welcome to our table.</p>
              </motion.div>
            ) : (
              <form className="w-full max-w-md mt-2 flex flex-col sm:flex-row gap-3 items-center" onSubmit={handleSubmit}>
                <div className="flex-1 w-full relative">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-on-surface/40">
                    <span className="material-symbols-outlined text-sm font-light">mail</span>
                  </div>
                  <input 
                    type="email" 
                    placeholder="Enter your private email" 
                    required
                    className="w-full h-12 bg-[#0B0604] border border-white/15 focus:border-primary rounded-full pl-11 pr-5 text-on-surface placeholder:text-on-surface/35 focus:outline-none transition-colors font-sans text-sm shadow-inner"
                    aria-label="Email address for Inner Circle"
                  />
                </div>
                
                {/* Island Button-in-Button Submission CTA */}
                <button 
                  type="submit"
                  disabled={isLoading}
                  className="group/btn w-full sm:w-auto h-12 pl-6 pr-2 rounded-full bg-gradient-to-r from-primary to-[#E5C158] hover:from-[#E5C158] hover:to-primary text-[#18110c] text-xs font-sans font-bold uppercase tracking-wider transition-all duration-300 flex items-center justify-between gap-3 shadow-[0_4px_16px_rgba(212,175,55,0.25)] hover:shadow-[0_6px_22px_rgba(212,175,55,0.4)] active:scale-[0.98] disabled:opacity-70 cursor-pointer shrink-0"
                >
                  {isLoading ? (
                    <span className="w-4 h-4 border-2 border-[#18110c] border-t-transparent rounded-full animate-spin mx-auto" />
                  ) : (
                    <>
                      <span>Join Privileges</span>
                      <div className="w-8 h-8 rounded-full bg-[#18110c]/15 group-hover/btn:bg-[#18110c]/25 flex items-center justify-center transition-all duration-300 group-hover/btn:translate-x-0.5">
                        <span className="material-symbols-outlined text-[17px] text-[#18110c]">
                          arrow_forward
                        </span>
                      </div>
                    </>
                  )}
                </button>
              </form>
            )}

            <p className="font-sans text-[11px] text-on-surface/45 tracking-wide">
              Discreet hospitality notifications only. No spam. Unsubscribe anytime.
            </p>

          </div>
        </motion.div>

      </div>
    </section>
  );
};
