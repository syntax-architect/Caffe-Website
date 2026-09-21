import { CartProvider } from './context/CartContext';
import { UIProvider } from './context/UIContext';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { ScrollSequence } from './components/ScrollSequence';
import { AboutVibe } from './components/AboutVibe';
import { SpecialsBanner } from './components/SpecialsBanner';
import { Menu } from './components/Menu';
import { Footer } from './components/Footer';
import { CartDrawer } from './components/CartDrawer';

function App() {
  return (
    <UIProvider>
      <CartProvider>
        <div className="bg-background font-body-md text-on-surface antialiased selection:bg-primary-container selection:text-on-primary-container min-h-screen">
          <Header />
          <main className="w-full pt-20">
            <Hero />
            <ScrollSequence />
            <AboutVibe />
            <SpecialsBanner />
            <Menu />
          </main>
          <Footer />
          <CartDrawer />
          <div 
            className="pointer-events-none fixed inset-0 z-[100] opacity-[0.03]"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
          />
        </div>
      </CartProvider>
    </UIProvider>
  );
}

export default App;
