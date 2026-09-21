import React from 'react';
import { motion } from 'framer-motion';
import { smoothScrollTo } from '../utils/scroll';

export const Hero: React.FC = () => {
  const handleNav = (e: React.MouseEvent, target: string) => {
    e.preventDefault();
    smoothScrollTo(target);
  };

  return (
    <section className="relative w-full h-[calc(100vh-5rem)] min-h-[600px] flex items-center justify-center bg-background overflow-hidden">
      <div className="w-full max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-12 flex flex-col lg:flex-row items-center gap-10 lg:gap-16 relative z-10">
        
        {/* Left Side (60%) */}
        <div className="w-full lg:w-[60%] flex flex-col items-center text-center lg:items-start lg:text-left">
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.8 }}
            className="inline-flex items-center gap-3 px-5 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm mb-8"
          >
            <div className="flex text-[#D4AF37]">
              <span className="material-symbols-outlined text-sm" style={{fontVariationSettings: "'FILL' 1"}}>star</span>
              <span className="material-symbols-outlined text-sm" style={{fontVariationSettings: "'FILL' 1"}}>star</span>
              <span className="material-symbols-outlined text-sm" style={{fontVariationSettings: "'FILL' 1"}}>star</span>
              <span className="material-symbols-outlined text-sm" style={{fontVariationSettings: "'FILL' 1"}}>star</span>
              <span className="material-symbols-outlined text-sm" style={{fontVariationSettings: "'FILL' 1"}}>star_half</span>
            </div>
            <span className="font-label-md text-sm text-[#E3DACD] tracking-wide">4.6 (192 Google Reviews)</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="font-headline-lg text-4xl sm:text-5xl md:text-6xl lg:text-[72px] leading-[0.95] text-[#E3DACD] font-medium tracking-tight mb-4 sm:mb-6"
          >
            The Cafe <br className="hidden md:block"/>
            <span className="text-[#D4AF37] italic font-serif font-semibold">Barrackpore</span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="font-body-lg text-base sm:text-lg md:text-xl text-[#E3DACD]/70 max-w-xl leading-relaxed mb-8 sm:mb-10 font-light"
          >
            Where artisan coffee meets handcrafted cocktails & gourmet comfort food in a strictly premium, nocturnal setting.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.8 }}
            className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 mb-10 sm:mb-14 w-full sm:w-auto"
          >
            <a 
              className="w-full sm:w-auto px-8 py-4 rounded-md font-label-lg text-base text-[#231914] bg-[#D4AF37] hover:bg-[#ebd074] transition-colors flex items-center justify-center gap-2" 
              href="#menu-section" 
              onClick={(e) => handleNav(e, 'menu-section')}
            >
              <span>Explore Menu</span>
            </a>
            <a 
              className="w-full sm:w-auto px-8 py-4 rounded-md font-label-lg text-base text-[#E3DACD] bg-transparent border border-[#D4AF37]/30 hover:border-[#D4AF37] hover:bg-[#D4AF37]/5 transition-all flex items-center justify-center gap-2" 
              href="#reserve-section" 
              onClick={(e) => handleNav(e, 'reserve-section')}
            >
              <span>Book a Table</span>
            </a>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9, duration: 1 }}
            className="flex flex-wrap items-center justify-center lg:justify-start gap-4 sm:gap-8"
          >
            <div className="flex items-center gap-2 text-[#E3DACD]/60">
              <span className="material-symbols-outlined text-[#D4AF37] text-xl font-light">local_bar</span>
              <span className="font-label-sm text-[13px] tracking-widest uppercase">Mocktails</span>
            </div>
            <div className="flex items-center gap-2 text-[#E3DACD]/60">
              <span className="material-symbols-outlined text-[#D4AF37] text-xl font-light">local_pizza</span>
              <span className="font-label-sm text-[13px] tracking-widest uppercase">Wood-Fired Pizza</span>
            </div>
            <div className="flex items-center gap-2 text-[#E3DACD]/60">
              <span className="material-symbols-outlined text-[#D4AF37] text-xl font-light">music_note</span>
              <span className="font-label-sm text-[13px] tracking-widest uppercase">Acoustic Weekends</span>
            </div>
          </motion.div>

        </div>

        {/* Right Side (40%) */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 1 }}
          className="w-full lg:w-[40%] flex justify-center lg:justify-end"
        >
          <div 
            className="relative w-full max-w-[400px] lg:max-w-full h-[50vh] lg:h-[70vh] max-h-[700px]"
            style={{ 
              maskImage: 'radial-gradient(circle, black 60%, transparent 100%)',
              WebkitMaskImage: 'radial-gradient(circle, black 60%, transparent 100%)'
            }}
          >
            <div className="absolute inset-0 bg-[#231914]/20 z-10 mix-blend-overlay pointer-events-none"></div>
            <img 
              src="/images/hero-bar.webp" 
              alt="Premium Lounge Bar" 
              className="w-full h-full object-cover object-bottom"
            />
          </div>
        </motion.div>

      </div>
    </section>
  );
};
