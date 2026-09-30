import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { clientDetails } from '../config/client';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { createOrder } from '../services/orderService';
import { generateClientOrderRef } from '../utils/orderCalculations';
import { useTableContext } from '../context/TableContext';

type DrawerStep = 'cart' | 'details' | 'review';
type OrderType = 'dine-in' | 'takeaway';

export const CartDrawer: React.FC = () => {
  const { items, isDrawerOpen, setIsDrawerOpen, updateQuantity, removeFromCart, cartTotal, clearCart } = useCart();
  const { tableNumber: qrTable, isQrOrder, isValidTable: isQrValid } = useTableContext();
  const [isMobile, setIsMobile] = useState(false);
  const [step, setStep] = useState<DrawerStep>('cart');

  // Checkout Form State
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [orderType, setOrderType] = useState<OrderType>(isQrOrder && isQrValid ? 'dine-in' : 'dine-in');
  const [tableNumber, setTableNumber] = useState(isQrOrder && isQrValid && qrTable ? qrTable : '');
  const [orderNotes, setOrderNotes] = useState('');
  const [orderRef, setOrderRef] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const drawerRef = useFocusTrap(isDrawerOpen, () => {
    setIsDrawerOpen(false);
    setStep('cart');
    setSubmissionError(null);
  });

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);


  // Derive active step to avoid cascading setState inside effects
  const activeStep = items.length === 0 ? 'cart' : step;

  const handleProceedToDetails = () => {
    if (items.length === 0) return;
    if (!orderRef) {
      setOrderRef(generateClientOrderRef());
    }
    if (isQrOrder && isQrValid && qrTable) {
      setOrderType('dine-in');
      setTableNumber(qrTable);
    }
    setErrors({});
    setSubmissionError(null);
    setStep('details');
  };

  const validateDetails = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!customerName.trim() || customerName.trim().length < 2) {
      newErrors.customerName = 'Please enter your full name';
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      newErrors.phone = 'Please enter a valid 10-digit mobile number';
    }

    if (orderType === 'dine-in' && !tableNumber.trim()) {
      newErrors.tableNumber = 'Please specify your table number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleProceedToReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateDetails()) {
      if (!orderRef) {
        setOrderRef(generateClientOrderRef());
      }
      setSubmissionError(null);
      setStep('review');
    }
  };

  const dispatchWhatsApp = (finalRef: string) => {
    const isTableLocked = Boolean(isQrOrder && isQrValid && qrTable);
    const resolvedTable = isTableLocked ? qrTable : tableNumber.trim();
    const resolvedOrderType = isTableLocked ? 'dine-in' : orderType;

    const orderLines = items
      .map((item) => `${item.quantity} × ${item.name}    ₹${item.price * item.quantity}`)
      .join('%0A');

    const serviceInfo =
      resolvedOrderType === 'dine-in'
        ? `Dine-in (Table ${resolvedTable})`
        : 'Takeaway';

    const notesSection = orderNotes.trim() ? `%0A%0ASpecial Notes: ${encodeURIComponent(orderNotes.trim())}` : '';

    const text = `*THE CAFÉ BARRACKPORE*%0A*NEW ORDER: ${finalRef}*%0A%0A*Customer:* ${encodeURIComponent(customerName.trim())}%0A*Phone:* ${phone.trim()}%0A*Order Type:* ${encodeURIComponent(serviceInfo)}${notesSection}%0A%0A---%0A${orderLines}%0A---%0A%0A*Subtotal: ₹${cartTotal}*%0A%0APlease confirm this order.`;

    const cleanTargetPhone = clientDetails.whatsapp.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanTargetPhone}?text=${text}`, '_blank');

    // Clear cart and reset state
    clearCart();
    setStep('cart');
    setOrderRef('');
    setSubmissionError(null);
    setIsDrawerOpen(false);
  };

  const handleConfirmOrder = async () => {
    if (items.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    setSubmissionError(null);

    const activeRef = orderRef || generateClientOrderRef();
    const isTableLocked = Boolean(isQrOrder && isQrValid && qrTable);
    const resolvedTable = isTableLocked ? qrTable : (orderType === 'dine-in' ? tableNumber.trim() : null);
    const resolvedOrderType = isTableLocked ? 'dine_in' : (orderType === 'dine-in' ? 'dine_in' : 'takeaway');

    try {
      const result = await createOrder({
        order_ref: activeRef,
        customer_name: customerName,
        customer_phone: phone,
        order_type: resolvedOrderType,
        table_number: resolvedTable,
        special_requests: orderNotes.trim() || null,
        items,
        source: isTableLocked ? 'qr' : 'website',
      });

      if (result.success) {
        dispatchWhatsApp(result.orderRef);
      } else {
        setSubmissionError(result.error || 'Unable to register order with the server.');
      }
    } catch (err) {
      console.error('[CartDrawer] Unexpected error confirming order:', err);
      setSubmissionError('Network error while saving order. You can still confirm directly via WhatsApp.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isDrawerOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setIsDrawerOpen(false);
              setStep('cart');
            }}
            className="fixed inset-0 bg-surface-container-lowest/80 z-[100]"
          />

          {/* Drawer / Bottom Sheet */}
          <motion.div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-drawer-heading"
            tabIndex={-1}
            initial={isMobile ? { y: '100%' } : { x: '100%' }}
            animate={isMobile ? { y: 0 } : { x: 0 }}
            exit={isMobile ? { y: '100%' } : { x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            drag={isMobile ? 'y' : false}
            dragConstraints={isMobile ? { top: 0 } : undefined}
            dragElastic={isMobile ? 0.2 : undefined}
            onDragEnd={(_e, info) => {
              if (isMobile && info.offset.y > 100) {
                setIsDrawerOpen(false);
                setStep('cart');
              }
            }}
            className={`fixed bg-[#130C08]/95 backdrop-blur-2xl z-[101] flex flex-col focus:outline-none shadow-[-25px_0_60px_rgba(0,0,0,0.85)] ${
              isMobile
                ? 'bottom-0 left-0 w-full h-[90vh] rounded-t-[2rem] border-t border-[#D4AF37]/25'
                : 'top-0 right-0 h-full w-full max-w-[460px] border-l border-[#D4AF37]/25'
            }`}
            data-lenis-prevent
          >
            {/* Drag Handle for Mobile */}
            {isMobile && (
              <div className="w-full flex justify-center pt-3 pb-1 bg-[#160E0A] rounded-t-[2rem] cursor-grab active:cursor-grabbing">
                <div className="w-12 h-1.5 bg-white/20 rounded-full" />
              </div>
            )}

            {/* Header */}
            <div
              className={`flex items-center justify-between px-6 py-4 border-b border-[#D4AF37]/15 bg-[#160E0A]/90 ${
                isMobile ? 'pt-2' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                {activeStep !== 'cart' && (
                  <button
                    type="button"
                    onClick={() => setStep(activeStep === 'review' ? 'details' : 'cart')}
                    className="w-8 h-8 rounded-full text-on-surface/70 hover:text-primary hover:bg-white/5 flex items-center justify-center transition-colors cursor-pointer"
                    aria-label="Back to previous step"
                  >
                    <span className="material-symbols-outlined text-lg">arrow_back</span>
                  </button>
                )}
                <div>
                  <span className="editorial-eyebrow text-[9px] block">Artisanal Dining</span>
                  <div className="flex items-center gap-2">
                    <h2 id="cart-drawer-heading" className="font-serif text-on-surface font-medium text-xl tracking-tight">
                      {activeStep === 'cart' && 'Your Order Bag'}
                      {activeStep === 'details' && 'Guest Details'}
                      {activeStep === 'review' && 'Confirm & Dispatch'}
                    </h2>
                    {items.length > 0 && activeStep === 'cart' && (
                      <span className="px-2 py-0.5 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-primary text-[10px] font-sans font-semibold">
                        {items.reduce((acc, i) => acc + i.quantity, 0)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsDrawerOpen(false);
                  setStep('cart');
                }}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-on-surface/60 hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Close cart drawer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {/* Luxury 3-Step Breadcrumb Bar */}
            <div className="px-6 py-2.5 border-b border-[#D4AF37]/10 bg-[#110B07] flex items-center justify-between text-[11px] font-sans">
              <div className={`flex items-center gap-1.5 ${activeStep === 'cart' ? 'text-primary font-medium' : 'text-on-surface/40'}`}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${activeStep === 'cart' ? 'bg-primary text-[#120B08]' : 'bg-white/10 text-white/50'}`}>1</span>
                <span>Bag</span>
              </div>
              <span className="w-8 h-[1px] bg-white/10" />
              <div className={`flex items-center gap-1.5 ${activeStep === 'details' ? 'text-primary font-medium' : 'text-on-surface/40'}`}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${activeStep === 'details' ? 'bg-primary text-[#120B08]' : 'bg-white/10 text-white/50'}`}>2</span>
                <span>Details</span>
              </div>
              <span className="w-8 h-[1px] bg-white/10" />
              <div className={`flex items-center gap-1.5 ${activeStep === 'review' ? 'text-primary font-medium' : 'text-on-surface/40'}`}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${activeStep === 'review' ? 'bg-primary text-[#120B08]' : 'bg-white/10 text-white/50'}`}>3</span>
                <span>Review</span>
              </div>
            </div>

            {/* STEP 1: CART ITEMS */}
            {activeStep === 'cart' && (
              <>
                <div className="flex-1 overflow-y-auto min-h-0 p-5 sm:p-6 flex flex-col gap-3 custom-scrollbar">
                  {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-on-surface/60 gap-4 py-16">
                      <div className="w-16 h-16 rounded-full bg-[#1C120D] border border-[#D4AF37]/25 flex items-center justify-center text-primary shadow-[0_0_20px_rgba(212,175,55,0.15)]">
                        <span className="material-symbols-outlined text-3xl font-light">shopping_bag</span>
                      </div>
                      <div className="text-center">
                        <p className="font-serif text-lg text-on-surface font-normal">Your order bag is empty</p>
                        <p className="font-sans text-xs text-on-surface/50 mt-1">Explore our artisanal roasts &amp; comfort kitchen dishes.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsDrawerOpen(false)}
                        className="mt-2 px-6 py-2.5 rounded-full btn-premium text-xs font-semibold uppercase tracking-wider cursor-pointer shadow-md"
                      >
                        Explore Menu
                      </button>
                    </div>
                  ) : (
                    <AnimatePresence>
                      {items.map((item) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          className="group relative flex gap-3.5 p-3.5 rounded-2xl bg-gradient-to-br from-[#1C120D] via-[#160E0A] to-[#110B07] border border-[#D4AF37]/20 hover:border-[#D4AF37]/45 shadow-[0_4px_16px_rgba(0,0,0,0.4)] transition-all"
                        >
                          {item.image ? (
                            <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-[#D4AF37]/20 bg-[#0E0705]">
                              <img
                                loading="lazy"
                                src={item.image}
                                alt={item.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                            </div>
                          ) : (
                            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#D4AF37]/15 to-[#0E0705] flex items-center justify-center shrink-0 border border-[#D4AF37]/30 text-primary">
                              <span className="material-symbols-outlined text-2xl">restaurant</span>
                            </div>
                          )}
                          <div className="flex-1 flex flex-col justify-between min-w-0">
                            <div>
                              <div className="flex justify-between items-start gap-2">
                                <h4 className="font-serif text-sm font-medium text-on-surface truncate">
                                  {item.name}
                                </h4>
                                <button
                                  type="button"
                                  onClick={() => removeFromCart(item.id)}
                                  aria-label={`Remove ${item.name} from cart`}
                                  className="w-6 h-6 rounded-md hover:bg-red-500/10 text-on-surface/35 hover:text-red-400 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-sm">delete</span>
                                </button>
                              </div>
                              <span className="font-serif text-xs text-primary/90 font-normal tabular-nums">
                                ₹{item.price} each
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-2 gap-2">
                              {/* Touch-Friendly Luxury Stepper Controls */}
                              <div className="flex items-center gap-1.5 bg-[#0D0705] px-2 py-0.5 rounded-full border border-white/10 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                  aria-label={`Decrease quantity of ${item.name}`}
                                  className="w-6 h-6 rounded-full hover:bg-white/10 text-on-surface/80 hover:text-primary flex items-center justify-center transition-colors cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-xs">remove</span>
                                </button>
                                <span className="font-sans text-xs font-semibold text-white w-4 text-center tabular-nums">
                                  {item.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                  aria-label={`Increase quantity of ${item.name}`}
                                  className="w-6 h-6 rounded-full hover:bg-white/10 text-on-surface/80 hover:text-primary flex items-center justify-center transition-colors cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-xs">add</span>
                                </button>
                              </div>
                              <span className="font-serif text-sm text-primary font-medium tabular-nums">
                                ₹{item.price * item.quantity}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  )}
                </div>

                {items.length > 0 && (
                  <div className="p-5 sm:p-6 border-t border-[#D4AF37]/15 bg-[#140D09]/95 backdrop-blur-xl flex flex-col gap-3 shadow-[0_-10px_35px_rgba(0,0,0,0.7)]">
                    <div className="flex justify-between items-center text-xs text-on-surface/70 font-sans">
                      <span>Subtotal ({items.reduce((acc, i) => acc + i.quantity, 0)} items)</span>
                      <span className="font-serif text-sm font-medium text-on-surface tabular-nums">₹{cartTotal}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-on-surface/50 font-sans pb-2 border-b border-white/5">
                      <span>Taxes &amp; Service Charges</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold uppercase tracking-wider">
                        Included
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-on-surface pt-0.5">
                      <span className="font-sans text-xs font-semibold uppercase tracking-wider text-on-surface/90">Total Payable</span>
                      <span className="font-serif text-2xl font-normal text-primary tabular-nums">₹{cartTotal}</span>
                    </div>
                    <div className="flex gap-2.5 pt-1.5">
                      <button
                        type="button"
                        onClick={clearCart}
                        className="h-12 px-4 rounded-full border border-white/15 hover:border-white/30 text-on-surface/75 hover:text-on-surface text-xs font-sans font-semibold uppercase tracking-wider transition-colors cursor-pointer"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={handleProceedToDetails}
                        className="group relative flex-1 h-12 rounded-full bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C5A028] text-[#120B08] font-semibold text-xs tracking-wider uppercase shadow-[0_4px_24px_rgba(212,175,55,0.28)] hover:shadow-[0_6px_32px_rgba(212,175,55,0.45)] transition-all duration-300 flex items-center justify-between pl-6 pr-2 cursor-pointer"
                      >
                        <span>Proceed to Details</span>
                        <span className="w-8 h-8 rounded-full bg-[#120B08]/15 flex items-center justify-center transition-transform duration-300 group-hover:translate-x-1 group-hover:scale-105">
                          <span className="material-symbols-outlined text-[16px] text-[#120B08]">arrow_forward</span>
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* STEP 2: CHECKOUT DETAILS FORM */}
            {activeStep === 'details' && (
              <form onSubmit={handleProceedToReview} className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 flex flex-col gap-4 custom-scrollbar bg-[#130C08]">
                  {/* Customer Name */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="checkout-name" className="font-sans text-[11px] uppercase tracking-wider text-on-surface/75 font-medium">
                      Your Full Name <span className="text-primary">*</span>
                    </label>
                    <input
                      id="checkout-name"
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        if (errors.customerName) setErrors((prev) => ({ ...prev, customerName: '' }));
                      }}
                      placeholder="e.g. Rahul Sharma"
                      className={`w-full bg-[#0D0705] border rounded-xl px-4 py-3 text-on-surface font-sans text-sm focus:outline-none transition-colors placeholder:text-white/20 ${
                        errors.customerName ? 'border-red-400 focus:border-red-400' : 'border-white/10 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/40'
                      }`}
                    />
                    {errors.customerName && (
                      <span role="alert" className="text-red-400 text-xs font-sans">
                        {errors.customerName}
                      </span>
                    )}
                  </div>

                  {/* Phone Number */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="checkout-phone" className="font-sans text-[11px] uppercase tracking-wider text-on-surface/75 font-medium">
                      Mobile Number <span className="text-primary">*</span>
                    </label>
                    <input
                      id="checkout-phone"
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
                      }}
                      placeholder="e.g. 9876543210"
                      className={`w-full bg-[#0D0705] border rounded-xl px-4 py-3 text-on-surface font-sans text-sm focus:outline-none transition-colors placeholder:text-white/20 ${
                        errors.phone ? 'border-red-400 focus:border-red-400' : 'border-white/10 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/40'
                      }`}
                    />
                    {errors.phone && (
                      <span role="alert" className="text-red-400 text-xs font-sans">
                        {errors.phone}
                      </span>
                    )}
                  </div>

                  {/* Order Type & Table Selection */}
                  {isQrOrder && isQrValid && qrTable ? (
                    <div className="flex flex-col gap-1.5">
                      <label className="font-sans text-[11px] uppercase tracking-wider text-on-surface/75 font-medium">
                        Dining Mode
                      </label>
                      <div className="p-4 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined text-xl">table_restaurant</span>
                          </div>
                          <div>
                            <div className="font-sans text-[10px] uppercase tracking-wider text-primary font-bold">
                              Dine-in Order
                            </div>
                            <div className="font-serif text-sm font-semibold text-on-surface">
                              Table {qrTable}
                            </div>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider">
                          QR Session
                        </span>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Order Type Selection */}
                      <div className="flex flex-col gap-1.5">
                        <label className="font-sans text-[11px] uppercase tracking-wider text-on-surface/75 font-medium">
                          Dining Mode <span className="text-primary">*</span>
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setOrderType('dine-in');
                              if (errors.tableNumber) setErrors((prev) => ({ ...prev, tableNumber: '' }));
                            }}
                            className={`py-3 px-4 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                              orderType === 'dine-in'
                                ? 'bg-primary/15 border-primary text-primary font-semibold shadow-sm'
                                : 'bg-[#0D0705] border-white/10 text-on-surface/70 hover:border-white/20'
                            }`}
                          >
                            <span className="material-symbols-outlined text-xl">table_restaurant</span>
                            <span className="font-sans text-xs uppercase tracking-wider">Dine-in</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOrderType('takeaway');
                              if (errors.tableNumber) setErrors((prev) => ({ ...prev, tableNumber: '' }));
                            }}
                            className={`py-3 px-4 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                              orderType === 'takeaway'
                                ? 'bg-primary/15 border-primary text-primary font-semibold shadow-sm'
                                : 'bg-[#0D0705] border-white/10 text-on-surface/70 hover:border-white/20'
                            }`}
                          >
                            <span className="material-symbols-outlined text-xl">shopping_bag</span>
                            <span className="font-sans text-xs uppercase tracking-wider">Takeaway</span>
                          </button>
                        </div>
                      </div>

                      {/* Table Number (Only if Dine-in) */}
                      {orderType === 'dine-in' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex flex-col gap-1.5"
                        >
                          <label htmlFor="checkout-table" className="font-sans text-[11px] uppercase tracking-wider text-on-surface/75 font-medium">
                            Table Number <span className="text-primary">*</span>
                          </label>
                          <input
                            id="checkout-table"
                            type="text"
                            required
                            value={tableNumber}
                            onChange={(e) => {
                              setTableNumber(e.target.value);
                              if (errors.tableNumber) setErrors((prev) => ({ ...prev, tableNumber: '' }));
                            }}
                            placeholder="e.g. Table 04 or Booth 2"
                            className={`w-full bg-[#0D0705] border rounded-xl px-4 py-3 text-on-surface font-sans text-sm focus:outline-none transition-colors placeholder:text-white/20 ${
                              errors.tableNumber ? 'border-red-400 focus:border-red-400' : 'border-white/10 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/40'
                            }`}
                          />
                          {errors.tableNumber && (
                            <span role="alert" className="text-red-400 text-xs font-sans">
                              {errors.tableNumber}
                            </span>
                          )}
                        </motion.div>
                      )}
                    </>
                  )}

                  {/* Special Instructions (Optional) */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="checkout-notes" className="font-sans text-[11px] uppercase tracking-wider text-on-surface/75 font-medium">
                      Kitchen Requests (Optional)
                    </label>
                    <textarea
                      id="checkout-notes"
                      rows={2}
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      placeholder="e.g. Less spicy, allergy notes, extra napkins..."
                      className="w-full bg-[#0D0705] border border-white/10 rounded-xl px-4 py-2.5 text-on-surface font-sans text-sm focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/40 transition-colors resize-none placeholder:text-white/20"
                    />
                  </div>
                </div>

                {/* Footer Submit */}
                <div className="p-5 sm:p-6 border-t border-[#D4AF37]/15 bg-[#140D09]/95 backdrop-blur-xl flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setStep('cart')}
                    className="h-12 px-5 rounded-full border border-white/15 hover:bg-white/5 transition-colors text-on-surface/80 hover:text-on-surface font-sans text-xs font-semibold uppercase tracking-wider cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="group relative flex-1 h-12 rounded-full bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C5A028] text-[#120B08] font-semibold text-xs tracking-wider uppercase shadow-[0_4px_24px_rgba(212,175,55,0.28)] hover:shadow-[0_6px_32px_rgba(212,175,55,0.45)] transition-all duration-300 flex items-center justify-between pl-6 pr-2 cursor-pointer"
                  >
                    <span>Review Order</span>
                    <span className="w-8 h-8 rounded-full bg-[#120B08]/15 flex items-center justify-center transition-transform duration-300 group-hover:translate-x-1 group-hover:scale-105">
                      <span className="material-symbols-outlined text-[16px] text-[#120B08]">arrow_forward</span>
                    </span>
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: REVIEW ORDER & SEND */}
            {activeStep === 'review' && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 flex flex-col gap-4 custom-scrollbar bg-[#130C08]">
                  {/* Reference Banner */}
                  <div className="p-4 rounded-2xl bg-primary/10 border border-primary/30 flex flex-col gap-1">
                    <span className="font-sans text-[10px] uppercase tracking-widest text-primary font-bold">
                      Order Reference
                    </span>
                    <span className="font-serif text-2xl text-primary font-semibold tracking-wider tabular-nums">
                      {orderRef}
                    </span>
                    <span className="font-sans text-xs text-on-surface/60">
                      Unique reference for your kitchen order ticket.
                    </span>
                  </div>

                  {/* Customer Summary Card */}
                  <div className="p-4 rounded-2xl bg-[#160E0A] border border-[#D4AF37]/20 flex flex-col gap-2.5">
                    <div className="flex justify-between items-center text-xs font-sans border-b border-white/5 pb-2">
                      <span className="text-on-surface/60 uppercase tracking-wider">Customer</span>
                      <span className="text-on-surface font-medium">{customerName}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-sans border-b border-white/5 pb-2">
                      <span className="text-on-surface/60 uppercase tracking-wider">Phone</span>
                      <span className="text-on-surface font-medium">{phone}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-sans border-b border-white/5 pb-2">
                      <span className="text-on-surface/60 uppercase tracking-wider">Service</span>
                      <span className="text-primary font-medium">
                        {(isQrOrder && isQrValid && qrTable) || orderType === 'dine-in'
                          ? `Dine-in (Table ${isQrOrder && isQrValid && qrTable ? qrTable : tableNumber})`
                          : 'Takeaway'}
                      </span>
                    </div>
                    {orderNotes.trim() && (
                      <div className="flex flex-col text-xs font-sans pt-1">
                        <span className="text-on-surface/60 uppercase tracking-wider">Kitchen Notes</span>
                        <span className="text-on-surface/85 mt-1 italic">"{orderNotes}"</span>
                      </div>
                    )}
                  </div>

                  {/* Items Summary */}
                  <div className="p-4 rounded-2xl bg-[#160E0A] border border-[#D4AF37]/20 flex flex-col gap-2">
                    <span className="font-sans text-[11px] uppercase tracking-wider text-primary font-semibold mb-1">
                      Ordered Line Items ({items.reduce((acc, i) => acc + i.quantity, 0)})
                    </span>
                    {items.map((item) => (
                      <div key={item.id} className="flex justify-between items-center text-xs py-1.5 border-b border-white/5 last:border-none">
                        <span className="text-on-surface/85">
                          {item.quantity} × {item.name}
                        </span>
                        <span className="font-serif text-primary font-normal tabular-nums">
                          ₹{item.price * item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Total Amount Box */}
                  <div className="p-4 rounded-2xl bg-[#140D09] border border-[#D4AF37]/30 flex justify-between items-center">
                    <span className="font-sans text-xs font-semibold uppercase tracking-wider text-on-surface">Total Amount</span>
                    <span className="font-serif text-2xl font-normal text-primary tabular-nums">
                      ₹{cartTotal}
                    </span>
                  </div>

                  {/* Submission Notice / Fallback if Supabase was unreachable */}
                  {submissionError && (
                    <div className="p-4 rounded-xl bg-error/10 border border-error/30 text-xs flex flex-col gap-2">
                      <div className="flex items-center gap-1.5 font-bold text-red-400">
                        <span className="material-symbols-outlined text-base">warning</span>
                        <span>Backend Registration Notice</span>
                      </div>
                      <p className="text-on-surface/80 leading-relaxed font-sans">
                        {submissionError}
                      </p>
                      <button
                        type="button"
                        onClick={() => dispatchWhatsApp(orderRef || generateClientOrderRef())}
                        className="text-left font-semibold text-primary underline hover:text-primary/80 transition-colors pt-1 cursor-pointer"
                      >
                        Continue and dispatch directly via WhatsApp ➔
                      </button>
                    </div>
                  )}
                </div>

                {/* Footer Submit */}
                <div className="p-5 sm:p-6 border-t border-[#D4AF37]/15 bg-[#140D09]/95 backdrop-blur-xl flex gap-2.5">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      setSubmissionError(null);
                      setStep('details');
                    }}
                    className="h-12 px-5 rounded-full border border-white/15 hover:bg-white/5 transition-colors text-on-surface/80 hover:text-on-surface font-sans text-xs font-semibold uppercase tracking-wider disabled:opacity-50 cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleConfirmOrder}
                    className="group relative flex-1 h-12 rounded-full bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C5A028] text-[#120B08] font-semibold text-xs tracking-wider uppercase shadow-[0_4px_24px_rgba(212,175,55,0.28)] hover:shadow-[0_6px_32px_rgba(212,175,55,0.45)] transition-all duration-300 flex items-center justify-between pl-6 pr-2 cursor-pointer shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>{isSubmitting ? 'Saving Order...' : 'Send via WhatsApp'}</span>
                    <span className="w-8 h-8 rounded-full bg-[#120B08]/15 flex items-center justify-center transition-transform duration-300 group-hover:translate-x-1 group-hover:scale-105">
                      <span className="material-symbols-outlined text-[16px] text-[#120B08]">send</span>
                    </span>
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
