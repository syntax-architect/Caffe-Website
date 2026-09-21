import { useEffect } from 'react';
import Lenis from 'lenis';
import { CartProvider } from './context/CartContext';
import { UIProvider } from './context/UIContext';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { ScrollSequence } from './components/ScrollSequence';
import { AboutVibe } from './components/AboutVibe';
import { OurStory } from './components/OurStory';
import { Gallery } from './components/Gallery';
import { VIPClub } from './components/VIPClub';
import { SpecialsBanner } from './components/SpecialsBanner';
import { Menu } from './components/Menu';
import { Footer } from './components/Footer';
import { CartDrawer } from './components/CartDrawer';
import { Preloader } from './components/Preloader';

function App() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      touchMultiplier: 2,
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
            <Hero />
            <ScrollSequence />
            <AboutVibe />
            <OurStory />
            <Gallery />
            <VIPClub />
            <SpecialsBanner />
            <Menu />
          </main>
          <Footer />
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
