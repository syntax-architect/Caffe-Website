import React, { useEffect, useRef } from 'react';

export const ScrollSequence: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const text1Ref = useRef<HTMLHeadingElement>(null);
  const text2Ref = useRef<HTMLHeadingElement>(null);
  const text3Ref = useRef<HTMLHeadingElement>(null);
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);
  
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  useEffect(() => {
    const isMobileRef = window.innerWidth < 768;
    const frameCount = isMobileRef ? 60 : 120;
    let lastFrameIndex = -1;
    let images: HTMLImageElement[] = [];
    
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


    const currentFrame = (index: number) => 
      isMobileRef 
        ? `/frames-mobile/ezgif-frame-${index.toString().padStart(3, '0')}.jpg` 
        : `/frames/ezgif-frame-${index.toString().padStart(3, '0')}.jpg`;

    let cachedWinWidth = window.innerWidth;
    let cachedWinHeight = window.innerHeight;

    const handleResize = () => {
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;
      
      // On mobile, scrolling causes the address bar to hide/show, triggering resize events.
      // We only want to resize the canvas if the width changes (orientation change) 
      // to avoid massive stuttering from canvas reallocation during scroll.
      if (isMobileRef && newWidth === cachedWinWidth) {
        return;
      }
      
      cachedWinWidth = newWidth;
      cachedWinHeight = newHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap DPR at 2 for performance
      
      // Only set canvas dimensions if they actually changed to avoid clearing the context
      if (canvas.width !== cachedWinWidth * dpr || canvas.height !== cachedWinHeight * dpr) {
        canvas.width = cachedWinWidth * dpr;
        canvas.height = cachedWinHeight * dpr;
        context.scale(dpr, dpr);
        context.imageSmoothingEnabled = true;
        
        // Use lower smoothing quality on mobile for better performance
        if (!isMobileRef) {
          context.imageSmoothingQuality = 'high';
        }
        
        if (images[0] && images[0].complete) {
          drawImageCover(context, images[0], cachedWinWidth, cachedWinHeight);
        }
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();

    const firstImg = new Image();
    firstImg.src = currentFrame(1);
    firstImg.onload = () => {
      drawImageCover(context, firstImg, cachedWinWidth, cachedWinHeight);
    };
    images[0] = firstImg;

    const loadRemainingFrames = () => {
      let currentIndex = 2;
      const loadChunk = () => {
        // Use a smaller chunk size to prevent network and decode spiking on mobile
        const chunkLimit = Math.min(currentIndex + 4, frameCount + 1);
        let loadedInChunk = 0;
        const totalInChunk = chunkLimit - currentIndex;
        
        for (let i = currentIndex; i < chunkLimit; i++) {
          const img = new Image();
          img.decoding = 'async'; // Prevents decode from blocking the main thread
          img.src = currentFrame(i);
          
          const onImageDone = () => {
            loadedInChunk++;
            if (loadedInChunk === totalInChunk) {
              currentIndex = chunkLimit;
              if (currentIndex <= frameCount) {
                // Yield to main thread before loading next chunk
                setTimeout(loadChunk, 30);
              }
            }
          };
          
          img.onload = () => {
            onImageDone();
          };
          img.onerror = onImageDone;
          images[i - 1] = img;
        }
      };
      loadChunk();
    };

    if (document.readyState === 'complete') {
      setTimeout(loadRemainingFrames, 1000); 
    } else {
      window.addEventListener('load', () => setTimeout(loadRemainingFrames, 1000));
    }
    
    let targetProgress = 0;
    let currentProgress = 0;
    let animationFrameId: number;
    let isVisible = true;

    // Use IntersectionObserver to pause rendering when the section is not in view
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        isVisible = entry.isIntersecting;
      });
    }, { threshold: 0, rootMargin: '200px' });
    
    const section = document.getElementById('scroll-sequence-section');
    if (section) {
      observer.observe(section);
    }

    const handleScroll = () => {
      if (!isVisible || !section) return;
      // Dynamically calculate bounding rect to avoid stale position bugs from lazy-loaded elements
      const rect = section.getBoundingClientRect();
      const scrollableDistance = rect.height - window.innerHeight;
      
      if (scrollableDistance > 0) {
        // rect.top is the distance from viewport top to section top.
        // It becomes negative as we scroll down into the section.
        targetProgress = Math.max(0, Math.min(1, -rect.top / scrollableDistance));
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Initial setup
    handleScroll();
    currentProgress = targetProgress;

    const renderLoop = () => {
      animationFrameId = window.requestAnimationFrame(renderLoop);
      
      // Stop processing if component is unmounted or not visible
      if (!isVisible) return;
      
      // Calculate diff to see if we need to update
      const diff = targetProgress - currentProgress;
      
      // If we are close enough to target, don't waste CPU cycles recalculating
      if (Math.abs(diff) < 0.0005) return;

      // Lerp progress for smooth playback, reducing mobile lag and jitter
      currentProgress += diff * 0.15; // Faster lerp for snappier response
      
      const frameIndex = Math.floor(currentProgress * (frameCount - 1));
      
      if (images[frameIndex] && images[frameIndex].complete) {
        if (frameIndex !== lastFrameIndex) {
          drawImageCover(context, images[frameIndex], cachedWinWidth, cachedWinHeight);
          lastFrameIndex = frameIndex;
          
          // Only update text opacity when the visual frame actually changes
          // to prevent unnecessary layout/style calculations 60 times a second
          const updateText = (ref: React.RefObject<HTMLHeadingElement | null>, show: boolean) => {
            if (ref.current) {
              const isShowing = ref.current.style.opacity === '1';
              if (show && !isShowing) {
                ref.current.style.opacity = '1';
                ref.current.style.transform = 'translateY(0)';
              } else if (!show && (isShowing || ref.current.style.opacity === '')) {
                ref.current.style.opacity = '0';
                ref.current.style.transform = 'translateY(2rem)';
              }
            }
          };

          updateText(text1Ref, currentProgress > 0.1 && currentProgress < 0.3);
          updateText(text2Ref, currentProgress > 0.4 && currentProgress < 0.6);
          updateText(text3Ref, currentProgress > 0.7 && currentProgress < 0.9);
        }
      }
    };
    
    renderLoop();

    return () => {
      if (section) observer.unobserve(section);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
      window.cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <section 
      id="scroll-sequence-section" 
      className="relative w-full bg-background"
      style={{ height: isMobile ? 'calc(100vh + 800px)' : 'calc(100vh + 3200px)' }}
    >
      <div 
        className="sticky top-0 w-full h-[100dvh] overflow-hidden flex items-center justify-center bg-black"
        style={isMobile ? {} : { maskImage: 'radial-gradient(circle, black 40%, transparent 100%)', WebkitMaskImage: 'radial-gradient(circle, black 40%, transparent 100%)' }}
      >
        {/* Canvas Frame Sequence (Used on both mobile and desktop) */}
        <canvas 
          ref={canvasRef}
          id="scroll-video-canvas" 
          className="absolute inset-0 w-full h-full opacity-60 transform-gpu will-change-transform"
          style={isMobile ? {} : { filter: 'contrast(1.25) brightness(0.9) saturate(1.1)' }}
        />
        
        {/* Subtle noise overlay */}
        <div className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-20" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>
        
        {/* Dark overlays to blend image into background */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-transparent" />
        
        {/* Floating text that appears during scroll */}
        <div className="relative z-10 max-w-[1320px] mx-auto px-4 sm:px-6 w-full flex flex-col items-center justify-center text-center h-full">
          <h2 ref={text1Ref} className="font-headline-lg text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-on-surface font-medium tracking-tight opacity-0 transition-all duration-700 translate-y-8 absolute w-full left-0 px-4 will-change-transform">
            Crafted to <span className="text-primary italic font-serif">Perfection</span>
          </h2>
          <h2 ref={text2Ref} className="font-headline-lg text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-on-surface font-medium tracking-tight opacity-0 transition-all duration-700 translate-y-8 absolute w-full left-0 px-4 will-change-transform">
            Every Drop <span className="text-primary italic font-serif">Matters</span>
          </h2>
          <h2 ref={text3Ref} className="font-headline-lg text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-on-surface font-medium tracking-tight opacity-0 transition-all duration-700 translate-y-8 absolute w-full left-0 px-4 will-change-transform">
            The True <span className="text-primary italic font-serif">Lounge</span> Experience
          </h2>
        </div>
      </div>
    </section>
  );
};
