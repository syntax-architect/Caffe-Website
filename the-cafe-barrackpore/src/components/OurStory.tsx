import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useSiteConfig } from '../context/SiteConfigContext';
import { DEFAULT_STORY_CHAPTERS, type StoryChapter } from '../services/siteContentService';
import { chapterTransitionVariants, resolveReducedMotion } from '../utils/motion';

export const OurStory: React.FC = () => {
  const { ourStory } = useSiteConfig();
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [progress, setProgress] = useState(0);
  const [isTouchDevice] = useState(() =>
    typeof window !== 'undefined' ? ('ontouchstart' in window || navigator.maxTouchPoints > 0) : false
  );

  // Dedicated imagery and copy for each curated chapter
  const customStorySrc = ourStory?.src;
  const chapters: StoryChapter[] = ourStory?.chapters && ourStory.chapters.length > 0
    ? ourStory.chapters
    : [
        {
          ...DEFAULT_STORY_CHAPTERS[0],
          description:
            ourStory?.description ||
            DEFAULT_STORY_CHAPTERS[0].description,
          image: customStorySrc && 
            customStorySrc !== '/images/story-luxury-pour.jpg' && 
            customStorySrc !== '/images/story-pour.webp' &&
            customStorySrc !== '/images/components/comp_img_0.webp' &&
            customStorySrc !== '/images/components/comp_img_0_highres.jpg'
            ? customStorySrc
            : DEFAULT_STORY_CHAPTERS[0].image,
          imageAlt: DEFAULT_STORY_CHAPTERS[0].imageAlt,
        },
        DEFAULT_STORY_CHAPTERS[1],
        DEFAULT_STORY_CHAPTERS[2],
      ];

  const numChapters = Math.max(1, chapters.length);

  // Jump smoothly to a specific chapter
  const scrollToChapter = useCallback((index: number) => {
    const targetIdx = Math.max(0, Math.min(numChapters - 1, index));
    setDirection(targetIdx >= activeChapterIndex ? 1 : -1);
    setActiveChapterIndex(targetIdx);

    if (!containerRef.current || numChapters <= 1) return;
    const rect = containerRef.current.getBoundingClientRect();
    const containerTop = window.scrollY + rect.top;
    const scrollableDistance = rect.height - window.innerHeight;
    if (scrollableDistance > 0) {
      const targetP = (targetIdx + 0.5) / numChapters;
      window.scrollTo({
        top: containerTop + scrollableDistance * targetP,
        behavior: 'smooth',
      });
    }
  }, [activeChapterIndex, numChapters]);

  // High-performance scroll tracking across the sticky section
  useEffect(() => {
    if (numChapters <= 1) return;

    let ticking = false;
    let isIntersecting = false;
    let cachedTop = 0;
    let cachedHeight = 0;
    let lastProgress = 0;

    const el = containerRef.current;
    if (!el) return;

    const updateGeometry = () => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      cachedTop = rect.top + window.scrollY;
      cachedHeight = rect.height;
    };

    const observer = new IntersectionObserver(
      (entries) => {
        isIntersecting = entries[0]?.isIntersecting ?? false;
        if (isIntersecting) {
          updateGeometry();
        }
      },
      { threshold: 0, rootMargin: '150px 0px' }
    );
    observer.observe(el);

    const handleScroll = () => {
      if (!isIntersecting) return;
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const totalDistance = cachedHeight - window.innerHeight;
          if (totalDistance <= 0) {
            ticking = false;
            return;
          }
          const currentDistance = window.scrollY - cachedTop;
          const p = Math.max(0, Math.min(1, currentDistance / totalDistance));
          if (Math.abs(p - lastProgress) > 0.003 || p === 0 || p === 1) {
            lastProgress = p;
            setProgress(p);
          }
          const computedIdx = Math.min(numChapters - 1, Math.max(0, Math.floor(p * numChapters)));
          setActiveChapterIndex((prev) => {
            if (prev !== computedIdx) {
              setDirection(computedIdx > prev ? 1 : -1);
              return computedIdx;
            }
            return prev;
          });
          ticking = false;
        });
        ticking = true;
      }
    };

    updateGeometry();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', updateGeometry, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updateGeometry);
    };
  }, [numChapters]);

  // Touch swipe support for mobile chapters
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    // Only respond to predominantly horizontal swipes
    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      if (deltaX < 0 && activeChapterIndex < numChapters - 1) {
        scrollToChapter(activeChapterIndex + 1);
      } else if (deltaX > 0 && activeChapterIndex > 0) {
        scrollToChapter(activeChapterIndex - 1);
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const currentChapter = chapters[activeChapterIndex] || chapters[0];
  const sectionMinHeight = numChapters === 1 ? 100 : Math.max(160, numChapters * 70);
  const resolvedVariants = resolveReducedMotion(chapterTransitionVariants, Boolean(prefersReducedMotion));

  return (
    <section
      ref={containerRef}
      id="our-story"
      className="relative w-full bg-background border-t border-outline/15 scroll-mt-24 transition-colors duration-500"
      style={{ minHeight: `${sectionMinHeight}vh` }}
    >
      {/* Sticky Viewport Stage */}
      <div className="sticky top-16 sm:top-20 lg:top-24 w-full h-[80vh] sm:h-[82vh] lg:h-[85vh] max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-2 z-0">
        
        {/* Architectural Story Stage Frame */}
        <div 
          className="relative w-full h-full rounded-[2rem] sm:rounded-[2.5rem] lg:rounded-[3rem] overflow-hidden bg-surface-container-lowest border border-outline/25 shadow-[0_30px_90px_rgba(0,0,0,0.8)]"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
            
            {/* 1. CRYSTAL-CLEAR CINEMATIC BACKGROUND IMAGES (Cross-fade between chapters with restrained scale) */}
            {chapters.map((ch, idx) => (
              <img
                key={ch.id}
                src={ch.image}
                alt={ch.imageAlt}
                style={{
                  transform: !prefersReducedMotion && !isTouchDevice
                    ? `scale(${1 + progress * 0.05})`
                    : undefined,
                }}
                className={`absolute inset-0 w-full h-full object-cover object-[25%_center] md:object-[30%_center] lg:object-center filter brightness-[0.98] contrast-[1.08] saturate-[1.05] transition-opacity duration-700 ease-in-out will-change-transform ${
                  activeChapterIndex === idx ? 'opacity-100 z-0' : 'opacity-0 pointer-events-none'
                }`}
                loading="lazy"
                decoding="async"
              />
            ))}

            {/* 2. REFINED VIGNETTES (Protects typography readability while leaving visual focal point clear) */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/35 pointer-events-none z-10" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/25 to-black/80 hidden md:block pointer-events-none z-10" />

            {/* Ambient Lighting Flare */}
            <div className="absolute top-6 right-8 sm:top-10 sm:right-16 w-80 h-80 bg-primary/20 blur-[100px] rounded-full pointer-events-none z-10" />

            {/* 3. PINNED HUD TELEMETRY HEADER */}
            <div className="absolute top-4 left-4 right-4 sm:top-7 sm:left-8 sm:right-8 flex items-center justify-between z-20 pointer-events-none">
              <div className="inline-flex items-center gap-2.5 px-3 sm:px-4 py-1.5 rounded-full bg-surface-container/90 backdrop-blur-md border border-primary/35 shadow-lg text-primary">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="font-mono text-[9px] sm:text-[10px] tracking-[0.22em] uppercase text-primary/80">
                  ACT VI
                </span>
                <span className="text-outline/40">•</span>
                <span className="font-sans text-[10px] sm:text-[11px] font-semibold tracking-[0.22em] uppercase text-primary">
                  {ourStory?.tagline || 'THE PHILOSOPHY & HERITAGE'}
                </span>
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container/80 backdrop-blur-md border border-outline/25 text-[10px] uppercase tracking-widest text-on-surface-variant font-mono shadow-md">
                <span className="hidden sm:inline">{ourStory?.hudLocation || 'EST. BARRACKPORE'}</span>
                <span className="hidden sm:inline text-outline/40">•</span>
                <span className="text-primary">{ourStory?.hudAmbiance || '2200K NOCTURNE'}</span>
              </div>
            </div>

            {/* 4. FLOATING EDITORIAL CHAPTER CARD (Stable height to prevent layout jumps) */}
            <div className="absolute inset-x-4 bottom-14 sm:bottom-16 md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:right-6 lg:right-10 md:left-auto md:max-w-lg lg:max-w-xl z-20">
              <div className="rounded-3xl lg:rounded-[2.25rem] bg-surface-container/95 backdrop-blur-2xl p-6 sm:p-8 md:p-10 border border-primary/30 shadow-[0_24px_50px_rgba(0,0,0,0.6)] flex flex-col justify-between min-h-[290px] sm:min-h-[320px] md:min-h-[340px]">
                
                {/* Chapter Header with Interactive Connected Indicators */}
                <div className="flex items-center justify-between border-b border-outline/15 pb-3">
                  <div className="inline-flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-primary tracking-wider">
                      {currentChapter.step}
                    </span>
                    <span className="text-outline/40">/</span>
                    <span className="font-sans text-[10px] sm:text-[11px] font-semibold tracking-[0.2em] uppercase text-on-surface">
                      {currentChapter.badge}
                    </span>
                  </div>

                    {numChapters > 1 && (
                      <div className="flex items-center gap-2" role="tablist" aria-label="Story Chapters">
                        {chapters.map((ch, idx) => (
                          <button
                            key={ch.id}
                            role="tab"
                            aria-selected={activeChapterIndex === idx}
                            aria-label={`Go to chapter ${idx + 1}: ${ch.badge}`}
                            onClick={() => scrollToChapter(idx)}
                            className={`h-2 rounded-full transition-all duration-300 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                              activeChapterIndex === idx
                                ? 'w-7 bg-primary shadow-[0_0_10px_rgba(var(--color-primary-rgb),0.6)]'
                                : 'w-2 bg-outline/35 hover:bg-outline/60'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Chapter Content with Smooth Layout-Stable Motion */}
                  <div className="relative py-2 flex-1 flex flex-col justify-center min-h-[170px] sm:min-h-[190px]">
                    <AnimatePresence mode="wait" custom={direction}>
                      <motion.div
                        key={currentChapter.id}
                        custom={direction}
                        variants={resolvedVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className="flex flex-col gap-3 sm:gap-5"
                      >
                        {/* Chapter Headline */}
                        <h3 className="font-sans text-2xl sm:text-3xl lg:text-4xl xl:text-[2.6rem] font-medium tracking-tight text-on-surface leading-[1.08]">
                          <span>{currentChapter.title} </span>
                          <span className="font-serif italic font-normal text-primary">
                            {currentChapter.titleItalic}
                          </span>
                        </h3>

                        {/* Chapter Description */}
                        <p className="font-sans text-[15px] sm:text-base text-on-surface-variant font-light leading-relaxed">
                          {currentChapter.description}
                        </p>

                        {/* Chapter Footnote */}
                        {currentChapter.highlight && (
                          <div className="pt-1 flex items-center gap-2.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                            <span className="font-sans text-xs text-primary font-medium tracking-wide">
                              {currentChapter.highlight}
                            </span>
                          </div>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  {/* Mobile Chapter Controls & Swipe Hint */}
                  {numChapters > 1 && (
                    <div className="flex md:hidden items-center justify-between pt-3 border-t border-outline/15 text-[11px] font-mono text-on-surface-variant">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={activeChapterIndex === 0}
                          onClick={() => scrollToChapter(activeChapterIndex - 1)}
                          className="w-8 h-8 rounded-full border border-outline/30 bg-surface-elevated/40 flex items-center justify-center text-primary disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 cursor-pointer"
                          aria-label="Previous story chapter"
                        >
                          <span className="material-symbols-outlined text-sm">arrow_back</span>
                        </button>
                        <button
                          type="button"
                          disabled={activeChapterIndex === numChapters - 1}
                          onClick={() => scrollToChapter(activeChapterIndex + 1)}
                          className="w-8 h-8 rounded-full border border-outline/30 bg-surface-elevated/40 flex items-center justify-center text-primary disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 cursor-pointer"
                          aria-label="Next story chapter"
                        >
                          <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-primary font-bold">0{activeChapterIndex + 1}</span>
                        <span>/</span>
                        <span>0{numChapters}</span>
                        <span className="text-outline/40">•</span>
                        <span className="text-[10px] uppercase tracking-wider text-on-surface-variant/80">Swipe or tap</span>
                      </div>
                    </div>
                  )}

                </div>
            </div>

            {/* 5. PINNED SCRUB TELEMETRY PROGRESS BAR */}
            <div className="absolute bottom-3 left-4 right-4 sm:bottom-5 sm:left-8 sm:right-8 flex flex-col gap-1.5 z-20">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">
                <span className="text-primary flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  {numChapters > 1 ? 'SCROLL OR TAP TO ADVANCE' : 'ESTABLISHED HOSPITALITY'}
                </span>
                <span>CHAPTER {String(activeChapterIndex + 1).padStart(2, '0')} / {String(numChapters).padStart(2, '0')}</span>
              </div>
              <div 
                className="w-full h-[3px] bg-outline/20 rounded-full overflow-hidden cursor-pointer"
                onClick={(e) => {
                  if (numChapters <= 1) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                  const targetIdx = Math.min(numChapters - 1, Math.max(0, Math.floor(ratio * numChapters)));
                  scrollToChapter(targetIdx);
                }}
              >
                <div
                  style={{
                    width: numChapters === 1
                      ? '100%'
                      : `${Math.max(progress * 100, ((activeChapterIndex + 1) / numChapters) * 100)}%`,
                  }}
                  className="h-full bg-gradient-to-r from-primary via-primary-fixed-dim to-on-surface transition-all duration-150 ease-out"
                />
              </div>
            </div>

          </div>
        </div>
      </section>
  );
};
