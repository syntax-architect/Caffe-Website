import React, { useState } from 'react';
import { useSiteConfig } from '../context/SiteConfigContext';
import { useI18n } from '../i18n/I18nContext';
import { UIProvider, useUI } from '../context/UIContext';
import { CartProvider, useCart } from '../context/CartContext';
import { useTableContext } from '../hooks/useTableContext';
import { calculateOrderTotals } from '../utils/orderCalculations';
import { Menu } from './Menu';
import { CartDrawer } from './CartDrawer';
import { MetaTags } from './MetaTags';

/**
 * High-End Table QR Dining Interface
 * Engineered with double-bezel enclosures, warm atmospheric lighting,
 * and high-contrast editorial typography.
 */
const QRContent: React.FC = () => {
  const { tableNumber, isQrValid, validationError, hasTableParam } = useTableContext();
  const { items, cartCount, setIsDrawerOpen, clearCart } = useCart();
  const { restaurantConfig, formatPrice, logoUrl, features } = useSiteConfig();
  const { t } = useI18n();
  const { showToast } = useUI();

  // Context conflict detection
  const [isConflictDismissed, setIsConflictDismissed] = useState(false);
  const [isStaffCalled, setIsStaffCalled] = useState(false);

  if (features?.qr_table_ordering === false) {
    return (
      <div className="min-h-screen bg-[#070504] text-[#F5EFE6] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#D4AF37]/20 to-black/60 border border-[#D4AF37]/40 flex items-center justify-center p-3 mb-4 shadow-[0_0_30px_rgba(212,175,55,0.25)]">
          <span className="material-symbols-outlined text-[#D4AF37] text-2xl">qr_code_scanner</span>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#D4AF37] mb-2">
          {t('qr.serviceNotice', 'Service Notice')}
        </span>
        <h2 className="text-xl font-serif font-bold text-white mb-2">{t('qr.tableOrderingPaused', 'QR Table Ordering Paused')}</h2>
        <p className="text-stone-400 text-xs max-w-sm mb-6 leading-relaxed">
          {t('qr.tableOrderingPausedDesc', 'Tabletop QR ordering is currently not active for this restaurant. Please contact your floor server to place your order.')}
        </p>
        <a
          href="/"
          className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#F3C766] text-[#070605] font-bold text-xs uppercase tracking-wider transition-all"
        >
          {t('orderSuccess.backHome', 'Return to Home')}
        </a>
      </div>
    );
  }

  const totals = calculateOrderTotals(items, {
    enabled: restaurantConfig.tax.enabled,
    mode: restaurantConfig.tax.mode,
    label: restaurantConfig.tax.label,
    rate: restaurantConfig.tax.rate,
    serviceCharge: restaurantConfig.tax.serviceCharge,
    rules: restaurantConfig.tax.rules,
  });

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

  const handleCallStaff = () => {
    setIsStaffCalled(true);
    showToast({
      title: 'Floor Staff Notified',
      message: `Table ${tableNumber} assistance request received.`,
      subtext: 'A concierge will attend to your table shortly.',
      type: 'success',
    });
    setTimeout(() => setIsStaffCalled(false), 8000);
  };

  // State 1: Missing table parameter (/qr)
  if (!hasTableParam) {
    return (
      <div className="min-h-screen bg-[#070504] text-[#F5EFE6] flex flex-col justify-between p-6 sm:p-12 font-sans selection:bg-[#D4AF37]/30 selection:text-white">
        <header className="flex flex-col items-center text-center pt-8">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#D4AF37]/20 to-black/60 border border-[#D4AF37]/40 flex items-center justify-center p-3 mb-4 shadow-[0_0_30px_rgba(212,175,55,0.25)]">
            <img src={logoUrl || "/logo.webp"} alt={restaurantConfig.businessName} className="w-full h-full object-contain" />
          </div>
          <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#D4AF37]">
            {t('qr.optical_table_interface', 'Optical Table Interface')}
          </span>
          <h1 className="text-xl sm:text-2xl font-serif font-semibold tracking-wider text-white mt-1">
            {restaurantConfig.businessName}
          </h1>
        </header>

        <main className="max-w-md mx-auto w-full text-center py-12 flex flex-col items-center">
          <div className="p-1 rounded-[2.5rem] bg-gradient-to-b from-white/[0.1] to-white/[0.02] border border-white/[0.08] shadow-2xl w-full">
            <div className="p-8 rounded-[calc(2.5rem-0.25rem)] bg-[#120F0D] flex flex-col items-center">
              <div className="w-20 h-20 rounded-3xl bg-[#0A0705] border border-white/[0.1] flex items-center justify-center mb-6 text-[#D4AF37] shadow-inner">
                <span className="material-symbols-outlined text-4xl">qr_code_scanner</span>
              </div>

              <h2 className="text-2xl font-serif font-semibold text-white mb-2">
                {t('qr.scan_your_table_stand', 'Scan Your Table Stand')}
              </h2>

              <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed mb-8">
                {t('qr.pointCameraDesc', 'To explore our menu and dispatch orders directly from your seat, please point your smartphone camera at the table QR stand.')}
              </p>

              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <a
                  href="/"
                  className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-6 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-white border border-white/[0.08] font-semibold text-xs tracking-wider uppercase transition-colors"
                >
                  <span className="material-symbols-outlined text-base">home</span>
                  <span>{t('qr.mainWebsite', 'Main Website')}</span>
                </a>
                <a
                  href="/qr-generator"
                  className="inline-flex items-center justify-center gap-2 py-3 px-6 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#F3C766] text-[#070605] font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">print</span>
                  <span>{t('qr.staffSetup', 'Staff Setup')}</span>
                </a>
              </div>
            </div>
          </div>
        </main>

        <footer className="text-center text-zinc-400 text-xs py-4 border-t border-white/[0.06] font-mono">
          {restaurantConfig.businessName} • {restaurantConfig.address.city}
        </footer>
      </div>
    );
  }

  // State 2: Invalid table parameter (/qr?table=abc)
  if (!isQrValid || !tableNumber) {
    return (
      <div className="min-h-screen bg-[#070504] text-[#F5EFE6] flex flex-col justify-between p-6 sm:p-12 font-sans selection:bg-[#D4AF37]/30 selection:text-white">
        <header className="flex flex-col items-center text-center pt-8">
          <div className="w-16 h-16 rounded-full bg-red-950/40 border border-red-500/40 flex items-center justify-center p-3 mb-4 shadow-[0_0_25px_rgba(239,68,68,0.2)]">
            <img src={logoUrl || "/logo.webp"} alt={restaurantConfig.businessName} className="w-full h-full object-contain" />
          </div>
          <h1 className="text-xl sm:text-2xl font-serif font-semibold tracking-wider text-white">
            {restaurantConfig.businessName}
          </h1>
          <p className="text-zinc-400 text-xs font-mono tracking-wider uppercase mt-1">
            {t('qr.tableVerification', 'Table Verification Protocol')}
          </p>
        </header>

        <main className="max-w-md mx-auto w-full text-center py-12 flex flex-col items-center">
          <div className="p-1 rounded-[2.5rem] bg-gradient-to-b from-red-500/20 to-transparent border border-red-500/30 shadow-2xl w-full">
            <div className="p-8 rounded-[calc(2.5rem-0.25rem)] bg-[#120F0D] flex flex-col items-center">
              <div className="w-20 h-20 rounded-3xl bg-red-950/60 border border-red-500/40 flex items-center justify-center mb-6 text-red-400 shadow-inner">
                <span className="material-symbols-outlined text-4xl">error_outline</span>
              </div>

              <h2 className="text-2xl font-serif font-semibold text-white mb-2">
                {t('qr.unrecognizedTable', 'Unrecognized Table QR')}
              </h2>

              <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed mb-8">
                {validationError || t('qr.unrecognizedTableDesc', 'The table QR code scanned is invalid or not recognized. Please scan the QR code located on your table again, or ask our staff for assistance.')}
              </p>

              <a
                href="/"
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-8 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#F3C766] text-[#070605] font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95"
              >
                <span className="material-symbols-outlined text-base">arrow_back</span>
                <span>{t('qr.returnToWebsite', 'Return to Website')}</span>
              </a>
            </div>
          </div>
        </main>

        <footer className="text-center text-zinc-400 text-xs py-4 border-t border-white/[0.06] font-mono">
          {restaurantConfig.businessName} • {t('qr.conciergeHelp', 'Concierge Help Available')}
        </footer>
      </div>
    );
  }

  // State 3: Valid Table QR Session (/qr?table=05)
  return (
    <div className="min-h-screen bg-[#070504] text-[#F5EFE6] selection:bg-[#D4AF37]/30 selection:text-white pb-36">
      {/* Top Floating / Header Bar */}
      <header className="sticky top-0 z-40 bg-[#070504]/90 backdrop-blur-xl border-b border-white/[0.08] px-4 py-3 sm:px-8 sm:py-3.5 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Brand Crest */}
          <div className="flex items-center gap-3">
            <a href="/" title={t('qr.go_to_home', 'Go to Home')} className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D4AF37]/25 to-black/60 border border-[#D4AF37]/40 flex items-center justify-center p-1.5 transition-transform group-hover:scale-105 shadow-[0_0_16px_rgba(212,175,55,0.25)] shrink-0">
                <img src={logoUrl || "/logo.webp"} alt="Logo" className="w-full h-full object-contain" />
              </div>
              <div className="hidden xs:block text-left">
                <p className="text-xs font-serif font-semibold tracking-wider text-white leading-tight group-hover:text-[#D4AF37] transition-colors">
                  {restaurantConfig.shortName || restaurantConfig.businessName}
                </p>
                <p className="text-[11px] text-zinc-400 uppercase tracking-widest font-mono">
                  {restaurantConfig.address.city} • {restaurantConfig.address.region || restaurantConfig.address.country}
                </p>
              </div>
            </a>
          </div>

          {/* Luxury In-Seat Hardware Key Indicator Badge */}
          <div className="p-0.5 rounded-full bg-gradient-to-r from-[#D4AF37]/35 via-white/[0.1] to-[#D4AF37]/35 shadow-[0_2px_14px_rgba(0,0,0,0.7)]">
            <div className="flex items-center gap-2.5 px-3.5 sm:px-4 py-1.5 rounded-full bg-[#130E0B] border border-white/[0.04]">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
              </span>
              <div className="text-left">
                <span className="sr-only">{t('qr.orderForTable', 'Ordering from Table')} {tableNumber}</span>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-xs sm:text-sm font-mono font-bold tracking-wider text-[#F3C766] uppercase leading-none">
                    {t('qr.tableLabel', 'TABLE')} {tableNumber}
                  </p>
                  <p className="text-[9px] text-zinc-400 uppercase tracking-widest font-mono leading-none hidden sm:inline">
                    • {t('qr.orderForTable', 'In-Seat Service')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Cart Trigger */}
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            aria-label={t('a11y.openCart', `View cart with ${cartCount} items`)}
            className="relative flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-full bg-[#18120D] hover:bg-[#221912] text-[#F3C766] border border-[#D4AF37]/40 hover:border-[#D4AF37] shadow-[0_2px_12px_rgba(212,175,55,0.15)] transition-all active:scale-95 cursor-pointer group"
          >
            <span className="material-symbols-outlined text-[17px] text-[#D4AF37] group-hover:scale-110 transition-transform">shopping_bag</span>
            <span className="text-xs font-semibold uppercase tracking-wider font-sans text-stone-200 hidden sm:inline">{t('cart.title', 'My Order')}</span>
            {cartCount > 0 ? (
              <span className="w-5 h-5 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#F3C766] text-[#0A0705] font-mono font-black text-[10px] flex items-center justify-center shadow-md">
                {cartCount}
              </span>
            ) : (
              <span className="text-[10px] font-mono text-stone-400 hidden sm:inline">0</span>
            )}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-4 sm:pt-6">
        {/* Cinematic Atmospheric In-Seat Hero Banner */}
        <section
          aria-labelledby="qr-table-heading"
          className="relative mb-6 sm:mb-8 p-1 rounded-3xl bg-gradient-to-b from-[#D4AF37]/25 via-white/[0.06] to-white/[0.02] border border-[#D4AF37]/25 shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden"
        >
          <div className="relative rounded-[calc(1.5rem-0.125rem)] bg-gradient-to-br from-[#18120D] via-[#100C09] to-[#0A0705] p-6 sm:p-9 overflow-hidden">
            {/* Cinematic Background Image Backdrop */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <picture>
                <source srcSet="/images/hero-cinematic.avif" type="image/avif" />
                <source srcSet="/images/hero-cinematic.webp" type="image/webp" />
                <img
                  src="/images/hero-cinematic.webp"
                  alt="Atmospheric Nocturnal Dining"
                  className="w-full h-full object-cover opacity-25 mix-blend-luminosity scale-105"
                  loading="eager"
                  decoding="async"
                />
              </picture>
              <div className="absolute inset-0 bg-gradient-to-r from-[#100C09] via-[#100C09]/90 to-[#100C09]/50" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0A0705] via-transparent to-[#18120D]/60" />
              <div className="absolute right-0 top-0 w-96 h-96 rounded-full bg-[#D4AF37]/10 blur-[120px]" />
            </div>

            <div className="relative z-10 text-left">
              {/* Service Badges */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/35 text-[#F3C766] text-xs font-mono font-bold uppercase tracking-wider shadow-xs">
                  <span className="material-symbols-outlined text-sm text-[#D4AF37]">restaurant</span>
                  <span>{t('qr.tableLabel', 'TABLE')} {tableNumber} • {t('cart.dineIn', 'Table Service')}</span>
                </div>

                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-[11px] font-mono shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{t('qr.welcomeSubtitle', 'Kitchen Direct Service')}</span>
                </div>
              </div>

              {/* Title & Subheading */}
              <h1 id="qr-table-heading" className="text-3xl sm:text-5xl font-serif font-normal text-white tracking-tight mb-2 drop-shadow-md">
                {restaurantConfig.businessName}
              </h1>
              <p className="text-base sm:text-lg text-[#F3C766] font-serif font-light italic mb-2">
                {t('qr.tableLabel', 'TABLE')} {tableNumber} • {t('qr.welcomeTitle', 'Smart Digital Service')}
              </p>
              <p className="text-zinc-300/85 text-xs sm:text-sm max-w-2xl leading-relaxed font-sans font-light">
                {t('menu.curatedGastronomy', 'Explore our freshly prepared artisanal menu below. Add dishes to your bag and submit directly to our kitchen with zero wait time.')}
              </p>

              {/* 3-Pill Hospitality Micro-Deck */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-5 mt-5 border-t border-white/[0.08] text-xs">
                <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-black/40 border border-white/[0.06] backdrop-blur-sm shadow-inner">
                  <div className="w-8 h-8 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#F3C766] shrink-0">
                    <span className="material-symbols-outlined text-base">bolt</span>
                  </div>
                  <div>
                    <p className="text-white font-medium text-xs">{t('qr.directTickets', 'Direct Line Tickets')}</p>
                    <p className="text-stone-400 text-[10px]">{t('qr.zeroWaiting', 'Zero line waiting')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-black/40 border border-white/[0.06] backdrop-blur-sm shadow-inner">
                  <div className="w-8 h-8 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#F3C766] shrink-0">
                    <span className="material-symbols-outlined text-base">room_service</span>
                  </div>
                  <div>
                    <p className="text-white font-medium text-xs">{t('qr.floorConcierge', 'Floor Concierge')}</p>
                    <p className="text-stone-400 text-[10px]">{t('qr.attentiveService', 'Attentive service on-call')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-black/40 border border-white/[0.06] backdrop-blur-sm shadow-inner">
                  <div className="w-8 h-8 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#F3C766] shrink-0">
                    <span className="material-symbols-outlined text-base">payments</span>
                  </div>
                  <div>
                    <p className="text-white font-medium text-xs">{t('qr.flexibleCheckout', 'Flexible Checkout')}</p>
                    <p className="text-stone-400 text-[10px]">{t('qr.instantOnline', 'Counter or instant online')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Existing Cart Conflict Notification */}
        {showCartConflictPrompt && (
          <aside
            role="alert"
            aria-live="polite"
            className="mb-6 p-1 rounded-2xl bg-gradient-to-b from-amber-500/30 to-transparent border border-amber-500/40 shadow-xl"
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
                  className="px-4 py-2 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-zinc-400 hover:text-white border border-white/[0.08] transition-colors cursor-pointer"
                >
                  {t('cart.clearCart', 'Start Fresh')}
                </button>
                <button
                  type="button"
                  onClick={handleKeepItems}
                  className="px-4 py-2 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#F3C766] text-[#070605] text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  {t('common.confirm', 'Keep Items')}
                </button>
              </div>
            </div>
          </aside>
        )}

        {/* Modern Food Photography Catalog Grid Menu */}
        <section aria-label={t('menu.title', 'Restaurant Menu')} className="w-full">
          <Menu isQrMode forcedVariant="catalog-grid" />
        </section>
      </main>

      {/* Floating Sticky Bottom Bar on Mobile/Tablet when Cart has items */}
      {cartCount > 0 && (
        <aside
          role="region"
          aria-label={t('qr.orderSummaryBar', 'Order summary bar')}
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-8 sm:bottom-8 sm:w-96 z-40 transition-all duration-300 animate-in slide-in-from-bottom"
        >
          <div className="p-0.5 rounded-2xl bg-gradient-to-r from-[#D4AF37] via-[#F3C766] to-[#D4AF37] shadow-[0_12px_45px_rgba(0,0,0,0.9)]">
            <div className="flex items-center justify-between gap-4 p-3.5 sm:p-4 rounded-[calc(1rem-0.125rem)] bg-[#0C0806] border border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#F3C766] text-[#070605] flex items-center justify-center font-mono font-black text-sm shadow">
                  {cartCount}
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">{t('qr.tableLabel', 'Table')} {tableNumber}</p>
                  <p className="text-base font-serif font-bold text-white">{formatPrice(totals.total)}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#F3C766] text-[#070605] font-bold text-xs uppercase tracking-wider hover:shadow-[0_6px_20px_rgba(212,175,55,0.4)] active:scale-95 transition-all cursor-pointer shadow-md"
              >
                <span>{t('cart.reviewOrder', 'View Order')}</span>
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Cart Drawer Modal */}
      <CartDrawer />

      {/* Luxury In-Seat Hospitality Concierge Deck */}
      <section className="max-w-4xl mx-auto px-4 mt-12 mb-6">
        <div className="p-1 rounded-3xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06] shadow-xl">
          <div className="rounded-[calc(1.5rem-0.125rem)] bg-[#100C09] p-6 sm:p-8 text-center flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 text-primary flex items-center justify-center shadow-inner">
              <span className="material-symbols-outlined text-2xl font-light">room_service</span>
            </div>

            <div>
              <h3 className="font-serif text-xl sm:text-2xl text-white font-normal mb-1">
                {t('contact.drawerTitle', 'Hospitality Concierge')} • {t('qr.tableLabel', 'Table')} {tableNumber}
              </h3>
              <p className="text-xs sm:text-sm text-stone-400 max-w-lg leading-relaxed font-sans font-light">
                {t('qr.conciergeSubtitle', 'Need extra cutlery, customized spice levels, water refills, or chef recommendations? Our floor team is delighted to assist.')}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleCallStaff}
                disabled={isStaffCalled}
                className={`px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer active:scale-95 ${
                  isStaffCalled
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/50'
                    : 'bg-primary text-on-primary hover:opacity-95 shadow-md shadow-primary/20'
                }`}
              >
                <span className="material-symbols-outlined text-base">{isStaffCalled ? 'check' : 'notifications_active'}</span>
                <span>{isStaffCalled ? t('qr.staffAlerted', 'Floor Staff Alerted') : t('qr.callStaff', 'Call Floor Staff')}</span>
              </button>

              <a
                href="/"
                className="px-5 py-2.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-stone-300 hover:text-white border border-white/[0.1] text-xs font-semibold uppercase tracking-wider transition-colors inline-flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">explore</span>
                <span>{t('common.back', 'Visit Main Site')}</span>
              </a>
            </div>

            <div className="w-full pt-4 mt-2 border-t border-white/[0.06] flex flex-wrap items-center justify-center gap-4 text-[11px] text-stone-300 font-mono">
              <span>{t('qr.wifiGuest', 'Wi-Fi: TheCafe_Guest')}</span>
              <span>•</span>
              <span>{t('qr.zeroWaitDispatch', 'Zero-Wait Line Dispatch')}</span>
              <span>•</span>
              <span>{restaurantConfig.address.city}{restaurantConfig.address.region ? `, ${restaurantConfig.address.region}` : ''}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Discrete Legal & Brand Signature */}
      <footer className="text-center text-zinc-400 text-xs max-w-7xl mx-auto px-4 font-mono pb-6">
        <p className="font-serif uppercase tracking-[0.2em] text-[#D4AF37] text-xs font-semibold mb-1">
          {restaurantConfig.businessName}
        </p>
        <p className="text-zinc-400 text-[11px]">
          {restaurantConfig.address.line1} • {t('qr.handcraftedSanctuary', 'Handcrafted Culinary Sanctuary')}
        </p>
        <div className="mt-2 flex items-center justify-center gap-3 text-[10px] text-zinc-400">
          <span>© {new Date().getFullYear()} {t('footer.allRightsReserved', 'All rights reserved')}</span>
          <span>•</span>
          <span>{t('cart.dineIn', 'Dine-In')} {t('qr.tableLabel', 'Table')} {tableNumber}</span>
          <span>•</span>
          <a href="/" className="hover:text-[#D4AF37] transition-colors underline">{t('common.back', 'Visit Full Website')}</a>
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
