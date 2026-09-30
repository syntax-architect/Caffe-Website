import React from 'react';
import { motion } from 'framer-motion';
import { useSiteConfig } from '../context/SiteConfigContext';

const EditorialParagraph = ({ text }: { text: string }) => {
  return (
    <motion.p 
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="font-sans text-base sm:text-lg leading-relaxed text-on-surface/85 font-light"
    >
      {text}
    </motion.p>
  );
};

export const OurStory: React.FC = () => {
  const { ourStory } = useSiteConfig();

  return (
    <section className="w-full py-16 sm:py-20 lg:py-28 bg-[#110B08] relative border-t border-white/5 scroll-mt-28 overflow-hidden" id="our-story">
      {/* Subtle Ambient Radial Lighting - Hidden on mobile to eliminate GPU throttling */}
      <div 
        className="absolute -top-24 right-0 w-[500px] h-[500px] bg-[#D4AF37]/5 blur-[130px] rounded-full pointer-events-none hidden sm:block" 
        aria-hidden="true" 
      />

      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 lg:gap-24 items-center">
          
          {/* Left Side: Double-Bezel Architectural Frame */}
          <motion.div 
            initial={{ opacity: 0, y: 35 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-[2.5rem] p-2 bg-gradient-to-b from-[#221610] via-[#180F0B] to-[#110B08] ring-1 ring-[#D4AF37]/25 shadow-[0_25px_60px_rgba(0,0,0,0.7)] group"
          >
            <div className="relative w-full aspect-[4/5] sm:h-[540px] md:h-[620px] rounded-[calc(2.5rem-0.5rem)] overflow-hidden bg-[#0D0705] border border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]">
              <div className="absolute inset-0 bg-gradient-to-t from-[#110B08] via-transparent to-black/25 opacity-80 z-10 pointer-events-none" />
              
              {/* Authentic Heritage Badge */}
              <div className="absolute top-5 left-5 z-20 px-4 py-1.5 rounded-full bg-[#120B08]/90 backdrop-blur-md border border-[#D4AF37]/35 text-[10px] uppercase tracking-[0.2em] text-primary font-semibold shadow-lg">
                Origin · Riverside Cantonment
              </div>

              {/* Monogram Seal */}
              <div className="absolute bottom-5 right-5 z-20 w-12 h-12 rounded-full bg-[#120B08]/90 backdrop-blur-md border border-[#D4AF37]/30 flex items-center justify-center text-primary shadow-xl">
                <span className="font-serif text-sm font-semibold tracking-widest text-[#D4AF37]">
                  TCB
                </span>
              </div>

              <img 
                loading="lazy"
                src={ourStory.src} 
                alt={ourStory.alt || "The Café Barrackpore Interior Sanctuary"} 
                className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
              />
            </div>
          </motion.div>

          {/* Right Side: Editorial Content & Founders' Craft */}
          <motion.div 
            initial={{ opacity: 0, x: 25 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col gap-6"
          >
            <div className="inline-flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span className="editorial-eyebrow">Our Philosophy &amp; Heritage</span>
            </div>
            
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-on-surface tracking-tight leading-[1.12] text-balance">
              {ourStory.title || "Crafting Barrackpore’s finest nocturnal escape"}
            </h2>
            
            <div className="w-16 h-[2px] bg-gradient-to-r from-[#D4AF37] to-transparent my-1" />
            
            <EditorialParagraph text={ourStory.description || "We believe that true luxury lies in the details. From sourcing the most vibrant, local ingredients from surrounding farms to hand-selecting the perfect acoustic backdrop, every element of our space is intentionally curated."} />
            
            <EditorialParagraph text="This isn't just a cafe; it's a sanctuary designed for those who appreciate the art of slowing down. A place where deep conversations flow as freely as our signature pours." />
            
            {/* Editorial Double-Bezel Pull Quote Box */}
            <div className="rounded-2xl p-1 bg-gradient-to-r from-[#D4AF37]/20 via-white/5 to-transparent">
              <div className="rounded-[calc(1rem-2px)] bg-[#160E0A]/90 p-5 sm:p-6 border-l-2 border-primary">
                <span className="font-serif text-3xl text-primary/40 block -mb-2 leading-none font-bold">“</span>
                <p className="text-on-surface/90 italic font-serif text-sm sm:text-base leading-relaxed">
                  We built The Café as a retreat from the rushed ordinary — where hospitality is treated as an intentional culinary craft.
                </p>
              </div>
            </div>

            {/* Founders' Signature Block with Crest */}
            <div className="mt-2 flex items-center justify-between border-t border-[#D4AF37]/20 pt-6">
              <div className="flex flex-col items-start">
                <span className="font-serif text-2xl sm:text-3xl italic text-primary font-medium tracking-wide">
                  Arindam &amp; Suman
                </span>
                <span className="font-sans text-[11px] uppercase tracking-[0.2em] text-on-surface/60 mt-1">
                  Founders, The Café Barrackpore
                </span>
              </div>
              
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#18100C] border border-white/10 text-xs text-primary/80">
                <span className="material-symbols-outlined text-sm">verified</span>
                <span className="text-[11px] tracking-wider uppercase font-sans">Craft Guarantee</span>
              </div>
            </div>

          </motion.div>

        </div>
      </div>
    </section>
  );
};
