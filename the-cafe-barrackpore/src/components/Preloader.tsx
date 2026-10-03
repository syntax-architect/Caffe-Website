import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clientDetails } from '../config/client';
import { useSiteConfig } from '../context/SiteConfigContext';

export const Preloader: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true);
  const { restaurantConfig, logoUrl } = useSiteConfig();

  const businessName = restaurantConfig?.businessName || clientDetails.businessName;

  useEffect(() => {
    // 1.5s luxury brand intro sequence before smooth curtain lift
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="luxury-preloader"
          initial={{ y: 0 }}
          exit={{ y: '-100%' }}
          transition={{ duration: 0.85, ease: [0.76, 0, 0.24, 1] }}
          className="fixed inset-0 z-[99999] bg-[#070504] flex flex-col items-center justify-center overflow-hidden pointer-events-auto select-none"
        >
          {/* Subtle Ambient Radial Gold Glow */}
          <div className="absolute w-[500px] h-[500px] rounded-full bg-[#D4AF37]/10 blur-[140px] pointer-events-none" />

          {/* Central Branded Composition */}
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -25, scale: 1.04 }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex flex-col items-center gap-6 px-6 z-10"
          >
            {/* Double-Ring Luxury Crest Frame */}
            <div className="relative p-1.5 rounded-full bg-gradient-to-b from-[#D4AF37]/40 via-white/10 to-[#D4AF37]/20 shadow-[0_0_50px_rgba(212,175,55,0.25)]">
              <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-[#0E0907] border border-white/10 p-3 sm:p-4 flex items-center justify-center overflow-hidden">
                <img
                  src={logoUrl || '/logo.webp'}
                  alt={`${businessName} Crest`}
                  className="w-full h-full object-contain filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]"
                  fetchPriority="high"
                  decoding="sync"
                />
              </div>

              {/* Pulsing Micro-Orbit Ring */}
              <div className="absolute inset-0 rounded-full border border-[#D4AF37]/40 animate-ping opacity-20 pointer-events-none" />
            </div>

            {/* Typography Stack */}
            <div className="flex flex-col items-center text-center gap-2">
              <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl text-[#F5F2F0] font-normal tracking-[0.18em] uppercase">
                {businessName}
              </h1>
              <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-mono tracking-[0.3em] uppercase text-[#D4AF37]">
                <span>EST. BARRACKPORE</span>
                <span className="text-white/20">•</span>
                <span>2200K NOCTURNE</span>
              </div>
            </div>

            {/* Precision Golden Hairline Progress Track */}
            <div className="w-48 sm:w-60 h-[2px] bg-white/10 rounded-full overflow-hidden mt-2">
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 1.35, ease: [0.65, 0, 0.35, 1] }}
                className="h-full bg-gradient-to-r from-[#D4AF37] via-[#F3C766] to-[#E3DACD]"
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
