import React, { useEffect, useRef } from 'react';

export const ScrollSequence: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    // Mathematically act like CSS object-fit: cover
    const drawImageCover = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, canvasWidth: number, canvasHeight: number) => {
      const imgRatio = img.width / img.height;
      const canvasRatio = canvasWidth / canvasHeight;
      let renderWidth, renderHeight, xOffset, yOffset;

      if (canvasRatio > imgRatio) {
        renderWidth = canvasWidth;
        renderHeight = canvasWidth / imgRatio;
        xOffset = 0;
        yOffset = (canvasHeight - renderHeight) / 2;
      } else {
        renderWidth = canvasHeight * imgRatio;
        renderHeight = canvasHeight;
        xOffset = (canvasWidth - renderWidth) / 2;
        yOffset = 0;
      }
      ctx.drawImage(img, xOffset, yOffset, renderWidth, renderHeight);
    };

    const frameCount = 120;
    const currentFrame = (index: number) => `/frames/ezgif-frame-${index.toString().padStart(3, '0')}.jpg`;

    const images: HTMLImageElement[] = [];
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

    for (let i = 1; i <= frameCount; i++) {
      const img = new Image();
      img.src = currentFrame(i);
      img.onload = () => {
        loadedImages++;
        if (loadedImages === 1) {
          drawImageCover(context, img, window.innerWidth, window.innerHeight);
        }
      };
      images.push(img);
    }

    const handleScroll = () => {
      const section = document.getElementById('scroll-sequence-section');
      if (!section) return;
      
      const rect = section.getBoundingClientRect();
      const sectionTop = rect.top;
      const sectionHeight = rect.height;
      const windowHeight = window.innerHeight;

      const scrollableDistance = sectionHeight - windowHeight;
      let progress = -sectionTop / scrollableDistance;
      progress = Math.max(0, Math.min(1, progress));
      
      const frameIndex = Math.floor(progress * (frameCount - 1));
      
      if (images[frameIndex] && images[frameIndex].complete) {
        requestAnimationFrame(() => {
          // Clear before draw just in case
          context.clearRect(0, 0, window.innerWidth, window.innerHeight);
          drawImageCover(context, images[frameIndex], window.innerWidth, window.innerHeight);
          
          // Handle text overlays based on progress inside rAF to avoid DOM thrashing
          const t1 = document.getElementById('scroll-text-1');
          const t2 = document.getElementById('scroll-text-2');
          const t3 = document.getElementById('scroll-text-3');
          
          if (t1) {
            if (progress > 0.1 && progress < 0.3) {
              t1.style.opacity = '1';
              t1.style.transform = 'translateY(0)';
            } else {
              t1.style.opacity = '0';
              t1.style.transform = 'translateY(2rem)';
            }
          }
          
          if (t2) {
            if (progress > 0.4 && progress < 0.6) {
              t2.style.opacity = '1';
              t2.style.transform = 'translateY(0)';
            } else {
              t2.style.opacity = '0';
              t2.style.transform = 'translateY(2rem)';
            }
          }
          
          if (t3) {
            if (progress > 0.7 && progress < 0.9) {
              t3.style.opacity = '1';
              t3.style.transform = 'translateY(0)';
            } else {
              t3.style.opacity = '0';
              t3.style.transform = 'translateY(2rem)';
            }
          }
        });
      }
    };

    let resizeTimeout: ReturnType<typeof setTimeout>;
    const handleResizeDebounced = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(resizeCanvas, 150);
    };

    window.addEventListener('resize', handleResizeDebounced);
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    setTimeout(handleScroll, 100);

    return () => {
      window.removeEventListener('resize', handleResizeDebounced);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <section id="scroll-sequence-section" className="relative w-full h-[800vh] bg-background">
      <div 
        className="sticky top-0 w-full h-screen overflow-hidden flex items-center justify-center"
        style={{ maskImage: 'radial-gradient(circle, black 40%, transparent 100%)', WebkitMaskImage: 'radial-gradient(circle, black 40%, transparent 100%)' }}
      >
        <canvas 
          ref={canvasRef}
          id="scroll-video-canvas" 
          className="absolute inset-0 w-full h-full opacity-60"
          style={{ filter: 'contrast(1.25) brightness(0.9) saturate(1.1)' }}
        />
        
        {/* Dark overlays to blend image into background */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-transparent" />
        
        {/* Floating text that appears during scroll */}
        <div className="relative z-10 max-w-[1320px] mx-auto px-4 sm:px-6 w-full flex flex-col items-center justify-center text-center">
          <h2 id="scroll-text-1" className="font-headline-lg text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-[#E3DACD] font-medium tracking-tight opacity-0 transition-all duration-700 translate-y-8 absolute w-full left-0 px-4">
            Crafted to <span className="text-primary italic font-serif">Perfection</span>
          </h2>
          <h2 id="scroll-text-2" className="font-headline-lg text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-[#E3DACD] font-medium tracking-tight opacity-0 transition-all duration-700 translate-y-8 absolute w-full left-0 px-4">
            Every Drop <span className="text-primary italic font-serif">Matters</span>
          </h2>
          <h2 id="scroll-text-3" className="font-headline-lg text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-[#E3DACD] font-medium tracking-tight opacity-0 transition-all duration-700 translate-y-8 absolute w-full left-0 px-4">
            The True <span className="text-primary italic font-serif">Lounge</span> Experience
          </h2>
        </div>
      </div>
    </section>
  );
};
