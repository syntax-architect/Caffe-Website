import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLogo } from '../hooks/useLogo';

export const Preloader: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true);
  const logoUrl = useLogo();

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 1500); // 1.5 seconds loading sequence
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 0 }}
          exit={{ y: '-100%' }}
          transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
          className="fixed inset-0 z-[9999] bg-[#1a130f] flex items-center justify-center overflow-hidden"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex flex-col items-center gap-6"
          >
            <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full border border-white/10 flex items-center justify-center bg-[#231914] overflow-hidden drop-shadow-[0_0_25px_rgba(212,175,55,0.2)]">
              <img src={logoUrl} alt="The Cafe Logo" className="w-full h-full object-contain" fetchPriority="high" decoding="sync" />
            </div>
            {/* We can keep the text below, but maybe smaller or omit it since the logo has text */}
            <h1 className="font-headline-lg text-2xl md:text-3xl text-[#E3DACD] font-medium tracking-widest uppercase mt-2">
              The Cafe
            </h1>
            <span className="font-label-sm text-[10px] tracking-[0.3em] uppercase text-[#D4AF37]/80 -mt-2">Barrackpore</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
