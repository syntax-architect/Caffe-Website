import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion, type MotionValue } from 'framer-motion';
import { useSiteConfig } from '../context/SiteConfigContext';

interface ScrubWordProps {
  children: React.ReactNode;
  progress: MotionValue<number>;
  range: [number, number];
  isGold?: boolean;
  className?: string;
}

const ScrubWord: React.FC<ScrubWordProps> = ({ children, progress, range, isGold, className = '' }) => {
  const shouldReduceMotion = useReducedMotion();
  const opacity = useTransform(progress, range, shouldReduceMotion ? [1, 1] : [0.8, 1]);

  return (
    <motion.span 
      style={{ opacity, color: isGold ? '#D4AF37' : '#F5F2F0' }} 
      className={`inline-block mr-[0.25em] will-change-[opacity] ${className}`}
    >
      {children}
    </motion.span>
  );
};

export const OurStory: React.FC = () => {
  const { ourStory } = useSiteConfig();
  const sectionRef = useRef<HTMLElement>(null);

  // Track scroll position across OurStory section
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start 85%', 'center 35%'],
  });

  const headlineTokens = [
    { text: 'A', isGold: false },
    { text: 'retreat', isGold: false },
    { text: 'from', isGold: false },
    { text: 'the', isGold: false },
    { text: 'rushed', isGold: true, isSerif: true },
    { text: 'ordinary.', isGold: true, isSerif: true },
  ];

  const subtext = ourStory?.title || "Crafting Barrackpore's finest nocturnal escape.";
  const subtextWords = subtext.split(' ');

  const description = ourStory?.description || 
    "We believe that true luxury lies in the details. From sourcing the most vibrant, local ingredients from surrounding farms to hand-selecting the perfect acoustic backdrop, every element of our space is intentionally curated.";
  const descriptionWords = description.split(' ');

  return (
    <section 
      ref={sectionRef}
      className="w-full py-24 lg:py-40 bg-[#0a0807] relative border-t border-white/5 overflow-hidden" 
      id="our-story"
    >
      {/* Subtle ambient background glow */}
      <div 
        className="absolute top-1/4 right-[-10%] w-[500px] h-[500px] rounded-full bg-[#D4AF37]/5 blur-[140px] pointer-events-none" 
        aria-hidden="true" 
      />

      <div className="max-w-[1400px] mx-auto px-6 sm:px-12 relative z-10">
        <div className="flex flex-col lg:flex-row gap-16 lg:gap-24 items-start">
          
          {/* Left: The Kinetic Scrub Typography */}
          <div className="w-full lg:w-1/2 flex flex-col gap-10 sm:gap-12">
            
            {/* Tag / Eyebrow */}
            <div className="flex items-center gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
              <span className="font-sans text-[11px] sm:text-xs font-semibold tracking-[0.28em] uppercase text-[#D4AF37]/90">
                THE PHILOSOPHY
              </span>
            </div>

            {/* Video-like Dark to White Headline */}
            <h2 className="font-sans text-4xl sm:text-5xl lg:text-7xl xl:text-[5.25rem] leading-[0.92] tracking-tighter font-medium">
              {headlineTokens.map((token, i) => {
                const start = (i / headlineTokens.length) * 0.45;
                const end = ((i + 1) / headlineTokens.length) * 0.45;
                return (
                  <ScrubWord 
                    key={i} 
                    progress={scrollYProgress} 
                    range={[start, end]} 
                    isGold={token.isGold}
                    className={token.isSerif ? 'italic font-serif' : ''}
                  >
                    {token.text}
                  </ScrubWord>
                );
              })}
            </h2>

            <div className="space-y-8">
              {/* Supporting Title with Kinetic Dark-to-White Scrub */}
              <p className="font-sans text-xl lg:text-2xl leading-relaxed font-light max-w-[32ch]">
                {subtextWords.map((word, i) => {
                  const start = 0.40 + (i / subtextWords.length) * 0.25;
                  const end = 0.40 + ((i + 1) / subtextWords.length) * 0.25;
                  return (
                    <ScrubWord 
                      key={i} 
                      progress={scrollYProgress} 
                      range={[start, end]}
                    >
                      {word}
                    </ScrubWord>
                  );
                })}
              </p>

              <div className="w-12 h-[1px] bg-white/20" />

              {/* Body Paragraph with Kinetic Dark-to-White Scrub */}
              <p className="font-sans text-base lg:text-lg leading-relaxed font-light max-w-[42ch]">
                {descriptionWords.map((word, i) => {
                  const start = 0.60 + (i / descriptionWords.length) * 0.38;
                  const end = 0.60 + ((i + 1) / descriptionWords.length) * 0.38;
                  return (
                    <ScrubWord 
                      key={i} 
                      progress={scrollYProgress} 
                      range={[start, end]}
                    >
                      {word}
                    </ScrubWord>
                  );
                })}
              </p>
            </div>
          </div>

          {/* Right: The Z-Axis Cascade Image */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-full lg:w-1/2"
          >
            <div className="p-2 sm:p-2.5 rounded-[2rem] lg:rounded-[2.5rem] bg-white/[0.02] border border-white/5 shadow-2xl backdrop-blur-2xl w-full -rotate-1 hover:rotate-0 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]">
              <div className="relative w-full aspect-[4/5] rounded-[calc(2rem-0.5rem)] lg:rounded-[calc(2.5rem-0.625rem)] overflow-hidden bg-[#0a0807] group">
                
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 z-10 pointer-events-none transition-opacity duration-700 group-hover:opacity-40" />
                
                <div className="absolute top-6 left-6 z-20 px-3 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-[10px] uppercase tracking-widest text-[#E3DACD] font-medium">
                  The Heritage
                </div>

                <div className="absolute bottom-6 right-6 z-20 w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-[#D4AF37] shadow-xl">
                  <span className="font-serif text-sm font-semibold tracking-widest text-[#D4AF37]">
                    TCB
                  </span>
                </div>

                <img 
                  loading="lazy"
                  decoding="async"
                  src={ourStory?.src || "/images/story-pour.webp"} 
                  alt={ourStory?.alt || "The Cafe Barrackpore Interior Pour"} 
                  className="w-full h-full object-cover object-center scale-[1.01] group-hover:scale-[1.05] transition-transform duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)]"
                />
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};
