
import { CartProvider } from './context/CartContext';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { Menu } from './components/Menu';
import { CartDrawer } from './components/CartDrawer';

function App() {
  return (
    <CartProvider>
      <div className="bg-background font-body-md text-on-surface antialiased selection:bg-primary-container selection:text-on-primary-container min-h-screen">
        <Header />
        <main className="w-full pt-20">
          <Hero />
          {/* Vibe / About section could go here if we extracted it, but we focus on Menu */}
          <Menu />
        </main>
        <CartDrawer />
      </div>
    </CartProvider>
  );
}

export default App;
