import React, { useEffect, useRef } from 'react';

export const ScrollSequence: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const text1Ref = useRef<HTMLHeadingElement>(null);
  const text2Ref = useRef<HTMLHeadingElement>(null);
  const text3Ref = useRef<HTMLHeadingElement>(null);
  const checkIsMobile = () => {
    if (typeof window === 'undefined') return false;
    const hasTouch = window.matchMedia('(pointer: coarse)').matches;
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isNarrow = window.innerWidth < 768;
    return hasTouch || isMobileUA || isNarrow;
  };
  
  useEffect(() => {
    const isMobileRef = checkIsMobile();
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


    const currentFrame = (index: number) => {
      const pad = index.toString().padStart(3, '0');
      return isMobileRef
        ? `/frames-mobile/ezgif-frame-${pad}.webp`
        : `/frames/ezgif-frame-${pad}.jpg`;
    };

    let cachedWinWidth = -1;
    let cachedWinHeight = -1;

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
      const dpr = Math.min(window.devicePixelRatio || 1, 2); // Allow sharp retina rendering up to 2x DPR
      
      // Only set canvas dimensions if they actually changed to avoid clearing the context
      if (canvas.width !== cachedWinWidth * dpr || canvas.height !== cachedWinHeight * dpr) {
        canvas.width = cachedWinWidth * dpr;
        canvas.height = cachedWinHeight * dpr;
        // Reset transform to identity before applying new scale to prevent cumulative scaling
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.scale(dpr, dpr);
        context.imageSmoothingEnabled = true;
        
        // Use lower smoothing quality on mobile for better performance
        if (!isMobileRef) {
          context.imageSmoothingQuality = 'high';
        }
        
        if (images[0] && images[0].complete && images[0].naturalWidth > 0) {
          drawImageCover(context, images[0], cachedWinWidth, cachedWinHeight);
        }
      }
    };
    
    window.addEventListener('resize', handleResize, { passive: true });

    // Helper to instantiate and manage a frame image with WebP-to-JPEG fallback
    const ensureFrame = (index: number, priority = false): HTMLImageElement => {
      const zeroIdx = index - 1;
      if (images[zeroIdx]) {
        return images[zeroIdx]!;
      }
      const img = new Image();
      img.decoding = 'async';
      if (priority && 'fetchPriority' in img) {
        (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = 'high';
      }
      const primarySrc = currentFrame(index);
      img.src = primarySrc;
      img.onerror = () => {
        // Gracefully fallback to .jpg if .webp ever fails to load
        if (primarySrc.endsWith('.webp')) {
          img.src = primarySrc.replace('.webp', '.jpg');
        }
      };
      images[zeroIdx] = img;
      return img;
    };

    // PHASE A: Load initial frames strictly on demand when user scrolls towards sequence
    let phaseAStarted = false;
    const startPhaseA = () => {
      if (phaseAStarted) return;
      phaseAStarted = true;
      handleResize();
      const firstImg = ensureFrame(1, !isMobileRef);
      firstImg.onload = () => {
        if (canvasRef.current && firstImg.naturalWidth > 0) {
          drawImageCover(context, firstImg, cachedWinWidth, cachedWinHeight);
        }
      };
      ensureFrame(2, false);
      ensureFrame(3, false);
    };

    // Chunks loader for Phase B and Phase C
    let phaseBStarted = false;
    let phaseCStarted = false;
    let nextPreloadIndex = 4;

    const loadChunk = (endIndex: number, onComplete?: () => void) => {
      if (nextPreloadIndex > endIndex || nextPreloadIndex > frameCount) {
        onComplete?.();
        return;
      }

      const chunkSize = isMobileRef ? 4 : 6;
      const chunkLimit = Math.min(nextPreloadIndex + chunkSize, endIndex + 1);
      let loadedInChunk = 0;
      const totalInChunk = chunkLimit - nextPreloadIndex;

      for (let i = nextPreloadIndex; i < chunkLimit; i++) {
        const img = ensureFrame(i);
        const onDone = () => {
          loadedInChunk++;
          if (loadedInChunk === totalInChunk) {
            nextPreloadIndex = chunkLimit;
            if (nextPreloadIndex <= endIndex && nextPreloadIndex <= frameCount) {
              setTimeout(() => loadChunk(endIndex, onComplete), 25);
            } else {
              onComplete?.();
            }
          }
        };
        if (img.complete && img.naturalWidth > 0) {
          onDone();
        } else {
          img.addEventListener('load', onDone, { once: true });
          img.addEventListener('error', onDone, { once: true });
        }
      }
    };

    // PHASE B: Preload initial small chunk when section enters viewport
    const startPhaseB = () => {
      if (phaseBStarted) return;
      phaseBStarted = true;
      const phaseBLimit = isMobileRef ? 12 : 24;
      loadChunk(phaseBLimit);
    };

    // PHASE C: Background preload remaining frames only when user scrolls through sequence
    const startPhaseC = () => {
      if (phaseCStarted) return;
      phaseCStarted = true;
      loadChunk(frameCount);
    };

    let targetProgress = 0;
    let currentProgress = 0;
    let animationFrameId: number | null = null;
    let isRunning = false;
    let isVisible = false;

    const renderLoop = () => {
      if (!isVisible) {
        isRunning = false;
        return;
      }
      
      const diff = targetProgress - currentProgress;
      if (Math.abs(diff) < 0.0005) {
        currentProgress = targetProgress;
        isRunning = false;
        return;
      }

      // Lerp progress for smooth playback, reducing mobile lag and jitter
      currentProgress += diff * 0.18; // Snappy, reactive lerp
      
      const targetIndex = Math.floor(currentProgress * (frameCount - 1));
      let renderIndex = targetIndex;

      // Closest-available-frame fallback: prevents blank frames if scrolling faster than preload
      if (!images[renderIndex] || !images[renderIndex]?.complete || images[renderIndex]?.naturalWidth === 0) {
        let closestIndex = -1;
        let minDistance = Infinity;

        // Search backwards first (since earlier frames loaded first)
        for (let i = targetIndex - 1; i >= 0; i--) {
          if (images[i] && images[i]?.complete && images[i]!.naturalWidth > 0) {
            closestIndex = i;
            minDistance = targetIndex - i;
            break;
          }
        }

        // Search forwards if needed
        for (let i = targetIndex + 1; i < frameCount; i++) {
          if (i - targetIndex >= minDistance) break;
          if (images[i] && images[i]?.complete && images[i]!.naturalWidth > 0) {
            closestIndex = i;
            break;
          }
        }

        if (closestIndex !== -1) {
          renderIndex = closestIndex;
        } else if (images[0] && images[0]?.complete && images[0]!.naturalWidth > 0) {
          renderIndex = 0;
        }
      }
      
      if (images[renderIndex] && images[renderIndex]?.complete && images[renderIndex]!.naturalWidth > 0) {
        if (renderIndex !== lastFrameIndex) {
          drawImageCover(context, images[renderIndex]!, cachedWinWidth, cachedWinHeight);
          lastFrameIndex = renderIndex;
          
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

      // Continue animating until target reached
      animationFrameId = window.requestAnimationFrame(renderLoop);
    };

    const triggerRender = () => {
      if (!isRunning && isVisible) {
        isRunning = true;
        animationFrameId = window.requestAnimationFrame(renderLoop);
      }
    };

    let userHasScrolled = typeof window !== 'undefined' && window.scrollY > 10;
    const onFirstUserScroll = () => {
      userHasScrolled = true;
      if (isVisible) {
        startPhaseA();
        startPhaseB();
        triggerRender();
      }
    };
    window.addEventListener('scroll', onFirstUserScroll, { passive: true, once: true });

    // Phase A trigger: Approach observer (only when user scrolls near within 150px)
    const section = document.getElementById('scroll-sequence-section');
    const approachObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && userHasScrolled) {
          startPhaseA();
        }
      },
      { threshold: 0, rootMargin: isMobileRef ? '100px 0px 100px 0px' : '250px 0px 250px 0px' }
    );

    // Phase B & render visibility observer (when section actually enters viewport)
    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isVisible = entry.isIntersecting;
          if (entry.isIntersecting && userHasScrolled) {
            startPhaseA();
            startPhaseB();
            triggerRender();
          }
        });
      },
      { threshold: 0, rootMargin: '50px 0px' }
    );

    if (section) {
      approachObserver.observe(section);
      visibilityObserver.observe(section);
    }

    const handleScroll = () => {
      if (!isVisible || !section) return;
      const rect = section.getBoundingClientRect();
      const scrollableDistance = rect.height - window.innerHeight;
      
      if (scrollableDistance > 0) {
        targetProgress = Math.max(0, Math.min(1, -rect.top / scrollableDistance));

        // Start progressive Phase C when user has scrolled 10% through the sequence
        if (targetProgress > 0.1) {
          startPhaseC();
        }

        // Prioritize buffered loading around current scroll position if user scrolls ahead
        const targetFrame = Math.floor(targetProgress * (frameCount - 1)) + 1;
        const startWindow = Math.max(1, targetFrame - 2);
        const endWindow = Math.min(frameCount, targetFrame + 6);
        for (let f = startWindow; f <= endWindow; f++) {
          ensureFrame(f);
        }

        triggerRender();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Initial setup without forced synchronous layout calculation
    targetProgress = 0;
    currentProgress = 0;
    triggerRender();

    return () => {
      if (section) {
        approachObserver.unobserve(section);
        visibilityObserver.unobserve(section);
      }
      approachObserver.disconnect();
      visibilityObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }

      // Clean up image memory references to prevent leaks
      images.forEach((img) => {
        if (img) {
          img.onload = null;
          img.onerror = null;
          img.src = '';
        }
      });
      images = [];
    };
  }, []);

  return (
    <section 
      id="scroll-sequence-section" 
      className="relative w-full bg-background h-[calc(100dvh+500px)] lg:h-[calc(100vh+2000px)]"
    >
      <div className="sticky top-0 w-full h-[100dvh] overflow-hidden flex items-center justify-center bg-[#0a0807]">
        {/* Canvas Frame Sequence with calibrated Golden Espresso tone */}
        <canvas 
          ref={canvasRef}
          id="scroll-video-canvas" 
          className="absolute inset-0 w-full h-full opacity-100 transform-gpu will-change-transform contrast-[1.10] brightness-[0.98] saturate-[1.08] sepia-[0.14]"
        />
        
        {/* Brand Palette Gold Tone Harmonizer */}
        <div className="absolute inset-0 bg-[#D4AF37]/[0.04] pointer-events-none mix-blend-color" />
        
        {/* Subtle cinematic 35mm grain overlay */}
        <div className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-15 hidden md:block" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>
        
        {/* Seamless edge blending into deep espresso (#0a0807) */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#0a0807] from-0% via-[#0a0807]/30 via-15% to-transparent to-35%" />
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-[#0a0807] from-0% via-[#0a0807]/30 via-15% to-transparent to-35%" />
        
        {/* Floating text that appears during scroll */}
        <div className="relative z-10 max-w-[1400px] mx-auto px-6 w-full flex flex-col items-center justify-center text-center h-full">
          <h2 ref={text1Ref} className="font-sans text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-[#F5F2F0] font-medium tracking-tighter opacity-0 transition-all duration-700 translate-y-8 absolute w-full left-0 px-4 will-change-transform">
            Crafted to <br className="sm:hidden" /><span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB] italic font-serif">Perfection.</span>
          </h2>
          <h2 ref={text2Ref} className="font-sans text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-[#F5F2F0] font-medium tracking-tighter opacity-0 transition-all duration-700 translate-y-8 absolute w-full left-0 px-4 will-change-transform">
            Every Drop <br className="sm:hidden" /><span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB] italic font-serif">Matters.</span>
          </h2>
          <h2 ref={text3Ref} className="font-sans text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-[#F5F2F0] font-medium tracking-tighter opacity-0 transition-all duration-700 translate-y-8 absolute w-full left-0 px-4 will-change-transform">
            The True <br className="sm:hidden" /><span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB] italic font-serif">Lounge</span> Experience
          </h2>
        </div>
      </div>
    </section>
  );
};
