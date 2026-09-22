import React, { useEffect, useRef, useState } from 'react';
import { useDevice } from '../hooks/useDevice';

export const ScrollSequence: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const text1Ref = useRef<HTMLHeadingElement>(null);
  const text2Ref = useRef<HTMLHeadingElement>(null);
  const text3Ref = useRef<HTMLHeadingElement>(null);
  
  // Mobile specific refs
  const mobileImg1Ref = useRef<HTMLImageElement>(null);
  const mobileImg2Ref = useRef<HTMLImageElement>(null);
  const mobileImg3Ref = useRef<HTMLImageElement>(null);
  const mobileText1Ref = useRef<HTMLHeadingElement>(null);
  const mobileText2Ref = useRef<HTMLHeadingElement>(null);
  const mobileText3Ref = useRef<HTMLHeadingElement>(null);

  const { isTouchDevice, isMobile } = useDevice();
  const isMobileView = isTouchDevice || isMobile;

  useEffect(() => {
    let ticking = false;
    let lastFrameIndex = -1;
    let images: HTMLImageElement[] = [];
    const frameCount = 120;
    
    // --- DESKTOP CANVAS LOGIC ---
    if (!isMobileView) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext('2d');
      if (!context) return;

      const drawImageCover = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, canvasWidth: number, canvasHeight: number) => {
        const imgRatio = img.width / img.height;
        const canvasRatio = canvasWidth / canvasHeight;
        let sWidth = img.width;
        let sHeight = img.height;
        let sX = 0;
        let sY = 0;
        if (canvasRatio > imgRatio) {
          sHeight = img.width / canvasRatio;
          sY = (img.height - sHeight) / 2;
        } else {
          sWidth = img.height * canvasRatio;
          sX = (img.width - sWidth) / 2;
        }
        ctx.drawImage(img, sX, sY, sWidth, sHeight, 0, 0, canvasWidth, canvasHeight);
      };

      const currentFrame = (index: number) => `/frames/ezgif-frame-${index.toString().padStart(3, '0')}.jpg`;
      let loadedImages = 0;

      const resizeCanvas = () => {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        context.scale(dpr, dpr);
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        if (images[0] && images[0].complete) {
          drawImageCover(context, images[0], window.innerWidth, window.innerHeight);
        }
      };
      
      window.addEventListener('resize', resizeCanvas);
      resizeCanvas();

      const firstImg = new Image();
      firstImg.src = currentFrame(1);
      firstImg.onload = () => {
        loadedImages++;
        drawImageCover(context, firstImg, window.innerWidth, window.innerHeight);
      };
      images[0] = firstImg;

      const loadRemainingFrames = () => {
        let currentIndex = 2;
        const loadChunk = () => {
          const chunkLimit = Math.min(currentIndex + 10, frameCount + 1);
          for (let i = currentIndex; i < chunkLimit; i++) {
            const img = new Image();
            img.decoding = 'async';
            img.src = currentFrame(i);
            img.onload = () => loadedImages++;
            images[i - 1] = img;
          }
          currentIndex = chunkLimit;
          if (currentIndex <= frameCount) {
            setTimeout(loadChunk, 250); 
          }
        };
        loadChunk();
      };

      if (document.readyState === 'complete') {
        setTimeout(loadRemainingFrames, 1000); 
      } else {
        window.addEventListener('load', () => setTimeout(loadRemainingFrames, 1000));
      }
      
      const handleDesktopScroll = () => {
        const section = document.getElementById('scroll-sequence-section');
        if (!section) return;
        const rect = section.getBoundingClientRect();
        const scrollableDistance = rect.height - window.innerHeight;
        let progress = Math.max(0, Math.min(1, -rect.top / scrollableDistance));
        const frameIndex = Math.floor(progress * (frameCount - 1));
        
        if (!ticking) {
          window.requestAnimationFrame(() => {
            if (images[frameIndex] && images[frameIndex].complete) {
              if (frameIndex !== lastFrameIndex) {
                context.clearRect(0, 0, window.innerWidth, window.innerHeight);
                drawImageCover(context, images[frameIndex], window.innerWidth, window.innerHeight);
                lastFrameIndex = frameIndex;
              }
              
              if (text1Ref.current) {
                if (progress > 0.1 && progress < 0.3) {
                  text1Ref.current.style.opacity = '1';
                  text1Ref.current.style.transform = 'translateY(0)';
                } else {
                  text1Ref.current.style.opacity = '0';
                  text1Ref.current.style.transform = 'translateY(2rem)';
                }
              }
              if (text2Ref.current) {
                if (progress > 0.4 && progress < 0.6) {
                  text2Ref.current.style.opacity = '1';
                  text2Ref.current.style.transform = 'translateY(0)';
                } else {
                  text2Ref.current.style.opacity = '0';
                  text2Ref.current.style.transform = 'translateY(2rem)';
                }
              }
              if (text3Ref.current) {
                if (progress > 0.7 && progress < 0.9) {
                  text3Ref.current.style.opacity = '1';
                  text3Ref.current.style.transform = 'translateY(0)';
                } else {
                  text3Ref.current.style.opacity = '0';
                  text3Ref.current.style.transform = 'translateY(2rem)';
                }
              }
            }
            ticking = false;
          });
          ticking = true;
        }
      };

      window.addEventListener('scroll', handleDesktopScroll, { passive: true });
      setTimeout(handleDesktopScroll, 100);

      return () => {
        window.removeEventListener('resize', resizeCanvas);
        window.removeEventListener('scroll', handleDesktopScroll);
      };
    } 
    
    // --- MOBILE PREMIUM CROSSFADE LOGIC ---
    else {
      const handleMobileScroll = () => {
        const section = document.getElementById('scroll-sequence-section');
        if (!section) return;
        const rect = section.getBoundingClientRect();
        const scrollableDistance = rect.height - window.innerHeight;
        let progress = Math.max(0, Math.min(1, -rect.top / scrollableDistance));
        
        if (!ticking) {
          window.requestAnimationFrame(() => {
            // Image Crossfading
            if (mobileImg1Ref.current) mobileImg1Ref.current.style.opacity = progress < 0.33 ? '1' : progress < 0.45 ? String(1 - (progress - 0.33) * 8) : '0';
            if (mobileImg2Ref.current) mobileImg2Ref.current.style.opacity = progress > 0.25 && progress < 0.66 ? '1' : progress >= 0.66 && progress < 0.75 ? String(1 - (progress - 0.66) * 11) : '0';
            if (mobileImg3Ref.current) mobileImg3Ref.current.style.opacity = progress > 0.58 ? '1' : '0';

            // Text Animations
            if (mobileText1Ref.current) {
              if (progress > 0.05 && progress < 0.30) {
                mobileText1Ref.current.style.opacity = '1';
                mobileText1Ref.current.style.transform = 'translateY(0) scale(1)';
              } else {
                mobileText1Ref.current.style.opacity = '0';
                mobileText1Ref.current.style.transform = 'translateY(1rem) scale(0.95)';
              }
            }
            
            if (mobileText2Ref.current) {
              if (progress > 0.35 && progress < 0.60) {
                mobileText2Ref.current.style.opacity = '1';
                mobileText2Ref.current.style.transform = 'translateY(0) scale(1)';
              } else {
                mobileText2Ref.current.style.opacity = '0';
                mobileText2Ref.current.style.transform = 'translateY(1rem) scale(0.95)';
              }
            }
            
            if (mobileText3Ref.current) {
              if (progress > 0.65 && progress < 0.95) {
                mobileText3Ref.current.style.opacity = '1';
                mobileText3Ref.current.style.transform = 'translateY(0) scale(1)';
              } else {
                mobileText3Ref.current.style.opacity = '0';
                mobileText3Ref.current.style.transform = 'translateY(1rem) scale(0.95)';
              }
            }
            
            ticking = false;
          });
          ticking = true;
        }
      };

      window.addEventListener('scroll', handleMobileScroll, { passive: true });
      setTimeout(handleMobileScroll, 100);

      return () => {
        window.removeEventListener('scroll', handleMobileScroll);
      };
    }
  }, [isMobileView]);

  return (
    <section id="scroll-sequence-section" className="relative w-full h-[380vh] bg-background">
      <div 
        className="sticky top-0 w-full h-[100dvh] overflow-hidden flex items-center justify-center bg-black"
        style={{ maskImage: 'radial-gradient(circle, black 40%, transparent 100%)', WebkitMaskImage: 'radial-gradient(circle, black 40%, transparent 100%)' }}
      >
        {isMobileView ? (
          // Mobile Premium Crossfade Images
          <>
            <img 
              ref={mobileImg1Ref}
              src="/images/cinematic_luxury_interior_photo_of_a_trendy_modern_cafe_lounge_named_the_cafe.webp"
              alt="The Cafe Barrackpore Interior"
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500 opacity-100"
            />
            <img 
              ref={mobileImg2Ref}
              src="/images/hero_coffee_splash.webp"
              alt="Premium Coffee Splash"
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500 opacity-0"
            />
            <img 
              ref={mobileImg3Ref}
              src="/images/high_end_culinary_photography_of_a_gourmet_chicken_burger_on_a_brioche_bun_with.webp"
              alt="Gourmet Burger"
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500 opacity-0"
            />
          </>
        ) : (
          // Desktop Canvas Frame Sequence
          <canvas 
            ref={canvasRef}
            id="scroll-video-canvas" 
            className="absolute inset-0 w-full h-full opacity-60"
            style={{ filter: 'contrast(1.25) brightness(0.9) saturate(1.1)' }}
          />
        )}
        
        {/* Subtle noise overlay (lighter on mobile for image clarity) */}
        <div className={`absolute inset-0 pointer-events-none mix-blend-overlay ${isMobileView ? 'opacity-10' : 'opacity-20'}`} style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>
        
        {/* Dark overlays to blend image into background */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-transparent" />
        
        {/* Floating text that appears during scroll */}
        <div className="relative z-10 max-w-[1320px] mx-auto px-4 sm:px-6 w-full flex flex-col items-center justify-center text-center h-full">
          {isMobileView ? (
             <>
               <h2 ref={mobileText1Ref} className="font-headline-lg text-4xl text-[#E3DACD] font-medium tracking-tight opacity-0 absolute w-full left-0 px-4 transition-all duration-500 ease-out">
                 Crafted to <span className="text-primary italic font-serif">Perfection</span>
               </h2>
               <h2 ref={mobileText2Ref} className="font-headline-lg text-4xl text-[#E3DACD] font-medium tracking-tight opacity-0 absolute w-full left-0 px-4 transition-all duration-500 ease-out">
                 Every Drop <span className="text-primary italic font-serif">Matters</span>
               </h2>
               <h2 ref={mobileText3Ref} className="font-headline-lg text-4xl text-[#E3DACD] font-medium tracking-tight opacity-0 absolute w-full left-0 px-4 transition-all duration-500 ease-out">
                 The True <span className="text-primary italic font-serif">Lounge</span> Experience
               </h2>
             </>
          ) : (
            <>
              <h2 ref={text1Ref} className="font-headline-lg text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-[#E3DACD] font-medium tracking-tight opacity-0 transition-all duration-700 translate-y-8 absolute w-full left-0 px-4">
                Crafted to <span className="text-primary italic font-serif">Perfection</span>
              </h2>
              <h2 ref={text2Ref} className="font-headline-lg text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-[#E3DACD] font-medium tracking-tight opacity-0 transition-all duration-700 translate-y-8 absolute w-full left-0 px-4">
                Every Drop <span className="text-primary italic font-serif">Matters</span>
              </h2>
              <h2 ref={text3Ref} className="font-headline-lg text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-[#E3DACD] font-medium tracking-tight opacity-0 transition-all duration-700 translate-y-8 absolute w-full left-0 px-4">
                The True <span className="text-primary italic font-serif">Lounge</span> Experience
              </h2>
            </>
          )}
        </div>
      </div>
    </section>
  );
};
