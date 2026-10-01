import React, { useState } from 'react';
import { useSiteConfig } from '../context/SiteConfigContext';
import { UIProvider } from '../context/UIContext';
import { CartProvider, useCart } from '../context/CartContext';
import { useTableContext } from '../hooks/useTableContext';
import { calculateOrderTotals } from '../utils/orderCalculations';
import { Menu } from './Menu';
import { CartDrawer } from './CartDrawer';
import { MetaTags } from './MetaTags';

/**
 * Inner component that has access to CartContext, TableContext, UIContext, and SiteConfigContext
 */
const QRContent: React.FC = () => {
  const { tableNumber, isQrValid, validationError, hasTableParam } = useTableContext();
  const { items, cartCount, setIsDrawerOpen, clearCart } = useCart();
  const { restaurantConfig, formatPrice, logoUrl } = useSiteConfig();

  const totals = calculateOrderTotals(items, {
    enabled: restaurantConfig.tax.enabled,
    mode: restaurantConfig.tax.mode,
    label: restaurantConfig.tax.label,
    rate: restaurantConfig.tax.rate,
    serviceCharge: restaurantConfig.tax.serviceCharge,
    rules: restaurantConfig.tax.rules,
  });

  // Context conflict detection
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
      <div className="min-h-screen bg-[#070605] text-[#f5efe6] flex flex-col justify-between p-6 sm:p-12 font-sans selection:bg-[#D4AF37]/30 selection:text-white">
        <header className="flex flex-col items-center text-center pt-8">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#D4AF37]/20 to-transparent border border-[#D4AF37]/40 flex items-center justify-center p-3 mb-4 shadow-[0_0_30px_rgba(212,175,55,0.2)]">
            <img src={logoUrl || "/logo.webp"} alt={restaurantConfig.businessName} className="w-full h-full object-contain filter invert" />
          </div>
          <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#D4AF37]">
            Optical Dining Interface
          </span>
          <h1 className="text-xl sm:text-2xl font-serif font-black uppercase tracking-[0.2em] text-white mt-1">
            {restaurantConfig.businessName}
          </h1>
        </header>

        <main className="max-w-md mx-auto w-full text-center py-12 flex flex-col items-center">
          <div className="p-1 rounded-[2.5rem] bg-gradient-to-b from-white/[0.1] to-white/[0.02] border border-white/[0.08] shadow-2xl w-full">
            <div className="p-8 rounded-[calc(2.5rem-0.25rem)] bg-[#120F0D] flex flex-col items-center">
              <div className="w-20 h-20 rounded-3xl bg-[#070605] border border-white/[0.1] flex items-center justify-center mb-6 text-[#D4AF37] shadow-inner">
                <span className="material-symbols-outlined text-4xl">qr_code_scanner</span>
              </div>

              <h2 className="text-2xl font-serif font-black text-white mb-2">
                Scan Your Table Stand
              </h2>

              <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed mb-8">
                To explore our menu and dispatch orders directly from your seat, please point your smartphone camera at the table QR stand.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <a
                  href="/"
                  className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-white border border-white/[0.08] font-bold text-xs transition-colors"
                >
                  <span className="material-symbols-outlined text-base">home</span>
                  <span>Main Website</span>
                </a>
                <a
                  href="/qr-generator"
                  className="inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#F3C766] text-[#070605] font-black text-xs uppercase tracking-wider transition-all"
                >
                  <span className="material-symbols-outlined text-base">print</span>
                  <span>Staff Setup</span>
                </a>
              </div>
            </div>
          </div>
        </main>

        <footer className="text-center text-zinc-600 text-xs py-4 border-t border-white/[0.06] font-mono">
          {restaurantConfig.businessName} • {restaurantConfig.address.city}
        </footer>
      </div>
    );
  }

  // State 2: Invalid table parameter (/qr?table=abc)
  if (!isQrValid || !tableNumber) {
    return (
      <div className="min-h-screen bg-[#070605] text-[#f5efe6] flex flex-col justify-between p-6 sm:p-12 font-sans selection:bg-[#D4AF37]/30 selection:text-white">
        <header className="flex flex-col items-center text-center pt-8">
          <div className="w-16 h-16 rounded-full bg-red-950/40 border border-red-500/40 flex items-center justify-center p-3 mb-4">
            <img src={logoUrl || "/logo.webp"} alt={restaurantConfig.businessName} className="w-full h-full object-contain filter invert" />
          </div>
          <h1 className="text-xl sm:text-2xl font-serif font-black uppercase tracking-[0.2em] text-white">
            {restaurantConfig.businessName}
          </h1>
          <p className="text-zinc-500 text-xs font-mono tracking-wider uppercase mt-1">
            Table Verification Protocol
          </p>
        </header>

        <main className="max-w-md mx-auto w-full text-center py-12 flex flex-col items-center">
          <div className="p-1 rounded-[2.5rem] bg-gradient-to-b from-red-500/20 to-transparent border border-red-500/30 shadow-2xl w-full">
            <div className="p-8 rounded-[calc(2.5rem-0.25rem)] bg-[#120F0D] flex flex-col items-center">
              <div className="w-20 h-20 rounded-3xl bg-red-950/60 border border-red-500/40 flex items-center justify-center mb-6 text-red-400 shadow-inner">
                <span className="material-symbols-outlined text-4xl">error_outline</span>
              </div>

              <h2 className="text-2xl font-serif font-black text-white mb-2">
                Unrecognized Table QR
              </h2>

              <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed mb-8">
                {validationError || 'The table QR code scanned is invalid or not recognized. Please scan the QR code located on your table again, or ask our staff for assistance.'}
              </p>

              <a
                href="/"
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-8 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#F3C766] text-[#070605] font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95"
              >
                <span className="material-symbols-outlined text-base">arrow_back</span>
                <span>Return to Website</span>
              </a>
            </div>
          </div>
        </main>

        <footer className="text-center text-zinc-600 text-xs py-4 border-t border-white/[0.06] font-mono">
          {restaurantConfig.businessName} • Concierge Help Available
        </footer>
      </div>
    );
  }

  // State 3: Valid Table QR Session (/qr?table=07)
  return (
    <div className="min-h-screen bg-[#070605] text-[#f5efe6] selection:bg-[#D4AF37]/30 selection:text-white pb-32">
      {/* Top Floating / Header Bar */}
      <header className="sticky top-0 z-40 bg-[#070605]/95 backdrop-blur-md border-b border-white/[0.08] px-4 py-3 sm:px-8 sm:py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" title="Go to Home" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D4AF37]/20 to-transparent border border-[#D4AF37]/40 flex items-center justify-center p-2 transition-transform group-hover:scale-105 shadow-[0_0_15px_rgba(212,175,55,0.2)]">
                <img src={logoUrl || "/logo.webp"} alt="Logo" className="w-full h-full object-contain filter invert" />
              </div>
              <div className="hidden xs:block text-left">
                <p className="text-xs font-serif font-black uppercase tracking-[0.18em] text-white leading-tight group-hover:text-[#D4AF37] transition-colors">
                  {restaurantConfig.shortName || restaurantConfig.businessName}
                </p>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">
                  {restaurantConfig.address.city}
                </p>
              </div>
            </a>
          </div>

          {/* Prominent Double-Bezel Table Indicator Badge */}
          <div className="p-0.5 rounded-full bg-gradient-to-r from-[#D4AF37]/40 via-white/[0.1] to-[#D4AF37]/40 shadow-[0_0_20px_rgba(212,175,55,0.2)]">
            <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-[#120F0D]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
              <div className="text-left">
                <span className="sr-only">Ordering from Table {tableNumber}</span>
                <p className="text-xs sm:text-sm font-serif font-black tracking-wider text-[#D4AF37] uppercase leading-none">
                  Table {tableNumber}
                </p>
                <p className="text-[8px] sm:text-[9px] text-zinc-400 uppercase tracking-widest font-mono leading-none mt-0.5">
                  Dine-In Covered
                </p>
              </div>
            </div>
          </div>

          {/* Quick Cart Trigger */}
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            aria-label={`View cart with ${cartCount} items`}
            className="relative flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#F3C766] text-[#070605] font-black text-xs sm:text-sm uppercase tracking-wider hover:shadow-[0_8px_25px_rgba(212,175,55,0.35)] transition-all active:scale-95 cursor-pointer shadow-md"
          >
            <span className="material-symbols-outlined text-base font-bold">shopping_bag</span>
            <span className="hidden sm:inline">My Order</span>
            {cartCount > 0 && (
              <span className="px-2 py-0.5 text-[10px] bg-[#070605] text-[#D4AF37] font-mono font-bold rounded-full min-w-[20px] text-center shadow">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 sm:pt-10">
        {/* Double-Bezel Table Welcome Banner */}
        <section aria-labelledby="qr-table-heading" className="mb-8 p-1 rounded-[2.5rem] bg-gradient-to-b from-[#D4AF37]/30 via-white/[0.06] to-transparent border border-[#D4AF37]/35 shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative overflow-hidden">
          <div className="p-6 sm:p-10 rounded-[calc(2.5rem-0.25rem)] bg-[#120F0D] relative z-10 text-center sm:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-mono font-bold uppercase tracking-wider mb-4">
              <span className="material-symbols-outlined text-sm">restaurant</span>
              <span>Dine-In Table Service</span>
            </div>
            <h1 id="qr-table-heading" className="text-3xl sm:text-5xl font-serif font-black text-white tracking-tight mb-2">
              {restaurantConfig.businessName.toUpperCase()}
            </h1>
            <p className="text-lg sm:text-xl text-[#D4AF37] font-serif font-bold tracking-wide">
              TABLE {tableNumber} • Smart Digital Service
            </p>
            <p className="text-zinc-400 text-xs sm:text-sm max-w-2xl mt-2 leading-relaxed">
              Explore our freshly prepared artisanal menu below. Add dishes to your bag and submit directly to our kitchen with zero wait time.
            </p>
          </div>

          <div className="absolute right-[-40px] bottom-[-40px] w-64 h-64 rounded-full bg-[#D4AF37]/10 blur-[100px] pointer-events-none" aria-hidden="true" />
        </section>

        {/* Existing Cart Conflict Notification */}
        {showCartConflictPrompt && (
          <aside
            role="alert"
            aria-live="polite"
            className="mb-8 p-1 rounded-2xl bg-gradient-to-b from-amber-500/30 to-transparent border border-amber-500/40 shadow-xl"
          >
            <div className="p-4 sm:p-5 rounded-[calc(1rem-0.125rem)] bg-[#120F0D] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-[#D4AF37] text-2xl mt-0.5">info</span>
                <div>
                  <p className="text-sm font-bold text-white">
                    Previous Cart Detected ({items.length} dishes)
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    You have items saved from an earlier session. Would you like to keep them for Table {tableNumber} or start fresh?
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end shrink-0">
                <button
                  type="button"
                  onClick={handleStartFresh}
                  className="px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-zinc-400 hover:text-white border border-white/[0.08] transition-colors cursor-pointer"
                >
                  Start Fresh
                </button>
                <button
                  type="button"
                  onClick={handleKeepItems}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#F3C766] text-[#070605] text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                >
                  Keep Items
                </button>
              </div>
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
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-8 sm:bottom-8 sm:w-96 z-40 transition-all duration-300 animate-in slide-in-from-bottom"
        >
          <div className="p-1 rounded-2xl bg-gradient-to-r from-[#D4AF37] via-[#F3C766] to-[#D4AF37] shadow-[0_10px_40px_rgba(0,0,0,0.85)]">
            <div className="flex items-center justify-between gap-4 p-3.5 sm:p-4 rounded-[calc(1rem-0.125rem)] bg-[#070605]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#D4AF37] text-[#070605] flex items-center justify-center font-mono font-black text-sm shadow">
                  {cartCount}
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">Table {tableNumber}</p>
                  <p className="text-base font-serif font-black text-white">{formatPrice(totals.total)}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#F3C766] text-[#070605] font-black text-xs uppercase tracking-wider hover:shadow-[0_6px_20px_rgba(212,175,55,0.4)] active:scale-95 transition-all cursor-pointer"
              >
                <span>View Order</span>
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Cart Drawer Modal */}
      <CartDrawer />

      {/* Lightweight Footer for QR Page */}
      <footer className="mt-16 pt-8 border-t border-white/[0.06] text-center text-zinc-500 text-xs max-w-7xl mx-auto px-4 font-mono">
        <p className="font-serif uppercase tracking-[0.2em] text-[#D4AF37] text-sm font-bold mb-1">
          {restaurantConfig.businessName}
        </p>
        <p className="text-zinc-500">{restaurantConfig.address.line1} • Need assistance? Please speak to our floor staff.</p>
        <div className="mt-3 flex items-center justify-center gap-4 text-[10px] text-zinc-600">
          <span>Dine-In Table {tableNumber}</span>
          <span>•</span>
          <a href="/" className="hover:text-[#D4AF37] transition-colors underline">Visit Full Website</a>
        </div>
      </footer>
    </div>
  );
};

export const QROrderingPage: React.FC = () => {
  return (
    <CartProvider>
      <UIProvider>
        <MetaTags />
        <QRContent />
      </UIProvider>
    </CartProvider>
  );
};

export default QROrderingPage;
