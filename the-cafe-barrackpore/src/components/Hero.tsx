import React from 'react';
import { motion } from 'framer-motion';
import { smoothScrollTo } from '../utils/scroll';
import { useUI } from '../context/UIContext';
import { useSiteConfig } from '../context/SiteConfigContext';

export const Hero: React.FC = () => {
  const { setIsReservationOpen } = useUI();
  const { hero } = useSiteConfig();

  const handleNav = (e: React.MouseEvent, target: string) => {
    e.preventDefault();
    smoothScrollTo(target);
  };

  return (
    <section 
      id="hero-section" 
      className="relative w-full min-h-[calc(100dvh-5rem)] lg:h-[calc(100vh-5rem)] flex items-center justify-center bg-background overflow-hidden py-4 sm:py-6 lg:py-8"
    >
      {/* Ambient Radial Glow Background - Hidden on mobile to save GPU */}
      <div 
        className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#D4AF37]/5 rounded-full blur-[120px] pointer-events-none hidden sm:block" 
        aria-hidden="true" 
      />
      <div 
        className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#3D2517]/20 rounded-full blur-[100px] pointer-events-none hidden sm:block" 
        aria-hidden="true" 
      />

      <div className="w-full max-w-[1340px] mx-auto px-4 sm:px-6 lg:px-12 flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-14 relative z-10 h-full">
        
        {/* Left Column — Editorial Narrative & Action Engine (58%) */}
        <div className="w-full lg:w-[58%] flex flex-col items-center text-center lg:items-start lg:text-left justify-center">
          
          {/* Refined Minimalist Eyebrow Tag */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#D4AF37]/35 bg-[#160E0A]/90 backdrop-blur-md mb-3.5 sm:mb-5 shadow-[0_2px_12px_rgba(0,0,0,0.5)]"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] shadow-[0_0_8px_#D4AF37] animate-pulse" />
            <span className="font-sans text-[10px] sm:text-[11px] uppercase tracking-[0.16em] sm:tracking-[0.22em] text-[#EAE0D5] font-medium">
              Cantonment Barrackpore &bull; Artisanal Gastronomy
            </span>
          </motion.div>

          {/* Wide Editorial Headline (Strict 2-Line Architecture) */}
          <motion.h1 
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="font-serif text-[28px] xs:text-[32px] sm:text-4xl lg:text-[44px] xl:text-[50px] leading-[1.14] text-on-surface font-normal tracking-tight mb-2.5 sm:mb-4 w-full max-w-2xl text-balance"
          >
            {hero.headline ? (
              <span>{hero.headline}</span>
            ) : (
              <>
                Step Into Barrackpore’s <br className="hidden sm:inline" />
                <span className="text-primary italic font-light">Trendsetting Dining Retreat</span>
              </>
            )}
          </motion.h1>

          {/* Editorial Subtitle / Value Proposition (< 20 Words) */}
          <motion.p 
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="font-sans text-[13px] sm:text-sm md:text-[15px] text-on-surface/80 max-w-lg leading-relaxed mb-5 sm:mb-7 font-light text-balance"
          >
            {hero.subtext || "Where artisan coffee meets handcrafted mocktails & wood-fired comfort food in a strictly premium, nocturnal setting."}
          </motion.p>

          {/* Island CTA & Button-in-Button Architecture */}
          <motion.div 
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-2 sm:flex sm:flex-row items-center gap-2.5 sm:gap-3.5 mb-5 sm:mb-7 w-full sm:w-auto"
          >
            {/* Primary CTA with Nested Trailing Icon Pill */}
            <motion.a 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              href="#menu-section" 
              onClick={(e: React.MouseEvent<HTMLAnchorElement>) => handleNav(e, 'menu-section')}
              className="group relative inline-flex items-center justify-between pl-4 pr-1.5 sm:pl-6 sm:pr-2 py-2 sm:py-1.5 rounded-full bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C5A028] text-[#120B08] font-bold text-[11px] sm:text-xs tracking-wider uppercase shadow-[0_4px_24px_rgba(212,175,55,0.28)] hover:shadow-[0_6px_32px_rgba(212,175,55,0.45)] transition-all duration-300 cursor-pointer w-full sm:w-auto"
            >
              <span className="truncate pr-1">Explore Menu</span>
              <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#120B08]/15 flex items-center justify-center transition-transform duration-300 group-hover:translate-x-1 group-hover:scale-105 shrink-0">
                <span className="material-symbols-outlined text-[14px] sm:text-[15px] text-[#120B08]">arrow_forward</span>
              </span>
            </motion.a>

            {/* Secondary CTA: Soft Glass Table Reservation Pill */}
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsReservationOpen(true)}
              className="group inline-flex items-center justify-center gap-1.5 sm:gap-2.5 px-3 sm:px-6 py-2.5 sm:py-3 rounded-full border border-[#D4AF37]/35 bg-[#160E0A]/70 hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]/70 text-[#EAE0D5] font-semibold text-[11px] sm:text-xs tracking-wider uppercase backdrop-blur-sm transition-all duration-300 shadow-sm cursor-pointer w-full sm:w-auto"
            >
              <span className="material-symbols-outlined text-[15px] sm:text-[16px] text-primary transition-transform duration-300 group-hover:scale-110">table_restaurant</span>
              <span className="truncate">Book Table</span>
            </motion.button>
          </motion.div>

          {/* Architectural Atmosphere Baseline */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.7 }}
            className="flex flex-wrap items-center justify-center lg:justify-start gap-2 sm:gap-3 pt-3 border-t border-white/10 w-full text-on-surface/75"
          >
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/10">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/80" />
              <span className="font-sans text-[10px] sm:text-[11px] tracking-wider uppercase font-medium">Lounge Mocktails</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/10">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/80" />
              <span className="font-sans text-[10px] sm:text-[11px] tracking-wider uppercase font-medium">Wood-Fired Crusts</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/10">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/80" />
              <span className="font-sans text-[10px] sm:text-[11px] tracking-wider uppercase font-medium">Acoustic Weekends</span>
            </div>
          </motion.div>

        </div>

        {/* Right Column — Double-Bezel Architectural Visual (42%) */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="w-full lg:w-[42%] flex justify-center lg:justify-end"
        >
          {/* Double-Bezel Outer Hardware Shell */}
          <div className="p-1.5 sm:p-2.5 rounded-[1.75rem] sm:rounded-[2rem] bg-gradient-to-b from-[#2A1C14]/50 via-[#1C120D]/60 to-[#120B08]/90 border border-[#D4AF37]/25 shadow-[0_20px_50px_rgba(0,0,0,0.85)] backdrop-blur-md w-full max-w-[340px] sm:max-w-[390px] lg:max-w-[430px]">
            
            {/* Double-Bezel Inner Core */}
            <div className="relative w-full aspect-[16/11] sm:aspect-[4/5] max-h-[260px] sm:max-h-[430px] lg:max-h-[460px] rounded-[calc(1.75rem-0.375rem)] sm:rounded-[calc(2rem-0.5rem)] overflow-hidden border border-[#D4AF37]/20 bg-[#140D09] shadow-[inset_0_1px_2px_rgba(255,255,255,0.15)] group">
              
              {/* Soft Ambient Inner Vignette */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#140D09] via-transparent to-black/25 opacity-75 z-10 pointer-events-none" />
              
              {/* Heritage Location Badge */}
              <div className="absolute top-3 right-3 sm:top-3.5 sm:right-3.5 z-20 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-[#120B08]/85 backdrop-blur-md border border-[#D4AF37]/35 text-[9px] uppercase tracking-widest text-primary font-semibold shadow-md">
                Est. Cantonment
              </div>

              {/* Frosted Telemetry Console Pill (Google Rating + Operating Hours) */}
              <div className="absolute bottom-2.5 left-2.5 right-2.5 sm:bottom-3.5 sm:left-3.5 sm:right-3.5 z-20 flex items-center justify-between px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-[#140D09]/90 backdrop-blur-md border border-[#D4AF37]/25 shadow-lg pointer-events-none">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#D4AF37] text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                  <span className="font-sans text-xs font-semibold text-white">4.6</span>
                  <span className="font-sans text-[9px] sm:text-[10px] text-white/60 tracking-wider uppercase">(192 Reviews)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse" />
                  <span className="font-sans text-[9px] sm:text-[10px] text-[#D4AF37] tracking-wider uppercase font-medium">Daily &bull; 11am-11:30pm</span>
                </div>
              </div>

              {/* Food / Beverage Photography */}
              <img 
                src={hero.src} 
                alt={hero.alt || "Artisanal beverage at The Café Barrackpore"} 
                className="w-full h-full object-cover object-center group-hover:scale-[1.04] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                fetchPriority="high"
              />
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  );
};

