import React from 'react';
import { motion } from 'framer-motion';

export const Hero: React.FC = () => {
  return (
    <section className="relative w-full -mt-20 overflow-hidden min-h-[92vh] flex items-center justify-center">
      <div className="absolute inset-0 z-0">
        <motion.img 
          initial={{ scale: 1.1 }}
          animate={{ scale: 1.05 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          alt="The Cafe Barrackpore nocturnal lounge"
          className="w-full h-full object-cover object-center"
          src="/images/hero.webp"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-surface-container-lowest/80 to-surface-container-lowest/50 backdrop-blur-[2px]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary-container/10 via-secondary-container/15 to-transparent mix-blend-screen pointer-events-none"></div>
      </div>
      
      <div className="relative z-10 w-full max-w-[1320px] mx-auto px-gutter flex flex-col items-center text-center pt-20 pb-space-lg">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="inline-flex items-center gap-space-xs px-space-md py-1.5 rounded-full bg-surface-container-high/80 backdrop-blur-md shadow-lg shadow-black/40 mb-space-lg"
        >
          <div className="flex text-tertiary">
            <span className="material-symbols-outlined text-sm" style={{fontVariationSettings: "'FILL' 1"}}>star</span>
            <span className="material-symbols-outlined text-sm" style={{fontVariationSettings: "'FILL' 1"}}>star</span>
            <span className="material-symbols-outlined text-sm" style={{fontVariationSettings: "'FILL' 1"}}>star</span>
            <span className="material-symbols-outlined text-sm" style={{fontVariationSettings: "'FILL' 1"}}>star</span>
            <span className="material-symbols-outlined text-sm" style={{fontVariationSettings: "'FILL' 1"}}>star_half</span>
          </div>
          <span className="font-label-md text-label-md text-on-surface font-semibold tracking-wide">4.6 (192 Google Reviews)</span>
          <span className="text-on-surface-variant font-label-md">•</span>
          <span className="font-label-md text-label-md text-primary tracking-wide">Barrackpore's Premier Hangout Lounge</span>
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="font-display-lg text-display-lg max-w-4xl tracking-tight text-on-surface font-bold drop-shadow-2xl"
        >
          The Cafe <span className="bg-gradient-to-r from-primary-container via-tertiary to-primary bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(249,115,22,0.4)]">Barrackpore</span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="font-headline-sm text-headline-sm max-w-2xl mt-space-md text-on-surface-variant font-normal leading-relaxed"
        >
          Where Artisan Coffee Meets Handcrafted Cocktails & Gourmet Comfort Food.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="flex flex-wrap items-center justify-center gap-space-md mt-space-xl"
        >
          <a className="px-space-xl py-space-md rounded-xl font-label-lg text-label-lg text-on-primary-container bg-gradient-to-r from-primary-container to-tertiary-container shadow-[0_0_24px_rgba(249,115,22,0.45)] hover:shadow-[0_0_36px_rgba(249,115,22,0.7)] transition-all flex items-center gap-space-xs group" href="#menu-section">
            <span className="material-symbols-outlined group-hover:rotate-12 transition-transform">restaurant_menu</span>
            <span>Explore Full Menu</span>
          </a>
          <a className="px-space-xl py-space-md rounded-xl font-label-lg text-label-lg text-secondary bg-surface-container-high/80 hover:bg-surface-bright shadow-lg backdrop-blur-xl transition-all flex items-center gap-space-xs" href="#reserve-section">
            <span className="material-symbols-outlined text-secondary">calendar_month</span>
            <span>Book a Table</span>
          </a>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-space-sm sm:gap-space-md mt-space-xl max-w-3xl w-full"
        >
          {[
            { icon: 'bolt', color: 'text-primary', text: 'Free High-Speed Wi-Fi' },
            { icon: 'music_note', color: 'text-tertiary', text: 'Live Acoustic Weekends' },
            { icon: 'local_bar', color: 'text-secondary', text: 'Mocktails & Sips' },
            { icon: 'local_pizza', color: 'text-primary-container', text: 'Wood-Fired Crusts' }
          ].map((badge, idx) => (
            <div key={idx} className="flex items-center justify-center gap-space-xs px-space-md py-space-sm rounded-xl bg-surface-container-low/70 backdrop-blur-md shadow-md text-on-surface-variant">
              <span className={`material-symbols-outlined ${badge.color} text-lg`}>{badge.icon}</span>
              <span className="font-label-md text-label-md text-on-surface">{badge.text}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};
