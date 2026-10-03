import { useState, useEffect, lazy, Suspense } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CartProvider, useCart } from './context/CartContext';
import { UIProvider, useUI } from './context/UIContext';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { ScrollSequence } from './components/ScrollSequence';
import { MobileActionDock } from './components/MobileActionDock';

// Synchronous above-the-fold and content sections for seamless SSR hydration without layout unmounting
import { AboutVibe } from './components/AboutVibe';
import { OurStory } from './components/OurStory';
import { Gallery } from './components/Gallery';
import { VIPClub } from './components/VIPClub';
import { SpecialsBanner } from './components/SpecialsBanner';
import { Menu } from './components/Menu';
import { Footer } from './components/Footer';

// Code-split heavy interactive modal overlays (only fetched when user opens them or on idle)
const CartDrawer = lazy(() => import('./components/CartDrawer').then(module => ({ default: module.CartDrawer })));
const ReservationDrawer = lazy(() => import('./components/ReservationDrawer').then(module => ({ default: module.ReservationDrawer })));
const CookieConsent = lazy(() => import('./components/CookieConsent').then(module => ({ default: module.CookieConsent })));

export const AppLayout: React.FC = () => {
  const { isDrawerOpen } = useCart();
  const { isReservationOpen } = useUI();
  const [mounted, setMounted] = useState(false);
  const [showConsent, setShowConsent] = useState(false);

  useEffect(() => {
    setMounted(true);
    const timer = setTimeout(() => setShowConsent(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="bg-background font-body-md text-on-surface antialiased selection:bg-primary-container selection:text-on-primary-container min-h-screen">
      <Header />
      <main id="main-content" className="w-full pt-20">
        {/* Ambient Golden Mesh Lighting - Hidden on mobile to save GPU */}
        <div className="fixed top-1/4 left-[-10%] w-72 h-72 sm:w-[500px] sm:h-[500px] rounded-full bg-[#D4AF37]/5 blur-[80px] sm:blur-[140px] pointer-events-none -z-10 hidden sm:block" />
        <div className="fixed top-2/4 right-[-10%] w-64 h-64 sm:w-[400px] sm:h-[400px] rounded-full bg-[#D4AF37]/4 blur-[80px] sm:blur-[130px] pointer-events-none -z-10 hidden sm:block" />
        <div className="fixed top-3/4 left-[15%] w-72 h-72 sm:w-[500px] sm:h-[500px] rounded-full bg-[#D4AF37]/5 blur-[80px] sm:blur-[140px] pointer-events-none -z-10 hidden sm:block" />
        <Hero />
        <ScrollSequence />
        <ErrorBoundary>
          <AboutVibe />
          <OurStory />
          <Gallery />
          <SpecialsBanner />
          <Menu />
          <VIPClub />
        </ErrorBoundary>
      </main>
      <ErrorBoundary>
        <Footer />
      </ErrorBoundary>

      {/* Overlays mounted strictly after hydration to keep initial critical path zero-overhead */}
      {mounted && (
        <Suspense fallback={null}>
          {isDrawerOpen && <CartDrawer />}
          {isReservationOpen && <ReservationDrawer />}
          {showConsent && <CookieConsent />}
        </Suspense>
      )}

      <MobileActionDock />
      <div 
        className="pointer-events-none fixed inset-0 z-[100] opacity-[0.03] hidden md:block"
        style={{ 
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          transform: 'translateZ(0)',
          willChange: 'transform'
        }}
      />
    </div>
  );
};

function App() {
  useEffect(() => {
    // Prevent browser from restoring scroll position on reload
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);

    // Defer drawer prefetch until user interacts or long idle to keep initial network completely clear
    const prefetchDrawers = () => {
      import('./components/CartDrawer');
      import('./components/ReservationDrawer');
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', prefetchDrawers, { once: true, passive: true });
      setTimeout(prefetchDrawers, 12000);
    }
  }, []);

  useEffect(() => {
    const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth < 1024);
    
    if (isTouchDevice) {
      return;
    }

    let lenisInstance: any = null;
    let rafId: number;

    import('lenis').then(({ default: LenisClass }) => {
      lenisInstance = new LenisClass({
        duration: 1.2,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: 'vertical',
        gestureOrientation: 'vertical',
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 2,
      });

      function raf(time: number) {
        if (lenisInstance) {
          lenisInstance.raf(time);
          rafId = requestAnimationFrame(raf);
        }
      }
      rafId = requestAnimationFrame(raf);
    });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (lenisInstance) lenisInstance.destroy();
    };
  }, []);

  return (
    <CartProvider>
      <UIProvider>
        <AppLayout />
      </UIProvider>
    </CartProvider>
  );
}

export default App;
