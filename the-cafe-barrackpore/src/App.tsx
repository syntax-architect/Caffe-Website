import { CartProvider } from './context/CartContext';
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
      </div>
    </CartProvider>
  );
}

export default App;
