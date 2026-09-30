import { useEffect, lazy, Suspense } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import Lenis from 'lenis';
import { CartProvider } from './context/CartContext';
import { UIProvider } from './context/UIContext';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { ScrollSequence } from './components/ScrollSequence';
import { Preloader } from './components/Preloader';
import { MetaTags } from './components/MetaTags';

import { SiteConfigProvider } from './context/SiteConfigContext';

// Lazy load below-the-fold components and interactive overlays
const AboutVibe = lazy(() => import('./components/AboutVibe').then(module => ({ default: module.AboutVibe })));
const OurStory = lazy(() => import('./components/OurStory').then(module => ({ default: module.OurStory })));
const Gallery = lazy(() => import('./components/Gallery').then(module => ({ default: module.Gallery })));
const VIPClub = lazy(() => import('./components/VIPClub').then(module => ({ default: module.VIPClub })));
const SpecialsBanner = lazy(() => import('./components/SpecialsBanner').then(module => ({ default: module.SpecialsBanner })));
const Menu = lazy(() => import('./components/Menu').then(module => ({ default: module.Menu })));
const Footer = lazy(() => import('./components/Footer').then(module => ({ default: module.Footer })));
const CartDrawer = lazy(() => import('./components/CartDrawer').then(module => ({ default: module.CartDrawer })));
const ReservationDrawer = lazy(() => import('./components/ReservationDrawer').then(module => ({ default: module.ReservationDrawer })));

function App() {
  useEffect(() => {
    // Prevent browser from restoring scroll position on reload
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);

    // Idle prefetch for interactive drawers so they open with 0ms latency on user click
    const prefetchDrawers = () => {
      import('./components/CartDrawer');
      import('./components/ReservationDrawer');
    };
    if (typeof window !== 'undefined') {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(prefetchDrawers, { timeout: 4000 });
      } else {
        setTimeout(prefetchDrawers, 3000);
      }
    }
  }, []);

  useEffect(() => {
    // MASSIVE OPTIMIZATION: Do not initialize Lenis smooth scrolling on touch devices.
    // Native mobile scrolling is already smooth, and running requestAnimationFrame
    // endlessly on an old phone drains battery and causes main thread lag.
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    if (isTouchDevice) {
      return;
    }

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      touchMultiplier: 2,
      syncTouch: false,
    });

    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }

    rafId = requestAnimationFrame(raf);
    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  return (
    <SiteConfigProvider>
      <CartProvider>
        <UIProvider>
          <MetaTags />
          <Preloader />
          <div className="bg-background font-body-md text-on-surface antialiased selection:bg-primary-container selection:text-on-primary-container min-h-screen">
            <Header />
            <main className="w-full pt-20">
              {/* Ambient Golden Mesh Lighting - Hidden on mobile to save GPU */}
              <div className="fixed top-1/4 left-[-10%] w-72 h-72 sm:w-[500px] sm:h-[500px] rounded-full bg-[#D4AF37]/5 blur-[80px] sm:blur-[140px] pointer-events-none -z-10 hidden sm:block" />
              <div className="fixed top-2/4 right-[-10%] w-64 h-64 sm:w-[400px] sm:h-[400px] rounded-full bg-[#D4AF37]/4 blur-[80px] sm:blur-[130px] pointer-events-none -z-10 hidden sm:block" />
              <div className="fixed top-3/4 left-[15%] w-72 h-72 sm:w-[500px] sm:h-[500px] rounded-full bg-[#D4AF37]/5 blur-[80px] sm:blur-[140px] pointer-events-none -z-10 hidden sm:block" />
              <Hero />
              <ScrollSequence />
              <ErrorBoundary>
                <Suspense fallback={<div className="h-32 w-full flex items-center justify-center text-[#D4AF37]">Loading...</div>}>
                  <AboutVibe />
                  <OurStory />
                  <Gallery />
                  <SpecialsBanner />
                  <Menu />
                  <VIPClub />
                </Suspense>
              </ErrorBoundary>
            </main>
            <ErrorBoundary>
              <Suspense fallback={<div className="h-32 w-full flex items-center justify-center text-[#D4AF37]">Loading...</div>}>
                <Footer />
              </Suspense>
            </ErrorBoundary>
            <Suspense fallback={null}>
              <CartDrawer />
              <ReservationDrawer />
            </Suspense>
            <div 
              className="pointer-events-none fixed inset-0 z-[100] opacity-[0.03] hidden sm:block"
              style={{ 
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                transform: 'translateZ(0)',
                willChange: 'transform'
              }}
            />
          </div>
        </UIProvider>
      </CartProvider>
    </SiteConfigProvider>
  );
}

export default App;
