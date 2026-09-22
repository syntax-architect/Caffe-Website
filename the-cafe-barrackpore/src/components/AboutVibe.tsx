import React, { useState, useRef, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { siteConfig as fallbackConfig } from '../data/siteConfig';
import { client, urlFor } from '../lib/sanityClient';

export const AboutVibe: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [images, setImages] = useState(fallbackConfig.aboutVibe.images);
  const sectionRef = useRef<HTMLElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await client.fetch(`*[_type == "siteConfig"][0]{ aboutVibeImages }`);
        if (config?.aboutVibeImages && config.aboutVibeImages.length === 4) {
          setImages(config.aboutVibeImages.map((img: any, index: number) => ({
            src: urlFor(img.image).url(),
            alt: img.alt || fallbackConfig.aboutVibe.images[index].alt
          })));
        }
      } catch (error) {
        console.error("Error fetching about vibe images from Sanity:", error);
      }
    };
    fetchConfig();

    audioRef.current = new Audio('https://assets.mixkit.co/music/preview/mixkit-chill-bro-494.mp3');
    audioRef.current.volume = 0.4;

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"]
  });
  
  const yPos = useTransform(scrollYProgress, [0, 1], [-40, 40]);

  return (
    <>
      <section ref={sectionRef} id="about-and-vibe" className="w-full py-16 md:py-space-xl bg-surface-container-lowest relative overflow-hidden">
  <div className="max-w-[1320px] mx-auto px-4 md:px-gutter">
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-space-xl items-center">
      {/* Narrative Column */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.7 }}
        className="lg:col-span-6 flex flex-col gap-space-md"
      >
        <div className="inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-primary-container animate-pulse" /><span className="font-label-sm text-label-sm text-[#D4AF37] uppercase tracking-widest font-semibold">The
            Atmosphere &amp; Essence</span></div>
        <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold">Cozy Elegance Meets <span className="text-tertiary">Pop-Art Energy</span></h2>
        <p className="font-body-lg text-body-lg text-on-surface-variant leading-relaxed">Step into Barrackpore's
          trendsetting dining retreat. Inspired by British-colonial vintage charms blended with a nocturnal lounge
          glow, our tufted sapphire velvet booths and golden Edison filament fixtures create the ultimate
          hideaway.</p>
        <p className="font-body-md text-body-md text-on-surface-variant/80 leading-relaxed">Whether you are sinking
          into a candlelit date night, catching up with old friends over aromatic pour-overs, or enjoying live
          Saturday acoustic serenades, every corner is designed to be your sanctuary of good taste and relaxed
          sophistication.</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 mt-6">
          <div className="py-6 px-2 bg-transparent flex flex-col gap-3 border-b border-white/10">
            <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[#D4AF37] text-xl">weekend</span><span className="font-label-md text-label-md text-on-surface font-semibold">Private Dining Booths</span>
            </div><span className="font-body-sm text-body-sm text-on-surface-variant">Deep blue velvet luxury with
              bespoke low lighting.</span>
          </div>
          <div className="py-6 px-2 bg-transparent flex flex-col gap-3 border-b border-white/10">
            <div className="flex items-center gap-2"><span className="material-symbols-outlined text-tertiary text-xl">photo_camera</span><span className="font-label-md text-label-md text-on-surface font-semibold">Instagram Art Wall</span></div>
            <span className="font-body-sm text-body-sm text-on-surface-variant">Vibrant neon signage and iconic
              culinary aesthetic.</span>
          </div>
          <div className="py-6 px-2 bg-transparent flex flex-col gap-3 border-b border-white/10">
            <div className="flex items-center gap-2"><span className="material-symbols-outlined text-secondary text-xl">ramen_dining</span><span className="font-label-md text-label-md text-on-surface font-semibold">Continental &amp; Asian</span>
            </div><span className="font-body-sm text-body-sm text-on-surface-variant">Artisanal pizzas, hand-crafted
              momos &amp; mocktails.</span>
          </div>
          <div className="py-6 px-2 bg-transparent flex flex-col gap-3 border-b border-white/10">
            <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[#D4AF37] text-xl">local_cafe</span><span className="font-label-md text-label-md text-on-surface font-semibold">Late Night Brews</span></div>
            <span className="font-body-sm text-body-sm text-on-surface-variant">Brewed fresh till 11:30 PM with
              artisanal roasts.</span>
          </div>
        </div>
        
        <div className="py-8 px-2 bg-transparent border-b border-white/10 flex flex-col gap-8">
          <div className="flex items-center justify-between"><span className="font-label-sm text-label-sm uppercase tracking-wider text-[#D4AF37] font-bold flex items-center gap-1.5"><span className="material-symbols-outlined text-base">tune</span> Live Atmosphere Vibe Metrics</span><span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400">Optimal
              Ambience</span></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-space-sm">
            <div className="flex flex-col gap-0.5"><span className="font-label-sm text-[11px] text-on-surface-variant/80 uppercase">Decibel Vibe</span><span className="font-body-sm text-body-sm font-semibold text-on-surface">Chill Lo-Fi &amp; Soul (~62
                dB)</span></div>
            <div className="flex flex-col gap-0.5"><span className="font-label-sm text-[11px] text-on-surface-variant/80 uppercase">Lighting
                Ambiance</span><span className="font-body-sm text-body-sm font-semibold text-tertiary">Edison &amp;
                Neon Glow (2200K)</span></div>
            <div className="flex flex-col gap-0.5"><span className="font-label-sm text-[11px] text-on-surface-variant/80 uppercase">Signature
                Fragrance</span><span className="font-body-sm text-body-sm font-semibold text-on-surface">Fresh
                Espresso &amp; Smoked Vanilla</span></div>
            <div className="flex flex-col gap-0.5"><span className="font-label-sm text-[11px] text-on-surface-variant/80 uppercase">Best Hours for
                Couples</span><span className="font-body-sm text-body-sm font-semibold text-secondary">7:00 PM – 10:30
                PM</span></div>
          </div>
        </div>
        
        <div className="py-8 px-2 bg-transparent border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-8">
          <div className="flex items-center gap-6">
            <div className="w-10 h-10 rounded-full bg-primary-container/20 flex items-center justify-center text-[#D4AF37] animate-pulse">
              <span className="material-symbols-outlined text-xl">graphic_eq</span></div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-label-sm text-label-sm text-tertiary font-semibold uppercase tracking-wider flex items-center">
                  Lounge Soundscape
                  <div className="flex items-end gap-[2px] h-3 ml-3 overflow-hidden">
                    <div className={`w-0.5 bg-[#D4AF37] rounded-full transition-all duration-300 ${isPlaying ? 'animate-[eq_1s_ease-in-out_infinite_alternate]' : 'h-0.5'}`} style={{ animationDelay: '0ms' }} />
                    <div className={`w-0.5 bg-[#D4AF37] rounded-full transition-all duration-300 ${isPlaying ? 'animate-[eq_0.8s_ease-in-out_infinite_alternate]' : 'h-0.5'}`} style={{ animationDelay: '200ms' }} />
                    <div className={`w-0.5 bg-[#D4AF37] rounded-full transition-all duration-300 ${isPlaying ? 'animate-[eq_1.2s_ease-in-out_infinite_alternate]' : 'h-0.5'}`} style={{ animationDelay: '400ms' }} />
                    <div className={`w-0.5 bg-[#D4AF37] rounded-full transition-all duration-300 ${isPlaying ? 'animate-[eq_0.9s_ease-in-out_infinite_alternate]' : 'h-0.5'}`} style={{ animationDelay: '100ms' }} />
                  </div>
                </span>
              </div>
              <span className="font-body-sm text-body-sm font-semibold text-on-surface mt-1">Lo-Fi Acoustic &amp; Velvet Jazz • Live Audio</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full bg-[#110C09] border border-white/20 flex items-center justify-center relative shadow-md ${isPlaying ? 'animate-[spin_3s_linear_infinite]' : ''}`}>
              <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]"></div>
              <div className="absolute inset-1 rounded-full border border-white/10 border-t-transparent pointer-events-none"></div>
              <div className="absolute inset-2 rounded-full border border-white/5 border-b-transparent pointer-events-none"></div>
            </div>
            <button id="music-toggle-btn" onClick={() => {
              if (isPlaying) {
                audioRef.current?.pause();
                setIsPlaying(false);
              } else {
                audioRef.current?.play();
                setIsPlaying(true);
              }
            }} data-playing={isPlaying} className={`px-space-md py-1.5 rounded-lg bg-surface-container-low hover:bg-primary hover:text-on-primary text-[#D4AF37] transition-all font-label-sm text-label-sm flex items-center gap-1.5 shadow-sm ${isPlaying ? 'animate-pulse ' : ''}`}>
              <span className="material-symbols-outlined text-base">{isPlaying ? 'pause_circle' : 'play_circle'}</span>
              <span className="label-text font-semibold">{isPlaying ? 'Pause Vibe' : 'Play Vibe'}</span>
            </button>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-space-xs pt-1">
          <div className="inline-flex items-center gap-1.5 px-space-sm py-1 px-2.5 rounded-full bg-surface-container text-on-surface-variant text-[12px] font-medium border border-outline-variant/30">
            <span className="material-symbols-outlined text-[#D4AF37] text-sm">bolt</span><span className="">High-Speed
              Fibre Wi-Fi</span></div>
          <div className="inline-flex items-center gap-1.5 px-space-sm py-1 px-2.5 rounded-full bg-surface-container text-on-surface-variant text-[12px] font-medium border border-outline-variant/30">
            <span className="material-symbols-outlined text-tertiary text-sm">power</span><span className="">Power Outlets
              at Every Booth</span></div>
          <div className="inline-flex items-center gap-1.5 px-space-sm py-1 px-2.5 rounded-full bg-surface-container text-on-surface-variant text-[12px] font-medium border border-outline-variant/30">
            <span className="material-symbols-outlined text-secondary text-sm">local_parking</span><span className="">Valet &amp; 2-Wheeler Parking</span></div>
        </div>
      </motion.div>
      {/* Visual Artistry Layout */}
      <motion.div 
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.9 }}
        className="lg:col-span-6 relative"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
          <div className="group relative rounded-xl overflow-hidden shadow-2xl bg-surface-container h-48 sm:h-64 lg:h-72 border border-outline-variant/30">
            <motion.img loading="lazy" alt={images[0].alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" src={images[0].src} style={{ y: yPos, scale: 1.15 }} />
            <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-surface-container-lowest/40 to-transparent flex flex-col justify-end p-space-md">
              <span className="font-label-sm text-[11px] text-[#D4AF37] uppercase font-bold tracking-wider">Midnight
                Velvet Booths</span>
              <p className="font-body-sm text-[12px] text-on-surface leading-tight mt-0.5">Intimate booth dining
                crafted for unforgettable evenings.</p>
            </div>
          </div>
          <div className="group relative rounded-xl overflow-hidden shadow-2xl bg-surface-container h-48 sm:h-64 lg:h-72 border border-outline-variant/30">
            <motion.img loading="lazy" alt={images[1].alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" src={images[1].src} style={{ y: yPos, scale: 1.15 }} />
            <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-surface-container-lowest/40 to-transparent flex flex-col justify-end p-space-md">
              <span className="font-label-sm text-[11px] text-tertiary uppercase font-bold tracking-wider">Live
                Acoustic Nook</span>
              <p className="font-body-sm text-[12px] text-on-surface leading-tight mt-0.5">Vinyl warmth, books &amp;
                weekend serenades.</p>
            </div>
          </div>
          <div className="group relative rounded-xl overflow-hidden shadow-2xl bg-surface-container h-48 sm:h-64 lg:h-72 border border-outline-variant/30">
            <motion.img loading="lazy" alt={images[2].alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" src={images[2].src} style={{ y: yPos, scale: 1.15 }} />
            <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-surface-container-lowest/40 to-transparent flex flex-col justify-end p-space-md">
              <span className="font-label-sm text-[11px] text-secondary uppercase font-bold tracking-wider">Signature
                Brew Bar</span>
              <p className="font-body-sm text-[12px] text-on-surface leading-tight mt-0.5">Cold drips &amp;
                hand-shaken smoke mocktails.</p>
            </div>
          </div>
          <div className="group relative rounded-xl overflow-hidden shadow-2xl bg-surface-container h-48 sm:h-64 lg:h-72 border border-outline-variant/30">
            <motion.img loading="lazy" alt={images[3].alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" src={images[3].src} style={{ y: yPos, scale: 1.15 }} />
            <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-surface-container-lowest/40 to-transparent flex flex-col justify-end p-space-md">
              <span className="font-label-sm text-[11px] text-[#D4AF37]-container uppercase font-bold tracking-wider">Gourmet
                Kitchen</span>
              <p className="font-body-sm text-[12px] text-on-surface leading-tight mt-0.5">Fresh wood-fired crusts
                &amp; steamed delicacies.</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  </div>
</section>

    </>
  );
};
