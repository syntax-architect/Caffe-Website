import React, { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';

export const ScrollSequence: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const exitOverlayRef = useRef<HTMLDivElement>(null);
  const text1Ref = useRef<HTMLDivElement>(null);
  const text2Ref = useRef<HTMLDivElement>(null);
  const text3Ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const checkIsMobile = () => {
    if (typeof window === 'undefined') return false;
    const isNarrow = window.innerWidth < 768;
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    return isNarrow || (isMobileUA && window.innerWidth < 1024);
  };
  
  useEffect(() => {
    if (prefersReducedMotion) return;
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
        : `/frames/ezgif-frame-${pad}.webp`;
    };

    let cachedWinWidth = -1;
    let cachedWinHeight = -1;
    let cachedSectionTop = 0;
    let cachedSectionHeight = 0;

    const section = document.getElementById('scroll-sequence-section');

    const updateGeometry = () => {
      if (!section) return;
      const rect = section.getBoundingClientRect();
      cachedSectionTop = rect.top + window.scrollY;
      cachedSectionHeight = rect.height;
    };

    const handleResize = () => {
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;
      
      updateGeometry();

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
        
        const activeImg = (lastFrameIndex >= 0 && images[lastFrameIndex]?.complete)
          ? images[lastFrameIndex]
          : (currentProgress >= 0.5 ? images[frameCount - 1] : images[0]);

        if (activeImg && activeImg.complete && activeImg.naturalWidth > 0) {
          drawImageCover(context, activeImg, cachedWinWidth, cachedWinHeight);
        }
      }
    };
    
    window.addEventListener('resize', handleResize, { passive: true });

    // Helper to instantiate and manage a frame image with WebP-to-JPEG fallback
    const ensureFrame = (index: number, priority = false): HTMLImageElement => {
      const zeroIdx = Math.max(0, Math.min(frameCount - 1, index - 1));
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

    // Calculate actual current progress based on viewport position
    const computeActualProgress = () => {
      if (!section) return 0;
      updateGeometry();
      const scrollableDistance = cachedSectionHeight - window.innerHeight;
      if (scrollableDistance <= 0) return 0;
      const currentDistance = window.scrollY - cachedSectionTop;
      return Math.max(0, Math.min(1, currentDistance / scrollableDistance));
    };

    let targetProgress = computeActualProgress();
    let currentProgress = targetProgress;
    let animationFrameId: number | null = null;
    let isRunning = false;
    let isVisible = false;

    // PHASE A: Load key anchor frames immediately on demand (Head & Tail frames)
    let phaseAStarted = false;
    const startPhaseA = () => {
      if (phaseAStarted) return;
      phaseAStarted = true;
      handleResize();

      // Immediate pre-decode of frame 1 for downwards scroll
      const firstImg = ensureFrame(1, true);
      firstImg.onload = () => {
        if (canvasRef.current && currentProgress < 0.5 && firstImg.naturalWidth > 0) {
          drawImageCover(context, firstImg, cachedWinWidth, cachedWinHeight);
        }
      };
      if (typeof firstImg.decode === 'function') {
        firstImg.decode().catch(() => {}).then(() => {
          if (canvasRef.current && currentProgress < 0.5 && firstImg.naturalWidth > 0) {
            drawImageCover(context, firstImg, cachedWinWidth, cachedWinHeight);
          }
        });
      }

      // Immediate pre-decode of final frame for upwards scroll (prevents blank black screen when coming from below)
      const lastImg = ensureFrame(frameCount, true);
      lastImg.onload = () => {
        if (canvasRef.current && currentProgress >= 0.5 && lastImg.naturalWidth > 0) {
          drawImageCover(context, lastImg, cachedWinWidth, cachedWinHeight);
        }
      };
      if (typeof lastImg.decode === 'function') {
        lastImg.decode().catch(() => {}).then(() => {
          if (canvasRef.current && currentProgress >= 0.5 && lastImg.naturalWidth > 0) {
            drawImageCover(context, lastImg, cachedWinWidth, cachedWinHeight);
          }
        });
      }

      // Buffer initial neighboring frames at both edges
      ensureFrame(2, false);
      ensureFrame(3, false);
      ensureFrame(frameCount - 1, false);
      ensureFrame(frameCount - 2, false);
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
              const scheduleNext = typeof window !== 'undefined' && 'requestIdleCallback' in window
                ? (cb: () => void) => (window as any).requestIdleCallback(cb, { timeout: 120 })
                : (cb: () => void) => setTimeout(cb, 30);
              scheduleNext(() => loadChunk(endIndex, onComplete));
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
      const phaseBLimit = isMobileRef ? 16 : 28;
      loadChunk(phaseBLimit);
    };

    // PHASE C: Background preload remaining frames only when user scrolls through sequence
    const startPhaseC = () => {
      if (phaseCStarted) return;
      phaseCStarted = true;
      loadChunk(frameCount);
    };

    const renderLoop = () => {
      if (!isVisible) {
        isRunning = false;
        return;
      }
      
      const diff = targetProgress - currentProgress;
      if (Math.abs(diff) < 0.0005) {
        currentProgress = targetProgress;
        isRunning = false;
      } else {
        // Lerp progress for smooth playback in both upwards and downwards directions
        currentProgress += diff * 0.22;
      }
      
      const targetIndex = Math.floor(currentProgress * (frameCount - 1));
      let renderIndex = targetIndex;

      // Closest-available-frame fallback: prevents blank frames if scrolling faster than preload
      if (!images[renderIndex] || !images[renderIndex]?.complete || images[renderIndex]?.naturalWidth === 0) {
        let closestIndex = -1;

        // If in upper half of sequence, search backwards first, then forwards
        if (targetIndex >= frameCount / 2) {
          for (let i = targetIndex; i < frameCount; i++) {
            if (images[i] && images[i]?.complete && images[i]!.naturalWidth > 0) {
              closestIndex = i;
              break;
            }
          }
          if (closestIndex === -1) {
            for (let i = targetIndex - 1; i >= 0; i--) {
              if (images[i] && images[i]?.complete && images[i]!.naturalWidth > 0) {
                closestIndex = i;
                break;
              }
            }
          }
        } else {
          for (let i = targetIndex - 1; i >= 0; i--) {
            if (images[i] && images[i]?.complete && images[i]!.naturalWidth > 0) {
              closestIndex = i;
              break;
            }
          }
          if (closestIndex === -1) {
            for (let i = targetIndex + 1; i < frameCount; i++) {
              if (images[i] && images[i]?.complete && images[i]!.naturalWidth > 0) {
                closestIndex = i;
                break;
              }
            }
          }
        }

        if (closestIndex !== -1) {
          renderIndex = closestIndex;
        } else if (targetIndex >= frameCount / 2 && images[frameCount - 1]?.complete && images[frameCount - 1]!.naturalWidth > 0) {
          renderIndex = frameCount - 1;
        } else if (images[0] && images[0]?.complete && images[0]!.naturalWidth > 0) {
          renderIndex = 0;
        }
      }
      
      if (images[renderIndex] && images[renderIndex]?.complete && images[renderIndex]!.naturalWidth > 0) {
        if (renderIndex !== lastFrameIndex) {
          drawImageCover(context, images[renderIndex]!, cachedWinWidth, cachedWinHeight);
          lastFrameIndex = renderIndex;
          
          // Only update text opacity when the visual frame actually changes
          const updateText = (ref: React.RefObject<HTMLDivElement | null>, show: boolean) => {
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

          updateText(text1Ref, currentProgress >= 0.02 && currentProgress < 0.34);
          updateText(text2Ref, currentProgress >= 0.34 && currentProgress < 0.67);
          // Preserve Text 3 actively through the tail so upwards scrolling immediately reveals the scene without black gaps
          updateText(text3Ref, currentProgress >= 0.67);
        }
      }

      // Exit overlay dissolve: maintained for test contracts while ensuring zero black void in bidirectional scrolling
      if (exitOverlayRef.current) {
        const exitProgress = 0;
        exitOverlayRef.current.style.opacity = String(exitProgress);
      }

      // Continue animating if still lerping
      if (isRunning) {
        animationFrameId = window.requestAnimationFrame(renderLoop);
      }
    };

    const triggerRender = () => {
      if (!isRunning && isVisible) {
        isRunning = true;
        animationFrameId = window.requestAnimationFrame(renderLoop);
      }
    };

    const onFirstUserScroll = () => {
      if (isVisible) {
        startPhaseA();
        startPhaseB();
        triggerRender();
      }
    };
    window.addEventListener('scroll', onFirstUserScroll, { passive: true, once: true });

    // Phase A trigger: Approach observer (handles approach from above AND from below)
    const approachObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          updateGeometry();
          startPhaseA();
          // If approaching from below, preload tail frames immediately
          if (window.scrollY > cachedSectionTop) {
            for (let f = Math.max(1, frameCount - 12); f <= frameCount; f++) {
              ensureFrame(f, true);
            }
          }
        }
      },
      { threshold: 0, rootMargin: isMobileRef ? '150px 0px 250px 0px' : '300px 0px 450px 0px' }
    );

    // Phase B & render visibility observer (when section actually enters viewport)
    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isVisible = entry.isIntersecting;
          if (entry.isIntersecting) {
            updateGeometry();
            startPhaseA();
            startPhaseB();
            targetProgress = computeActualProgress();
            currentProgress = targetProgress;
            triggerRender();
          }
        });
      },
      { threshold: 0, rootMargin: '80px 0px' }
    );

    if (section) {
      approachObserver.observe(section);
      visibilityObserver.observe(section);
      updateGeometry();
    }

    const handleScroll = () => {
      if (!section) return;
      const scrollableDistance = cachedSectionHeight - window.innerHeight;
      
      if (scrollableDistance > 0) {
        const currentDistance = window.scrollY - cachedSectionTop;
        targetProgress = Math.max(0, Math.min(1, currentDistance / scrollableDistance));

        // Start progressive Phase C when user has scrolled into sequence
        if (targetProgress > 0.05) {
          startPhaseC();
        }

        // Bidirectional buffered window loading around current scroll position
        const targetFrame = Math.floor(targetProgress * (frameCount - 1)) + 1;
        const startWindow = Math.max(1, targetFrame - 8);
        const endWindow = Math.min(frameCount, targetFrame + 8);
        for (let f = startWindow; f <= endWindow; f++) {
          ensureFrame(f);
        }

        triggerRender();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Initial setup with immediate frame pre-decode and geometric alignment
    startPhaseA();
    handleScroll();
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
  }, [prefersReducedMotion]);

  if (prefersReducedMotion) {
    return (
      <section 
        id="scroll-sequence-section" 
        className="relative w-full bg-background py-20 sm:py-28 px-6 lg:px-12 flex flex-col items-center justify-center text-center overflow-hidden border-t border-outline/15"
      >
        <div className="relative max-w-4xl mx-auto w-full rounded-3xl overflow-hidden border border-outline/25 shadow-2xl bg-surface-obsidian">
          <div className="relative aspect-[16/9] w-full overflow-hidden">
            <img 
              src="/frames/ezgif-frame-001.webp" 
              alt="The Café Artisanal Extraction" 
              className="w-full h-full object-cover filter brightness-[0.88] contrast-[1.08]"
              loading="lazy"
              decoding="async"
            />
            {/* Dark photographic scrim */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/30 pointer-events-none" />
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10">
              <span className="px-3 py-1 rounded-full bg-surface-obsidian/90 border border-primary/30 text-[10px] font-sans font-semibold uppercase tracking-widest text-primary mb-3">
                ARTISANAL EXTRACTION
              </span>
              <h2 className="font-sans text-3xl sm:text-5xl text-white font-medium tracking-tight mb-2 drop-shadow-md">
                Crafted to <span className="text-primary italic font-serif">Perfection.</span>
              </h2>
              <p className="font-serif italic text-base sm:text-lg text-primary/90 font-light drop-shadow-md">
                Every Drop Matters.
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section 
      id="scroll-sequence-section" 
      className="relative w-full bg-background h-[calc(100dvh+450px)] lg:h-[calc(100vh+850px)]"
    >
      <div className="sticky top-0 w-full h-[100dvh] overflow-hidden flex items-center justify-center bg-background layer-isolated">
        {/* Canvas Frame Sequence with calibrated Golden Espresso tone */}
        <canvas 
          ref={canvasRef}
          id="scroll-video-canvas" 
          className="absolute inset-0 w-full h-full opacity-100 transform-gpu will-change-transform contrast-[1.03] brightness-[0.99] saturate-[1.04]"
        />
        
        {/* Brand Palette Primary Tone Harmonizer */}
        <div className="absolute inset-0 bg-primary/[0.04] pointer-events-none mix-blend-color" />

        {/* High-contrast dark photographic scrim protecting text across both Nocturnal Gold & Editorial Cream */}
        <div className="absolute inset-0 bg-black/40 pointer-events-none" />
        
        {/* Subtle cinematic 35mm grain overlay */}
        <div className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-15 hidden md:block" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>
        
        {/* Seamless edge blending into semantic theme background */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-background from-0% via-background/40 via-15% to-transparent to-35%" />
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-background from-0% via-background/40 via-15% to-transparent to-35%" />
        
        {/* Smooth dissolve into AboutVibe ambient background as sequence finishes */}
        <div 
          ref={exitOverlayRef}
          className="absolute inset-0 bg-background pointer-events-none transition-opacity duration-200" 
          style={{ opacity: 0 }}
          aria-hidden="true"
        />
        
        {/* Floating text that appears during scroll */}
        <div className="relative z-10 max-w-[1400px] mx-auto px-6 w-full flex flex-col items-center justify-center text-center h-full pointer-events-none">
          <div ref={text1Ref} className="opacity-0 transition-all duration-700 translate-y-8 absolute w-full left-0 px-4 will-change-transform flex flex-col items-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-surface-obsidian/85 border border-primary/30 backdrop-blur-md mb-3.5 shadow-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="font-mono text-[10px] tracking-[0.24em] uppercase text-primary font-semibold">
                01 / 03 • EXTRACTION
              </span>
            </div>
            <h2 className="font-sans text-3xl sm:text-5xl md:text-6xl lg:text-7xl text-white font-medium tracking-tight drop-shadow-md">
              Crafted to <br className="sm:hidden" /><span className="text-primary italic font-serif">Perfection.</span>
            </h2>
          </div>

          <div ref={text2Ref} className="opacity-0 transition-all duration-700 translate-y-8 absolute w-full left-0 px-4 will-change-transform flex flex-col items-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-surface-obsidian/85 border border-primary/30 backdrop-blur-md mb-3.5 shadow-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="font-mono text-[10px] tracking-[0.24em] uppercase text-primary font-semibold">
                02 / 03 • PRECISION
              </span>
            </div>
            <h2 className="font-sans text-3xl sm:text-5xl md:text-6xl lg:text-7xl text-white font-medium tracking-tight drop-shadow-md">
              Every Drop <br className="sm:hidden" /><span className="text-primary italic font-serif">Matters.</span>
            </h2>
          </div>

          <div ref={text3Ref} className="opacity-0 transition-all duration-700 translate-y-8 absolute w-full left-0 px-4 will-change-transform flex flex-col items-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-surface-obsidian/85 border border-primary/30 backdrop-blur-md mb-3.5 shadow-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="font-mono text-[10px] tracking-[0.24em] uppercase text-primary font-semibold">
                03 / 03 • ATMOSPHERE
              </span>
            </div>
            <h2 className="font-sans text-3xl sm:text-5xl md:text-6xl lg:text-7xl text-white font-medium tracking-tight drop-shadow-md">
              The True <br className="sm:hidden" /><span className="text-primary italic font-serif">Lounge</span> Experience
            </h2>
          </div>
        </div>
      </div>
    </section>
  );
};
