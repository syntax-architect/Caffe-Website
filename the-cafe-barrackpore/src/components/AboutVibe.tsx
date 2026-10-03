import React, { useState, useRef, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
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
  
  const yPos1 = useTransform(scrollYProgress, [0, 1], [-20, 20]);
  const yPos2 = useTransform(scrollYProgress, [0, 1], [20, -20]);

  return (
    <section ref={sectionRef} id="about-and-vibe" className="w-full py-24 lg:py-40 bg-[#0a0807] relative overflow-hidden border-t border-white/5 scroll-mt-24">
      {/* Background ambient texture */}
      <div className="hidden sm:block absolute inset-0 pointer-events-none mix-blend-overlay opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>

      <div className="max-w-[1400px] mx-auto px-6 sm:px-12">
        
        {/* Top: Editorial Narrative */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-12 mb-20 lg:mb-32 relative z-10">
          <motion.h2 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="font-sans text-5xl lg:text-7xl xl:text-8xl text-[#F5F2F0] font-medium tracking-tighter leading-[0.9]"
          >
            The <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB] italic font-serif pr-2">Atmosphere.</span>
          </motion.h2>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="font-sans text-lg text-[#E3DACD]/60 max-w-[40ch] leading-relaxed font-light"
          >
            Inspired by British-colonial vintage charms blended with a nocturnal lounge glow, our tufted sapphire velvet booths and golden filament fixtures create an intimate sanctuary for relaxed sophistication.
          </motion.p>
        </div>

        {/* The Asymmetrical Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8 relative z-10">
          
          {/* Main Visual Cell (Tall Portrait) */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="md:col-span-5 md:row-span-2 p-2 rounded-[2rem] lg:rounded-[2.5rem] bg-white/[0.02] border border-white/5 shadow-2xl backdrop-blur-sm"
          >
            <div className="relative w-full h-full min-h-[400px] lg:min-h-[600px] rounded-[calc(2rem-0.5rem)] lg:rounded-[calc(2.5rem-0.5rem)] overflow-hidden bg-[#0a0807] group">
              <motion.img 
                loading="lazy" 
                decoding="async" 
                alt={images[0]?.alt} 
                src={images[0]?.src} 
                style={{ y: yPos1 }}
                className="absolute inset-0 w-full h-[120%] object-cover object-center group-hover:scale-105 transition-transform duration-[1.5s] ease-out" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
              <div className="absolute bottom-6 left-6 right-6">
                <span className="block font-sans text-xs uppercase tracking-widest text-[#D4AF37] mb-2 font-semibold">01</span>
                <span className="block font-serif text-2xl text-white italic">Private Velvet Booths</span>
              </div>
            </div>
          </motion.div>

          {/* Top Right Cell (Audio Lounge & Metrics) */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="md:col-span-7 p-2 rounded-[2rem] lg:rounded-[2.5rem] bg-white/[0.02] border border-white/5 backdrop-blur-sm"
          >
            <div className="relative w-full h-full p-8 lg:p-12 rounded-[calc(2rem-0.5rem)] lg:rounded-[calc(2.5rem-0.5rem)] bg-gradient-to-br from-[#1C120D] to-[#0a0807] border border-white/[0.05] flex flex-col justify-between gap-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={toggleAudio}
                    className="w-14 h-14 rounded-full bg-[#D4AF37]/10 flex items-center justify-center text-[#D4AF37] transition-all duration-500 hover:scale-105 hover:bg-[#D4AF37]/20 border border-[#D4AF37]/20"
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
                  <span className="block font-serif text-lg text-white">Warm Amber <span className="text-[#D4AF37] italic">2200K</span></span>
                </div>
                <div>
                  <span className="block font-sans text-[10px] uppercase tracking-widest text-white/40 mb-1">Aroma</span>
                  <span className="block font-serif text-lg text-white">Smoked Vanilla & Arabica</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Bottom Right Cell 1 (Image) */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="md:col-span-3 lg:col-span-4 p-2 rounded-[2rem] bg-white/[0.02] border border-white/5 backdrop-blur-sm"
          >
            <div className="relative w-full h-[300px] lg:h-[400px] rounded-[calc(2rem-0.5rem)] overflow-hidden bg-[#0a0807] group">
              <motion.img 
                loading="lazy" 
                decoding="async" 
                alt={images[1]?.alt} 
                src={images[1]?.src} 
                style={{ y: yPos2 }}
                className="absolute inset-0 w-full h-[120%] object-cover object-center group-hover:scale-105 transition-transform duration-[1.5s] ease-out" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
              <div className="absolute bottom-6 left-6">
                <span className="block font-sans text-[10px] uppercase tracking-widest text-[#D4AF37] mb-1 font-semibold">02</span>
                <span className="block font-sans text-sm text-white font-light">Iconic Neon Accents</span>
              </div>
            </div>
          </motion.div>

          {/* Bottom Right Cell 2 (Image) */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="md:col-span-4 lg:col-span-3 p-2 rounded-[2rem] bg-white/[0.02] border border-white/5 backdrop-blur-sm"
          >
            <div className="relative w-full h-[300px] lg:h-[400px] rounded-[calc(2rem-0.5rem)] overflow-hidden bg-[#0a0807] group">
              <motion.img 
                loading="lazy" 
                decoding="async" 
                alt={images[2]?.alt} 
                src={images[2]?.src} 
                style={{ y: yPos1 }}
                className="absolute inset-0 w-full h-[120%] object-cover object-center group-hover:scale-105 transition-transform duration-[1.5s] ease-out" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
              <div className="absolute bottom-6 left-6">
                <span className="block font-sans text-[10px] uppercase tracking-widest text-[#D4AF37] mb-1 font-semibold">03</span>
                <span className="block font-sans text-sm text-white font-light">Curated Plating</span>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};
