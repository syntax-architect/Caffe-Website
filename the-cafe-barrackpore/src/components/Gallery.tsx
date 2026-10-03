import React, { useEffect, useState } from 'react';
import { useSiteConfig } from '../context/SiteConfigContext';
import { clientDetails } from '../config/client';

interface GalleryPhoto {
  src: string;
  alt: string;
  caption?: string;
  tag?: string;
}

const GALLERY_METADATA: Record<number, { tag: string; caption: string }> = {
  0: { tag: "Intimate Evenings", caption: "Bespoke booth seating bathed in low filament glow." },
  1: { tag: "Wood-Fired Artisans", caption: "Hand-stretched sourdough pizzas fresh from the flame." },
  2: { tag: "Single-Origin Brews", caption: "Artisanal espresso & slow cold drip extractions." },
  3: { tag: "Acoustic Weekends", caption: "Live unplugged melodies and twilight conversations." },
};

export const Gallery: React.FC = () => {
  const { gallery } = useSiteConfig();
  const images = gallery.images;
  const [selectedPhoto, setSelectedPhoto] = useState<{ index: number; data: GalleryPhoto } | null>(null);

  const hasElfsight = clientDetails.elfsightId && clientDetails.elfsightId !== "YOUR_ELFSIGHT_WIDGET_ID";

  useEffect(() => {
    if (hasElfsight) {
      const script = document.createElement('script');
      script.src = "https://static.elfsight.com/platform/platform.js";
      script.async = true;
      document.body.appendChild(script);
      return () => {
        document.body.removeChild(script);
      };
    }
  }, [hasElfsight]);

  // Handle escape key to close lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedPhoto !== null) {
        setSelectedPhoto(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPhoto]);

  return (
    <section className="w-full py-20 lg:py-28 bg-[#0D0705] relative border-t border-white/5 scroll-mt-28 overflow-hidden" id="gallery">
      {/* Ambient Glow */}
      <div 
        className="absolute top-1/3 left-1/4 w-[600px] h-[400px] bg-[#D4AF37]/5 blur-[140px] rounded-full pointer-events-none" 
        aria-hidden="true" 
      />

      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        
        {/* Section Header */}
        <div className="mb-14 md:mb-18 text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center justify-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="editorial-eyebrow">Visual Chronicles</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-on-surface font-normal tracking-tight text-balance">
            Moments Captured at The Café
          </h2>
          <p className="font-sans text-sm sm:text-base text-on-surface/70 mt-3 font-light leading-relaxed">
            A glimpse into the nocturnal atmosphere, handcrafted cuisine, and acoustic energy at Barrackpore’s premier dining retreat.
          </p>
        </div>

        {hasElfsight ? (
          <div className="w-full">
            <div className={`elfsight-app-${clientDetails.elfsightId}`} data-elfsight-app-lazy></div>
          </div>
        ) : (
          /* Asymmetrical Double-Bezel Bento Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 auto-rows-[250px] sm:auto-rows-[310px]">
            {images.slice(0, 4).map((img, idx) => {
              const meta = GALLERY_METADATA[idx] || { tag: "The Café Experience", caption: img.alt };
              // Spans: Item 0 = 1 col, 2 rows (portrait hero); Item 1 = 2 cols, 1 row (wide panoramic); Items 2 & 3 = 1 col each
              const spanClass = 
                idx === 0 
                  ? "lg:col-span-1 lg:row-span-2 min-h-[300px] sm:min-h-full" 
                  : idx === 1 
                  ? "lg:col-span-2 lg:row-span-1" 
                  : "lg:col-span-1 lg:row-span-1";

              return (
                <div 
                  key={idx}
                  onClick={() => setSelectedPhoto({ index: idx, data: { ...img, ...meta } })}
                  className={`${spanClass} rounded-[2rem] p-1.5 bg-gradient-to-b from-white/10 via-white/[0.04] to-transparent border border-white/10 hover:border-[#D4AF37]/50 shadow-xl transition-all duration-500 cursor-pointer group flex flex-col hover:-translate-y-1`}
                >
                  <div className="rounded-[calc(2rem-0.375rem)] overflow-hidden relative h-full w-full bg-[#18100C] border border-white/5">
                    {/* Subtle Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#100906] via-transparent to-black/30 opacity-75 group-hover:opacity-45 transition-opacity duration-500 z-10 pointer-events-none" />

                    {/* Corner Category Tag */}
                    <div className="absolute top-4 left-4 z-20 px-3.5 py-1 rounded-full bg-[#120B08]/90 backdrop-blur-md border border-[#D4AF37]/35 text-[10px] uppercase tracking-wider text-primary font-semibold shadow-lg">
                      {meta.tag}
                    </div>

                    {/* Concentric Expand Button */}
                    <div className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-[#120B08]/85 backdrop-blur-md border border-white/15 flex items-center justify-center text-on-surface opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0 group-hover:border-[#D4AF37]/50 shadow-lg">
                      <span className="material-symbols-outlined text-sm font-light text-primary">fullscreen</span>
                    </div>

                    {/* Bottom Caption Overlay */}
                    <div className="absolute bottom-0 inset-x-0 p-5 z-20 flex flex-col justify-end transform translate-y-1 group-hover:translate-y-0 transition-transform duration-300">
                      <p className="font-serif text-base sm:text-lg text-on-surface font-normal leading-snug">
                        {meta.caption}
                      </p>
                      <span className="font-sans text-[11px] text-primary/90 mt-1 uppercase tracking-wider font-medium flex items-center gap-1">
                        <span>View Photograph</span>
                        <span className="material-symbols-outlined text-xs">arrow_forward</span>
                      </span>
                    </div>

                    {/* Photography Image */}
                    <img 
                      loading="lazy" 
                      decoding="async" 
                      width="600" 
                      height="450" 
                      src={img?.src} 
                      alt={img?.alt || "The Café Barrackpore Hospitality"}
                      className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Luxury Fullscreen Lightbox Modal */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 z-[250] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-4 sm:p-8 animate-fade-in transition-opacity duration-300"
          onClick={() => setSelectedPhoto(null)}
        >
          {/* Top Close Bar */}
          <div className="absolute top-6 left-6 right-6 flex items-center justify-between text-on-surface z-30 max-w-5xl mx-auto w-full">
            <div className="flex items-center gap-3">
              <span className="font-sans text-xs uppercase tracking-widest text-primary font-semibold">
                0{selectedPhoto.index + 1} / 04
              </span>
              <span className="text-white/20">|</span>
              <span className="font-sans text-xs uppercase tracking-wider text-on-surface/75">
                {selectedPhoto.data.tag}
              </span>
            </div>
            <button 
              onClick={() => setSelectedPhoto(null)}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-on-surface transition-colors cursor-pointer"
              aria-label="Close photograph lightbox"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>

          {/* Modal Image Container with Double Bezel */}
          <div 
            className="relative max-w-4xl max-h-[75vh] rounded-[2rem] p-1.5 bg-gradient-to-b from-white/15 to-white/5 border border-[#D4AF37]/35 shadow-2xl bg-[#160E0A]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded-[calc(2rem-0.375rem)] overflow-hidden max-h-[calc(75vh-12px)]">
              <img 
                src={selectedPhoto.data.src} 
                alt={selectedPhoto.data.alt} 
                width="1200"
                height="800"
                decoding="async"
                className="w-full h-full max-h-[75vh] object-contain"
              />
            </div>
          </div>

          {/* Modal Caption */}
          <div className="mt-6 text-center max-w-xl z-30" onClick={(e) => e.stopPropagation()}>
            <p className="font-serif text-lg sm:text-xl text-on-surface font-light">
              {selectedPhoto.data.caption}
            </p>
            <p className="font-sans text-xs text-primary/80 mt-1 uppercase tracking-widest">
              The Café Barrackpore
            </p>
          </div>
        </div>
      )}
    </section>
  );
};
