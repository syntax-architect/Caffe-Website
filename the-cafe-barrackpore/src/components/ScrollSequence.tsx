import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useReducedMotion } from 'motion/react';
import { useSiteConfig } from '../context/SiteConfigContext';

interface ExtractionActSpec {
  id: string;
  indexLabel: string;
  actCode: string;
  eyebrow: string;
  titleBefore: string;
  titleHighlight: string;
  titleAfter?: string;
  description: string;
  watermark: string;
  /** Normalized scroll range [start, end] within 0..1 */
  window: [number, number];
  /** Peak plateau [plateauStart, plateauEnd] where opacity === 1 */
  plateau: [number, number];
}

const EXTRACTION_ACTS: ExtractionActSpec[] = [
  {
    id: 'act-extraction',
    indexLabel: '01 / 03',
    actCode: 'ACT I · THE EXTRACTION',
    eyebrow: '01 / 03 • EXTRACTION',
    titleBefore: 'Crafted to ',
    titleHighlight: 'Perfection.',
    description:
      'Single-origin Arabica beans, slow-roasted in small batches and ground to micron precision before nine bars of hydraulic pressure awaken the crema.',
    watermark: '93.4°C',
    window: [0.0, 0.31],
    plateau: [0.03, 0.23],
  },
  {
    id: 'act-precision',
    indexLabel: '02 / 03',
    actCode: 'ACT II · THE CREMA',
    eyebrow: '02 / 03 • PRECISION',
    titleBefore: 'Every Drop ',
    titleHighlight: 'Matters.',
    description:
      'Tiger-flecked hazelnut crema meets syrupy dark-cocoa body—pulled to the exact tenth of a gram for an unhurried, velvety mouthfeel.',
    watermark: '9.0 BAR',
    window: [0.34, 0.65],
    plateau: [0.41, 0.58],
  },
  {
    id: 'act-lounge',
    indexLabel: '03 / 03',
    actCode: 'ACT III · UNVEILED',
    eyebrow: '03 / 03 • SANCTUARY', // 03 / 03 • ATMOSPHERE
    titleBefore: 'The True ',
    titleHighlight: 'Lounge',
    titleAfter: ' Experience',
    description:
      'Poured into preheated porcelain beneath 2200K tungsten filament glow at Barrackpore’s premier nocturnal dining retreat.',
    watermark: '2200K',
    window: [0.68, 1.0],
    plateau: [0.75, 0.96],
  },
];

/**
 * Pure envelope calculator guaranteeing zero overlap between acts.
 * Outside [window[0], window[1]], opacity is strictly 0.
 */
function computeActEnvelope(
  progress: number,
  window: [number, number],
  plateau: [number, number]
): { opacity: number; translateY: number; scale: number; blur: number; isVisible: boolean } {
  const [start, end] = window;
  const [pStart, pEnd] = plateau;

  if (progress < start || progress > end) {
    return { opacity: 0, translateY: 28, scale: 0.97, blur: 6, isVisible: false };
  }

  let opacity = 1;
  if (progress < pStart) {
    opacity = (progress - start) / Math.max(0.001, pStart - start);
  } else if (progress > pEnd) {
    opacity = (end - progress) / Math.max(0.001, end - pEnd);
  }

  const clampedOpacity = Math.max(0, Math.min(1, opacity));
  const localNorm = (progress - start) / Math.max(0.001, end - start); // 0..1
  const translateY = (0.5 - localNorm) * -28; // +14px entry -> 0px center -> -14px exit
  const scale = 0.98 + clampedOpacity * 0.02;
  const blur = (1 - clampedOpacity) * 4;

  return {
    opacity: clampedOpacity,
    translateY,
    scale,
    blur,
    isVisible: clampedOpacity > 0.01,
  };
}

export const ScrollSequence: React.FC = () => {
  const { engineConfig } = useSiteConfig();
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const exitOverlayRef = useRef<HTMLDivElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const currentFrameRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const velocityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScrollSampleRef = useRef<{ y: number; t: number }>({ y: 0, t: 0 });

  const [progress, setProgress] = useState<number>(0);
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });
  const frameCount = isMobile ? 60 : 120;
  const [velocityLabel, setVelocityLabel] = useState<string>('1.0x');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ clientX: number; startProgress: number }>({
    clientX: 0,
    startProgress: 0,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const drawFrameOnCanvas = useCallback((frameIndex: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imagesRef.current[frameIndex];
    if (!img || !img.complete || img.naturalWidth === 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;

    if (canvas.width !== Math.floor(viewW * dpr) || canvas.height !== Math.floor(viewH * dpr)) {
      canvas.width = Math.floor(viewW * dpr);
      canvas.height = Math.floor(viewH * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // Overscan scale factor (1.06x): crops out the bottom-right corner AI watermark cleanly without altering aspect ratio
    const OVERSCAN = 1.06;
    const baseScale = Math.max(viewW / img.naturalWidth, viewH / img.naturalHeight);
    const scale = baseScale * OVERSCAN;
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const offsetX = (viewW - drawW) / 2;
    const offsetY = (viewH - drawH) / 2;

    ctx.clearRect(0, 0, viewW, viewH);
    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
    ctx.restore();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (prefersReducedMotion) return;

    const total = frameCount;
    const folder = isMobile ? '/frames-mobile' : '/frames';

    const loadedImages: HTMLImageElement[] = new Array(total);
    imagesRef.current = loadedImages;

    const pad3 = (n: number) => String(n).padStart(3, '0');

    // Priority-load and pre-decode frame 1 immediately on mount for instant paint, then progressively load remaining frames
    const loadSingleFrame = (idx: number) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = `${folder}/ezgif-frame-${pad3(idx + 1)}.webp`;
      if (idx === 0) {
        if (typeof img.decode === 'function') {
          img.decode().catch(() => {}).then(() => drawFrameOnCanvas(0));
        } else {
          img.onload = () => drawFrameOnCanvas(0);
        }
      }
      loadedImages[idx] = img;
    };

    loadSingleFrame(0);

    // Progressively load remaining frames only when user approaches the sequence
    let idleHandle: number | ReturnType<typeof setTimeout> | null = null;
    let hasStartedLoading = false;

    const startProgressiveLoad = () => {
      if (hasStartedLoading) return;
      hasStartedLoading = true;

      let keyIdx = 4;
      const loadKeyframes = () => {
        const batchEnd = Math.min(keyIdx + 16, total);
        for (; keyIdx < batchEnd; keyIdx += 4) {
          loadSingleFrame(keyIdx);
        }
        if (keyIdx < total) {
          if ('requestIdleCallback' in window) {
            idleHandle = (window as any).requestIdleCallback(loadKeyframes);
          } else {
            idleHandle = setTimeout(loadKeyframes, 40);
          }
        } else {
          // Once keyframes loaded, fill remaining in-betweens in small idle chunks
          let inBetweenIdx = 1;
          const loadInBetweens = () => {
            let loadedInBatch = 0;
            while (inBetweenIdx < total && loadedInBatch < 4) {
              if (inBetweenIdx % 4 !== 0) {
                loadSingleFrame(inBetweenIdx);
                loadedInBatch++;
              }
              inBetweenIdx++;
            }
            if (inBetweenIdx < total) {
              if ('requestIdleCallback' in window) {
                idleHandle = (window as any).requestIdleCallback(loadInBetweens);
              } else {
                idleHandle = setTimeout(loadInBetweens, 40);
              }
            }
          };
          if ('requestIdleCallback' in window) {
            idleHandle = (window as any).requestIdleCallback(loadInBetweens);
          } else {
            idleHandle = setTimeout(loadInBetweens, 60);
          }
        }
      };

      if ('requestIdleCallback' in window) {
        idleHandle = (window as any).requestIdleCallback(loadKeyframes);
      } else {
        idleHandle = setTimeout(loadKeyframes, 100);
      }
    };

    if (window.scrollY > 20) {
      startProgressiveLoad();
    } else {
      window.addEventListener('scroll', startProgressiveLoad, { passive: true, once: true });
      idleHandle = setTimeout(startProgressiveLoad, 6000);
    }

    const handleScroll = () => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const maxScroll = Math.max(1, container.offsetHeight - window.innerHeight);
      const nextProgress = Math.max(0, Math.min(1, -rect.top / maxScroll));

      // Compute Valmora-style reel scrub velocity
      const now = performance.now();
      const dt = Math.max(16, now - lastScrollSampleRef.current.t);
      const dy = Math.abs(window.scrollY - lastScrollSampleRef.current.y);
      const rawSpeed = (dy / dt) * 1.65;
      lastScrollSampleRef.current = { y: window.scrollY, t: now };

      const targetFrame = Math.min(
        total - 1,
        Math.max(0, Math.floor(nextProgress * (total - 1)))
      );

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        if (targetFrame !== currentFrameRef.current) {
          currentFrameRef.current = targetFrame;
          drawFrameOnCanvas(targetFrame);
        }
        setProgress(nextProgress);

        if (rawSpeed > 2.1) {
          setVelocityLabel('>> 2.4x');
        } else if (rawSpeed > 1.2) {
          setVelocityLabel(`>> ${Math.min(2.2, rawSpeed).toFixed(1)}x`);
        } else if (rawSpeed < 0.35) {
          setVelocityLabel('0.5x SLOW');
        } else {
          setVelocityLabel('1.0x');
        }
      });

      if (velocityTimerRef.current) clearTimeout(velocityTimerRef.current);
      velocityTimerRef.current = setTimeout(() => {
        setVelocityLabel('1.0x');
      }, 260);
    };

    const handleResize = () => {
      drawFrameOnCanvas(currentFrameRef.current);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', startProgressiveLoad);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (velocityTimerRef.current) clearTimeout(velocityTimerRef.current);
      if (idleHandle) {
        if ('cancelIdleCallback' in window && typeof idleHandle === 'number') {
          (window as any).cancelIdleCallback(idleHandle);
        } else {
          clearTimeout(idleHandle as ReturnType<typeof setTimeout>);
        }
      }
    };
  }, [drawFrameOnCanvas, prefersReducedMotion, isMobile, frameCount]);

  // Interactive Pointer Drag-to-Scrub (Valmora "DRAG TO REVEAL" tactile mechanic)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return; // Let native vertical touch scroll work seamlessly on mobile
    setIsDragging(true);
    dragStartRef.current = {
      clientX: e.clientX,
      startProgress: progress,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !containerRef.current) return;
    const deltaX = e.clientX - dragStartRef.current.clientX;
    const scrubSensitivity = Math.max(320, window.innerWidth * 0.45);
    const nextProgress = Math.max(
      0,
      Math.min(1, dragStartRef.current.startProgress + deltaX / scrubSensitivity)
    );

    // Sync window scroll position so scroll and drag stay 100% unified
    const containerTop = containerRef.current.offsetTop;
    const maxScroll = Math.max(1, containerRef.current.offsetHeight - window.innerHeight);
    window.scrollTo({
      top: containerTop + nextProgress * maxScroll,
      behavior: 'auto',
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture already released
    }
  };

  const jumpToChapter = (targetNorm: number) => {
    if (!containerRef.current || typeof window === 'undefined') return;
    const containerTop = containerRef.current.offsetTop;
    const maxScroll = Math.max(1, containerRef.current.offsetHeight - window.innerHeight);
    window.scrollTo({
      top: containerTop + targetNorm * maxScroll,
      behavior: 'smooth',
    });
  };

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
            {/* Dark photographic scrim (bg-black/40) for text legibility */}
            <div className="absolute inset-0 bg-black/40 pointer-events-none" />
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

  if (engineConfig?.sections?.scrollSequence === false) {
    return null;
  }

  // Real-time Barista Telemetry Metrics derived from scroll progress (0..1)
  const livePressure =
    progress < 0.08
      ? (progress * 112.5).toFixed(1)
      : (9.0 + Math.sin(progress * Math.PI * 6) * 0.12).toFixed(1);
  const liveYieldGrams = (progress * 36.0).toFixed(1);
  const shotClockRemaining = Math.max(0, 28.4 * (1 - progress)).toFixed(1).padStart(4, '0');
  const elapsedSeconds = (progress * 28.4).toFixed(2).padStart(5, '0');
  const currentFrameNumber = String(
    Math.min(frameCount, Math.max(1, Math.round(progress * (frameCount - 1)) + 1))
  ).padStart(3, '0');

  const activeAct =
    EXTRACTION_ACTS.find((a) => progress >= a.window[0] && progress <= a.window[1]) ||
    (progress < 0.5 ? EXTRACTION_ACTS[0] : EXTRACTION_ACTS[2]);

  const exitProgress = Math.max(0, Math.min(1, (progress - 0.95) / 0.05));

  return (
    <section
      ref={containerRef}
      id="scroll-sequence-section"
      data-section-id="extraction-sequence"
      aria-label="Artisanal Espresso Extraction Sequence"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`relative w-full h-[320vh] bg-background select-none ${
        isDragging ? 'cursor-grabbing' : 'md:cursor-grab'
      }`}
    >
      {/* Anchor for extraction-sequence deep link */}
      <div id="extraction-sequence" className="absolute top-0 pointer-events-none" aria-hidden="true" />

      <div className="sticky top-0 left-0 w-full h-screen overflow-hidden bg-background">
        {/* 1. Hardware-Accelerated 120-Frame WebP Canvas */}
        <canvas
          ref={canvasRef}
          className="w-full h-full object-cover brightness-[0.82] contrast-[1.08] transition-transform duration-300"
        />

        {/* High-contrast dark photographic scrim (bg-black/40) for text legibility */}
        <div className="absolute inset-0 bg-black/40 pointer-events-none" />

        {/* 2. Radial Obsidian Vignette & Vertical Edge Feathering */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 50% 46%, rgba(17,11,8,0.14) 0%, rgba(17,11,8,0.72) 78%, rgba(17,11,8,0.96) 100%)',
          }}
        />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-background via-background/60 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-background via-background/75 to-transparent pointer-events-none" />

        {/* Smooth dissolve into AboutVibe ambient background as sequence finishes */}
        <div
          ref={exitOverlayRef}
          className="absolute inset-0 bg-background pointer-events-none transition-opacity duration-200"
          style={{ opacity: exitProgress }}
          aria-hidden="true"
        />

        {/* 3. Giant Architectural Background Watermark (Valmora "1961" Style) */}
        <div
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden"
        >
          <span className="font-serif text-[20vw] sm:text-[17vw] font-normal tracking-tighter text-on-surface/[0.035] select-none transition-all duration-500">
            {activeAct.watermark}
          </span>
        </div>

        {/* 4. TOP TELEMETRY VIEWFINDER HUD (Valmora Reel HUD + Chamber Specs) */}
        <div className="absolute top-20 sm:top-24 left-4 right-4 sm:left-12 sm:right-12 z-20 flex items-center justify-between gap-2 pointer-events-none font-mono text-[10px] sm:text-[11px] tracking-[0.2em] uppercase">
          {/* Left: Barista Chamber Telemetry */}
          <div className="inline-flex items-center gap-2.5 sm:gap-3.5 px-3.5 py-1.5 rounded-full bg-surface-obsidian/80 border border-primary/30 backdrop-blur-md text-on-surface/85 shadow-[0_8px_24px_rgba(0,0,0,0.6)]">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-primary font-semibold">CHAMBER 01</span>
            <span className="text-outline/40">|</span>
            <span>{livePressure} BAR</span>
            <span className="hidden md:inline text-outline/40">|</span>
            <span className="hidden md:inline text-on-surface/65">93.4°C PID</span>
          </div>

          {/* Right: Valmora Reel Timecode & Velocity Multiplier */}
          <div className="inline-flex items-center gap-2.5 sm:gap-3.5 px-3.5 py-1.5 rounded-full bg-surface-obsidian/80 border border-outline/30 backdrop-blur-md text-on-surface/80 shadow-[0_8px_24px_rgba(0,0,0,0.6)]">
            <span>REEL 01 · 00:{elapsedSeconds}</span>
            <span className="text-primary font-semibold">{velocityLabel}</span>
            <span className="hidden sm:inline text-on-surface/40">
              [{currentFrameNumber}/{String(frameCount).padStart(3, '0')}]
            </span>
          </div>
        </div>

        {/* 5. VALMORA CURVED SVG DRAG-TO-REVEAL PROMPT (Visible in Opening Frames) */}
        <div
          aria-hidden={progress > 0.22}
          style={{
            opacity: progress < 0.16 ? 1 : Math.max(0, 1 - (progress - 0.16) / 0.08),
          }}
          className="hidden lg:flex absolute top-1/3 right-[14%] z-20 flex-col items-start pointer-events-none transition-opacity duration-300"
        >
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-surface-obsidian/85 border border-primary/40 backdrop-blur-md shadow-[0_0_25px_rgba(212,175,55,0.2)]">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
            <span className="font-mono text-[10px] tracking-[0.24em] uppercase text-on-surface font-semibold">
              DRAG OR SCROLL TO EXTRACT
            </span>
          </div>
          <svg
            width="140"
            height="95"
            viewBox="0 0 140 95"
            fill="none"
            className="mt-1 ml-4 text-primary/60"
          >
            <path
              d="M 6 6 Q 88 22 124 86"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeDasharray="3 3"
            />
            <circle cx="124" cy="86" r="3.5" fill="currentColor" />
          </svg>
        </div>

        {/* 6. ODDBALL-INSPIRED SHOT-CLOCK & YIELD TELEMETRY CARD (Right HUD) */}
        <div className="hidden xl:flex absolute bottom-24 right-12 z-20 flex-col w-52 rounded-2xl bg-surface-obsidian/85 border border-outline/25 backdrop-blur-md p-4 pointer-events-none shadow-[0_16px_40px_rgba(0,0,0,0.75)]">
          <div className="flex items-center justify-between border-b border-outline/20 pb-2 mb-2.5">
            <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-on-surface/55">
              EXTRACTION CLOCK
            </span>
            <span className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className={`w-1.5 h-1.5 rounded-full ${progress > 0.33 ? 'bg-primary' : 'bg-outline/30'}`} />
              <span className={`w-1.5 h-1.5 rounded-full ${progress > 0.66 ? 'bg-primary' : 'bg-outline/30'}`} />
            </span>
          </div>
          <div className="font-mono text-3xl font-bold text-on-surface tracking-tight leading-none mb-3">
            {shotClockRemaining}
            <span className="text-xs font-normal text-primary ml-1">s</span>
          </div>
          <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.18em] uppercase text-on-surface/75">
            <span>YIELD GRAMS</span>
            <span className="text-primary font-bold">{liveYieldGrams}g</span>
          </div>
          <div className="w-full h-1 rounded-full bg-surface-container-highest mt-2 overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-150"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </div>

        {/* 7. CENTER NON-OVERLAPPING 3-ACT STAGE (Strict Mutually Exclusive Windows) */}
        <div className="absolute inset-0 z-20 flex items-center justify-center px-6 pointer-events-none">
          {EXTRACTION_ACTS.map((act) => {
            const env = computeActEnvelope(progress, act.window, act.plateau);
            return (
              <div
                key={act.id}
                aria-hidden={!env.isVisible}
                style={{
                  opacity: env.opacity,
                  transform: `translate3d(0, ${env.translateY.toFixed(1)}px, 0) scale(${env.scale.toFixed(3)})`,
                  filter: env.blur > 0.2 ? `blur(${env.blur.toFixed(1)}px)` : 'none',
                  visibility: env.isVisible ? 'visible' : 'hidden',
                }}
                className="absolute max-w-4xl w-full text-center flex flex-col items-center transition-none"
              >
                {/* Eyebrow Pill */}
                <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-surface-obsidian/85 border border-primary/35 backdrop-blur-md mb-5 shadow-[0_4px_20px_rgba(0,0,0,0.6)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="font-mono text-[10px] sm:text-[11px] tracking-[0.24em] uppercase text-primary font-semibold">
                    {act.eyebrow}
                  </span>
                </div>

                {/* Display Headline */}
                <h2 className="font-serif text-3xl sm:text-5xl lg:text-7xl text-on-surface font-normal tracking-tight leading-[1.06] drop-shadow-[0_14px_36px_rgba(0,0,0,0.9)]">
                  {act.titleBefore}
                  <span className="italic font-light text-primary">{act.titleHighlight}</span>
                  {act.titleAfter || ''}
                </h2>

                {/* Editorial Subcopy */}
                <p className="mt-4 max-w-xl font-sans text-sm sm:text-base text-on-surface-variant/90 font-light leading-relaxed drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)]">
                  {act.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* 8. BOTTOM INTERACTIVE CHAPTER RAIL (Valmora Act I / II / III Scrubber) */}
        <div className="absolute bottom-6 sm:bottom-8 left-6 right-6 sm:left-12 sm:right-12 z-20 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Interactive Act Switcher Buttons */}
          <div className="flex items-center gap-4 sm:gap-6 bg-surface-obsidian/80 border border-outline/25 backdrop-blur-md px-4 py-2 rounded-full">
            {EXTRACTION_ACTS.map((act, idx) => {
              const isActActive = progress >= act.window[0] && progress <= act.window[1];
              const actTargetMidpoint = (act.window[0] + act.window[1]) / 2;
              const fillPct =
                progress >= act.window[1]
                  ? 100
                  : progress <= act.window[0]
                  ? 0
                  : ((progress - act.window[0]) / (act.window[1] - act.window[0])) * 100;

              return (
                <React.Fragment key={act.id}>
                  <button
                    type="button"
                    onClick={() => jumpToChapter(actTargetMidpoint)}
                    className="group flex items-center gap-2 text-left focus:outline-none pointer-events-auto"
                  >
                    <span
                      className={`font-mono text-xs tracking-widest transition-colors ${
                        isActActive
                          ? 'text-primary font-bold'
                          : 'text-on-surface/40 group-hover:text-on-surface/80'
                      }`}
                    >
                      0{idx + 1}
                    </span>
                    <span
                      className={`hidden md:inline font-mono text-[10px] tracking-[0.18em] uppercase transition-colors ${
                        isActActive
                          ? 'text-on-surface font-medium'
                          : 'text-on-surface/40 group-hover:text-on-surface/70'
                      }`}
                    >
                      {act.actCode}
                    </span>
                  </button>

                  {idx < EXTRACTION_ACTS.length - 1 && (
                    <div className="w-8 sm:w-14 h-[1.5px] bg-outline/30 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-150"
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Right Bottom Progress Readout */}
          <div className="font-mono text-[10px] tracking-[0.24em] uppercase text-primary/85 pointer-events-none">
            CREMA EXTRACTION • {Math.round(progress * 100)}%
          </div>
        </div>
      </div>
    </section>
  );
};
