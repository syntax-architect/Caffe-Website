import React, { useState, useRef, useEffect } from 'react';
import { useSiteConfig } from '../context/SiteConfigContext';

export const AboutVibe: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const { aboutVibe } = useSiteConfig();
  const images = (aboutVibe?.images && aboutVibe.images.length > 0)
    ? aboutVibe.images
    : [
        { src: '/images/components/comp_img_0.webp', alt: 'Midnight Velvet Booth Seating' },
        { src: '/images/components/comp_img_2.webp', alt: 'Live Acoustic & Reading Nook' },
        { src: '/images/components/comp_img_3.webp', alt: 'Signature Brew Bar & Mixology' },
        { src: '/images/components/comp_img_1.webp', alt: 'Artisan Platters and Comfort Food' },
      ];
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

  const placeholderSvg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Crect width='100%25' height='100%25' fill='%230a0807'/%3E%3C/svg%3E";

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const toggleAudio = async () => {
    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
    } else {
      try {
        if (!audioRef.current) {
          const audio = new Audio('https://assets.mixkit.co/music/preview/mixkit-chill-bro-494.mp3');
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

  return (
    <section ref={sectionRef} id="about-and-vibe" className="w-full py-16 sm:py-20 lg:py-28 bg-[#090605] relative overflow-hidden border-t border-white/5 scroll-mt-24">
      {/* 1. Ambient Warm Filament Lighting Flares */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[850px] h-[400px] bg-gradient-to-b from-[#D4AF37]/12 via-[#E5C158]/5 to-transparent blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-[#D4AF37]/8 blur-[120px] pointer-events-none rounded-full" />
      <div className="absolute bottom-10 right-0 w-80 h-80 bg-[#C5A028]/6 blur-[100px] pointer-events-none rounded-full" />

      {/* Background ambient texture */}
      <div className="hidden sm:block absolute inset-0 pointer-events-none mix-blend-overlay opacity-[0.035]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }} />

      <div className="max-w-[1400px] mx-auto px-6 sm:px-12 relative z-10">
        
        {/* Top: Editorial Narrative Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 lg:gap-16 mb-12 sm:mb-16 lg:mb-20">
          
          {/* Left Column: Eyebrow + Majestic Editorial Title */}
          <div className="flex flex-col items-start gap-4 max-w-2xl">
            {/* Architectural Heritage Eyebrow Badge */}
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#18100B]/90 border border-[#D4AF37]/35 shadow-[0_2px_14px_rgba(212,175,55,0.15)] backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />
              <span className="font-sans text-[10px] sm:text-[11px] font-semibold tracking-[0.22em] uppercase text-[#D4AF37]">
                Cantonment Ambience
              </span>
              <span className="text-white/20 text-xs">•</span>
              <span className="font-mono text-[10px] uppercase text-[#FAF6F0]/80 tracking-wider">
                Nocturne Sanctuary
              </span>
            </div>

            {/* Headline Group */}
            <div>
              <span className="font-sans text-[10px] sm:text-xs font-semibold uppercase tracking-[0.26em] text-[#D4AF37]/75 block mb-2">
                COLONIAL CHARM &bull; VINTAGE GLOW
              </span>
              <h2 className="font-serif text-4xl sm:text-5xl lg:text-6xl xl:text-7xl text-[#FAF6F0] font-normal tracking-tight leading-[1.06]">
                The <span className="italic font-serif font-light text-transparent bg-clip-text bg-gradient-to-r from-[#F3E5AB] via-[#D4AF37] to-[#C5A028]">Atmosphere</span>
                <span className="text-[#D4AF37]">.</span>
              </h2>
            </div>
          </div>
          
          {/* Right Column: Editorial Lead + Double-Bezel Spec Strip */}
          <div className="w-full lg:max-w-xl flex flex-col gap-5">
            <div className="relative pl-5 sm:pl-6 border-l-2 border-[#D4AF37]/40 py-1">
              <p className="font-sans text-sm sm:text-base lg:text-[16px] text-[#FAF6F0]/85 font-light leading-relaxed">
                Inspired by British-colonial vintage charms blended with a nocturnal lounge glow, our tufted sapphire velvet booths and golden filament fixtures create an intimate sanctuary for relaxed sophistication.
              </p>
            </div>

            {/* Double-Bezel Architectural Telemetry Cards */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-1">
              <div className="p-1 rounded-2xl bg-white/[0.03] border border-white/10 shadow-sm hover:border-[#D4AF37]/30 transition-colors">
                <div className="px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-[calc(1rem-0.25rem)] bg-[#140D0A]/90 flex flex-col gap-0.5">
                  <span className="font-sans text-[8px] sm:text-[9px] uppercase tracking-widest text-[#D4AF37] font-semibold">Lighting</span>
                  <span className="font-serif text-xs sm:text-sm text-[#FAF6F0] font-medium truncate">2200K Amber</span>
                </div>
              </div>
              <div className="p-1 rounded-2xl bg-white/[0.03] border border-white/10 shadow-sm hover:border-[#D4AF37]/30 transition-colors">
                <div className="px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-[calc(1rem-0.25rem)] bg-[#140D0A]/90 flex flex-col gap-0.5">
                  <span className="font-sans text-[8px] sm:text-[9px] uppercase tracking-widest text-[#D4AF37] font-semibold">Seating</span>
                  <span className="font-serif text-xs sm:text-sm text-[#FAF6F0] font-medium truncate">Sapphire Velvet</span>
                </div>
              </div>
              <div className="p-1 rounded-2xl bg-white/[0.03] border border-white/10 shadow-sm hover:border-[#D4AF37]/30 transition-colors">
                <div className="px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-[calc(1rem-0.25rem)] bg-[#140D0A]/90 flex flex-col gap-0.5">
                  <span className="font-sans text-[8px] sm:text-[9px] uppercase tracking-widest text-[#D4AF37] font-semibold">Soundscape</span>
                  <span className="font-serif text-xs sm:text-sm text-[#FAF6F0] font-medium truncate">Nocturne Jazz</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* The Asymmetrical Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8 relative z-10">
          
          {/* Main Visual Cell (Tall Portrait) */}
          <div className="md:col-span-5 md:row-span-2 p-2 rounded-[2rem] lg:rounded-[2.5rem] bg-white/[0.02] border border-white/5 shadow-2xl backdrop-blur-sm">
            <div className="relative w-full h-full min-h-[400px] lg:min-h-[600px] rounded-[calc(2rem-0.5rem)] lg:rounded-[calc(2.5rem-0.5rem)] overflow-hidden bg-[#0a0807] group">
              <img 
                loading="lazy" 
                decoding="async" 
                fetchPriority="low"
                alt={images[0]?.alt} 
                src={isNear ? images[0]?.src : placeholderSvg} 
                className="absolute inset-0 w-full h-[120%] object-cover object-center group-hover:scale-105 transition-transform duration-[1.5s] ease-out" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
              <div className="absolute bottom-6 left-6 right-6 p-4 rounded-2xl bg-black/65 backdrop-blur-md border border-white/10 flex items-center justify-between shadow-lg">
                <div>
                  <span className="block font-sans text-[10px] uppercase tracking-widest text-[#D4AF37] font-semibold">01 &bull; SEATING</span>
                  <span className="block font-serif text-xl sm:text-2xl text-white font-normal mt-0.5">Private Velvet Booths</span>
                </div>
                <div className="w-9 h-9 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37]">
                  <span className="material-symbols-outlined text-base">chair</span>
                </div>
              </div>
            </div>
          </div>

          {/* Top Right Cell (Audio Lounge & Metrics) */}
          <div className="md:col-span-7 p-2 rounded-[2rem] lg:rounded-[2.5rem] bg-white/[0.02] border border-white/5 backdrop-blur-sm">
            <div className="relative w-full h-full p-8 lg:p-12 rounded-[calc(2rem-0.5rem)] lg:rounded-[calc(2.5rem-0.5rem)] bg-gradient-to-br from-[#1C120D] to-[#0a0807] border border-white/[0.05] flex flex-col justify-between gap-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={toggleAudio}
                    className="w-14 h-14 rounded-full bg-[#D4AF37]/10 flex items-center justify-center text-[#D4AF37] transition-all duration-500 hover:scale-105 hover:bg-[#D4AF37]/20 border border-[#D4AF37]/20 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[24px]">{isPlaying ? 'pause' : 'play_arrow'}</span>
                  </button>
                  <div>
                    <h3 className="font-sans text-sm uppercase tracking-widest text-white font-medium mb-1">Lounge Soundscape</h3>
                    <div className="flex items-end gap-1 h-4">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className={`w-1 bg-[#D4AF37] rounded-full transition-all duration-300 ${isPlaying ? 'animate-[eq_1s_ease-in-out_infinite_alternate]' : 'h-1'}`} style={{ animationDelay: `${i * 150}ms` }} />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-sans text-xs uppercase tracking-widest text-emerald-400 font-medium">Live</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-8 border-t border-white/5">
                <div>
                  <span className="block font-sans text-[10px] uppercase tracking-widest text-white/40 mb-1">Lighting</span>
                  <span className="block font-sans text-lg text-white font-medium">Warm Amber <span className="text-[#D4AF37] italic font-serif">2200K</span></span>
                </div>
                <div>
                  <span className="block font-sans text-[10px] uppercase tracking-widest text-white/40 mb-1">Aroma</span>
                  <span className="block font-sans text-lg text-white font-medium">Smoked Vanilla & Arabica</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Right Cell 1 (Image) */}
          <div className="md:col-span-3 lg:col-span-4 p-2 rounded-[2rem] bg-white/[0.02] border border-white/5 backdrop-blur-sm">
            <div className="relative w-full h-[300px] lg:h-[400px] rounded-[calc(2rem-0.5rem)] overflow-hidden bg-[#0a0807] group">
              <img 
                loading="lazy" 
                decoding="async" 
                fetchPriority="low"
                alt={images[1]?.alt} 
                src={isNear ? images[1]?.src : placeholderSvg} 
                className="absolute inset-0 w-full h-[120%] object-cover object-center group-hover:scale-105 transition-transform duration-[1.5s] ease-out" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
              <div className="absolute bottom-6 left-6 right-6 p-3 sm:p-3.5 rounded-xl bg-black/65 backdrop-blur-md border border-white/10 flex items-center justify-between shadow-lg">
                <div>
                  <span className="block font-sans text-[9px] uppercase tracking-widest text-[#D4AF37] font-semibold">02 &bull; NOCTURNE</span>
                  <span className="block font-serif text-sm sm:text-base text-white font-normal mt-0.5">Iconic Neon Accents</span>
                </div>
                <div className="w-7 h-7 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37]">
                  <span className="material-symbols-outlined text-xs">flare</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Right Cell 2 (Image) */}
          <div className="md:col-span-4 lg:col-span-3 p-2 rounded-[2rem] bg-white/[0.02] border border-white/5 backdrop-blur-sm">
            <div className="relative w-full h-[300px] lg:h-[400px] rounded-[calc(2rem-0.5rem)] overflow-hidden bg-[#0a0807] group">
              <img 
                loading="lazy" 
                decoding="async" 
                fetchPriority="low"
                alt={images[2]?.alt} 
                src={isNear ? images[2]?.src : placeholderSvg} 
                className="absolute inset-0 w-full h-[120%] object-cover object-center group-hover:scale-105 transition-transform duration-[1.5s] ease-out" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
              <div className="absolute bottom-6 left-6 right-6 p-3 sm:p-3.5 rounded-xl bg-black/65 backdrop-blur-md border border-white/10 flex items-center justify-between shadow-lg">
                <div>
                  <span className="block font-sans text-[9px] uppercase tracking-widest text-[#D4AF37] font-semibold">03 &bull; GASTRONOMY</span>
                  <span className="block font-serif text-sm sm:text-base text-white font-normal mt-0.5">Curated Plating</span>
                </div>
                <div className="w-7 h-7 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37]">
                  <span className="material-symbols-outlined text-xs">restaurant</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
