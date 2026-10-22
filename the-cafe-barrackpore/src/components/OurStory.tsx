import React, { useState, useEffect, useRef } from 'react';
import { useSiteConfig } from '../context/SiteConfigContext';
import { useI18n } from '../i18n';
import { SectionReveal } from './SectionReveal';
import { getAvifSource } from '../utils/image';
import { DEFAULT_STORY_CHAPTERS, type StoryChapter } from '../services/siteContentService';

const MANIFESTO_TEXT =
  'NO TEMPLATES. NO RUSHED TABLES. EVERY ESPRESSO PULLED AT NINE BARS, EVERY SOURDOUGH STRETCHED BY HAND, AND EVERY EVENING TUNED TO 2200K AMBER WARMTH — BECAUSE CANTONMENT DESERVES UNFORGETTABLE.';

const HIGHLIGHT_WORDS = new Set([
  'NINE',
  'BARS,',
  'SOURDOUGH',
  '2200K',
  'AMBER',
  'UNFORGETTABLE.',
]);

interface EveningPhaseSpec {
  id: string;
  timeRange: string;
  timeLabel: string;
  tag: string;
  title: string;
  titleHighlight: string;
  subtitle: string;
  description: string;
  vibe: string;
  bestFor: string;
  lighting: string;
  soundtrack: string;
  signaturePairing: string;
  activeZoneName: string;
  zoneCoord: { x: number; y: number; r: number };
}

const EVENING_PHASES: EveningPhaseSpec[] = [
  {
    id: 'phase-aperitivo',
    timeRange: '17:00 – 19:00',
    timeLabel: '5:00 PM',
    tag: 'PHASE 01 · GOLDEN HOUR',
    title: 'The Sunset Pour & ',
    titleHighlight: 'Aperitivo.',
    subtitle: 'Quiet transition from afternoon into evening twilight',
    description:
      'Single-origin Arabica espresso pulled to micron precision and cold-clarified botanical coolers as the sun dips over Barrackpore Cantonment. The ideal hour for unhurried conversations and quiet creative moments.',
    vibe: 'Unhurried & Mellow',
    bestFor: 'Coffee catch-ups, solo reads & casual meetings',
    lighting: '2700K Warm Twilight Glow',
    soundtrack: 'Mellow Ambient Lo-Fi & Vintage Jazz',
    signaturePairing: 'Single-Origin Pour-Over + Artisan Sourdough Toastie',
    activeZoneName: 'ESPRESSO & APERITIVO BAR',
    zoneCoord: { x: 75, y: 65, r: 24 },
  },
  {
    id: 'phase-dinner',
    timeRange: '19:00 – 20:30',
    timeLabel: '7:00 PM',
    tag: 'PHASE 02 · HEARTH SERVICE',
    title: 'Wood-Fired Hearth & ',
    titleHighlight: 'Dinner.',
    subtitle: 'Artisanal sourdough crusts & sizzling banquets',
    description:
      'Our Italian stone hearth blazes at 450°C. Hand-stretched 48-hour sourdough pizzas blister to leopard-crusted perfection while sizzling pan-Asian platters and handmade pastas leave the kitchen pass.',
    vibe: 'Bustling, Vibrant & Sensory',
    bestFor: 'Family dinners, birthdays & group celebrations',
    lighting: 'Hearth Flame & Amber Filament Glow',
    soundtrack: 'Lively Dining Ambience & Modern Soul',
    signaturePairing: 'Truffle Mushroom Pizza + Smoked Peach Cooler',
    activeZoneName: '450°C STONE HEARTH',
    zoneCoord: { x: 235, y: 68, r: 24 },
  },
  {
    id: 'phase-acoustic',
    timeRange: '20:30 – 22:00',
    timeLabel: '8:30 PM',
    tag: 'PHASE 03 · NOCTURNE SESSIONS',
    title: 'Unplugged Live ',
    titleHighlight: 'Acoustics.',
    subtitle: 'Intimate melodies tuned to table conversation',
    description:
      'Tungsten filaments dim down to 2200K amber as acoustic guitarists and soulful vocalists take our speakeasy stage. Carefully calibrated soundscapes engineered to accompany—never drown out—your dinner conversation.',
    vibe: 'Intimate, Soulful & Romantic',
    bestFor: 'Date nights, couples & music lovers',
    lighting: '2200K Dimmable Tungsten Filaments',
    soundtrack: 'Live Acoustic Unplugged Sets',
    signaturePairing: 'Botanical Elixir + Crispy Lotus Root',
    activeZoneName: 'UNPLUGGED ACOUSTIC STAGE',
    zoneCoord: { x: 180, y: 155, r: 24 },
  },
  {
    id: 'phase-nightcap',
    timeRange: '22:00 – CLOSE',
    timeLabel: '10:30 PM',
    tag: 'PHASE 04 · LATE NIGHTCAP',
    title: 'Velvet Booths & ',
    titleHighlight: 'Nightcaps.',
    subtitle: 'The city slows down inside our private booths',
    description:
      'Sink into deep sapphire velvet booths for late-night desserts, dark roast affogatos, and botanical zero-proof nightcaps. Barrackpore’s premier nocturnal retreat embraces the stillness of midnight.',
    vibe: 'Nocturnal, Plush & Intimate',
    bestFor: 'Late-night conversations & dessert dates',
    lighting: 'Subdued Amber & Soft Candlelight',
    soundtrack: 'Midnight Downtempo & Smoky Blues',
    signaturePairing: 'Dark Chocolate Affogato + Tiramisu',
    activeZoneName: 'PRIVATE VELVET BOOTHS',
    zoneCoord: { x: 265, y: 145, r: 26 },
  },
];

export const OurStory: React.FC = () => {
  const { ourStory, engineConfig } = useSiteConfig();
  const { t } = useI18n();
  const sectionRef = useRef<HTMLElement>(null);
  const chaptersTrackRef = useRef<HTMLDivElement>(null);
  const [activeChapterIdx, setActiveChapterIdx] = useState(0);
  const [scrollLightProgress, setScrollLightProgress] = useState(0.35);
  const [, setChapterScrollProgress] = useState(0);
  const [activePhaseIdx, setActivePhaseIdx] = useState(0);

  const chapters: StoryChapter[] =
    ourStory?.chapters && ourStory.chapters.length > 0
      ? ourStory.chapters
      : [
          {
            ...DEFAULT_STORY_CHAPTERS[0],
            description: ourStory?.description || DEFAULT_STORY_CHAPTERS[0].description,
          },
          DEFAULT_STORY_CHAPTERS[1],
          DEFAULT_STORY_CHAPTERS[2],
        ];

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let rafId: number | null = null;

    const handleScroll = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        // 1. Part 1: Word lighting in Manifesto
        const el = sectionRef.current;
        if (el) {
          const rect = el.getBoundingClientRect();
          const viewH = window.innerHeight;
          // Start lighting words as section enters bottom of viewport, finish by mid-scroll
          const raw = (viewH * 0.85 - rect.top) / (viewH * 0.95);
          setScrollLightProgress(Math.max(0.12, Math.min(1, raw)));
        }

        // 2. Part 2: Pinned scroll track for 3-Chapter Heritage Flow
        const track = chaptersTrackRef.current;
        if (track) {
          const rect = track.getBoundingClientRect();
          const maxScroll = Math.max(1, track.offsetHeight - window.innerHeight);
          const scrolled = -rect.top;
          const p = Math.max(0, Math.min(1, scrolled / maxScroll));
          setChapterScrollProgress(p);

          const numChapters = chapters.length;
          const computedIdx = Math.min(numChapters - 1, Math.max(0, Math.floor(p * numChapters)));
          setActiveChapterIdx(computedIdx);
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [chapters.length]);

  if ((ourStory as any)?.enabled === false || engineConfig?.sections?.story === false) {
    return null;
  }

  const safeIdx = Math.min(activeChapterIdx, chapters.length - 1);
  const currentChapter = chapters[safeIdx] || chapters[0];

  const words = MANIFESTO_TEXT.split(' ');
  const activePhase = EVENING_PHASES[activePhaseIdx] || EVENING_PHASES[0];

  const scrollToChapter = (targetIdx: number) => {
    const clamped = Math.max(0, Math.min(chapters.length - 1, targetIdx));
    setActiveChapterIdx(clamped);
    const track = chaptersTrackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const maxScroll = Math.max(1, track.offsetHeight - window.innerHeight);
    const targetP = (clamped + 0.5) / chapters.length;
    const targetScrollY = window.scrollY + rect.top + targetP * maxScroll;
    window.scrollTo({
      top: targetScrollY,
      behavior: 'smooth',
    });
  };

  const handleNextChapter = () => {
    const nextIdx = (activeChapterIdx + 1) % chapters.length;
    scrollToChapter(nextIdx);
  };

  const handlePrevChapter = () => {
    const prevIdx = (activeChapterIdx - 1 + chapters.length) % chapters.length;
    scrollToChapter(prevIdx);
  };

  return (
    <section
      ref={sectionRef}
      id="our-story"
      aria-label={t('story.title', 'Our Story and Philosophy')}
      className="w-full py-16 sm:py-24 lg:py-28 bg-background relative border-t border-outline/15 scroll-mt-24"
    >
      <div className="max-w-[1400px] mx-auto px-6 sm:px-12 relative z-10">
        
        {/* PART 1: EDITORIAL TUNGSTEN SCROLL MANIFESTO & ARTISAN PROVENANCE CAPSULE */}
        <SectionReveal className="mb-16 sm:mb-24">
          <div className="relative rounded-3xl p-6 sm:p-10 lg:p-12 bg-gradient-to-b from-surface-container/70 via-surface-obsidian/85 to-surface-obsidian border border-primary/25 shadow-[0_30px_90px_rgba(0,0,0,0.75)] overflow-hidden">
            {/* Ambient Warm Filament Lighting Flare */}
            <div className="absolute -top-24 left-1/4 w-96 h-96 bg-primary/12 blur-[120px] pointer-events-none rounded-full" />
            <div className="absolute -bottom-24 right-10 w-80 h-80 bg-primary-fixed-dim/8 blur-[100px] pointer-events-none rounded-full" />
            
            {/* Background Watermark Telemetry */}
            <div className="absolute top-6 right-8 font-mono text-[11px] tracking-[0.3em] uppercase text-primary/10 select-none pointer-events-none hidden lg:block">
              CANTONMENT SANCTUARY · 2200K NOCTURNE
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center relative z-10">
              
              {/* Left 8 Cols: Illuminated Manifesto Typography */}
              <div className="lg:col-span-8 flex flex-col items-start">
                {/* Eyebrow Badge */}
                <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-surface-container-low/90 border border-primary/35 shadow-[0_2px_14px_rgba(var(--color-primary-rgb),0.15)] backdrop-blur-md mb-6">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="font-sans text-[10px] sm:text-[11px] font-semibold tracking-[0.22em] uppercase text-primary">
                    {t('story.manifesto', 'THE MANIFESTO')}
                  </span>
                  <span className="text-outline/40 text-xs">•</span>
                  <span className="font-mono text-[10px] uppercase text-on-surface/80 tracking-wider">
                    {t('story.subtitle', 'UNDER THE 2200K LIGHTS')}
                  </span>
                </div>

                {/* Manifesto Editorial Typography with Luminous Tungsten Words */}
                <p className="font-serif text-2xl sm:text-4xl lg:text-[40px] xl:text-[44px] leading-[1.24] tracking-tight select-none">
                  {words.map((word, idx) => {
                    const threshold = idx / words.length;
                    const isLit = scrollLightProgress >= threshold;
                    const isAccent = HIGHLIGHT_WORDS.has(word);
                    return (
                      <React.Fragment key={`${word}-${idx}`}>
                        <span
                          className={`transition-all duration-300 ${
                            isAccent
                              ? 'text-primary italic font-serif font-light drop-shadow-[0_0_16px_rgba(var(--color-primary-rgb),0.4)]'
                              : isLit
                              ? 'text-on-surface font-normal'
                              : 'text-on-surface/40'
                          }`}
                        >
                          {word}
                        </span>{' '}
                      </React.Fragment>
                    );
                  })}
                </p>

                {/* Subtle Signature / Cantonment Philosophy Anchor */}
                <div className="flex items-center gap-4 mt-6 pt-6 border-t border-outline/15 w-full font-mono text-[10px] tracking-[0.2em] uppercase text-on-surface/60">
                  <span className="text-primary font-semibold">ACT V</span>
                  <span>•</span>
                  <span>THE PURSUIT OF UNRUSHED PERFECTION</span>
                </div>
              </div>

              {/* Right 4 Cols: Artisan Cold-Fermentation & Hearth Provenance Capsule */}
              <div className="lg:col-span-4 w-full">
                <div className="relative p-6 sm:p-7 rounded-2xl bg-surface-container-lowest/90 border border-primary/30 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl group/card hover:border-primary/50 transition-all duration-500">
                  {/* Corner Viewfinder Crosshair Brackets */}
                  <div className="absolute top-2.5 left-2.5 font-mono text-[10px] text-primary/70 z-20 pointer-events-none select-none">┌</div>
                  <div className="absolute top-2.5 right-2.5 font-mono text-[10px] text-primary/70 z-20 pointer-events-none select-none">┐</div>
                  <div className="absolute bottom-2.5 left-2.5 font-mono text-[10px] text-primary/70 z-20 pointer-events-none select-none">└</div>
                  <div className="absolute bottom-2.5 right-2.5 font-mono text-[10px] text-primary/70 z-20 pointer-events-none select-none">┘</div>

                  {/* Header Capsule Bar */}
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-outline/15">
                    <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-primary font-bold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                      ARTISAN PROVENANCE
                    </span>
                    <span className="font-mono text-[9px] tracking-wider uppercase px-2 py-0.5 rounded bg-surface-obsidian text-primary/80 border border-primary/20">
                      48H · 4°C
                    </span>
                  </div>

                  {/* Title & Eyebrow */}
                  <div className="mb-4">
                    <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-on-surface-variant/70 block mb-1">
                      SLOW FERMENTATION CRUST
                    </span>
                    <h4 className="font-serif text-xl sm:text-2xl text-on-surface tracking-tight leading-snug">
                      Cold-Fermented <span className="italic font-light text-primary">Sourdough.</span>
                    </h4>
                  </div>

                  {/* Dual Telemetry Stat Capsules */}
                  <div className="grid grid-cols-2 gap-2.5 mb-4">
                    <div className="p-3 rounded-xl bg-surface-elevated/40 border border-outline/15 flex flex-col">
                      <span className="font-mono text-[9px] uppercase tracking-wider text-primary font-semibold mb-0.5">
                        PROOFING
                      </span>
                      <span className="font-serif text-base text-on-surface font-normal">
                        48 Hours
                      </span>
                      <span className="font-mono text-[9px] text-on-surface-variant/70">
                        @ 4°C Chill
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-surface-elevated/40 border border-outline/15 flex flex-col">
                      <span className="font-mono text-[9px] uppercase tracking-wider text-primary font-semibold mb-0.5">
                        HEARTH
                      </span>
                      <span className="font-serif text-base text-on-surface font-normal">
                        450°C
                      </span>
                      <span className="font-mono text-[9px] text-on-surface-variant/70">
                        Stone Fire
                      </span>
                    </div>
                  </div>

                  {/* Narrative Craft Description */}
                  <p className="font-sans text-[13px] sm:text-sm text-on-surface-variant/85 leading-relaxed font-light mb-4">
                    Every pizza dough ball cold-ferments for two full days to unlock complex natural aeration before blistering across our 450°C stone hearth.
                  </p>

                  {/* Bottom Craft Seal */}
                  <div className="pt-3 border-t border-outline/15 flex items-center justify-between font-mono text-[9px] uppercase tracking-widest text-on-surface/50">
                    <span>ZERO RUSH · HAND-STRETCHED</span>
                    <span className="text-primary font-semibold">AUTHENTIC</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </SectionReveal>

        {/* PART 2: 3-CHAPTER HERITAGE VIEWER (Scroll-Pinned & Flow-Driven) */}
        <div
          ref={chaptersTrackRef}
          className="relative w-full my-8 sm:my-14"
          style={{ minHeight: `${Math.max(180, chapters.length * 75)}vh` }}
        >
          <div className="sticky top-0 left-0 w-full h-screen flex flex-col justify-center pt-16 sm:pt-20 pb-4 z-20 pointer-events-none">
            <div className="w-full pointer-events-auto">
              <div className="rounded-[2rem] border border-outline/20 bg-surface-obsidian/95 overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.85)] backdrop-blur-xl">
              {/* Top Bar */}
              <div className="px-6 sm:px-10 py-4 border-b border-outline/15 flex flex-wrap items-center justify-between gap-4 font-mono text-[10px] sm:text-[11px] tracking-[0.22em] uppercase text-on-surface/70 bg-surface-obsidian/80">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-primary font-semibold">
                    {ourStory?.tagline || (ourStory as any)?.eyebrow || t('story.title', 'ACT VI • THE PHILOSOPHY & HERITAGE')}
                  </span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  <span>{ourStory?.hudLocation || 'EST. BARRACKPORE'}</span>
                  <span>•</span>
                  <span>{ourStory?.hudAmbiance || '2200K NOCTURNE'}</span>
                </div>
              </div>

              {/* Main Split Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[420px] sm:min-h-[460px]">
                {/* Left Image: Multi-Chapter Crossfade Dissolve Stage */}
                <div
                  onClick={handleNextChapter}
                  className="lg:col-span-6 relative h-56 sm:h-72 lg:h-auto min-h-[220px] sm:min-h-[280px] lg:min-h-[460px] overflow-hidden bg-background cursor-pointer group"
                  title={t('story.description', 'Click or scroll to advance chapter')}
                >
                  {chapters.map((ch, idx) => {
                    const isActive = idx === safeIdx;
                    const avifSrc = getAvifSource(ch.image);
                    return (
                      <div
                        key={ch.id || idx}
                        className={`absolute inset-0 transition-all duration-700 ease-out ${
                          isActive
                            ? 'opacity-100 scale-100 z-10'
                            : 'opacity-0 scale-105 z-0 pointer-events-none'
                        }`}
                      >
                        <picture>
                          {avifSrc && <source srcSet={avifSrc} type="image/avif" />}
                          <img
                            src={ch.image}
                            alt={ch.imageAlt || ch.title}
                            loading={idx === 0 ? 'eager' : 'lazy'}
                            decoding="async"
                            className="w-full h-full object-cover brightness-[0.88] transition-transform duration-700 group-hover:scale-105"
                          />
                        </picture>
                        <div className="absolute inset-0 bg-gradient-to-t from-surface-obsidian/95 via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-surface-obsidian/95 pointer-events-none" />

                        {/* Telemetry Lens Watermark */}
                        <div className="absolute top-4 left-4 font-mono text-[9px] tracking-[0.22em] uppercase px-3 py-1 rounded-full bg-surface-obsidian/85 backdrop-blur-md border border-primary/30 text-primary font-medium pointer-events-none flex items-center gap-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.5)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                          <span>{t('story.badge', 'CHAPTER')} {String(idx + 1).padStart(2, '0')} · {ch.badge || 'PROVENANCE'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Right Narrative Card with Luxury Architectural Frame Tokens */}
                <div className="lg:col-span-6 p-6 sm:p-10 lg:p-12 flex flex-col justify-between rounded-2xl sm:rounded-3xl lg:rounded-[2.25rem] bg-surface-container/95 backdrop-blur-2xl border border-primary/30 relative overflow-hidden">
                  {/* Ambient subtle warm gold radial behind the card */}
                  <div className="absolute -top-24 -right-24 w-72 h-72 bg-primary/10 rounded-full blur-[90px] pointer-events-none" />

                  <div>
                    {/* Chapter Stepper Dots & Navigation Controls */}
                    <div className="flex items-center justify-between gap-4 mb-8 relative z-10">
                      <div className="flex items-center gap-2">
                        {chapters.map((ch, idx) => (
                          <button
                            key={ch.id || idx}
                            type="button"
                            aria-label={`${t('story.badge', 'Chapter')} ${idx + 1}`}
                            onClick={() => scrollToChapter(idx)}
                            className={`h-2.5 rounded-full transition-all duration-500 cursor-pointer ${
                              idx === safeIdx
                                ? 'w-10 bg-primary shadow-[0_0_14px_rgba(var(--color-primary-rgb),0.6)]'
                                : 'w-2.5 bg-outline/40 hover:bg-primary/60'
                            }`}
                          />
                        ))}
                      </div>

                      {/* Navigation Controls with required arrow_back & arrow_forward tokens */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handlePrevChapter}
                          aria-label={t('common.previous', 'Previous story chapter')}
                          className="w-10 h-10 rounded-full border border-outline/30 flex items-center justify-center text-on-surface/75 hover:border-primary hover:text-primary transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer bg-surface-obsidian/40 backdrop-blur-sm"
                        >
                          <span className="material-symbols-outlined text-base">arrow_back</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleNextChapter}
                          aria-label={t('common.next', 'Next story chapter')}
                          className="w-10 h-10 rounded-full border border-outline/30 flex items-center justify-center text-on-surface/75 hover:border-primary hover:text-primary transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer bg-surface-obsidian/40 backdrop-blur-sm"
                        >
                          <span className="material-symbols-outlined text-base">arrow_forward</span>
                        </button>
                      </div>
                    </div>

                    {/* Animated Narrative Content per Chapter */}
                    <div key={safeIdx} className="animate-chapter-fade">
                      <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-primary/15 border border-primary/30 font-mono text-[10px] tracking-[0.2em] uppercase text-primary font-semibold mb-4">
                        <span>{currentChapter.step || String(safeIdx + 1).padStart(2, '0')}</span>
                        <span>•</span>
                        <span>{currentChapter.badge || t('story.badge', 'THE PHILOSOPHY')}</span>
                      </div>

                      <h3 className="font-sans text-2xl sm:text-3xl lg:text-4xl text-on-surface font-medium tracking-tight leading-[1.15] mb-4">
                        <span>{currentChapter.title} </span>
                        {currentChapter.titleItalic && (
                          <span className="font-serif italic font-normal text-primary">
                            {currentChapter.titleItalic}
                          </span>
                        )}
                      </h3>

                      <p className="font-sans text-[15px] sm:text-base text-on-surface-variant font-light leading-relaxed">
                        {currentChapter.description}
                      </p>
                    </div>
                  </div>

                  {/* Highlight Seal */}
                  <div key={`hl-${safeIdx}`} className="animate-chapter-fade">
                    {currentChapter.highlight && (
                      <div className="mt-8 pt-4 border-t border-outline/15 flex items-center gap-2.5 font-sans text-xs sm:text-sm text-primary font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        <span>{currentChapter.highlight}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Chapter Bar with Live Scroll / Scrub Indicator */}
              <div className="relative px-6 sm:px-10 py-3.5 border-t border-outline/15 flex items-center justify-between font-mono text-[10px] tracking-[0.22em] uppercase text-on-surface/60 overflow-hidden bg-surface-obsidian/90">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                  <span>• {t('story.subtitle', 'SCROLL OR TAP TO ADVANCE')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-primary font-semibold">
                    {t('story.badge', 'CHAPTER')} {String(safeIdx + 1).padStart(2, '0')} / {String(chapters.length).padStart(2, '0')}
                  </span>
                </div>

                {/* Live Scrub / Scroll Progress Line */}
                <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-outline/20">
                  <div
                    className="h-full bg-primary transition-all duration-300 ease-out shadow-[0_0_10px_rgba(var(--color-primary-rgb),0.85)]"
                    style={{
                      width: `${Math.max(6, Math.min(100, ((safeIdx + 1) / chapters.length) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>

        {/* PART 3: THE EVENING JOURNEY: 4 PHASES OF SERVICE */}
        <SectionReveal className="mt-14 sm:mt-20">
          <div className="rounded-[2rem] border border-primary/25 bg-surface-obsidian/90 p-6 sm:p-10 shadow-[0_25px_70px_rgba(0,0,0,0.8)]">
            {/* Top Header & Time Phase Switcher */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-outline/20">
              <div>
                <span className="editorial-eyebrow block mb-1">{t('story.badge', 'SERVICE RHYTHM · DUSK TO MIDNIGHT')}</span>
                <h3 className="font-serif text-3xl sm:text-5xl text-on-surface tracking-tight">
                  {t('story.title', 'AN EVENING AT')} <span className="italic font-light text-primary">{t('story.titleItalic', 'THE CAFÉ.')}</span>
                </h3>
                <p className="font-sans text-sm sm:text-base text-on-surface-variant/80 font-light mt-1.5 max-w-xl leading-relaxed">
                  {t('story.description', 'Discover how our sanctuary evolves through the night—from golden-hour espresso to wood-fired dinner service and intimate acoustic nightcaps.')}
                </p>
              </div>

              {/* Time Phase Switcher */}
              <div className="flex flex-wrap items-center gap-2 bg-background p-2 rounded-2xl border border-outline/30">
                {EVENING_PHASES.map((phase, idx) => (
                  <button
                    key={phase.id}
                    type="button"
                    onClick={() => setActivePhaseIdx(idx)}
                    className={`px-3 sm:px-4 py-2 rounded-xl font-mono text-xs font-semibold tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                      idx === activePhaseIdx
                        ? 'bg-primary text-on-primary shadow-[0_0_16px_rgba(var(--color-primary-rgb),0.45)]'
                        : 'text-on-surface/60 hover:text-on-surface hover:bg-surface-elevated/40'
                    }`}
                  >
                    <span>{phase.timeLabel}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive Sanctuary Floor Diagram + Phase Narrative */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-8 items-center">
              {/* Left 7 Cols: Architectural Floor Sanctuary Map */}
              <div className="lg:col-span-7 rounded-2xl bg-surface-container-lowest p-5 sm:p-7 border border-primary/25 shadow-[0_12px_36px_rgba(0,0,0,0.6)] relative overflow-hidden">
                {/* Header Status Bar */}
                <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.2em] uppercase text-on-surface-variant/80 mb-3 pb-2.5 border-b border-outline/15">
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                    CANTONMENT SANCTUARY FLOOR PLAN
                  </span>
                  <span className="px-2.5 py-0.5 rounded bg-surface-obsidian text-primary font-bold border border-primary/25">
                    {activePhase.timeRange}
                  </span>
                </div>

                <svg viewBox="0 0 350 210" className="w-full h-52 sm:h-64 select-none">
                  <defs>
                    <radialGradient id="activeZoneGlow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="rgb(var(--color-primary))" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="rgb(var(--color-primary))" stopOpacity="0" />
                    </radialGradient>
                  </defs>

                  {/* Outer Architectural Perimeter */}
                  <rect
                    x="10"
                    y="10"
                    width="330"
                    height="190"
                    rx="16"
                    fill="none"
                    stroke="rgba(var(--color-outline-rgb), 0.35)"
                    strokeWidth="1.2"
                  />

                  {/* Architectural Dividers & Partitions */}
                  <line
                    x1="175"
                    y1="10"
                    x2="175"
                    y2="200"
                    stroke="rgba(var(--color-outline-rgb), 0.2)"
                    strokeDasharray="4 4"
                  />
                  <path
                    d="M 10 105 A 70 70 0 0 1 150 105"
                    fill="none"
                    stroke="rgba(var(--color-outline-rgb), 0.2)"
                    strokeWidth="1"
                  />

                  {/* Gentle Connecting Golden Ambient Flow Pathway */}
                  <path
                    d="M 75 65 Q 155 35 235 68 Q 240 120 180 155 Q 220 170 265 145"
                    fill="none"
                    stroke="rgb(var(--color-primary))"
                    strokeWidth="1.2"
                    strokeDasharray="3 4"
                    strokeOpacity="0.35"
                  />

                  {/* Glow Halo around active zone */}
                  <circle
                    cx={activePhase.zoneCoord.x}
                    cy={activePhase.zoneCoord.y}
                    r="48"
                    fill="url(#activeZoneGlow)"
                    className="transition-all duration-700 ease-out"
                  />

                  {/* Outer Pulsing Sonar Ring */}
                  <circle
                    cx={activePhase.zoneCoord.x}
                    cy={activePhase.zoneCoord.y}
                    r="34"
                    fill="none"
                    stroke="rgb(var(--color-primary))"
                    strokeWidth="1.2"
                    strokeDasharray="3 3"
                    className="animate-spin transition-all duration-700 ease-out"
                    style={{ animationDuration: '14s' }}
                  />

                  {/* Zone 1: 01 ESPRESSO BAR */}
                  <g onClick={() => setActivePhaseIdx(0)} className="cursor-pointer group">
                    <circle
                      cx="75"
                      cy="65"
                      r={activePhaseIdx === 0 ? "24" : "20"}
                      fill={activePhaseIdx === 0 ? "rgb(var(--color-primary))" : "rgba(var(--color-surface-container-rgb), 0.9)"}
                      stroke={activePhaseIdx === 0 ? "#FFFFFF" : "rgba(var(--color-primary-rgb), 0.4)"}
                      strokeWidth={activePhaseIdx === 0 ? "2" : "1"}
                      className="transition-all duration-300"
                    />
                    <text
                      x="75"
                      y="68"
                      textAnchor="middle"
                      className={`font-mono text-[7px] font-bold ${
                        activePhaseIdx === 0 ? 'fill-[#120B08]' : 'fill-on-surface/80'
                      }`}
                    >
                      01 ESPRESSO
                    </text>
                  </g>

                  {/* Zone 2: 02 450°C HEARTH */}
                  <g onClick={() => setActivePhaseIdx(1)} className="cursor-pointer group">
                    <circle
                      cx="235"
                      cy="68"
                      r={activePhaseIdx === 1 ? "24" : "20"}
                      fill={activePhaseIdx === 1 ? "rgb(var(--color-primary))" : "rgba(var(--color-surface-container-rgb), 0.9)"}
                      stroke={activePhaseIdx === 1 ? "#FFFFFF" : "rgba(var(--color-primary-rgb), 0.4)"}
                      strokeWidth={activePhaseIdx === 1 ? "2" : "1"}
                      className="transition-all duration-300"
                    />
                    <text
                      x="235"
                      y="71"
                      textAnchor="middle"
                      className={`font-mono text-[7px] font-bold ${
                        activePhaseIdx === 1 ? 'fill-[#120B08]' : 'fill-on-surface/80'
                      }`}
                    >
                      02 HEARTH
                    </text>
                  </g>

                  {/* Zone 3: 03 ACOUSTIC STAGE */}
                  <g onClick={() => setActivePhaseIdx(2)} className="cursor-pointer group">
                    <circle
                      cx="180"
                      cy="155"
                      r={activePhaseIdx === 2 ? "24" : "20"}
                      fill={activePhaseIdx === 2 ? "rgb(var(--color-primary))" : "rgba(var(--color-surface-container-rgb), 0.9)"}
                      stroke={activePhaseIdx === 2 ? "#FFFFFF" : "rgba(var(--color-primary-rgb), 0.4)"}
                      strokeWidth={activePhaseIdx === 2 ? "2" : "1"}
                      className="transition-all duration-300"
                    />
                    <text
                      x="180"
                      y="158"
                      textAnchor="middle"
                      className={`font-mono text-[7px] font-bold ${
                        activePhaseIdx === 2 ? 'fill-[#120B08]' : 'fill-on-surface/80'
                      }`}
                    >
                      03 ACOUSTIC
                    </text>
                  </g>

                  {/* Zone 4: 04 VELVET BOOTHS */}
                  <g onClick={() => setActivePhaseIdx(3)} className="cursor-pointer group">
                    <circle
                      cx="265"
                      cy="145"
                      r={activePhaseIdx === 3 ? "24" : "20"}
                      fill={activePhaseIdx === 3 ? "rgb(var(--color-primary))" : "rgba(var(--color-surface-container-rgb), 0.9)"}
                      stroke={activePhaseIdx === 3 ? "#FFFFFF" : "rgba(var(--color-primary-rgb), 0.4)"}
                      strokeWidth={activePhaseIdx === 3 ? "2" : "1"}
                      className="transition-all duration-300"
                    />
                    <text
                      x="265"
                      y="148"
                      textAnchor="middle"
                      className={`font-mono text-[7px] font-bold ${
                        activePhaseIdx === 3 ? 'fill-[#120B08]' : 'fill-on-surface/80'
                      }`}
                    >
                      04 BOOTHS
                    </text>
                  </g>
                </svg>

                {/* Bottom Legend Bar */}
                <div className="flex items-center justify-between pt-3 border-t border-outline/15 font-mono text-[9px] uppercase tracking-widest text-on-surface/60">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    CLICK ANY ZONE TO PREVIEW SERVICE
                  </span>
                  <span className="font-bold text-primary">{activePhase.activeZoneName}</span>
                </div>
              </div>

              {/* Right 5 Cols: Phase Experience Details */}
              <div className="lg:col-span-5 space-y-5">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/15 border border-primary/35 font-mono text-[10px] tracking-[0.22em] uppercase text-primary font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                  <span>{activePhase.tag}</span>
                  <span>•</span>
                  <span>{activePhase.timeRange}</span>
                </div>

                <div>
                  <h4 className="font-serif text-3xl sm:text-4xl text-on-surface tracking-tight leading-tight">
                    <span>{activePhase.title}</span>
                    <span className="italic font-light text-primary">{activePhase.titleHighlight}</span>
                  </h4>
                  <p className="font-sans text-xs sm:text-sm text-primary/80 font-medium tracking-wide mt-1 uppercase">
                    {activePhase.subtitle}
                  </p>
                </div>

                <p className="font-sans text-sm sm:text-base text-on-surface-variant/85 font-light leading-relaxed">
                  {activePhase.description}
                </p>

                {/* 4-Stat Scannable Guide Grid for Guests */}
                <div className="grid grid-cols-2 gap-2.5 pt-2">
                  <div className="p-3 rounded-xl bg-surface-elevated/40 border border-outline/15 flex flex-col">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-primary font-semibold mb-0.5">
                      VIBE & ATMOSPHERE
                    </span>
                    <span className="font-sans text-xs sm:text-[13px] text-on-surface font-medium leading-tight">
                      {activePhase.vibe}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-surface-elevated/40 border border-outline/15 flex flex-col">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-primary font-semibold mb-0.5">
                      BEST FOR
                    </span>
                    <span className="font-sans text-xs sm:text-[13px] text-on-surface font-medium leading-tight">
                      {activePhase.bestFor}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-surface-elevated/40 border border-outline/15 flex flex-col">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-primary font-semibold mb-0.5">
                      LIGHTING
                    </span>
                    <span className="font-sans text-xs sm:text-[13px] text-on-surface font-medium leading-tight">
                      {activePhase.lighting}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-surface-elevated/40 border border-outline/15 flex flex-col">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-primary font-semibold mb-0.5">
                      SIGNATURE PAIRING
                    </span>
                    <span className="font-sans text-xs sm:text-[13px] text-on-surface font-medium leading-tight">
                      {activePhase.signaturePairing}
                    </span>
                  </div>
                </div>

                {/* Stepper Progress Bar */}
                <div className="pt-2 flex items-center gap-2">
                  {EVENING_PHASES.map((p, idx) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setActivePhaseIdx(idx)}
                      className={`h-1.5 flex-1 rounded-full transition-all cursor-pointer ${
                        idx === activePhaseIdx ? 'bg-primary' : idx < activePhaseIdx ? 'bg-primary/50' : 'bg-outline/25'
                      }`}
                      aria-label={`Select ${p.timeLabel}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </SectionReveal>

      </div>
    </section>
  );
};
