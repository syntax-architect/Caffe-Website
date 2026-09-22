import React, { useEffect, useRef } from 'react';

export const ScrollSequence: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const text1Ref = useRef<HTMLHeadingElement>(null);
  const text2Ref = useRef<HTMLHeadingElement>(null);
  const text3Ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    // Mathematically act like CSS object-fit: cover
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

    // 1. Load the first frame immediately so the canvas isn't empty
    const firstImg = new Image();
    firstImg.src = currentFrame(1);
    firstImg.onload = () => {
      loadedImages++;
      drawImageCover(context, firstImg, window.innerWidth, window.innerHeight);
    };
    images[0] = firstImg;

    // 2. Defer loading the remaining 119 frames to prevent clogging the network queue
    // which was causing other important images on the phone to load very slowly.
    const loadRemainingFrames = () => {
      let currentIndex = 2;
      
      const loadChunk = () => {
        const chunkLimit = Math.min(currentIndex + 10, frameCount + 1); // Load 10 frames at a time
        for (let i = currentIndex; i < chunkLimit; i++) {
          const img = new Image();
          img.decoding = 'async';
          img.src = currentFrame(i);
          img.onload = () => loadedImages++;
          images[i - 1] = img;
        }
        currentIndex = chunkLimit;
        
        if (currentIndex <= frameCount) {
          setTimeout(loadChunk, 150); // Small pause to let other network requests breathe
        }
      };
      
      loadChunk();
    };

    // Wait for the initial page load to finish before pulling the heavy sequence
    if (document.readyState === 'complete') {
      setTimeout(loadRemainingFrames, 500);
    } else {
      window.addEventListener('load', () => setTimeout(loadRemainingFrames, 500));
    }

    let ticking = false;
    let lastFrameIndex = -1;

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
      
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (images[frameIndex] && images[frameIndex].complete) {
            // Only redraw canvas if the frame actually changed
            if (frameIndex !== lastFrameIndex) {
              context.clearRect(0, 0, window.innerWidth, window.innerHeight);
              drawImageCover(context, images[frameIndex], window.innerWidth, window.innerHeight);
              lastFrameIndex = frameIndex;
            }
            
            // Handle text overlays
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
          <h2 ref={text1Ref} className="font-headline-lg text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-[#E3DACD] font-medium tracking-tight opacity-0 transition-all duration-700 translate-y-8 absolute w-full left-0 px-4">
            Crafted to <span className="text-primary italic font-serif">Perfection</span>
          </h2>
          <h2 ref={text2Ref} className="font-headline-lg text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-[#E3DACD] font-medium tracking-tight opacity-0 transition-all duration-700 translate-y-8 absolute w-full left-0 px-4">
            Every Drop <span className="text-primary italic font-serif">Matters</span>
          </h2>
          <h2 ref={text3Ref} className="font-headline-lg text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-[#E3DACD] font-medium tracking-tight opacity-0 transition-all duration-700 translate-y-8 absolute w-full left-0 px-4">
            The True <span className="text-primary italic font-serif">Lounge</span> Experience
          </h2>
        </div>
      </div>
    </section>
  );
};
