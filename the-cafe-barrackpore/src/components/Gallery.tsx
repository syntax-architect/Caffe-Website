import React from 'react';
import { motion } from 'framer-motion';

export const Gallery: React.FC = () => {
  return (
    <section className="w-full py-24 md:py-32 bg-background relative" id="gallery">
      <div className="max-w-[1320px] mx-auto px-4 md:px-6 lg:px-12">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="mb-12 md:mb-16 text-center"
        >
          <div className="inline-flex items-center justify-center gap-2 mb-4">
            <span className="material-symbols-outlined text-primary text-xl font-light">auto_awesome</span>
            <span className="font-label-sm text-xs uppercase tracking-[0.2em] text-primary font-semibold">The Visuals</span>
          </div>
          <h2 className="font-headline-lg text-4xl md:text-5xl lg:text-6xl text-on-surface font-serif tracking-tight">
            Moments <span className="italic font-light">Captured</span>
          </h2>
        </motion.div>

        {/* Asymmetrical Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-2 gap-6 md:gap-8 auto-rows-[300px]">
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6 }}
            className="col-span-1 md:col-span-2 row-span-1 rounded-2xl overflow-hidden bg-white/5 group relative"
          >
            <div className="w-full h-full bg-white/5 transition-transform duration-500 group-hover:scale-[1.02]" />
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="col-span-1 md:col-span-1 row-span-2 rounded-2xl overflow-hidden bg-white/5 group relative"
          >
             <div className="w-full h-full bg-white/5 transition-transform duration-500 group-hover:scale-[1.02]" />
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="col-span-1 md:col-span-1 row-span-1 rounded-2xl overflow-hidden bg-white/5 group relative"
          >
             <div className="w-full h-full bg-white/5 transition-transform duration-500 group-hover:scale-[1.02]" />
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="col-span-1 md:col-span-1 row-span-1 rounded-2xl overflow-hidden bg-white/5 group relative"
          >
             <div className="w-full h-full bg-white/5 transition-transform duration-500 group-hover:scale-[1.02]" />
          </motion.div>

        </div>
      </div>
    </section>
  );
};
