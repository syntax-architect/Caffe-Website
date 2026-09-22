import React from 'react';
import { motion } from 'framer-motion';

export const Gallery: React.FC = () => {
  return (
    <section className="w-full py-16 lg:py-32 bg-background relative" id="gallery">
      <div className="max-w-[1320px] mx-auto px-4 md:px-6 lg:px-12">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="mb-12 md:mb-16 text-center"
        >
          <div className="inline-flex items-center justify-center gap-2 mb-4">
            <span className="material-symbols-outlined text-[#D4AF37] text-xl font-light">auto_awesome</span>
            <span className="text-[#D4AF37] text-sm tracking-widest uppercase">The Visuals</span>
          </div>
          <h2 className="text-[#E3DACD] text-4xl md:text-5xl font-serif mb-12">
            Moments Captured
          </h2>
        </motion.div>

        {/* Asymmetrical Masonry Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 md:gap-8 auto-rows-[auto] md:auto-rows-[300px]">
          
          {/* Couple Image (Spans 2 Rows for portrait look) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6 }}
            className="col-span-1 md:col-span-1 md:row-span-2 w-full h-72 sm:h-80 md:h-full rounded-xl overflow-hidden group relative bg-surface-container"
          >
            <div className="absolute inset-0 bg-black/10 z-10 pointer-events-none group-hover:bg-transparent transition-colors duration-700" />
            <img loading="lazy" 
              src="/images/gallery-couple.jpg" 
              alt="Nightlife Couple"
              className="w-full h-full object-cover transition-transform duration-700 ease-in-out group-hover:scale-[1.03]"
            />
          </motion.div>

          {/* Pizza Image */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="col-span-1 md:col-span-1 lg:col-span-2 md:row-span-1 w-full h-72 sm:h-80 md:h-full rounded-xl overflow-hidden group relative bg-surface-container"
          >
             <div className="absolute inset-0 bg-black/10 z-10 pointer-events-none group-hover:bg-transparent transition-colors duration-700" />
             <img loading="lazy" 
              src="/images/gallery-pizza.jpg" 
              alt="Wood-Fired Pizza"
              className="w-full h-full object-cover transition-transform duration-700 ease-in-out group-hover:scale-[1.03]"
            />
          </motion.div>

          {/* Beans Image */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="col-span-1 md:col-span-1 md:row-span-1 w-full h-72 sm:h-80 md:h-full rounded-xl overflow-hidden group relative bg-surface-container"
          >
             <div className="absolute inset-0 bg-black/10 z-10 pointer-events-none group-hover:bg-transparent transition-colors duration-700" />
             <img loading="lazy"
              src="/images/gallery-beans.jpg" 
              alt="Artisanal Coffee Beans"
              className="w-full h-full object-cover transition-transform duration-700 ease-in-out group-hover:scale-[1.03]"
            />
          </motion.div>

          {/* Guitar Image */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="col-span-1 md:col-span-1 lg:col-span-1 md:row-span-1 w-full h-72 sm:h-80 md:h-full rounded-xl overflow-hidden group relative bg-surface-container"
          >
             <div className="absolute inset-0 bg-black/10 z-10 pointer-events-none group-hover:bg-transparent transition-colors duration-700" />
             <img loading="lazy"
              src="/images/gallery-guitar.jpg" 
              alt="Acoustic Weekend Guitar"
              className="w-full h-full object-cover transition-transform duration-700 ease-in-out group-hover:scale-[1.03]"
            />
          </motion.div>

        </div>
      </div>
    </section>
  );
};
