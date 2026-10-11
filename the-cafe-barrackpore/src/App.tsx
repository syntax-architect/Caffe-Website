import { useState, useEffect, lazy, Suspense } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CartProvider, useCart } from './context/CartContext';
import { UIProvider, useUI } from './context/UIContext';
import { useSiteConfig } from './context/SiteConfigContext';
import { Header } from './components/Header';
import { AnnouncementBanner } from './components/AnnouncementBanner';
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
  const { engineConfig } = useSiteConfig();
  const [showConsent, setShowConsent] = useState(false);

  const sections = engineConfig?.sections;

  useEffect(() => {
    const triggerConsent = () => setShowConsent(true);
    window.addEventListener('scroll', triggerConsent, { once: true, passive: true });
    window.addEventListener('pointerdown', triggerConsent, { once: true, passive: true });
    window.addEventListener('keydown', triggerConsent, { once: true, passive: true });
    return () => {
      window.removeEventListener('scroll', triggerConsent);
      window.removeEventListener('pointerdown', triggerConsent);
      window.removeEventListener('keydown', triggerConsent);
    };
  }, []);

  return (
    <div className="bg-background font-body-md text-on-surface antialiased selection:bg-primary-container selection:text-on-primary-container min-h-screen">
      <AnnouncementBanner />
      <Header />
      <main id="main-content" className="w-full pt-20">
        {/* Ambient Golden Mesh Lighting - Isolated layer, zero repaint on scroll */}
        <div className="fixed inset-0 pointer-events-none -z-10 layer-isolated hidden sm:block" aria-hidden="true">
          <div className="absolute top-1/4 left-[-10%] w-72 h-72 sm:w-[500px] sm:h-[500px] rounded-full bg-primary/5 blur-[80px] sm:blur-[140px]" />
          <div className="absolute top-2/4 right-[-10%] w-64 h-64 sm:w-[400px] sm:h-[400px] rounded-full bg-primary/4 blur-[80px] sm:blur-[130px]" />
          <div className="absolute top-3/4 left-[15%] w-72 h-72 sm:w-[500px] sm:h-[500px] rounded-full bg-primary/5 blur-[80px] sm:blur-[140px]" />
        </div>
        {sections?.hero !== false && <Hero />}
        {sections?.scrollSequence !== false && <ScrollSequence />}
        <ErrorBoundary>
          <div className="cv-auto">
            {sections?.aboutVibe !== false && <AboutVibe />}
            {sections?.menu !== false && <Menu />}
            {sections?.specialsBanner !== false && <SpecialsBanner />}
            {sections?.story !== false && <OurStory />}
            {sections?.gallery !== false && <Gallery />}
            {sections?.vipClub !== false && <VIPClub />}
          </div>
        </ErrorBoundary>
      </main>
      {sections?.footer !== false && (
        <ErrorBoundary>
          <Footer />
        </ErrorBoundary>
      )}

      {/* Overlays mounted strictly on demand to keep critical path zero-overhead */}
      {(isDrawerOpen || isReservationOpen || showConsent) && (
        <Suspense fallback={null}>
          {isDrawerOpen && <CartDrawer />}
          {isReservationOpen && <ReservationDrawer />}
          {showConsent && <CookieConsent />}
        </Suspense>
      )}

      <MobileActionDock />
      <div 
        className="pointer-events-none fixed inset-0 z-[100] opacity-[0.03] hidden md:block layer-isolated"
        style={{ 
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
};

function App() {
  useEffect(() => {
    // Scroll to top on fresh load
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
    if (typeof window !== 'undefined' && window.scrollY > 0) {
      window.scrollTo(0, 0);
    }
  }, []);

  useEffect(() => {
    const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth < 1024);
    
    if (isTouchDevice) {
      return;
    }

    let lenisInstance: any = null;

    import('lenis').then(({ default: LenisClass }) => {
      lenisInstance = new LenisClass({
        duration: 1.2,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: 'vertical',
        gestureOrientation: 'vertical',
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 2,
        autoRaf: true,
      });
    });

    return () => {
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
