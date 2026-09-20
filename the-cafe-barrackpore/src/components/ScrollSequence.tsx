import React, { useEffect, useRef } from 'react';

export const ScrollSequence: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const frameCount = 40;
    const currentFrame = (index: number) => `/frames/ezgif-frame-${index.toString().padStart(3, '0')}.jpg`;

    const images: HTMLImageElement[] = [];
    let loadedImages = 0;

    for (let i = 1; i <= frameCount; i++) {
      const img = new Image();
      img.src = currentFrame(i);
      img.onload = () => {
        loadedImages++;
        if (loadedImages === 1) {
          // Draw first frame immediately
          context.drawImage(img, 0, 0, canvas.width, canvas.height);
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

      // Calculate progress (0 to 1)
      const scrollableDistance = sectionHeight - windowHeight;
      let progress = -sectionTop / scrollableDistance;
      
      // Clamp between 0 and 1
      progress = Math.max(0, Math.min(1, progress));
      
      const frameIndex = Math.floor(progress * (frameCount - 1));
      
      if (images[frameIndex] && images[frameIndex].complete) {
        requestAnimationFrame(() => {
          context.drawImage(images[frameIndex], 0, 0, canvas.width, canvas.height);
        });
      }

      // Handle text overlays based on progress
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
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Initial call
    setTimeout(handleScroll, 100);

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <section id="scroll-sequence-section" className="relative w-full h-[400vh] bg-background">
      <div className="sticky top-0 w-full h-screen overflow-hidden flex items-center justify-center">
        <canvas 
          ref={canvasRef}
          id="scroll-video-canvas" 
          className="absolute inset-0 w-full h-full object-cover opacity-80" 
          width={1920} 
          height={1080} 
        />
        {/* Overlay Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-transparent" />
        
        {/* Floating text that appears during scroll */}
        <div className="relative z-10 max-w-[1320px] mx-auto px-gutter w-full flex flex-col items-center justify-center text-center">
          <h2 id="scroll-text-1" className="font-display-lg text-display-lg text-on-surface font-bold tracking-tight opacity-0 transition-all duration-500 translate-y-8 absolute w-full left-0">Crafted to <span className="text-primary">Perfection</span></h2>
          <h2 id="scroll-text-2" className="font-display-lg text-display-lg text-on-surface font-bold tracking-tight opacity-0 transition-all duration-500 translate-y-8 absolute w-full left-0">Every Drop <span className="text-secondary">Matters</span></h2>
          <h2 id="scroll-text-3" className="font-display-lg text-display-lg text-on-surface font-bold tracking-tight opacity-0 transition-all duration-500 translate-y-8 absolute w-full left-0">The True <span className="text-tertiary">Lounge</span> Experience</h2>
        </div>
      </div>
    </section>
  );
};
