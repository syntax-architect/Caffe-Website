import React, { useState } from 'react';
import { SiteConfigProvider } from '../context/SiteConfigContext';
import { UIProvider } from '../context/UIContext';
import { CartProvider, useCart } from '../context/CartContext';
import { useTableContext } from '../hooks/useTableContext';
import { Menu } from './Menu';
import { CartDrawer } from './CartDrawer';
import { MetaTags } from './MetaTags';

/**
 * Inner component that has access to CartContext, TableContext, UIContext, and SiteConfigContext
 */
const QRContent: React.FC = () => {
  const { tableNumber, isQrValid, validationError, hasTableParam } = useTableContext();
  const { items, cartCount, cartTotal, setIsDrawerOpen, clearCart } = useCart();

  // Context conflict detection (avoid silently adopting old cart without acknowledgment)
  const [isConflictDismissed, setIsConflictDismissed] = useState(false);

  const hasContextMismatch =
    typeof window !== 'undefined' &&
    isQrValid &&
    !!tableNumber &&
    items.length > 0 &&
    sessionStorage.getItem('cafe_qr_active_table') !== tableNumber;

  const showCartConflictPrompt = hasContextMismatch && !isConflictDismissed;

  const handleKeepItems = () => {
    if (tableNumber) {
      sessionStorage.setItem('cafe_qr_active_table', tableNumber);
    }
    setIsConflictDismissed(true);
  };

  const handleStartFresh = () => {
    clearCart();
    if (tableNumber) {
      sessionStorage.setItem('cafe_qr_active_table', tableNumber);
    }
    setIsConflictDismissed(true);
  };

  // State 1: Missing table parameter (/qr)
  if (!hasTableParam) {
    return (
      <div className="min-h-screen bg-background text-on-surface flex flex-col justify-between p-6 sm:p-12 font-body-md selection:bg-primary-container selection:text-on-primary-container">
        <header className="flex flex-col items-center text-center pt-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center p-3 mb-4 shadow-[0_0_25px_rgba(212,175,55,0.15)]">
            <img src="/logo.webp" alt="The Café Barrackpore" className="w-full h-full object-contain filter invert" />
          </div>
          <h1 className="text-xl sm:text-2xl font-serif uppercase tracking-[0.2em] text-primary">
            The Café Barrackpore
          </h1>
          <p className="text-outline text-xs sm:text-sm tracking-wider uppercase mt-1">
            Smart QR Dine-In Ordering
          </p>
        </header>

        <main className="max-w-md mx-auto w-full text-center py-12 flex flex-col items-center">
          <div className="w-20 h-20 rounded-2xl bg-surface-container-high border border-outline-variant/50 flex items-center justify-center mb-6 text-primary shadow-lg">
            <span className="material-symbols-outlined text-4xl">qr_code_scanner</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-serif text-on-surface font-semibold mb-3">
            Please Scan Your Table QR
          </h2>

          <p className="text-outline text-sm leading-relaxed mb-8">
            To view our menu and order directly from your seat, please point your phone's camera at the QR code on your table.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <a
              href="/"
              className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-6 rounded-full bg-surface-container-high hover:bg-surface-container-highest text-on-surface border border-outline-variant/60 font-medium text-sm transition-colors"
            >
              <span className="material-symbols-outlined text-base">home</span>
              Main Website
            </a>
            <a
              href="/qr-generator"
              className="inline-flex items-center justify-center gap-2 py-3 px-6 rounded-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-medium text-sm transition-colors"
            >
              <span className="material-symbols-outlined text-base">print</span>
              Staff QR Setup
            </a>
          </div>
        </main>

        <footer className="text-center text-outline/60 text-xs py-4 border-t border-outline-variant/20">
          The Café Barrackpore • 14, Riverside Road, Cantonment, Barrackpore
        </footer>
      </div>
    );
  }

  // State 2: Invalid table parameter (/qr?table=abc or table > 99 or table <= 0)
  if (!isQrValid || !tableNumber) {
    return (
      <div className="min-h-screen bg-background text-on-surface flex flex-col justify-between p-6 sm:p-12 font-body-md selection:bg-primary-container selection:text-on-primary-container">
        <header className="flex flex-col items-center text-center pt-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center p-3 mb-4">
            <img src="/logo.webp" alt="The Café Barrackpore" className="w-full h-full object-contain filter invert" />
          </div>
          <h1 className="text-xl sm:text-2xl font-serif uppercase tracking-[0.2em] text-primary">
            The Café Barrackpore
          </h1>
          <p className="text-outline text-xs sm:text-sm tracking-wider uppercase mt-1">
            Table Verification
          </p>
        </header>

        <main className="max-w-md mx-auto w-full text-center py-12 flex flex-col items-center">
          <div className="w-20 h-20 rounded-2xl bg-error/10 border border-error/30 flex items-center justify-center mb-6 text-error shadow-lg">
            <span className="material-symbols-outlined text-4xl">error_outline</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-serif text-on-surface font-semibold mb-3">
            Invalid Table QR Code
          </h2>

          <p className="text-outline text-sm leading-relaxed mb-8">
            {validationError || 'The table QR code scanned is invalid or not recognized. Please scan the QR code located on your table again, or ask our staff for assistance.'}
          </p>

          <a
            href="/"
            className="inline-flex items-center justify-center gap-2 py-3 px-8 rounded-full bg-primary text-on-primary hover:bg-primary-hover font-semibold text-sm transition-all shadow-md active:scale-95"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Back to Main Website
          </a>
        </main>

        <footer className="text-center text-outline/60 text-xs py-4 border-t border-outline-variant/20">
          The Café Barrackpore • Smart QR Service
        </footer>
      </div>
    );
  }

  // State 3: Valid Table QR Session (/qr?table=07)
  return (
    <div className="min-h-screen bg-background text-on-surface selection:bg-primary-container selection:text-on-primary-container pb-28">
      {/* Top Floating / Header Bar */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-outline-variant/30 px-4 py-3 sm:px-8 sm:py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" title="Go to Home" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center p-2 transition-transform group-hover:scale-105">
                <img src="/logo.webp" alt="Logo" className="w-full h-full object-contain filter invert" />
              </div>
              <div className="hidden xs:block text-left">
                <p className="text-xs font-serif uppercase tracking-[0.18em] text-primary leading-tight">The Café</p>
                <p className="text-[10px] text-outline uppercase tracking-wider">Barrackpore</p>
              </div>
            </a>
          </div>

          {/* Prominent Table Indicator Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-surface-container-highest border border-primary/40 shadow-[0_2px_12px_rgba(212,175,55,0.12)]">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
            <div className="text-left">
              <span className="sr-only">Ordering from Table {tableNumber}</span>
              <p className="text-xs sm:text-sm font-bold tracking-wider text-primary font-serif uppercase leading-none">
                Table {tableNumber}
              </p>
              <p className="text-[9px] sm:text-[10px] text-outline uppercase tracking-wider leading-none mt-0.5">
                Dine-In Session
              </p>
            </div>
          </div>

          {/* Quick Cart Trigger */}
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            aria-label={`View cart with ${cartCount} items`}
            className="relative flex items-center gap-2 px-3.5 py-2 rounded-full bg-primary text-on-primary font-semibold text-xs sm:text-sm hover:bg-primary-hover transition-transform active:scale-95 shadow-md"
          >
            <span className="material-symbols-outlined text-base">shopping_bag</span>
            <span className="hidden sm:inline">My Order</span>
            {cartCount > 0 && (
              <span className="px-1.5 py-0.5 text-[11px] bg-black text-primary font-bold rounded-full min-w-[20px] text-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 sm:pt-10">
        {/* Table Welcome Banner */}
        <section aria-labelledby="qr-table-heading" className="mb-8 text-center sm:text-left bg-gradient-to-r from-surface-container to-surface-container-high border border-outline-variant/40 rounded-3xl p-6 sm:p-8 relative overflow-hidden">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-semibold uppercase tracking-wider mb-3">
              <span className="material-symbols-outlined text-sm">restaurant</span>
              Dine-In Table Service
            </div>
            <h1 id="qr-table-heading" className="text-2xl sm:text-4xl font-serif font-bold text-on-surface tracking-tight mb-2">
              THE CAFÉ BARRACKPORE
            </h1>
            <p className="text-base sm:text-lg text-primary font-medium tracking-wide">
              TABLE {tableNumber} • Order from your table
            </p>
            <p className="text-outline text-xs sm:text-sm max-w-2xl mt-2 leading-relaxed">
              Browse our freshly prepared menu below, add your favorite dishes to your order, and submit directly to our kitchen.
            </p>
          </div>
          
          <div className="absolute right-[-20px] bottom-[-20px] w-48 h-48 rounded-full bg-primary/5 blur-3xl pointer-events-none" aria-hidden="true" />
        </section>

        {/* Existing Cart Conflict Notification */}
        {showCartConflictPrompt && (
          <aside
            role="alert"
            aria-live="polite"
            className="mb-8 p-4 sm:p-5 rounded-2xl bg-surface-container-highest border border-primary/40 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-2xl mt-0.5">info</span>
              <div>
                <p className="text-sm font-semibold text-on-surface">
                  Previous Cart Detected ({items.length} items)
                </p>
                <p className="text-xs text-outline mt-0.5">
                  You have items from an earlier session. Would you like to keep them for Table {tableNumber} or start fresh?
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end shrink-0">
              <button
                type="button"
                onClick={handleStartFresh}
                className="px-4 py-1.5 rounded-full border border-outline-variant hover:bg-surface-container-high text-xs font-semibold text-outline hover:text-on-surface transition-colors"
              >
                Start Fresh
              </button>
              <button
                type="button"
                onClick={handleKeepItems}
                className="px-4 py-1.5 rounded-full bg-primary text-on-primary text-xs font-semibold hover:bg-primary-hover transition-colors"
              >
                Keep Items
              </button>
            </div>
          </aside>
        )}

        {/* The Reused Menu Component */}
        <section aria-label="Restaurant Menu" className="w-full">
          <Menu />
        </section>
      </main>

      {/* Floating Sticky Bottom Bar on Mobile/Tablet when Cart has items */}
      {cartCount > 0 && (
        <aside
          role="region"
          aria-label="Order summary bar"
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-8 sm:bottom-8 sm:w-96 z-40 transition-all duration-300"
        >
          <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-surface-container-highest/95 backdrop-blur-md border border-primary/50 shadow-[0_8px_30px_rgba(0,0,0,0.6)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center font-bold text-sm shadow">
                {cartCount}
              </div>
              <div className="text-left">
                <p className="text-xs text-outline uppercase tracking-wider">Table {tableNumber}</p>
                <p className="text-base font-bold text-on-surface">₹{cartTotal}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-on-primary font-semibold text-xs sm:text-sm hover:bg-primary-hover active:scale-95 transition-all shadow-md"
            >
              <span>View Order</span>
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </button>
          </div>
        </aside>
      )}

      {/* Cart Drawer Modal */}
      <CartDrawer />

      {/* Lightweight Footer for QR Page */}
      <footer className="mt-16 pt-8 border-t border-outline-variant/30 text-center text-outline text-xs max-w-7xl mx-auto px-4">
        <p className="font-serif uppercase tracking-widest text-primary text-sm mb-1">The Café Barrackpore</p>
        <p className="text-outline/70">Riverside Road, Cantonment, Barrackpore • Need assistance? Please speak to our floor staff.</p>
        <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-outline/50">
          <span>Dine-In Table {tableNumber}</span>
          <span>•</span>
          <a href="/" className="hover:text-primary transition-colors underline">Visit Full Website</a>
        </div>
      </footer>
    </div>
  );
};

/**
 * QROrderingPage - Standalone, lightweight entry component for QR table orders.
 * Completely eliminates heavy homepage assets, ScrollSequence, and canvas computations.
 */
export const QROrderingPage: React.FC = () => {
  return (
    <SiteConfigProvider>
      <CartProvider>
        <UIProvider>
          <MetaTags />
          <QRContent />
        </UIProvider>
      </CartProvider>
    </SiteConfigProvider>
  );
};

export default QROrderingPage;
