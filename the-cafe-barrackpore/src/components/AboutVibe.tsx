import React, { useState, useRef, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useSiteConfig } from '../context/SiteConfigContext';

export const AboutVibe: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const { aboutVibe } = useSiteConfig();
  const images = aboutVibe.images;
  const sectionRef = useRef<HTMLElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const check = () => setIsDesktop(typeof window !== 'undefined' && window.innerWidth >= 1024);
    check();
    window.addEventListener('resize', check, { passive: true });
    return () => window.removeEventListener('resize', check);
  }, []);

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

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"]
  });
  
  const yPos = useTransform(scrollYProgress, [0, 1], [-40, 40]);

  return (
    <>
      <section ref={sectionRef} id="about-and-vibe" className="w-full py-16 lg:py-24 bg-[#170F0B] relative overflow-hidden border-t border-white/5 scroll-mt-24">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-12">
          
          {/* Top Section: Narrative & 4 Photo Grid (Balanced Heights) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            
            {/* Left Narrative Column (6 cols) */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.7 }}
              className="lg:col-span-6 flex flex-col gap-5"
            >
              <div className="inline-flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="editorial-eyebrow">The Atmosphere &amp; Essence</span>
              </div>
              
              <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-on-surface font-normal tracking-tight leading-[1.12]">
                Cozy Elegance Meets <br className="hidden sm:block" />
                <span className="text-primary italic font-light">Nocturnal Radiance</span>
              </h2>

              <p className="font-sans text-sm sm:text-base text-on-surface/80 leading-relaxed font-light">
                Step into Barrackpore's trendsetting dining retreat. Inspired by British-colonial vintage charms blended with a nocturnal lounge glow, our tufted sapphire velvet booths and golden filament fixtures create an intimate sanctuary.
              </p>

              <p className="font-sans text-xs sm:text-sm text-on-surface/65 leading-relaxed font-light -mt-2">
                Whether sinking into a candlelit date night, catching up with friends over single-origin pour-overs, or enjoying live weekend acoustic sessions, every detail is curated for relaxed sophistication.
              </p>
              
              {/* 4 Feature Amenities Grid (2x2 Luxury Double-Bezel Cards on Mobile) */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 pt-1">
                <div className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-br from-[#1C120D] to-[#120B08] border border-[#D4AF37]/25 shadow-md flex flex-col gap-1 active:scale-[0.98] transition-transform">
                  <div className="w-8 h-8 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-base">weekend</span>
                  </div>
                  <span className="font-serif text-xs sm:text-sm text-on-surface font-medium mt-1">Private Velvet Booths</span>
                  <span className="font-sans text-[10px] sm:text-[11px] text-on-surface/60 line-clamp-2">Tufted comfort with bespoke low-candlelight.</span>
                </div>
                
                <div className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-br from-[#1C120D] to-[#120B08] border border-[#D4AF37]/25 shadow-md flex flex-col gap-1 active:scale-[0.98] transition-transform">
                  <div className="w-8 h-8 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-base">photo_camera</span>
                  </div>
                  <span className="font-serif text-xs sm:text-sm text-on-surface font-medium mt-1">Instagram Art Wall</span>
                  <span className="font-sans text-[10px] sm:text-[11px] text-on-surface/60 line-clamp-2">Iconic neon accents &amp; curated visual moments.</span>
                </div>

                <div className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-br from-[#1C120D] to-[#120B08] border border-[#D4AF37]/25 shadow-md flex flex-col gap-1 active:scale-[0.98] transition-transform">
                  <div className="w-8 h-8 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-base">ramen_dining</span>
                  </div>
                  <span className="font-serif text-xs sm:text-sm text-on-surface font-medium mt-1">Continental &amp; Asian</span>
                  <span className="font-sans text-[10px] sm:text-[11px] text-on-surface/60 line-clamp-2">Artisanal pizzas, gourmet dim sums &amp; sips.</span>
                </div>

                <div className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-br from-[#1C120D] to-[#120B08] border border-[#D4AF37]/25 shadow-md flex flex-col gap-1 active:scale-[0.98] transition-transform">
                  <div className="w-8 h-8 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-base">local_cafe</span>
                  </div>
                  <span className="font-serif text-xs sm:text-sm text-on-surface font-medium mt-1">Late Night Kitchen</span>
                  <span className="font-sans text-[10px] sm:text-[11px] text-on-surface/60 line-clamp-2">Craft pours &amp; comfort food till 11:30 PM.</span>
                </div>
              </div>
            </motion.div>

            {/* Right Visual Artistry Layout (2x2 Grid on Mobile, Staggered on Desktop) */}
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.8 }}
              className="lg:col-span-6 grid grid-cols-2 gap-2.5 sm:gap-4"
            >
              <div className="group relative rounded-2xl overflow-hidden shadow-xl bg-[#140D09] h-44 sm:h-56 lg:h-64 border border-[#D4AF37]/20 hover:border-[#D4AF37]/50 transition-colors duration-500">
                <motion.img loading="lazy" alt={images[0].alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" src={images[0].src} style={isDesktop ? { y: yPos, scale: 1.15 } : {}} />
                <div className="absolute inset-0 bg-gradient-to-t from-[#140D09] via-transparent to-transparent flex flex-col justify-end p-2.5 sm:p-4">
                  <span className="font-serif text-[11px] sm:text-sm font-medium text-primary">Midnight Booths</span>
                  <p className="font-sans text-[9px] sm:text-[11px] text-on-surface/75 mt-0.5 line-clamp-1 sm:line-clamp-none">Intimate dining crafted for evenings.</p>
                </div>
              </div>

              <div className="group relative rounded-2xl overflow-hidden shadow-xl bg-[#140D09] h-44 sm:h-56 lg:h-64 border border-[#D4AF37]/20 hover:border-[#D4AF37]/50 transition-colors duration-500 sm:translate-y-3">
                <motion.img loading="lazy" alt={images[1].alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" src={images[1].src} style={isDesktop ? { y: yPos, scale: 1.15 } : {}} />
                <div className="absolute inset-0 bg-gradient-to-t from-[#140D09] via-transparent to-transparent flex flex-col justify-end p-2.5 sm:p-4">
                  <span className="font-serif text-[11px] sm:text-sm font-medium text-primary">Acoustic Nook</span>
                  <p className="font-sans text-[9px] sm:text-[11px] text-on-surface/75 mt-0.5 line-clamp-1 sm:line-clamp-none">Warm vinyl &amp; live serenades.</p>
                </div>
              </div>

              <div className="group relative rounded-2xl overflow-hidden shadow-xl bg-[#140D09] h-44 sm:h-56 lg:h-64 border border-[#D4AF37]/20 hover:border-[#D4AF37]/50 transition-colors duration-500">
                <motion.img loading="lazy" alt={images[2].alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" src={images[2].src} style={isDesktop ? { y: yPos, scale: 1.15 } : {}} />
                <div className="absolute inset-0 bg-gradient-to-t from-[#140D09] via-transparent to-transparent flex flex-col justify-end p-2.5 sm:p-4">
                  <span className="font-serif text-[11px] sm:text-sm font-medium text-primary">Espresso Bar</span>
                  <p className="font-sans text-[9px] sm:text-[11px] text-on-surface/75 mt-0.5 line-clamp-1 sm:line-clamp-none">Specialty beans &amp; pour-overs.</p>
                </div>
              </div>

              <div className="group relative rounded-2xl overflow-hidden shadow-xl bg-[#140D09] h-44 sm:h-56 lg:h-64 border border-[#D4AF37]/20 hover:border-[#D4AF37]/50 transition-colors duration-500 sm:translate-y-3">
                <motion.img loading="lazy" alt={images[3].alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" src={images[3].src} style={isDesktop ? { y: yPos, scale: 1.15 } : {}} />
                <div className="absolute inset-0 bg-gradient-to-t from-[#140D09] via-transparent to-transparent flex flex-col justify-end p-2.5 sm:p-4">
                  <span className="font-serif text-[11px] sm:text-sm font-medium text-primary">Comfort Bites</span>
                  <p className="font-sans text-[9px] sm:text-[11px] text-on-surface/75 mt-0.5 line-clamp-1 sm:line-clamp-none">Wood-fired thin crusts &amp; dim sums.</p>
                </div>
              </div>
            </motion.div>

          </div>

          {/* Bottom Section: Full-Width 2-Column Experience Showcase (No Blank Space) */}
          <div className="mt-10 lg:mt-14 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-stretch">
            
            {/* Column 1: Live Atmosphere Metrics (6 cols) */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="lg:col-span-6 p-5 sm:p-6 rounded-2xl bg-[#140D09] border border-[#D4AF37]/20 flex flex-col justify-between gap-4 shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-base">tune</span>
                  <span className="font-sans text-xs uppercase tracking-wider text-primary font-semibold">Live Atmosphere Metrics</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Optimal Ambience
                </span>
              </div>

              <div className="grid grid-cols-2 gap-y-3.5 gap-x-4">
                <div>
                  <span className="font-sans text-[10px] uppercase tracking-wider text-on-surface/50 block">Soundscape</span>
                  <span className="font-sans text-xs sm:text-sm font-medium text-on-surface">Lo-Fi &amp; Soul (~62 dB)</span>
                </div>
                <div>
                  <span className="font-sans text-[10px] uppercase tracking-wider text-on-surface/50 block">Lighting Temp</span>
                  <span className="font-sans text-xs sm:text-sm font-medium text-primary">Warm Amber (2200K)</span>
                </div>
                <div>
                  <span className="font-sans text-[10px] uppercase tracking-wider text-on-surface/50 block">Aroma Profile</span>
                  <span className="font-sans text-xs sm:text-sm font-medium text-on-surface">Smoked Vanilla &amp; Arabica</span>
                </div>
                <div>
                  <span className="font-sans text-[10px] uppercase tracking-wider text-on-surface/50 block">Best Hours</span>
                  <span className="font-sans text-xs sm:text-sm font-medium text-on-surface">7:00 PM – 11:30 PM</span>
                </div>
              </div>
            </motion.div>

            {/* Column 2: Lounge Soundscape Audio & Guest Amenities (6 cols) */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="lg:col-span-6 p-5 sm:p-6 rounded-2xl bg-[#140D09] border border-[#D4AF37]/20 flex flex-col justify-between gap-4 shadow-xl"
            >
              {/* Soundscape Audio Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shrink-0">
                    <span className="material-symbols-outlined text-base">graphic_eq</span>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-sans text-xs uppercase tracking-wider text-primary font-semibold">Lounge Soundscape</span>
                      <div className="flex items-end gap-[2px] h-3 overflow-hidden">
                        <div className={`w-0.5 bg-primary rounded-full transition-all duration-300 ${isPlaying ? 'animate-[eq_1s_ease-in-out_infinite_alternate]' : 'h-1'}`} />
                        <div className={`w-0.5 bg-primary rounded-full transition-all duration-300 ${isPlaying ? 'animate-[eq_0.8s_ease-in-out_infinite_alternate]' : 'h-1'}`} style={{ animationDelay: '150ms' }} />
                        <div className={`w-0.5 bg-primary rounded-full transition-all duration-300 ${isPlaying ? 'animate-[eq_1.2s_ease-in-out_infinite_alternate]' : 'h-1'}`} style={{ animationDelay: '300ms' }} />
                        <div className={`w-0.5 bg-primary rounded-full transition-all duration-300 ${isPlaying ? 'animate-[eq_0.9s_ease-in-out_infinite_alternate]' : 'h-1'}`} style={{ animationDelay: '100ms' }} />
                      </div>
                    </div>
                    <span className="font-sans text-xs text-on-surface/70 mt-0.5">Acoustic Lo-Fi &amp; Velvet Jazz</span>
                  </div>
                </div>

                <button 
                  id="music-toggle-btn" 
                  onClick={toggleAudio} 
                  data-playing={isPlaying} 
                  className={`h-8 px-4 rounded-full text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 ${
                    isPlaying 
                      ? 'bg-primary text-background' 
                      : 'border border-primary/40 text-primary hover:bg-primary/10'
                  }`}
                  aria-label={isPlaying ? 'Pause Lounge Audio' : 'Play Lounge Audio'}
                >
                  <span className="material-symbols-outlined text-sm">{isPlaying ? 'pause' : 'play_arrow'}</span>
                  <span className="label-text font-sans uppercase tracking-wider">{isPlaying ? 'Pause Audio' : 'Play Vibe'}</span>
                </button>
              </div>

              {/* Guest Comfort Amenities */}
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-on-surface/65 font-sans">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/5 border border-white/5">
                  <span className="material-symbols-outlined text-primary text-xs">wifi</span> High-Speed Wi-Fi
                </span>
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/5 border border-white/5">
                  <span className="material-symbols-outlined text-primary text-xs">power</span> Power at Every Booth
                </span>
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/5 border border-white/5">
                  <span className="material-symbols-outlined text-primary text-xs">two_wheeler</span> Dedicated Parking
                </span>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

    </>
  );
};
