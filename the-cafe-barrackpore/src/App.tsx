import { useEffect, lazy, Suspense } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import Lenis from 'lenis';
import { CartProvider } from './context/CartContext';
import { UIProvider } from './context/UIContext';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { ScrollSequence } from './components/ScrollSequence';
import { CartDrawer } from './components/CartDrawer';
import { Preloader } from './components/Preloader';

// Lazy load below-the-fold components
const AboutVibe = lazy(() => import('./components/AboutVibe').then(module => ({ default: module.AboutVibe })));
const OurStory = lazy(() => import('./components/OurStory').then(module => ({ default: module.OurStory })));
const Gallery = lazy(() => import('./components/Gallery').then(module => ({ default: module.Gallery })));
const VIPClub = lazy(() => import('./components/VIPClub').then(module => ({ default: module.VIPClub })));
const SpecialsBanner = lazy(() => import('./components/SpecialsBanner').then(module => ({ default: module.SpecialsBanner })));
const Menu = lazy(() => import('./components/Menu').then(module => ({ default: module.Menu })));
const Footer = lazy(() => import('./components/Footer').then(module => ({ default: module.Footer })));

function App() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      touchMultiplier: 2,
      syncTouch: false,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);
    return () => lenis.destroy();
  }, []);

  return (
    <UIProvider>
      <CartProvider>
        <Preloader />
        <div className="bg-background font-body-md text-on-surface antialiased selection:bg-primary-container selection:text-on-primary-container min-h-screen">
          <Header />
          <main className="w-full pt-20">
            {/* Ambient Golden Mesh Lighting */}
            <div className="fixed top-1/4 left-[-10%] w-72 h-72 sm:w-[500px] sm:h-[500px] rounded-full bg-[#D4AF37]/5 blur-[80px] sm:blur-[140px] pointer-events-none -z-10" />
            <div className="fixed top-2/4 right-[-10%] w-64 h-64 sm:w-[400px] sm:h-[400px] rounded-full bg-[#9d4300]/8 blur-[70px] sm:blur-[120px] pointer-events-none -z-10" />
            <div className="fixed top-3/4 left-[15%] w-72 h-72 sm:w-[500px] sm:h-[500px] rounded-full bg-[#D4AF37]/5 blur-[80px] sm:blur-[140px] pointer-events-none -z-10" />
            <Hero />
            <ScrollSequence />
            <ErrorBoundary>
              <Suspense fallback={<div className="h-32 w-full flex items-center justify-center text-[#D4AF37]">Loading...</div>}>
                <AboutVibe />
                <OurStory />
                <Gallery />
                <VIPClub />
                <SpecialsBanner />
                <Menu />
              </Suspense>
            </ErrorBoundary>
          </main>
          <ErrorBoundary>
            <Suspense fallback={<div className="h-32 w-full flex items-center justify-center text-[#D4AF37]">Loading...</div>}>
              <Footer />
            </Suspense>
          </ErrorBoundary>
          <CartDrawer />
          <div 
            className="pointer-events-none fixed inset-0 z-[100] opacity-[0.03]"
            style={{ 
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
              transform: 'translateZ(0)',
              willChange: 'transform'
            }}
          />
        </div>
      </CartProvider>
    </UIProvider>
  );
}

export default App;
