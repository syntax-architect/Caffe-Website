import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSiteConfig } from '../context/SiteConfigContext';
import { SectionReveal } from './SectionReveal';
import { getAvifSource } from '../utils/image';
import type { AmbienceItem } from '../services/siteContentService';
import {
  DEFAULT_AMBIENCE_ITEMS,
  DEFAULT_AMBIENCE_CHIPS,
  DEFAULT_AMBIENCE_METRICS,
  DEFAULT_AMBIENCE_AUDIO,
} from '../services/siteContentService';

interface HotspotCoord {
  x: number; // percentage 0..100
  y: number; // percentage 0..100
  specCode: string;
}

const HOTSPOT_COORDS: HotspotCoord[] = [
  { x: 34, y: 64, specCode: 'BOOTH · 45dB ACOUSTIC ISOLATION' },
  { x: 62, y: 26, specCode: 'LUX · 2200K TUNGSTEN FILAMENT' },
  { x: 24, y: 44, specCode: 'STAGE · UNPLUGGED TIMBER RESONANCE' },
  { x: 74, y: 56, specCode: 'ELIXIR · ZERO-PROOF BOTANICAL INFUSION' },
];

export const AboutVibe: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeHotspotIndex, setActiveHotspotIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [cycleProgress, setCycleProgress] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const { aboutVibe, engineConfig } = useSiteConfig();
  const sectionRef = useRef<HTMLElement>(null);
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWheelTimeRef = useRef(0);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const items: AmbienceItem[] =
    aboutVibe?.items && aboutVibe.items.length > 0 ? aboutVibe.items : DEFAULT_AMBIENCE_ITEMS;
  const safeItems = items.slice(0, 4);

  // Smooth jump to a specific zone synchronized with window scroll position
  const jumpToZone = useCallback(
    (index: number) => {
      const targetIdx = Math.max(0, Math.min(safeItems.length - 1, index));
      setActiveHotspotIndex(targetIdx);
      setCycleProgress(0);

      if (!stageContainerRef.current || safeItems.length <= 1 || typeof window === 'undefined') return;
      const container = stageContainerRef.current;
      const rect = container.getBoundingClientRect();
      const containerPageTop = window.scrollY + rect.top;
      const cardEl = container.firstElementChild as HTMLElement | null;
      const cardHeight = cardEl ? cardEl.offsetHeight : 500;
      const totalPinDistance = Math.max(1, container.offsetHeight - cardHeight);
      const targetP = (targetIdx + 0.5) / safeItems.length;
      const targetScrollY = containerPageTop - 80 + totalPinDistance * targetP;

      window.scrollTo({
        top: Math.max(0, targetScrollY),
        behavior: 'smooth',
      });
    },
    [safeItems.length]
  );

  // High-performance scroll tracking: scrolling through the section scrubs 01 -> 02 -> 03
  useEffect(() => {
    if (safeItems.length <= 1 || typeof window === 'undefined') return;

    let ticking = false;

    const handleScroll = () => {
      const container = stageContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const stickyTop = 80; // Pins right below the 80px fixed header
      const cardEl = container.firstElementChild as HTMLElement | null;
      const cardHeight = cardEl ? cardEl.offsetHeight : 500;
      const totalPinDistance = Math.max(1, container.offsetHeight - cardHeight);

      // Total pixels scrolled into the pinned track:
      const scrolled = stickyTop - rect.top;
      const p = Math.max(0, Math.min(1, scrolled / totalPinDistance));

      setScrollProgress(p);

      // Only mark as actively scrolling and scrub if container is in the active pin window
      if (rect.top <= stickyTop + 120 && rect.bottom >= stickyTop + 80) {
        isScrollingRef.current = true;
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => {
          isScrollingRef.current = false;
        }, 800);

        const computedIdx = Math.min(
          safeItems.length - 1,
          Math.max(0, Math.floor(p * safeItems.length))
        );

        setActiveHotspotIndex((prev) => {
          if (prev !== computedIdx) {
            setCycleProgress(0);
            return computedIdx;
          }
          return prev;
        });
      }

      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(handleScroll);
        ticking = true;
      }
    };

    // Initial evaluation
    handleScroll();

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [safeItems.length]);

  // Auto-cycle through hotspots when user is stationary (pauses on hover or active scrolling)
  useEffect(() => {
    if (isPaused || safeItems.length <= 1) return;

    setCycleProgress(0);
    const stepMs = 50;
    const totalMs = 4500;

    const timer = setInterval(() => {
      if (isScrollingRef.current) {
        return; // Pause timer during active scroll
      }
      setCycleProgress((prev) => {
        if (prev >= 100) {
          setActiveHotspotIndex((curr) => (curr + 1) % safeItems.length);
          return 0;
        }
        return prev + (stepMs / totalMs) * 100;
      });
    }, stepMs);

    return () => clearInterval(timer);
  }, [isPaused, safeItems.length, activeHotspotIndex]);

  // Wheel scrub directly on the stage
  const handleWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaY) < 18) return;
    const now = performance.now();
    if (now - lastWheelTimeRef.current < 350) return;

    if (e.deltaY > 0 && activeHotspotIndex < safeItems.length - 1) {
      lastWheelTimeRef.current = now;
      jumpToZone(activeHotspotIndex + 1);
    } else if (e.deltaY < 0 && activeHotspotIndex > 0) {
      lastWheelTimeRef.current = now;
      jumpToZone(activeHotspotIndex - 1);
    }
  };

  if (aboutVibe?.enabled === false || engineConfig?.sections?.aboutVibe === false) {
    return null;
  }

  const images =
    aboutVibe?.images && aboutVibe.images.length > 0
      ? aboutVibe.images
      : [
          { src: '/images/components/comp_img_1.webp', alt: 'Midnight Velvet Booth Dining & Warm Filament Lighting' },
          { src: '/images/components/comp_img_2.webp', alt: 'Live Acoustic Guitar Performance on Speakeasy Stage' },
          { src: '/images/components/comp_img_3.webp', alt: 'Signature Craft Cocktail with Charred Rosemary on Marble Counter' },
          { src: '/images/components/comp_img_0.webp', alt: 'Artisan Espresso Crema on Dark Wood' },
        ];

  const chips =
    aboutVibe?.chips && aboutVibe.chips.length > 0 ? aboutVibe.chips : DEFAULT_AMBIENCE_CHIPS;

  const metrics =
    aboutVibe?.metrics && aboutVibe.metrics.length > 0
      ? aboutVibe.metrics
      : DEFAULT_AMBIENCE_METRICS;

  const audioConfig = aboutVibe?.audio ?? DEFAULT_AMBIENCE_AUDIO;
  const isAudioEnabled =
    audioConfig?.enabled !== false && engineConfig?.features?.audioAmbianceEnabled !== false;
  const audioSrc =
    audioConfig?.src || DEFAULT_AMBIENCE_AUDIO.src || 'https://assets.mixkit.co/music/preview/mixkit-chill-bro-494.mp3';
  const audioTitle = audioConfig?.title || 'Lounge Soundscape';

  // Soundscape status reflecting true audio playback state
  const soundscapeStatus: 'PLAYING' | 'AVAILABLE' | 'UNAVAILABLE' = (!isAudioEnabled || !audioSrc)
    ? 'UNAVAILABLE'
    : isPlaying
    ? 'PLAYING'
    : 'AVAILABLE';

  const eyebrowBadge = aboutVibe?.eyebrowBadge || 'Cantonment Ambience';
  const eyebrowSub = aboutVibe?.eyebrowSub || 'Nocturne Sanctuary';
  const eyebrowText = aboutVibe?.eyebrowText || 'COLONIAL CHARM • VINTAGE GLOW';
  const title = aboutVibe?.title || 'The Atmosphere.';
  const titleItalic = aboutVibe?.titleItalic || 'Atmosphere';
  const description =
    aboutVibe?.description ||
    'Inspired by British-colonial vintage charms blended with a nocturnal lounge glow, our tufted sapphire velvet booths and golden filament fixtures create an intimate sanctuary for relaxed sophistication.';

  const toggleAudio = async () => {
    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
    } else {
      try {
        if (!audioRef.current || audioRef.current.src !== audioSrc) {
          const audio = new Audio(audioSrc);
          audio.volume = 0.4;
          audio.onended = () => setIsPlaying(false);
          audio.onerror = () => setIsPlaying(false);
          audioRef.current = audio;
        }
        await audioRef.current.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    }
  };

  const getItemImage = (item: AmbienceItem, idx: number) => {
    return item.image || images[idx]?.src || DEFAULT_AMBIENCE_ITEMS[idx]?.image || '/images/components/comp_img_0.webp';
  };

  const getItemAvifImage = (item: AmbienceItem, idx: number) => {
    const src = getItemImage(item, idx);
    return getAvifSource(src);
  };

  const getItemAlt = (item: AmbienceItem, idx: number) => {
    return item.imageAlt || images[idx]?.alt || item.title;
  };

  const activeItem = safeItems[activeHotspotIndex] || safeItems[0];
  const activeCoord = HOTSPOT_COORDS[activeHotspotIndex] || HOTSPOT_COORDS[0];
  const meshGlowActive = engineConfig?.theme?.ambience?.meshGlow !== false;

  return (
    <section
      ref={sectionRef}
      id="about-and-vibe"
      className="w-full pt-12 sm:pt-16 lg:pt-20 pb-16 sm:pb-20 lg:pb-24 bg-background relative border-t border-outline/15 scroll-mt-28"
    >
      {/* 1. Ambient Warm Filament Lighting Flares (clipped to section without breaking sticky) */}
      {meshGlowActive && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[850px] h-[400px] bg-gradient-to-b from-primary/12 via-primary-fixed-dim/5 to-transparent blur-[140px] pointer-events-none rounded-full" />
          <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary/8 blur-[120px] pointer-events-none rounded-full" />
          <div className="absolute bottom-10 right-0 w-80 h-80 bg-primary-fixed-dim/6 blur-[100px] pointer-events-none rounded-full" />
        </div>
      )}

      <div className="max-w-[1400px] mx-auto px-6 sm:px-12 relative z-10">
        
        {/* Top: Editorial Narrative Header */}
        <SectionReveal className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 lg:gap-16 mb-12 sm:mb-16">
          <div className="flex flex-col items-start gap-4 max-w-2xl">
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-surface-container-low/90 border border-primary/35 shadow-[0_2px_14px_rgba(var(--color-primary-rgb),0.15)] backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="font-sans text-[10px] sm:text-[11px] font-semibold tracking-[0.22em] uppercase text-primary">
                {eyebrowBadge}
              </span>
              <span className="text-outline/40 text-xs">•</span>
              <span className="font-mono text-[10px] uppercase text-on-surface/80 tracking-wider">
                {eyebrowSub}
              </span>
            </div>

            <div>
              <span className="font-sans text-[10px] sm:text-xs font-semibold uppercase tracking-[0.26em] text-primary/75 block mb-2">
                {eyebrowText}
              </span>
              <h2 className="font-serif text-4xl sm:text-5xl lg:text-6xl xl:text-7xl text-on-surface font-normal tracking-tight leading-[1.06]">
                {title.includes(titleItalic) ? (
                  <>
                    {title.split(titleItalic)[0]}
                    <span className="italic font-serif font-light text-primary">{titleItalic}</span>
                    {title.split(titleItalic)[1] || <span className="text-primary">.</span>}
                  </>
                ) : (
                  <>
                    The <span className="italic font-serif font-light text-primary">Atmosphere</span>
                    <span className="text-primary">.</span>
                  </>
                )}
              </h2>
            </div>
          </div>

          <div className="w-full lg:max-w-xl flex flex-col gap-5">
            <div className="relative pl-5 sm:pl-6 border-l-2 border-primary/40 py-1">
              <p className="font-sans text-[15px] sm:text-base lg:text-[16px] text-on-surface-variant font-light leading-relaxed">
                {description}
              </p>
            </div>

            {/* Architectural Telemetry Spec Bar + Live Audio Equalizer Toggle */}
            <div className="flex flex-col gap-4 pt-3 border-t border-outline/15">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                  {chips.map((chip, idx) => (
                    <div key={chip.label || idx} className="flex flex-col gap-0.5 px-3.5 py-2 rounded-xl bg-surface-elevated/40 border border-outline/15 min-w-[95px]">
                      <span className="font-sans text-[9px] uppercase tracking-[0.22em] text-primary font-semibold">
                        {chip.label}
                      </span>
                      <span className="font-serif text-sm sm:text-base text-on-surface">
                        {chip.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Lounge Soundscape Audio Player with Live 12-Bar Waveform */}
                {isAudioEnabled && (
                  <button
                    type="button"
                    onClick={toggleAudio}
                    aria-label={isPlaying ? `Pause ${audioTitle}` : `Play ${audioTitle}`}
                    className="inline-flex items-center gap-3 px-4 py-2.5 rounded-xl bg-surface-obsidian border border-primary/30 hover:border-primary hover:shadow-[0_0_20px_rgba(var(--color-primary-rgb),0.25)] active:scale-[0.97] transition-all group cursor-pointer"
                  >
                    <span className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors">
                      <span className="material-symbols-outlined text-sm">
                        {isPlaying ? 'volume_up' : 'music_note'}
                      </span>
                    </span>
                    <div className="text-left font-mono text-[10px] tracking-wider uppercase">
                      <span className="block text-on-surface/55">{audioTitle}</span>
                      <span className="text-primary font-semibold flex items-center gap-1.5">
                        {soundscapeStatus === 'PLAYING' ? (
                          <>
                            <span>PLAYING</span>
                            {/* Live 12-bar animated equalizer visualizer */}
                            <span className="flex items-end gap-0.5 h-3">
                              {[0.8, 0.4, 0.9, 0.6, 1.0, 0.5, 0.7, 0.3, 0.85, 0.65, 0.95, 0.45].map((h, i) => (
                                <span
                                  key={i}
                                  className="w-0.5 bg-primary rounded-full animate-pulse"
                                  style={{
                                    height: `${Math.round(h * 12)}px`,
                                    animationDelay: `${i * 65}ms`,
                                    animationDuration: `${0.45 + (i % 4) * 0.15}s`,
                                  }}
                                />
                              ))}
                            </span>
                          </>
                        ) : soundscapeStatus === 'AVAILABLE' ? (
                          'AVAILABLE [LISTEN]'
                        ) : (
                          'UNAVAILABLE'
                        )}
                      </span>
                    </div>
                  </button>
                )}
              </div>

              {/* Architectural Telemetry Metrics */}
              {metrics && metrics.length > 0 && (
                <div className="flex items-center gap-6 pt-2 border-t border-outline/15 flex-wrap">
                  {metrics.map((m, idx) => (
                    <div key={m.label || idx} className="flex flex-col">
                      <span className="font-sans text-[9px] uppercase tracking-widest text-on-surface-variant/70 mb-0.5">
                        {m.label}
                      </span>
                      <span className="font-sans text-sm sm:text-base text-on-surface font-medium">
                        {m.value}{m.highlight ? <> <span className="text-primary italic font-serif">{m.highlight}</span></> : null}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SectionReveal>

        {/* VALMORA SPATIAL HOTSPOT & ANIMATED SVG LEADER-LINE STAGE WITH SCROLL SCRUBBING */}
        <div ref={stageContainerRef} className="relative w-full min-h-[190vh] lg:min-h-[250vh] mt-4">
          <div className="sticky top-20 w-full z-20">
            <div
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
              onWheel={handleWheel}
              className="relative w-full rounded-[2rem] border border-primary/25 bg-surface-container overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.85)] group/stage"
            >
                <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[520px]">
                  
                  {/* Left 7 Columns: Interactive Reticles & SVG Leader Line */}
                  <div className="lg:col-span-7 relative min-h-[360px] lg:min-h-[520px] overflow-hidden bg-surface-container-lowest border border-outline/20">
                    <picture>
                      {getItemAvifImage(activeItem, activeHotspotIndex) && (
                        <source srcSet={getItemAvifImage(activeItem, activeHotspotIndex)!} type="image/avif" />
                      )}
                      <img
                        src={getItemImage(activeItem, activeHotspotIndex)}
                        alt={getItemAlt(activeItem, activeHotspotIndex)}
                        className="w-full h-full object-cover brightness-[0.78] contrast-[1.08] transition-all duration-700 scale-105"
                        loading="lazy"
                        decoding="async"
                      />
                    </picture>
                    <div className="absolute inset-0 bg-gradient-to-r from-background/40 via-transparent to-surface-obsidian/95 pointer-events-none" />

                    {/* Animated Diagonal SVG Leader Line with Traveling Photon Packet */}
                    <svg
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      className="hidden lg:block absolute inset-0 w-full h-full pointer-events-none z-20"
                    >
                      <defs>
                        <filter id="telemetryGlow" x="-30%" y="-30%" width="160%" height="160%">
                          <feGaussianBlur stdDeviation="0.75" result="blur" />
                          <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>

                      {/* Ambient Laser Beam Glow Halo */}
                      <line
                        x1={activeCoord.x}
                        y1={activeCoord.y}
                        x2={98}
                        y2={28}
                        stroke="rgb(var(--color-primary))"
                        strokeWidth="1.2"
                        strokeOpacity="0.18"
                        filter="url(#telemetryGlow)"
                        className="transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                      />

                      {/* Razor-Sharp Optical Telemetry Line */}
                      <line
                        x1={activeCoord.x}
                        y1={activeCoord.y}
                        x2={98}
                        y2={28}
                        stroke="rgb(var(--color-primary))"
                        strokeWidth="0.38"
                        strokeOpacity="0.9"
                        className="transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                      />

                      {/* Kinetic Dashed Stream Pulse */}
                      <line
                        x1={activeCoord.x}
                        y1={activeCoord.y}
                        x2={98}
                        y2={28}
                        stroke="rgb(var(--color-primary))"
                        strokeWidth="0.45"
                        strokeDasharray="2, 5"
                        strokeOpacity="0.8"
                        className="transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                      >
                        <animate
                          attributeName="stroke-dashoffset"
                          from="28"
                          to="0"
                          dur="1.4s"
                          repeatCount="indefinite"
                        />
                      </line>

                      {/* Travelling Golden Photon Energy Packet */}
                      <circle r="1.15" fill="rgb(var(--color-primary))" filter="url(#telemetryGlow)">
                        <animate
                          attributeName="cx"
                          values={`${activeCoord.x};98`}
                          dur="2.4s"
                          repeatCount="indefinite"
                        />
                        <animate
                          attributeName="cy"
                          values={`${activeCoord.y};28`}
                          dur="2.4s"
                          repeatCount="indefinite"
                        />
                        <animate
                          attributeName="opacity"
                          values="0; 1; 1; 0.2"
                          dur="2.4s"
                          repeatCount="indefinite"
                        />
                      </circle>

                      {/* Reticle Origin & Target Terminal Nodes */}
                      <circle
                        cx={activeCoord.x}
                        cy={activeCoord.y}
                        r="1.3"
                        fill="rgb(var(--color-primary))"
                        className="transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                      />
                      <circle cx={98} cy={28} r="1.0" fill="rgb(var(--color-primary))" />
                    </svg>

                    {/* Interactive Pulsing Reticle Buttons with Radar Calibration HUD */}
                    {safeItems.map((item, idx) => {
                      const coord = HOTSPOT_COORDS[idx] || HOTSPOT_COORDS[0];
                      const isSelected = idx === activeHotspotIndex;
                      return (
                        <button
                          key={item.id || idx}
                          type="button"
                          aria-label={`Inspect ${item.title}`}
                          onClick={() => jumpToZone(idx)}
                          onMouseEnter={() => {
                            if (!isScrollingRef.current) {
                              setActiveHotspotIndex(idx);
                              setCycleProgress(0);
                            }
                          }}
                          style={{ left: `${coord.x}%`, top: `${coord.y}%` }}
                          className="absolute -translate-x-1/2 -translate-y-1/2 z-30 group focus:outline-none cursor-pointer"
                        >
                          <div className="relative flex items-center justify-center">
                            {/* Outer Rotating Radar Calibration Ring */}
                            {isSelected && (
                              <span className="absolute -inset-2 rounded-full border border-dashed border-primary/55 animate-[spin_8s_linear_infinite] pointer-events-none" />
                            )}

                            {/* Acoustic Pulse Ping */}
                            {isSelected && (
                              <span className="absolute -inset-1 rounded-full bg-primary/30 animate-ping pointer-events-none" />
                            )}

                            <span
                              className={`flex items-center justify-center w-9 h-9 rounded-full border transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                                isSelected
                                  ? 'border-primary bg-primary/25 scale-110 shadow-[0_0_24px_rgba(var(--color-primary-rgb),0.65)]'
                                  : 'border-on-surface/40 bg-background/70 hover:border-primary hover:scale-105'
                              }`}
                            >
                              <span
                                className={`w-2.5 h-2.5 rounded-full transition-transform duration-300 ${
                                  isSelected
                                    ? 'bg-primary scale-100 shadow-[0_0_8px_rgb(var(--color-primary))]'
                                    : 'bg-on-surface/80 group-hover:bg-primary'
                                }`}
                              />
                            </span>

                            {/* Floating Telemetry Coordinates Tag */}
                            {isSelected && (
                              <div className="hidden sm:flex absolute left-full ml-3 top-1/2 -translate-y-1/2 items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-obsidian/95 border border-primary/40 shadow-lg backdrop-blur-md pointer-events-none whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                <span className="font-mono text-[9px] uppercase tracking-widest text-primary font-semibold">
                                  ZONE 0{idx + 1} • [{coord.x}%, {coord.y}%]
                                </span>
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}

                    {/* Viewfinder Stamp */}
                    <div className="absolute top-5 left-5 z-20 px-3.5 py-1.5 rounded-full bg-background/85 border border-outline/30 backdrop-blur-md font-mono text-[10px] tracking-[0.22em] uppercase text-on-surface/85 pointer-events-none flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                      <span>EVERY DETAIL DRAWN ONCE • {activeCoord.specCode}</span>
                    </div>
                  </div>

                  {/* Right 5 Columns: Valmora Macro Detail Window & Numbered Callout */}
                  <div className="lg:col-span-5 p-6 sm:p-10 flex flex-col justify-between bg-surface-obsidian/95 border-t lg:border-t-0 lg:border-l border-outline/20">
                    <div>
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-baseline gap-2">
                          {/* Animated Mechanical Odometer Digit Counter */}
                          <div className="h-14 sm:h-16 overflow-hidden">
                            <div
                              className="transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col"
                              style={{ transform: `translateY(-${(activeHotspotIndex * 100) / safeItems.length}%)` }}
                            >
                              {safeItems.map((_, i) => (
                                <span
                                  key={i}
                                  className="h-14 sm:h-16 flex items-center font-serif text-5xl sm:text-6xl text-primary tracking-tight font-light"
                                >
                                  {String(i + 1).padStart(2, '0')}
                                </span>
                              ))}
                            </div>
                          </div>
                          <span className="font-mono text-xs tracking-[0.25em] text-on-surface/40">
                            / {String(safeItems.length).padStart(2, '0')}
                          </span>
                        </div>

                        {/* Step Navigation Controls (Prev / Next) with Kinetic Press */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            aria-label="Previous Sanctuary Zone"
                            onClick={() => jumpToZone((activeHotspotIndex - 1 + safeItems.length) % safeItems.length)}
                            className="w-8 h-8 rounded-full border border-outline/30 hover:border-primary/60 bg-surface-elevated/40 hover:bg-surface-elevated active:scale-95 flex items-center justify-center text-on-surface/70 hover:text-primary transition-all cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-sm">chevron_left</span>
                          </button>
                          <button
                            type="button"
                            aria-label="Next Sanctuary Zone"
                            onClick={() => jumpToZone((activeHotspotIndex + 1) % safeItems.length)}
                            className="w-8 h-8 rounded-full border border-outline/30 hover:border-primary/60 bg-surface-elevated/40 hover:bg-surface-elevated active:scale-95 flex items-center justify-center text-on-surface/70 hover:text-primary transition-all cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-sm">chevron_right</span>
                          </button>
                        </div>
                      </div>

                      {/* Valmora Macro Detail Window with Architectural Crosshairs & Laser Scanline */}
                      <div className="relative h-44 sm:h-52 w-full rounded-2xl overflow-hidden border border-primary/30 mb-6 group bg-surface-container-lowest">
                        {/* Corner Viewfinder Crosshair Brackets */}
                        <div className="absolute top-2 left-2.5 font-mono text-[10px] text-primary/70 z-20 pointer-events-none select-none">┌</div>
                        <div className="absolute top-2 right-2.5 font-mono text-[10px] text-primary/70 z-20 pointer-events-none select-none">┐</div>
                        <div className="absolute bottom-2 left-2.5 font-mono text-[10px] text-primary/70 z-20 pointer-events-none select-none">└</div>
                        <div className="absolute bottom-2 right-2.5 font-mono text-[10px] text-primary/70 z-20 pointer-events-none select-none">┘</div>

                        {/* High-Tech Amber Scanline Sweep */}
                        <div className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent pointer-events-none z-20 animate-scanline" />

                        <picture key={activeHotspotIndex}>
                          {getItemAvifImage(activeItem, activeHotspotIndex) && (
                            <source srcSet={getItemAvifImage(activeItem, activeHotspotIndex)!} type="image/avif" />
                          )}
                          <img
                            src={getItemImage(activeItem, activeHotspotIndex)}
                            alt={getItemAlt(activeItem, activeHotspotIndex)}
                            className="w-full h-full object-cover scale-150 object-center transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.65]"
                            loading="lazy"
                            decoding="async"
                          />
                        </picture>
                        <div className="absolute inset-0 bg-gradient-to-t from-background/85 via-transparent to-transparent pointer-events-none" />
                        <span className="absolute bottom-3 left-3 font-mono text-[10px] tracking-[0.2em] uppercase px-2.5 py-1 rounded bg-background/85 text-primary border border-primary/25 pointer-events-none flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                          {activeItem.eyebrow || `ZONE 0${activeHotspotIndex + 1}`}
                        </span>

                        <span className="absolute top-3 right-3 font-mono text-[9px] tracking-wider uppercase px-2 py-0.5 rounded bg-surface-obsidian/85 text-primary/80 border border-primary/20 pointer-events-none hidden sm:inline">
                          TELEMETRY LOCK
                        </span>
                      </div>

                      {/* Editorial Title & Description with Kinetic Fade */}
                      <div key={activeHotspotIndex} className="animate-in fade-in slide-in-from-bottom-1 duration-500">
                        <h3 className="font-serif text-2xl sm:text-3xl text-on-surface tracking-tight uppercase mb-2.5 transition-colors">
                          {activeItem.title}
                        </h3>
                        <p className="font-sans text-[15px] sm:text-base text-on-surface-variant/85 leading-relaxed font-light">
                          {activeItem.description}
                        </p>
                      </div>
                    </div>

                    {/* Bottom 01 - 02 - 03 Stepper Rail with Luminous Progress Spark */}
                    <div
                      className={`grid gap-3 pt-6 mt-6 border-t border-outline/20 ${
                        safeItems.length === 3 ? 'grid-cols-3' : 'grid-cols-4'
                      }`}
                    >
                      {safeItems.map((item, idx) => {
                        const isCurrent = idx === activeHotspotIndex;
                        const fillWidth = isCurrent
                          ? isScrollingRef.current
                            ? `${Math.min(100, Math.max(10, ((scrollProgress * safeItems.length) - idx) * 100))}%`
                            : `${Math.min(100, Math.max(4, cycleProgress))}%`
                          : idx < activeHotspotIndex
                          ? '100%'
                          : '0%';

                        return (
                          <button
                            key={item.id || idx}
                            type="button"
                            aria-label={`Select Zone 0${idx + 1}: ${item.title}`}
                            onClick={() => jumpToZone(idx)}
                            onMouseEnter={() => {
                              if (!isScrollingRef.current) {
                                setActiveHotspotIndex(idx);
                                setCycleProgress(0);
                              }
                            }}
                            className="text-left group focus:outline-none cursor-pointer py-2 px-2 -mx-2 rounded-xl hover:bg-surface-elevated/30 transition-colors w-full"
                          >
                            <div className="h-[3px] w-full bg-outline/25 mb-2 overflow-hidden rounded-full relative">
                              <div
                                className="h-full bg-gradient-to-r from-primary-fixed-dim via-primary to-primary rounded-full transition-all duration-100 relative"
                                style={{ width: fillWidth }}
                              >
                                {isCurrent && (
                                  <span className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white shadow-[0_0_8px_#D4AF37]" />
                                )}
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <span
                                className={`font-mono text-xs sm:text-[13px] tracking-widest block transition-colors ${
                                  isCurrent
                                    ? 'text-primary font-bold'
                                    : 'text-on-surface/40 group-hover:text-on-surface/80'
                                }`}
                              >
                                0{idx + 1}
                              </span>
                              <span
                                className={`font-mono text-[9px] tracking-wider uppercase transition-colors hidden sm:inline ${
                                  isCurrent ? 'text-on-surface/80 font-medium' : 'text-on-surface/30'
                                }`}
                              >
                                {item.title.split(' ')[0]}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                </div>
              </div>
          </div>
        </div>

      </div>
    </section>
  );
};
