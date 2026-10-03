import React, { useRef, useState, useEffect } from 'react';
import { useSiteConfig } from '../context/SiteConfigContext';

interface StoryChapter {
  id: string;
  step: string;
  badge: string;
  title: string;
  titleItalic: string;
  description: string;
  highlight: string;
}

export const OurStory: React.FC = () => {
  const { ourStory } = useSiteConfig();
  const containerRef = useRef<HTMLElement>(null);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  // High-performance scroll tracking across the sticky section using rAF
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (!containerRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          const totalDistance = rect.height - window.innerHeight;
          if (totalDistance <= 0) return;
          const currentDistance = -rect.top;
          const p = Math.max(0, Math.min(1, currentDistance / totalDistance));
          setProgress(p);
          if (p < 0.34) {
            setActiveChapterIndex(0);
          } else if (p < 0.68) {
            setActiveChapterIndex(1);
          } else {
            setActiveChapterIndex(2);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // High-performance story photography asset
  const storyImageSrc = ourStory?.src || '/images/story-luxury-pour.jpg';

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

  const currentChapter = chapters[activeChapterIndex] || chapters[0];

  return (
    <section
      ref={containerRef}
      id="our-story"
      className="relative w-full bg-[#070504] border-t border-white/5 scroll-mt-24 min-h-[220vh] lg:min-h-[240vh]"
    >
      {/* Sticky Viewport Stage */}
      <div className="sticky top-16 sm:top-20 lg:top-24 w-full h-[80vh] sm:h-[82vh] lg:h-[85vh] max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-2 z-0">
        
        {/* Double-Bezel Outer Enclosure */}
        <div className="relative w-full h-full p-1.5 sm:p-2 rounded-[2rem] sm:rounded-[2.5rem] lg:rounded-[3rem] bg-gradient-to-b from-white/15 via-white/[0.04] to-white/10 ring-1 ring-[#D4AF37]/35 shadow-[0_30px_90px_rgba(0,0,0,0.95)]">
          <div className="relative w-full h-full rounded-[calc(2rem-0.375rem)] sm:rounded-[calc(2.5rem-0.5rem)] lg:rounded-[calc(3rem-0.5rem)] overflow-hidden bg-[#0A0706]">
            
            {/* 1. CRYSTAL-CLEAR CINEMATIC BACKGROUND IMAGE (Barista pour on left, editorial space on right) */}
            <img
              src={storyImageSrc}
              alt={ourStory?.alt || 'The Café Barrackpore Artisanal Coffee Pour'}
              style={{ transform: `scale(${1 + progress * 0.1})` }}
              className="absolute inset-0 w-full h-full object-cover object-[25%_center] md:object-[30%_center] lg:object-center filter brightness-[0.98] contrast-[1.08] saturate-[1.05] transition-transform duration-100 ease-out"
              loading="lazy"
              decoding="async"
              fetchPriority="low"
            />

            {/* 2. REFINED SUBTLE VIGNETTES (Protects typography readability while leaving the left pour crystal clear) */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/35 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/20 to-black/80 hidden md:block pointer-events-none" />

            {/* Ambient Golden Filament Lighting Flare (Aligned with top-right glowing pendant bulb) */}
            <div className="absolute top-6 right-8 sm:top-10 sm:right-16 w-80 h-80 bg-[#D4AF37]/25 blur-[100px] rounded-full pointer-events-none" />

            {/* 3. PINNED HUD TELEMETRY HEADER */}
            <div className="absolute top-4 left-4 right-4 sm:top-7 sm:left-8 sm:right-8 flex items-center justify-between z-20 pointer-events-none">
              <div className="inline-flex items-center gap-2.5 px-3 sm:px-4 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-[#D4AF37]/30 shadow-lg">
                <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />
                <span className="font-sans text-[10px] sm:text-[11px] font-semibold tracking-[0.24em] uppercase text-[#D4AF37]">
                  THE PHILOSOPHY & HERITAGE
                </span>
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-[10px] uppercase tracking-widest text-[#E3DACD]/80 font-mono">
                <span className="hidden sm:inline">EST. BARRACKPORE</span>
                <span className="hidden sm:inline text-white/20">•</span>
                <span className="text-[#D4AF37]">2200K NOCTURNE</span>
              </div>
            </div>

            {/* 4. FLOATING EDITORIAL CHAPTER CARD (Positioned gracefully on right, zero overlap with coffee pour) */}
            <div className="absolute inset-x-4 bottom-14 sm:bottom-16 md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:right-6 lg:right-10 md:left-auto md:max-w-lg lg:max-w-xl z-20">
              <div
                key={currentChapter.id}
                className="p-1 sm:p-1.5 rounded-[1.75rem] sm:rounded-[2.25rem] bg-gradient-to-br from-white/20 via-white/[0.06] to-white/10 ring-1 ring-[#D4AF37]/35 shadow-[0_20px_50px_rgba(0,0,0,0.85)] animate-fade-in transition-all duration-300"
              >
                <div className="rounded-[calc(1.75rem-0.25rem)] sm:rounded-[calc(2.25rem-0.375rem)] bg-[#0E0907]/90 backdrop-blur-2xl p-5 sm:p-8 md:p-10 border border-white/10 flex flex-col gap-4 sm:gap-6">
                  
                  {/* Chapter Header */}
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="inline-flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-[#D4AF37] tracking-wider">
                        {currentChapter.step}
                      </span>
                      <span className="text-white/25">/</span>
                      <span className="font-sans text-[10px] sm:text-[11px] font-semibold tracking-[0.2em] uppercase text-[#E3DACD]">
                        {currentChapter.badge}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {chapters.map((ch, idx) => (
                        <div
                          key={ch.id}
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            activeChapterIndex === idx
                              ? 'w-6 bg-[#D4AF37]'
                              : 'w-1.5 bg-white/20'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Chapter Headline */}
                  <h3 className="font-sans text-2xl sm:text-3xl lg:text-4xl xl:text-[2.6rem] font-medium tracking-tight text-[#F5F2F0] leading-[1.08]">
                    <span>{currentChapter.title} </span>
                    <span className="font-serif italic font-normal text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] via-[#F3C766] to-[#E3DACD]">
                      {currentChapter.titleItalic}
                    </span>
                  </h3>

                  {/* Chapter Description */}
                  <p className="font-sans text-xs sm:text-sm lg:text-base text-[#E3DACD]/85 font-light leading-relaxed">
                    {currentChapter.description}
                  </p>

                  {/* Chapter Footnote */}
                  <div className="pt-1 flex items-center gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
                    <span className="font-sans text-xs text-[#D4AF37] font-medium tracking-wide">
                      {currentChapter.highlight}
                    </span>
                  </div>

                </div>
              </div>
            </div>

            {/* 5. PINNED SCRUB TELEMETRY PROGRESS BAR */}
            <div className="absolute bottom-3 left-4 right-4 sm:bottom-5 sm:left-8 sm:right-8 flex flex-col gap-1.5 z-20 pointer-events-none">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-white/60">
                <span className="text-[#D4AF37] flex items-center gap-1.5">
                  <span className="inline-block animate-bounce">↓</span>
                  SCROLL TO ADVANCE CHAPTERS
                </span>
                <span>CHAPTER 0{activeChapterIndex + 1} / 03</span>
              </div>
              <div className="w-full h-[2.5px] bg-white/10 rounded-full overflow-hidden">
                <div
                  style={{ width: `${progress * 100}%` }}
                  className="h-full bg-gradient-to-r from-[#D4AF37] via-[#F3C766] to-[#E3DACD] transition-all duration-75 ease-out"
                />
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
};
