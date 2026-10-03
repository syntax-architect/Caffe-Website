import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { useSiteConfig } from '../context/SiteConfigContext';

interface StoryChapter {
  id: string;
  step: string;
  title: string;
  titleItalic: string;
  description: string;
  badge: string;
  highlight: string;
}

export const OurStory: React.FC = () => {
  const { ourStory } = useSiteConfig();
  const containerRef = useRef<HTMLElement>(null);
  const shouldReduceMotion = useReducedMotion();

  // Scroll tracking across the sticky section
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Smooth scroll transformations for the sticky background
  const bgScale = useTransform(scrollYProgress, [0, 1], shouldReduceMotion ? [1, 1] : [1.02, 1.14]);
  const bgY = useTransform(scrollYProgress, [0, 1], shouldReduceMotion ? ['0%', '0%'] : ['0%', '-5%']);
  const overlayOpacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.55, 0.65, 0.72]);

  // Dynamic progress line for the pinned HUD
  const progressLineWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  const chapters: StoryChapter[] = [
    {
      id: 'chapter-1',
      step: '01',
      badge: 'THE PHILOSOPHY',
      title: 'A retreat from the',
      titleItalic: 'rushed ordinary.',
      description:
        ourStory?.description ||
        'Conceived as an antidote to urban rush, The Café Barrackpore reimagines colonial Bengal heritage into an intimate, contemporary nocturnal haven where time gently slows down.',
      highlight: 'Slow living in the heart of Barrackpore.',
    },
    {
      id: 'chapter-2',
      step: '02',
      badge: '2200K NOCTURNAL RITUAL',
      title: 'The Sanctuary of',
      titleItalic: 'amber warmth.',
      description:
        'Tufted sapphire velvet booths, hand-finished walnut surfaces, and warm 2200K tungsten filament lighting create an unhurried sanctuary tailored for meaningful conversations.',
      highlight: 'Acoustic jazz, smoked vanilla & single-origin aromas.',
    },
    {
      id: 'chapter-3',
      step: '03',
      badge: 'ARTISANAL GASTRONOMY',
      title: 'Crafted with',
      titleItalic: 'obsessive intent.',
      description:
        'From hand-pulled espresso crema and slow cold-drip extractions to wood-fired artisanal sourdough pizzas and sizzling tandoori banquets, every creation is an intentional celebration.',
      highlight: 'Locally sourced botanicals & master culinary craft.',
    },
  ];

  return (
    <section
      ref={containerRef}
      id="our-story"
      className="relative w-full bg-[#070504] border-t border-white/5 scroll-mt-24 min-h-[220vh] lg:min-h-[260vh]"
    >
      {/* Ambient background glows */}
      <div
        className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#D4AF37]/5 blur-[160px] rounded-full"
        aria-hidden="true"
      />

      {/* Sticky Background Viewport Master */}
      <div className="sticky top-20 lg:top-24 w-full h-[76vh] lg:h-[84vh] max-w-[1400px] mx-auto px-4 sm:px-8 py-2 z-0">
        
        {/* Double-Bezel Frame Enclosure */}
        <div className="relative w-full h-full p-1.5 sm:p-2 rounded-[2.25rem] lg:rounded-[3rem] bg-gradient-to-b from-white/10 via-white/[0.03] to-white/10 ring-1 ring-[#D4AF37]/30 shadow-[0_30px_90px_rgba(0,0,0,0.95)]">
          <div className="relative w-full h-full rounded-[calc(2.25rem-0.375rem)] lg:rounded-[calc(3rem-0.5rem)] overflow-hidden bg-[#0A0706]">
            
            {/* Pinned Sticky Photography with Scrub Zoom */}
            <motion.img
              src={ourStory?.src || '/images/story-luxury-pour.jpg'}
              alt={ourStory?.alt || 'The Café Barrackpore Artisanal Coffee Pour'}
              style={{ scale: bgScale, y: bgY }}
              className="absolute inset-0 w-full h-full object-cover object-center filter brightness-[0.92] contrast-[1.06]"
              loading="lazy"
              decoding="async"
            />

            {/* Seamless Vignettes & Contrast Gradients */}
            <motion.div
              style={{ opacity: overlayOpacity }}
              className="absolute inset-0 bg-[#070504] pointer-events-none"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#070504] via-[#070504]/50 to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#070504]/90 via-[#070504]/50 to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#070504]/80 via-transparent to-transparent pointer-events-none" />

            {/* Ambient Golden Filament Spotlight */}
            <div className="absolute top-10 right-10 w-96 h-96 bg-[#D4AF37]/15 blur-[120px] rounded-full pointer-events-none" />

            {/* Pinned HUD Header */}
            <div className="absolute top-6 left-6 right-6 sm:top-8 sm:left-10 sm:right-10 flex items-center justify-between z-10 pointer-events-none">
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/10">
                <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />
                <span className="font-sans text-[10px] sm:text-[11px] font-semibold tracking-[0.24em] uppercase text-[#D4AF37]">
                  THE PHILOSOPHY & HERITAGE
                </span>
              </div>

              <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-[10px] uppercase tracking-widest text-[#E3DACD]/80 font-mono">
                <span>EST. BARRACKPORE</span>
                <span className="text-white/20">•</span>
                <span className="text-[#D4AF37]">2200K NOCTURNE</span>
              </div>
            </div>

            {/* Pinned HUD Bottom Scrub Indicator */}
            <div className="absolute bottom-6 left-6 right-6 sm:bottom-8 sm:left-10 sm:right-10 flex flex-col gap-2 z-10 pointer-events-none">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-white/50">
                <span className="text-[#D4AF37]">SCROLL TO EXPLORE CHAPTERS</span>
                <span>CHAPTER 01 / 03</span>
              </div>
              <div className="w-full h-[2px] bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  style={{ width: progressLineWidth }}
                  className="h-full bg-gradient-to-r from-[#D4AF37] to-[#F3C766]"
                />
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Floating Narrative Content Cards Moving UPON The Sticky Image */}
      <div className="relative z-10 max-w-[1360px] mx-auto px-4 sm:px-8 -mt-[68vh] lg:-mt-[74vh] pb-32 flex flex-col gap-36 sm:gap-48 pointer-events-none">
        {chapters.map((chapter) => (
          <div
            key={chapter.id}
            className="w-full max-w-xl sm:max-w-2xl ml-auto pointer-events-auto"
          >
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.98 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: false, margin: '-100px' }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="p-1.5 sm:p-2 rounded-[2rem] sm:rounded-[2.5rem] bg-gradient-to-br from-white/15 via-white/[0.04] to-white/10 ring-1 ring-[#D4AF37]/30 shadow-[0_25px_70px_rgba(0,0,0,0.9)]"
            >
              <div className="rounded-[calc(2rem-0.375rem)] sm:rounded-[calc(2.5rem-0.5rem)] bg-[#100A08]/90 backdrop-blur-2xl p-6 sm:p-10 border border-white/10 flex flex-col gap-6">
                
                {/* Card Eyebrow */}
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div className="inline-flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-[#D4AF37] tracking-wider">
                      {chapter.step}
                    </span>
                    <span className="text-white/20">/</span>
                    <span className="font-sans text-[11px] font-semibold tracking-[0.2em] uppercase text-[#E3DACD]">
                      {chapter.badge}
                    </span>
                  </div>

                  <span className="font-mono text-[10px] text-white/40 uppercase tracking-widest hidden sm:inline">
                    TCB HERITAGE
                  </span>
                </div>

                {/* Card Headline */}
                <h3 className="font-sans text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-[#F5F2F0] leading-[1.05]">
                  <span>{chapter.title} </span>
                  <span className="font-serif italic font-normal text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] via-[#F3C766] to-[#E3DACD]">
                    {chapter.titleItalic}
                  </span>
                </h3>

                {/* Card Description */}
                <p className="font-sans text-sm sm:text-base text-[#E3DACD]/80 font-light leading-relaxed">
                  {chapter.description}
                </p>

                {/* Card Footnote / Highlight Pill */}
                <div className="pt-2 flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
                  <span className="font-sans text-xs text-[#D4AF37] font-medium tracking-wide">
                    {chapter.highlight}
                  </span>
                </div>

              </div>
            </motion.div>
          </div>
        ))}
      </div>
    </section>
  );
};
