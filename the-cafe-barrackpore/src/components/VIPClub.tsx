import React from 'react';
import { motion } from 'framer-motion';

export const VIPClub: React.FC = () => {
  return (
    <section className="w-full py-24 md:py-32 bg-black/40 border-y border-white/5 relative" id="vip-club">
      <div className="max-w-[800px] mx-auto px-4 md:px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="flex flex-col items-center gap-6"
        >
          <div className="w-12 h-12 rounded-full border border-primary/20 bg-primary/5 flex items-center justify-center mb-2">
            <span className="material-symbols-outlined text-primary text-2xl font-light">mail</span>
          </div>

          <h2 className="font-headline-lg text-4xl md:text-5xl lg:text-6xl text-on-surface font-serif tracking-tight">
            Join the <span className="italic font-light">Inner Circle</span>
          </h2>

          <p className="font-body-md text-base md:text-lg text-on-surface/70 leading-relaxed max-w-lg mx-auto">
            Subscribe for priority reservations, acoustic weekend line-ups, and secret menu unlocks.
          </p>

          <form className="w-full max-w-md mt-6 flex flex-col sm:flex-row gap-6 sm:gap-4 items-end" onSubmit={(e) => e.preventDefault()}>
            <div className="flex-1 w-full relative">
              <input 
                type="email" 
                placeholder="Enter your email" 
                required
                className="w-full bg-transparent border-b border-white/20 px-0 py-3 text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-primary transition-colors font-body-md"
              />
            </div>
            <button 
              type="submit"
              className="w-full sm:w-auto px-8 py-3 bg-primary text-background font-label-lg rounded-full hover:bg-primary/90 transition-colors uppercase tracking-widest whitespace-nowrap"
            >
              Subscribe
            </button>
          </form>
        </motion.div>
      </div>
    </section>
  );
};
