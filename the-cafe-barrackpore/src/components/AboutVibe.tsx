import React, { useState, useRef, useEffect } from 'react';
import { useSiteConfig } from '../context/SiteConfigContext';
import { SectionReveal } from './SectionReveal';
import type { AmbienceItem } from '../services/siteContentService';
import {
  DEFAULT_AMBIENCE_ITEMS,
  DEFAULT_AMBIENCE_CHIPS,
  DEFAULT_AMBIENCE_METRICS,
  DEFAULT_AMBIENCE_AUDIO,
} from '../services/siteContentService';

export const AboutVibe: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const { aboutVibe, engineConfig } = useSiteConfig();
  const sectionRef = useRef<HTMLElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isNear, setIsNear] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: '400px' }
    );
    observer.observe(el);

    const onScroll = () => {
      if (window.scrollY > 150) {
        setIsNear(true);
        window.removeEventListener('scroll', onScroll);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Section visibility check (after all hooks)
  if (aboutVibe?.enabled === false || engineConfig?.sections?.aboutVibe === false) {
    return null;
  }

  const images = (aboutVibe?.images && aboutVibe.images.length > 0)
    ? aboutVibe.images
    : [
        { src: '/images/components/comp_img_0.webp', alt: 'Midnight Velvet Booth Seating' },
        { src: '/images/components/comp_img_2.webp', alt: 'Live Acoustic & Reading Nook' },
        { src: '/images/components/comp_img_3.webp', alt: 'Signature Brew Bar & Mixology' },
        { src: '/images/components/comp_img_1.webp', alt: 'Artisan Platters and Comfort Food' },
      ];

  const items: AmbienceItem[] = (aboutVibe?.items && aboutVibe.items.length > 0)
    ? aboutVibe.items
    : DEFAULT_AMBIENCE_ITEMS;

  const chips = (aboutVibe?.chips && aboutVibe.chips.length > 0)
    ? aboutVibe.chips
    : DEFAULT_AMBIENCE_CHIPS;

  const metrics = (aboutVibe?.metrics && aboutVibe.metrics.length > 0)
    ? aboutVibe.metrics
    : DEFAULT_AMBIENCE_METRICS;

  const audioConfig = aboutVibe?.audio ?? DEFAULT_AMBIENCE_AUDIO;
  const isAudioEnabled = audioConfig?.enabled !== false && engineConfig?.features?.audioAmbianceEnabled !== false;
  const audioSrc = audioConfig?.src || DEFAULT_AMBIENCE_AUDIO.src || 'https://assets.mixkit.co/music/preview/mixkit-chill-bro-494.mp3';
  const audioTitle = audioConfig?.title || 'Lounge Soundscape';
  const audioBadge = audioConfig?.badge || 'Live';

  const eyebrowBadge = aboutVibe?.eyebrowBadge || 'Cantonment Ambience';
  const eyebrowSub = aboutVibe?.eyebrowSub || 'Nocturne Sanctuary';
  const eyebrowText = aboutVibe?.eyebrowText || 'COLONIAL CHARM • VINTAGE GLOW';
  const title = aboutVibe?.title || 'The Atmosphere.';
  const titleItalic = aboutVibe?.titleItalic || 'Atmosphere';
  const description = aboutVibe?.description ||
    'Inspired by British-colonial vintage charms blended with a nocturnal lounge glow, our tufted sapphire velvet booths and golden filament fixtures create an intimate sanctuary for relaxed sophistication.';

  const placeholderSvg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Crect width='100%25' height='100%25' fill='%230a0807'/%3E%3C/svg%3E";

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
          audio.onerror = (e) => {
            console.warn('Audio playback error:', e);
            setIsPlaying(false);
          };
          audioRef.current = audio;
        }
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (err) {
        console.warn('Playback prevented or failed:', err);
        setIsPlaying(false);
      }
    }
  };

  const getItemImage = (item: AmbienceItem, idx: number) => {
    return item.image || images[idx]?.src || DEFAULT_AMBIENCE_ITEMS[idx]?.image || '/images/components/comp_img_0.webp';
  };

  const getItemAlt = (item: AmbienceItem, idx: number) => {
    return item.imageAlt || images[idx]?.alt || item.title;
  };

  const primaryItem = items[0] || DEFAULT_AMBIENCE_ITEMS[0];
  const item1 = items[1];
  const item2 = items[2];
  const additionalItems = items.slice(3);

  const meshGlowActive = engineConfig?.theme?.ambience?.meshGlow !== false;

  return (
    <section ref={sectionRef} id="about-and-vibe" className="w-full py-16 sm:py-20 lg:py-28 bg-background relative overflow-hidden border-t border-outline/15 scroll-mt-24">
      {/* 1. Ambient Warm Filament Lighting Flares */}
      {meshGlowActive && (
        <>
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[850px] h-[400px] bg-gradient-to-b from-primary/12 via-primary-fixed-dim/5 to-transparent blur-[140px] pointer-events-none rounded-full" />
          <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary/8 blur-[120px] pointer-events-none rounded-full" />
          <div className="absolute bottom-10 right-0 w-80 h-80 bg-primary-fixed-dim/6 blur-[100px] pointer-events-none rounded-full" />
        </>
      )}

      {/* Background ambient texture */}
      <div className="hidden sm:block absolute inset-0 pointer-events-none mix-blend-overlay opacity-[0.035]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }} />

      <div className="max-w-[1400px] mx-auto px-6 sm:px-12 relative z-10">
        
        {/* Top: Editorial Narrative Header with Restrained Reveal */}
        <SectionReveal className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 lg:gap-16 mb-12 sm:mb-16 lg:mb-20">
          
          {/* Left Column: Eyebrow + Majestic Editorial Title */}
          <div className="flex flex-col items-start gap-4 max-w-2xl">
            {/* Architectural Heritage Eyebrow Badge */}
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

            {/* Headline Group */}
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
          
          {/* Right Column: Editorial Lead + Double-Bezel Spec Strip */}
          <div className="w-full lg:max-w-xl flex flex-col gap-5">
            <div className="relative pl-5 sm:pl-6 border-l-2 border-primary/40 py-1">
              <p className="font-sans text-sm sm:text-base lg:text-[16px] text-on-surface-variant font-light leading-relaxed">
                {description}
              </p>
            </div>

            {/* Architectural Telemetry Spec Bar */}
            <div className="flex items-center gap-3 sm:gap-4 pt-3 border-t border-outline/15 flex-wrap">
              {chips.map((chip, idx) => (
                <div key={chip.label || idx} className="flex flex-col gap-0.5 px-3.5 py-2 rounded-xl bg-surface-elevated/40 border border-outline/15 min-w-[95px]">
                  <span className="font-sans text-[9px] uppercase tracking-[0.22em] text-primary font-semibold">
                    {chip.label}
                  </span>
                  <span className="font-serif text-sm sm:text-base text-on-surface font-medium">
                    {chip.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </SectionReveal>

        {/* The Asymmetrical Bento Grid: Architectural Photographic Windows */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8 relative z-10">
          
          {/* Main Visual Cell (Tall Portrait) */}
          <div className={`${isAudioEnabled ? 'md:col-span-5 md:row-span-2' : 'md:col-span-6'} relative rounded-3xl lg:rounded-[2.5rem] overflow-hidden bg-surface-container-lowest border border-outline/20 hover:border-primary/50 shadow-2xl group transition-all duration-500 min-h-[420px] ${isAudioEnabled ? 'lg:min-h-[600px]' : 'lg:min-h-[500px]'}`}>
            <img 
              loading="lazy" 
              decoding="async" 
              fetchPriority="low"
              alt={getItemAlt(primaryItem, 0)} 
              src={isNear ? getItemImage(primaryItem, 0) : placeholderSvg} 
              className="absolute inset-0 w-full h-[120%] object-cover object-center group-hover:scale-105 transition-transform duration-[1.5s] ease-out will-change-transform" 
            />
            {/* Cinematic Gradient Vignette */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none" />
            
            {/* Direct Editorial Overlay */}
            <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between z-10 pointer-events-none">
              <div>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] uppercase tracking-widest font-semibold bg-surface-obsidian/90 text-primary border border-primary/30 mb-2 backdrop-blur-sm">
                  {primaryItem.eyebrow || '01 • SEATING'}
                </span>
                <h3 className="font-serif text-2xl sm:text-3xl text-white font-normal drop-shadow-sm">
                  {primaryItem.title}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-surface-obsidian/85 border border-primary/35 flex items-center justify-center text-primary backdrop-blur-sm shadow-md shrink-0">
                <span className="material-symbols-outlined text-lg">{primaryItem.icon || 'chair'}</span>
              </div>
            </div>
          </div>

          {/* Top Right Cell (Audio Lounge & Metrics) */}
          {isAudioEnabled && (
            <div className="md:col-span-7 rounded-3xl lg:rounded-[2.5rem] p-8 lg:p-12 bg-surface-container border border-outline/20 hover:border-primary/40 flex flex-col justify-between gap-8 shadow-xl transition-all duration-500">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={toggleAudio}
                    aria-label={isPlaying ? `Pause ${audioTitle}` : `Play ${audioTitle}`}
                    className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary transition-all duration-500 hover:scale-105 hover:bg-primary/20 border border-primary/25 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[24px]">{isPlaying ? 'pause' : 'play_arrow'}</span>
                  </button>
                  <div>
                    <h3 className="font-sans text-sm uppercase tracking-widest text-on-surface font-medium mb-1">{audioTitle}</h3>
                    <div className="flex items-end gap-1 h-4">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className={`w-1 bg-primary rounded-full transition-all duration-300 ${isPlaying ? 'animate-[eq_1s_ease-in-out_infinite_alternate]' : 'h-1'}`} style={{ animationDelay: `${i * 150}ms` }} />
                      ))}
                    </div>
                  </div>
                </div>
                {audioBadge && (
                  <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-sans text-xs uppercase tracking-widest text-emerald-400 font-medium">{audioBadge}</span>
                  </div>
                )}
              </div>

              <div className={`grid grid-cols-${Math.min(metrics.length, 2)} gap-8 pt-8 border-t border-outline/15`}>
                {metrics.map((m, idx) => (
                  <div key={m.label || idx}>
                    <span className="block font-sans text-[10px] uppercase tracking-widest text-on-surface-variant/70 mb-1">{m.label}</span>
                    <span className="block font-sans text-lg text-on-surface font-medium">
                      {m.value}{m.highlight ? <> <span className="text-primary italic font-serif">{m.highlight}</span></> : null}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Right Cell 1 (Image) */}
          {item1 && (
            <div className={`${isAudioEnabled ? 'md:col-span-3 lg:col-span-4' : 'md:col-span-6'} relative rounded-3xl overflow-hidden bg-surface-container-lowest border border-outline/20 hover:border-primary/50 shadow-xl group transition-all duration-500 min-h-[300px] ${isAudioEnabled ? 'lg:h-[380px]' : 'lg:h-[480px]'}`}>
              <img 
                loading="lazy" 
                decoding="async" 
                fetchPriority="low"
                alt={getItemAlt(item1, 1)} 
                src={isNear ? getItemImage(item1, 1) : placeholderSvg} 
                className="absolute inset-0 w-full h-[120%] object-cover object-center group-hover:scale-105 transition-transform duration-[1.5s] ease-out will-change-transform" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />
              <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between z-10 pointer-events-none">
                <div>
                  <span className="inline-block px-2 py-0.5 rounded-full text-[8px] uppercase tracking-widest font-semibold bg-surface-obsidian/90 text-primary border border-primary/30 mb-1.5 backdrop-blur-sm">
                    {item1.eyebrow || '02 • NOCTURNE'}
                  </span>
                  <h4 className="font-serif text-lg sm:text-xl text-white font-normal drop-shadow-sm">
                    {item1.title}
                  </h4>
                </div>
                <div className="w-8 h-8 rounded-full bg-surface-obsidian/85 border border-primary/35 flex items-center justify-center text-primary backdrop-blur-sm shadow-md shrink-0">
                  <span className="material-symbols-outlined text-sm">{item1.icon || 'flare'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Right Cell 2 (Image) */}
          {item2 && (
            <div className={`${isAudioEnabled ? 'md:col-span-4 lg:col-span-3' : 'md:col-span-6'} relative rounded-3xl overflow-hidden bg-surface-container-lowest border border-outline/20 hover:border-primary/50 shadow-xl group transition-all duration-500 min-h-[300px] ${isAudioEnabled ? 'lg:h-[380px]' : 'lg:h-[480px]'}`}>
              <img 
                loading="lazy" 
                decoding="async" 
                fetchPriority="low"
                alt={getItemAlt(item2, 2)} 
                src={isNear ? getItemImage(item2, 2) : placeholderSvg} 
                className="absolute inset-0 w-full h-[120%] object-cover object-center group-hover:scale-105 transition-transform duration-[1.5s] ease-out will-change-transform" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />
              <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between z-10 pointer-events-none">
                <div>
                  <span className="inline-block px-2 py-0.5 rounded-full text-[8px] uppercase tracking-widest font-semibold bg-surface-obsidian/90 text-primary border border-primary/30 mb-1.5 backdrop-blur-sm">
                    {item2.eyebrow || '03 • GASTRONOMY'}
                  </span>
                  <h4 className="font-serif text-lg sm:text-xl text-white font-normal drop-shadow-sm">
                    {item2.title}
                  </h4>
                </div>
                <div className="w-8 h-8 rounded-full bg-surface-obsidian/85 border border-primary/35 flex items-center justify-center text-primary backdrop-blur-sm shadow-md shrink-0">
                  <span className="material-symbols-outlined text-sm">{item2.icon || 'restaurant'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Additional Ambience Items (if client provides >3 items) */}
          {additionalItems.map((item, addIdx) => {
            const actualIdx = addIdx + 3;
            return (
              <div key={item.id || `vibe-extra-${actualIdx}`} className="md:col-span-6 lg:col-span-4 relative rounded-3xl overflow-hidden bg-surface-container-lowest border border-outline/20 hover:border-primary/50 shadow-xl group transition-all duration-500 min-h-[300px] lg:h-[380px]">
                <img 
                  loading="lazy" 
                  decoding="async" 
                  fetchPriority="low"
                  alt={getItemAlt(item, actualIdx)} 
                  src={isNear ? getItemImage(item, actualIdx) : placeholderSvg} 
                  className="absolute inset-0 w-full h-[120%] object-cover object-center group-hover:scale-105 transition-transform duration-[1.5s] ease-out will-change-transform" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />
                <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between z-10 pointer-events-none">
                  <div>
                    {item.eyebrow && (
                      <span className="inline-block px-2 py-0.5 rounded-full text-[8px] uppercase tracking-widest font-semibold bg-surface-obsidian/90 text-primary border border-primary/30 mb-1.5 backdrop-blur-sm">
                        {item.eyebrow}
                      </span>
                    )}
                    <h4 className="font-serif text-lg sm:text-xl text-white font-normal drop-shadow-sm">
                      {item.title}
                    </h4>
                  </div>
                  {item.icon && (
                    <div className="w-8 h-8 rounded-full bg-surface-obsidian/85 border border-primary/35 flex items-center justify-center text-primary backdrop-blur-sm shadow-md shrink-0">
                      <span className="material-symbols-outlined text-sm">{item.icon}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

        </div>
      </div>
    </section>
  );
};
