import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { clientDetails } from '../config/client';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { createOrder, updatePendingOrder } from '../services/orderService';
import { generateClientOrderRef, calculateOrderTotals } from '../utils/orderCalculations';
import { useTableContext } from '../context/TableContext';
import { useSiteConfig } from '../context/SiteConfigContext';
import { validatePhoneNumber } from '../utils/phone';
import { isItemAvailable } from '../services/menuAvailabilityService';
import {
  validateAndCalculateOrderPayment,
  createPaymentSession,
  verifyAndReconcilePayment,
} from '../services/paymentService';
import { TurnstileWidget } from './TurnstileWidget';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { PaymentCheckoutResult } from '../types/payment';
import {
  getActiveHappyHour,
  validateDiscountCode,
} from '../services/ownerService';
import type { ActiveHappyHour, DiscountValidationResult } from '../types/owner';

type DrawerStep = 'cart' | 'details' | 'review' | 'payment_process' | 'payment_failed' | 'confirmed';
type OrderType = 'dine-in' | 'takeaway';

export const CartDrawer: React.FC = () => {
  const { items, isDrawerOpen, setIsDrawerOpen, updateQuantity, removeFromCart, clearCart } = useCart();
  const { tableNumber: qrTable, isQrOrder, isValidTable: isQrValid } = useTableContext();
  const { restaurantConfig, formatPrice } = useSiteConfig();
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
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  // Marketing Consent & Promotions
  const [marketingConsent, setMarketingConsent] = useState(true);
  const [activeHappyHour, setActiveHappyHour] = useState<ActiveHappyHour | null>(null);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<DiscountValidationResult | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [isValidatingDiscount, setIsValidatingDiscount] = useState(false);

  // Payment Architecture State (Phase 1J)
  const [paymentMethodChoice, setPaymentMethodChoice] = useState<'online' | 'counter'>('online');
  const [activePaymentSessionId, setActivePaymentSessionId] = useState<string | null>(null);
  const [paymentFailureReason, setPaymentFailureReason] = useState<string | null>(null);
  const [paidAmount, setPaidAmount] = useState<number | null>(null);
  const [confirmedTotal, setConfirmedTotal] = useState<number | null>(null);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [paymentToken, setPaymentToken] = useState<string | null>(null);

  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setStep('cart');
    setSubmissionError(null);
    setPaymentFailureReason(null);
    setConfirmedTotal(null);
    setPaymentToken(null);
  }, [setIsDrawerOpen]);

  const drawerRef = useFocusTrap(isDrawerOpen, handleCloseDrawer);

  // Lock body scroll while cart drawer is open
  useEffect(() => {
    if (isDrawerOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isDrawerOpen]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const totals = calculateOrderTotals(items, {
    enabled: restaurantConfig.tax.enabled,
    mode: restaurantConfig.tax.mode,
    label: restaurantConfig.tax.label,
    rate: restaurantConfig.tax.rate,
    serviceCharge: restaurantConfig.tax.serviceCharge,
    rules: restaurantConfig.tax.rules,
  });

  // Fetch active happy hour when drawer is open
  useEffect(() => {
    if (isDrawerOpen) {
      getActiveHappyHour().then(setActiveHappyHour);
    }
  }, [isDrawerOpen]);

  // Promotions and Happy Hour Calculations
  const happyHourDiscount = activeHappyHour && !appliedDiscount
    ? Math.round(totals.subtotal * (activeHappyHour.discount_percentage / 100))
    : 0;
  const effectiveDiscount = appliedDiscount
    ? (appliedDiscount.discount_amount || 0)
    : happyHourDiscount;
  const finalPayableTotal = Math.max(0, totals.total - effectiveDiscount);
  const activeDiscountLabel = appliedDiscount
    ? `Promo (${appliedDiscount.code})`
    : activeHappyHour
    ? `${activeHappyHour.label} (${activeHappyHour.discount_percentage}% OFF)`
    : null;

  const handleApplyPromoCode = async () => {
    if (!promoCodeInput.trim()) return;
    setIsValidatingDiscount(true);
    setDiscountError(null);
    try {
      const res = await validateDiscountCode(promoCodeInput.trim(), totals.subtotal);
      if (res.valid) {
        setAppliedDiscount(res);
        setPromoCodeInput('');
      } else {
        setDiscountError(res.error || 'Invalid discount code.');
      }
    } catch {
      setDiscountError('Failed to validate discount code.');
    } finally {
      setIsValidatingDiscount(false);
    }
  };

  const handleRemoveDiscount = () => {
    setAppliedDiscount(null);
    setDiscountError(null);
  };

  // Payment Configuration Resolution
  const isPaymentEnabled = Boolean(
    restaurantConfig.payments?.enabled && restaurantConfig.payments?.mode !== 'disabled'
  );
  const paymentMode = restaurantConfig.payments?.mode || 'disabled';
  const isOnlinePayment =
    isPaymentEnabled &&
    (paymentMode === 'online' || (paymentMode === 'optional' && paymentMethodChoice === 'online'));

  // Derive active step to avoid cascading setState inside effects
  const activeStep = items.length === 0 && step !== 'confirmed' ? 'cart' : step;

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

    const phoneVal = validatePhoneNumber(phone, restaurantConfig.phoneCountryCode);
    if (!phoneVal.valid) {
      newErrors.phone = phoneVal.error || 'Please enter a valid phone number';
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
      .map((item) => `${item.quantity} × ${item.name}    ${formatPrice(item.price * item.quantity)}`)
      .join('%0A');

    const serviceInfo =
      resolvedOrderType === 'dine-in'
        ? `Dine-in (Table ${resolvedTable})`
        : 'Takeaway';

    const notesSection = orderNotes.trim() ? `%0A%0ASpecial Notes: ${encodeURIComponent(orderNotes.trim())}` : '';
    const discountSection = effectiveDiscount > 0
      ? `%0A*Discount (${encodeURIComponent(activeDiscountLabel || 'Promo')}):* -${encodeURIComponent(formatPrice(effectiveDiscount))}`
      : '';

    const text = `*${encodeURIComponent(restaurantConfig.businessName.toUpperCase())}*%0A*NEW ORDER: ${finalRef}*%0A%0A*Customer:* ${encodeURIComponent(customerName.trim())}%0A*Phone:* ${phone.trim()}%0A*Order Type:* ${encodeURIComponent(serviceInfo)}${notesSection}%0A%0A---%0A${orderLines}%0A---${discountSection}%0A%0A*Total: ${encodeURIComponent(formatPrice(finalPayableTotal))}*%0A%0APlease confirm this order.`;

    const cleanTargetPhone = (restaurantConfig.contact.whatsapp || clientDetails.whatsapp).replace(/\D/g, '');
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
    setPaymentFailureReason(null);

    const activeRef = orderRef || generateClientOrderRef();
    setOrderRef(activeRef);

    const isTableLocked = Boolean(isQrOrder && isQrValid && qrTable);
    const resolvedTable = isTableLocked ? qrTable : (orderType === 'dine-in' ? tableNumber.trim() : null);
    const resolvedOrderType = isTableLocked ? 'dine_in' : (orderType === 'dine-in' ? 'dine_in' : 'takeaway');
    const phoneVal = validatePhoneNumber(phone, restaurantConfig.phoneCountryCode);
    const normalizedPhone = phoneVal.normalized || phone.trim();

    // Pre-check: Ensure no items in cart are 86'd (sold out)
    const unavailableItem = items.find((i) => !isItemAvailable(i.id));
    if (unavailableItem) {
      setSubmissionError(`"${unavailableItem.name}" is currently sold out. Please remove it from your cart to proceed.`);
      setIsSubmitting(false);
      return;
    }

    try {
      if (isOnlinePayment) {
        // 1. Authoritative Server-side Price & 86'd Availability Validation (Section 12 & 13)
        const validation = await validateAndCalculateOrderPayment(
          items,
          {
            enabled: restaurantConfig.tax.enabled,
            mode: restaurantConfig.tax.mode,
            label: restaurantConfig.tax.label,
            rate: restaurantConfig.tax.rate,
            serviceCharge: restaurantConfig.tax.serviceCharge,
            rules: restaurantConfig.tax.rules,
          },
          totals.total,
          true
        );

        if (!validation.valid) {
          setSubmissionError(validation.error || 'Menu pricing validation failed.');
          setIsSubmitting(false);
          return;
        }

        const authoritativeTotal = validation.totals!.total;

        // 2. Register order in database with pending payment status
        const orderResult = await createOrder({
          order_ref: activeRef,
          customer_name: customerName,
          customer_phone: normalizedPhone,
          order_type: resolvedOrderType,
          table_number: resolvedTable,
          special_requests: orderNotes.trim() || null,
          items,
          source: isTableLocked ? 'qr' : 'website',
          currency: restaurantConfig.currency,
          payment_required: true,
          payment_status: 'pending',
          payment_provider: restaurantConfig.payments.provider,
          payment_amount: Math.max(0, authoritativeTotal - effectiveDiscount),
          discount_code: appliedDiscount?.code || (activeHappyHour ? activeHappyHour.label : null),
          discount_amount: effectiveDiscount,
          marketing_consent: marketingConsent,
          captcha_token: captchaToken || undefined,
          tax_options: {
            enabled: restaurantConfig.tax.enabled,
            mode: restaurantConfig.tax.mode,
            label: restaurantConfig.tax.label,
            rate: restaurantConfig.tax.rate,
            serviceCharge: restaurantConfig.tax.serviceCharge,
            rules: restaurantConfig.tax.rules,
          },
        });

        if (!orderResult.success) {
          setSubmissionError(orderResult.error || 'Unable to register order for payment.');
          setIsSubmitting(false);
          return;
        }

        if (orderResult.paymentToken) {
          setPaymentToken(orderResult.paymentToken);
        }

        // 3. Create payment session via provider abstraction
        const sessionResult = await createPaymentSession(
          {
            orderId: orderResult.orderId || activeRef,
            orderRef: activeRef,
            paymentToken: orderResult.paymentToken,
            amount: Math.max(0, authoritativeTotal - effectiveDiscount),
            currency: restaurantConfig.currency,
            customerName: customerName.trim(),
            customerPhone: normalizedPhone,
            items: items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price })),
          },
          restaurantConfig.payments.provider
        );

        if (!sessionResult.success) {
          setPaymentFailureReason(sessionResult.error || 'Payment gateway initialization failed.');
          setStep('payment_failed');
          setIsSubmitting(false);
          return;
        }

        setActivePaymentSessionId(sessionResult.paymentId || null);

        // Open provider-specific checkout (Razorpay modal with UPI/Cards, or Stripe Checkout URL)
        if (restaurantConfig.payments.provider === 'razorpay' && (sessionResult.razorpayOrderId || sessionResult.orderId)) {
          openRazorpayCheckout(sessionResult, activeRef, orderResult.paymentToken);
        } else if (restaurantConfig.payments.provider === 'stripe' && sessionResult.checkoutUrl) {
          startListeningForPayment(activeRef, orderResult.paymentToken);
          window.location.href = sessionResult.checkoutUrl;
        } else {
          setStep('payment_process');
        }
      } else {
        // Pay-at-counter or Payment Disabled Checkout
        const result = await createOrder({
          order_ref: activeRef,
          customer_name: customerName,
          customer_phone: normalizedPhone,
          order_type: resolvedOrderType,
          table_number: resolvedTable,
          special_requests: orderNotes.trim() || null,
          items,
          source: isTableLocked ? 'qr' : 'website',
          currency: restaurantConfig.currency,
          payment_required: false,
          payment_status: 'not_required',
          payment_amount: finalPayableTotal,
          discount_code: appliedDiscount?.code || (activeHappyHour ? activeHappyHour.label : null),
          discount_amount: effectiveDiscount,
          marketing_consent: marketingConsent,
          captcha_token: captchaToken || undefined,
          tax_options: {
            enabled: restaurantConfig.tax.enabled,
            mode: restaurantConfig.tax.mode,
            label: restaurantConfig.tax.label,
            rate: restaurantConfig.tax.rate,
            serviceCharge: restaurantConfig.tax.serviceCharge,
            rules: restaurantConfig.tax.rules,
          },
        });

        if (result.success) {
          if (restaurantConfig.contact.primaryMethod === 'whatsapp') {
            dispatchWhatsApp(result.orderRef);
          } else {
            setOrderRef(result.orderRef);
            setPaidAmount(null);
            setConfirmedTotal(finalPayableTotal);
            setStep('confirmed');
            clearCart();
          }
        } else {
          setSubmissionError(result.error || 'Unable to register order with the server.');
        }
      }
    } catch (err: any) {
      console.error('[CartDrawer] Unexpected error confirming order:', err);
      if (restaurantConfig.contact.primaryMethod === 'whatsapp') {
        setSubmissionError('Network error while saving order. You can still confirm directly via WhatsApp.');
      } else {
        setSubmissionError(err.message || 'Network error while processing order. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Realtime subscription & polling fallback to wait for verified webhook reconciliation
  const startListeningForPayment = (activeRef: string, activePaymentToken?: string | null) => {
    setIsVerifyingPayment(true);
    setStep('payment_process');

    let isSubscribed = true;
    let intervalId: any = null;
    let realtimeChannel: any = null;
    const tokenToUse = activePaymentToken || paymentToken;

    const onConfirmed = (amountPaid: number, total: number) => {
      if (!isSubscribed) return;
      isSubscribed = false;
      if (intervalId) clearInterval(intervalId);
      if (realtimeChannel && supabase) supabase.removeChannel(realtimeChannel);
      setIsVerifyingPayment(false);
      setPaidAmount(amountPaid);
      setConfirmedTotal(total);
      clearCart();
      setStep('confirmed');
    };

    const onFailed = (reason?: string) => {
      if (!isSubscribed) return;
      isSubscribed = false;
      if (intervalId) clearInterval(intervalId);
      if (realtimeChannel && supabase) supabase.removeChannel(realtimeChannel);
      setIsVerifyingPayment(false);
      setPaymentFailureReason(reason || 'Payment authorization failed.');
      setStep('payment_failed');
    };

    if (isSupabaseConfigured && supabase) {
      // 1. Supabase Realtime Channel
      realtimeChannel = supabase
        .channel(`payment_status_${activeRef}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `order_ref=eq.${activeRef}`,
          },
          (payload: any) => {
            const status = payload.new?.payment_status;
            if (status === 'paid') {
              onConfirmed(payload.new?.payment_amount ?? payload.new?.total, payload.new?.total);
            } else if (status === 'failed') {
              onFailed('Payment reported as failed.');
            }
          }
        )
        .subscribe();

      // 2. Polling fallback every 2.5s using get_order_status_by_token RPC
      let elapsed = 0;
      intervalId = setInterval(async () => {
        if (!isSubscribed || !supabase) return;
        elapsed += 2.5;

        try {
          if (tokenToUse) {
            const { data: statusData, error: statusErr } = await supabase.rpc('get_order_status_by_token', {
              p_order_ref: activeRef,
              p_payment_token: tokenToUse,
            });

            if (!statusErr && statusData && statusData.success) {
              if (statusData.payment_status === 'paid') {
                onConfirmed(statusData.payment_amount ?? statusData.total, statusData.total);
                return;
              } else if (statusData.payment_status === 'failed') {
                onFailed('Payment declined or failed.');
                return;
              }
            }
          }
        } catch (err) {
          console.warn('Polling check error:', err);
        }

        if (elapsed >= 90) {
          onFailed('Payment confirmation timed out. If your account was charged, please show your receipt at the counter.');
        }
      }, 2500);
    }
  };

  // Launch standard Razorpay Checkout modal for UPI, Cards, Net Banking
  const openRazorpayCheckout = (sessionResult: PaymentCheckoutResult, activeRef: string, activePaymentToken?: string | null) => {
    const loadScript = (): Promise<boolean> => {
      return new Promise((resolve) => {
        if ((window as any).Razorpay) {
          resolve(true);
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
      });
    };

    loadScript().then((loaded) => {
      if (!loaded || !(window as any).Razorpay) {
        if (sessionResult.checkoutUrl) {
          window.location.href = sessionResult.checkoutUrl;
          return;
        }
        setPaymentFailureReason('Could not load Razorpay payment SDK. Please try again or choose Pay at Counter.');
        setStep('payment_failed');
        return;
      }

      setStep('payment_process');
      setIsVerifyingPayment(true);

      const rzpOptions = {
        key: sessionResult.keyId || (import.meta.env.VITE_RAZORPAY_KEY_ID as string),
        amount: sessionResult.amount, // in paise
        currency: sessionResult.currency || 'INR',
        name: restaurantConfig.businessName || 'The Café Barrackpore',
        description: `Order ${activeRef}`,
        order_id: sessionResult.razorpayOrderId || sessionResult.orderId,
        prefill: {
          name: customerName,
          contact: phone,
        },
        notes: {
          order_ref: activeRef,
        },
        theme: {
          color: '#D4AF37',
        },
        handler: function (_response: any) {
          // Frontend never mutates status to 'paid'; begins awaiting webhook verification
          startListeningForPayment(activeRef, activePaymentToken || paymentToken);
        },
        modal: {
          ondismiss: function () {
            setIsVerifyingPayment(false);
            setPaymentFailureReason('Payment window closed before completing transaction.');
            setStep('payment_failed');
          },
        },
      };

      try {
        const rzpInstance = new (window as any).Razorpay(rzpOptions);
        rzpInstance.open();
      } catch (e: any) {
        setPaymentFailureReason(e.message || 'Failed to open Razorpay modal.');
        setStep('payment_failed');
      }
    });
  };

  // Payment Verification Handler (strictly restricted to DEV environment)
  const handleAuthorizePayment = async () => {
    if (!import.meta.env.DEV) return;
    if (isVerifyingPayment) return;
    setIsVerifyingPayment(true);
    setPaymentFailureReason(null);

    try {
      const verifyRes = await verifyAndReconcilePayment(
        {
          orderRef,
          providerPaymentId: activePaymentSessionId || 'demo_pay_auth',
          metadata: { amount: totals.total, currency: restaurantConfig.currency },
        },
        restaurantConfig.payments.provider
      );

      if (verifyRes.success && verifyRes.paid) {
        setPaidAmount(totals.total);
        setConfirmedTotal(totals.total);
        setStep('confirmed');
        clearCart();
      } else {
        setPaymentFailureReason(verifyRes.error || 'Payment was declined or failed.');
        setStep('payment_failed');
      }
    } catch (err: any) {
      setPaymentFailureReason(err.message || 'Payment verification encountered a network error.');
      setStep('payment_failed');
    } finally {
      setIsVerifyingPayment(false);
    }
  };

  // Simulated Payment Failure for Testing Recovery Flow (strictly restricted to DEV environment)
  const handleSimulateFailure = async () => {
    if (!import.meta.env.DEV) return;
    if (isVerifyingPayment) return;
    setIsVerifyingPayment(true);

    try {
      await verifyAndReconcilePayment(
        {
          orderRef,
          providerPaymentId: 'fail_card_declined',
          metadata: { amount: totals.total, currency: restaurantConfig.currency },
        },
        restaurantConfig.payments.provider
      );

      setPaymentFailureReason('Card declined by issuing bank: insufficient funds or invalid authorization token.');
      setStep('payment_failed');
    } catch {
      setPaymentFailureReason('Payment verification failed.');
      setStep('payment_failed');
    } finally {
      setIsVerifyingPayment(false);
    }
  };

  // Retry payment without creating duplicate order (Section 15)
  const handleRetryPayment = () => {
    setPaymentFailureReason(null);
    setStep('review');
  };

  // Switch to pay-at-counter from failed state
  const handleSwitchToCounterPayment = async () => {
    setIsSubmitting(true);
    try {
      await updatePendingOrder(orderRef, {
        payment_required: false,
        payment_status: 'not_required',
      });
      setPaidAmount(null);
      setConfirmedTotal(totals.total);
      setStep('confirmed');
      clearCart();
    } catch (err: any) {
      setSubmissionError(err.message || 'Failed to update order to pay at counter.');
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
                {activeStep !== 'cart' && activeStep !== 'confirmed' && activeStep !== 'payment_process' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (activeStep === 'payment_failed') setStep('review');
                      else if (activeStep === 'review') setStep('details');
                      else setStep('cart');
                    }}
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
                      {activeStep === 'payment_process' && 'Payment Gateway'}
                      {activeStep === 'payment_failed' && 'Payment Recovery'}
                      {activeStep === 'confirmed' && 'Order Confirmed'}
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

            {/* Luxury 3-Step Breadcrumb Bar (Pre-submission flow only) */}
            {(activeStep === 'cart' || activeStep === 'details' || activeStep === 'review') && (
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
            )}

            {/* STEP 1: CART ITEMS */}
            {activeStep === 'cart' && (
              <>
                <div className="flex-1 overflow-y-auto min-h-0 p-5 sm:p-6 flex flex-col gap-3 custom-scrollbar overscroll-contain"
                  data-lenis-prevent>
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
                                {formatPrice(item.price)} each
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
                                {formatPrice(item.price * item.quantity)}
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
                      <span className="font-serif text-sm font-medium text-on-surface tabular-nums">{formatPrice(totals.subtotal)}</span>
                    </div>
                    {restaurantConfig.tax.enabled && (totals.taxRate ?? 0) > 0 && (
                      <div className="flex justify-between items-center text-xs text-on-surface/60 font-sans">
                        <span>{totals.taxLabel} ({totals.taxMode === 'inclusive' ? `${((totals.taxRate ?? 0) * 100).toFixed(restaurantConfig.tax.rate % 1 === 0 ? 0 : 2)}% incl.` : `${((totals.taxRate ?? 0) * 100).toFixed(restaurantConfig.tax.rate % 1 === 0 ? 0 : 2)}%`})</span>
                        <span className="font-serif text-xs text-primary/80 tabular-nums">
                          {formatPrice(totals.tax)}
                        </span>
                      </div>
                    )}
                    {(totals as any).serviceCharge > 0 && (
                      <div className="flex justify-between items-center text-xs text-on-surface/60 font-sans">
                        <span>{(totals as any).serviceChargeLabel || 'Service Charge'}</span>
                        <span className="font-serif text-xs text-primary/80 tabular-nums">
                          {formatPrice((totals as any).serviceCharge)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-on-surface pt-0.5 border-t border-white/5">
                      <span className="font-sans text-xs font-semibold uppercase tracking-wider text-on-surface/90">Total Payable</span>
                      <span className="font-serif text-2xl font-normal text-primary tabular-nums">{formatPrice(totals.total)}</span>
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
                <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 flex flex-col gap-4 custom-scrollbar bg-[#130C08] overscroll-contain"
                  data-lenis-prevent>
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
                      placeholder={
                        restaurantConfig.phoneCountryCode === '+1'
                          ? 'e.g. (212) 555-0198'
                          : restaurantConfig.phoneCountryCode === '+44'
                          ? 'e.g. 020 7946 0958'
                          : restaurantConfig.phoneCountryCode === '+971'
                          ? 'e.g. 050 123 4567'
                          : 'e.g. 98301 11222'
                      }
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

                  {/* Marketing Opt-in Consent */}
                  <label className="flex items-start gap-3 p-3.5 rounded-xl bg-[#0D0705] border border-white/10 hover:border-primary/30 transition-colors cursor-pointer group mt-1">
                    <input
                      type="checkbox"
                      checked={marketingConsent}
                      onChange={(e) => setMarketingConsent(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-white/20 text-[#D4AF37] focus:ring-[#D4AF37]/40 bg-black/40 accent-[#D4AF37] cursor-pointer"
                    />
                    <div className="flex-1 text-xs font-sans text-on-surface/80 group-hover:text-on-surface">
                      <span className="font-semibold text-white">Join The Café Inner Circle</span>
                      <p className="text-[11px] text-on-surface/60 mt-0.5 leading-relaxed">
                        Keep me updated with chef specials, happy hours, and exclusive offers via WhatsApp / SMS.
                      </p>
                    </div>
                  </label>
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
                          {formatPrice(item.price * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Optional Payment Selection */}
                  {paymentMode === 'optional' && (
                    <div className="p-4 rounded-2xl bg-[#160E0A] border border-[#D4AF37]/20 flex flex-col gap-2.5">
                      <span className="font-sans text-[11px] uppercase tracking-wider text-primary font-semibold">
                        Select Payment Method
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setPaymentMethodChoice('online')}
                          className={`py-2.5 px-3 rounded-xl border flex flex-col items-center justify-center gap-1 text-xs cursor-pointer transition-all ${
                            paymentMethodChoice === 'online'
                              ? 'bg-primary/20 border-primary text-primary font-bold shadow-sm'
                              : 'bg-[#0D0705] border-white/10 text-on-surface/70 hover:border-white/20'
                          }`}
                        >
                          <span className="material-symbols-outlined text-lg">credit_card</span>
                          <span className="font-sans text-[11px] uppercase tracking-wider">Pay Online</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethodChoice('counter')}
                          className={`py-2.5 px-3 rounded-xl border flex flex-col items-center justify-center gap-1 text-xs cursor-pointer transition-all ${
                            paymentMethodChoice === 'counter'
                              ? 'bg-primary/20 border-primary text-primary font-bold shadow-sm'
                              : 'bg-[#0D0705] border-white/10 text-on-surface/70 hover:border-white/20'
                          }`}
                        >
                          <span className="material-symbols-outlined text-lg">point_of_sale</span>
                          <span className="font-sans text-[11px] uppercase tracking-wider">Pay at Counter</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Security Verification (Cloudflare Turnstile) */}
                  <div className="p-3.5 rounded-2xl bg-[#160E0A] border border-[#D4AF37]/20 flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 text-primary text-[11px] font-sans font-semibold uppercase tracking-wider">
                      <span className="material-symbols-outlined text-sm">shield</span>
                      <span>Security Verification</span>
                    </div>
                    <TurnstileWidget action="order" onVerify={(token) => setCaptchaToken(token)} />
                  </div>

                  {/* Happy Hour Active Banner */}
                  {activeHappyHour && (
                    <div className="p-3.5 rounded-2xl bg-[#160E0A] border border-[#D4AF37]/30 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-amber-400 text-lg">local_fire_department</span>
                        <div>
                          <p className="text-xs font-semibold text-white">{activeHappyHour.label}</p>
                          <p className="text-[10px] text-stone-400">Happy hour discount active until {activeHappyHour.end_time}</p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-[#D4AF37]/20 text-[#F3C766] border border-[#D4AF37]/30 text-xs font-mono font-bold">
                        {activeHappyHour.discount_percentage}% OFF
                      </span>
                    </div>
                  )}

                  {/* Promotional Code Entry */}
                  <div className="p-3.5 rounded-2xl bg-[#160E0A] border border-[#D4AF37]/20 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-on-surface/75 font-medium uppercase tracking-wider text-[10px]">
                        Promotional Coupon Code
                      </span>
                      {appliedDiscount && (
                        <button
                          type="button"
                          onClick={handleRemoveDiscount}
                          className="text-[10px] text-red-400 hover:underline cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {appliedDiscount ? (
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
                        <div className="flex items-center gap-2 font-mono font-bold">
                          <span className="material-symbols-outlined text-sm">verified</span>
                          <span>{appliedDiscount.code}</span>
                        </div>
                        <span className="font-semibold font-mono text-[11px]">
                          -{formatPrice(appliedDiscount.discount_amount || 0)} applied
                        </span>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={promoCodeInput}
                          onChange={(e) => {
                            setPromoCodeInput(e.target.value.toUpperCase());
                            if (discountError) setDiscountError(null);
                          }}
                          placeholder="e.g. WELCOME10"
                          className="flex-1 bg-[#0D0705] border border-white/10 rounded-xl px-3 py-2 text-xs text-white uppercase font-mono tracking-wider focus:outline-none focus:border-[#D4AF37]"
                        />
                        <button
                          type="button"
                          disabled={isValidatingDiscount || !promoCodeInput.trim()}
                          onClick={handleApplyPromoCode}
                          className="px-4 py-2 rounded-xl bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#F3C766] hover:bg-[#D4AF37]/30 text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors"
                        >
                          {isValidatingDiscount ? '...' : 'Apply'}
                        </button>
                      </div>
                    )}

                    {discountError && (
                      <p className="text-[11px] text-red-400 font-sans">{discountError}</p>
                    )}
                  </div>

                  {/* Total Amount Box with Configurable Tax */}
                  <div className="p-4 rounded-2xl bg-[#140D09] border border-[#D4AF37]/30 flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs text-on-surface/70">
                      <span>Subtotal</span>
                      <span className="font-serif text-sm tabular-nums">{formatPrice(totals.subtotal)}</span>
                    </div>
                    {restaurantConfig.tax.enabled && (totals.taxRate ?? 0) > 0 && (
                      <div className="flex justify-between items-center text-xs text-on-surface/60">
                        <span>{totals.taxLabel} ({totals.taxMode === 'inclusive' ? `${((totals.taxRate ?? 0) * 100).toFixed(restaurantConfig.tax.rate % 1 === 0 ? 0 : 2)}% incl.` : `${((totals.taxRate ?? 0) * 100).toFixed(restaurantConfig.tax.rate % 1 === 0 ? 0 : 2)}%`})</span>
                        <span className="font-serif text-xs text-primary/80 tabular-nums">{formatPrice(totals.tax)}</span>
                      </div>
                    )}
                    {(totals as any).serviceCharge > 0 && (
                      <div className="flex justify-between items-center text-xs text-on-surface/60">
                        <span>{(totals as any).serviceChargeLabel || 'Service Charge'}</span>
                        <span className="font-serif text-xs text-primary/80 tabular-nums">{formatPrice((totals as any).serviceCharge)}</span>
                      </div>
                    )}
                    {effectiveDiscount > 0 && (
                      <div className="flex justify-between items-center text-xs text-emerald-400">
                        <span>{activeDiscountLabel || 'Promotional Discount'}</span>
                        <span className="font-serif text-xs font-semibold tabular-nums">
                          -{formatPrice(effectiveDiscount)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-2 border-t border-white/5">
                      <span className="font-sans text-xs font-semibold uppercase tracking-wider text-on-surface">Total Amount</span>
                      <span className="font-serif text-2xl font-normal text-primary tabular-nums">
                        {formatPrice(finalPayableTotal)}
                      </span>
                    </div>
                  </div>

                  {/* Submission Notice / Fallback if Supabase was unreachable */}
                  {submissionError && (
                    <div className="p-4 rounded-xl bg-error/10 border border-error/30 text-xs flex flex-col gap-2">
                      <div className="flex items-center gap-1.5 font-bold text-red-400">
                        <span className="material-symbols-outlined text-base">warning</span>
                        <span>Notice</span>
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
                    <span>
                      {isSubmitting
                        ? 'Processing...'
                        : isOnlinePayment
                        ? `Pay Securely · ${formatPrice(finalPayableTotal)}`
                        : restaurantConfig.contact.primaryMethod === 'whatsapp'
                        ? 'Send via WhatsApp'
                        : 'Place Order (Pay at Counter)'}
                    </span>
                    <span className="w-8 h-8 rounded-full bg-[#120B08]/15 flex items-center justify-center transition-transform duration-300 group-hover:translate-x-1 group-hover:scale-105">
                      <span className="material-symbols-outlined text-[16px] text-[#120B08]">
                        {isOnlinePayment ? 'lock' : restaurantConfig.contact.primaryMethod === 'whatsapp' ? 'send' : 'check'}
                      </span>
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP: SECURE PAYMENT PROCESSING (Demo / Gateway UI) */}
            {activeStep === 'payment_process' && (
              <div className="flex-1 flex flex-col justify-between p-6 bg-[#130C08]">
                <div className="space-y-6 max-w-sm mx-auto w-full pt-4">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/40 flex items-center justify-center text-primary shadow-[0_0_24px_rgba(212,175,55,0.2)] mb-3">
                      <span className="material-symbols-outlined text-3xl">shield_locked</span>
                    </div>
                    <span className="font-sans text-[10px] uppercase tracking-widest text-primary font-bold">
                      {restaurantConfig.payments.provider.toUpperCase()} CHECKOUT
                    </span>
                    <h3 className="font-serif text-2xl text-on-surface font-normal mt-0.5">
                      Authorize Payment
                    </h3>
                    <p className="font-sans text-xs text-on-surface/60 mt-1">
                      Order Reference: <span className="font-mono text-primary font-bold">{orderRef}</span>
                    </p>
                  </div>

                  {/* Payment Summary Box */}
                  <div className="p-4 rounded-2xl bg-[#160E0A] border border-[#D4AF37]/30 space-y-2.5">
                    <div className="flex justify-between items-center text-xs font-sans">
                      <span className="text-on-surface/60">Payable Amount:</span>
                      <span className="font-serif text-xl font-bold text-primary tabular-nums">
                        {formatPrice(totals.total)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-sans pt-2 border-t border-white/5">
                      <span className="text-on-surface/60">Customer:</span>
                      <span className="text-on-surface font-medium">{customerName}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-sans">
                      <span className="text-on-surface/60">Dining:</span>
                      <span className="text-primary font-mono text-[11px]">
                        {(isQrOrder && isQrValid && qrTable) || orderType === 'dine-in'
                          ? `Table ${isQrOrder && isQrValid && qrTable ? qrTable : tableNumber}`
                          : 'Takeaway'}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-on-surface/50 text-center leading-relaxed">
                    This order will be submitted to the kitchen display only after successful verification.
                  </p>
                </div>

                {/* Payment Actions */}
                <div className="space-y-2.5 max-w-sm mx-auto w-full pt-6">
                  {isVerifyingPayment && (
                    <div className="flex items-center justify-center gap-2.5 p-3 rounded-xl bg-primary/10 border border-primary/25 text-primary text-xs">
                      <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                      <span>Waiting for payment confirmation from bank...</span>
                    </div>
                  )}

                  {import.meta.env.DEV && (
                    <>
                      <button
                        type="button"
                        disabled={isVerifyingPayment}
                        onClick={handleAuthorizePayment}
                        className="w-full h-12 rounded-full bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C5A028] text-[#120B08] font-bold text-xs tracking-wider uppercase shadow-[0_4px_24px_rgba(212,175,55,0.3)] hover:shadow-[0_6px_32px_rgba(212,175,55,0.45)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-base">verified_user</span>
                        <span>{isVerifyingPayment ? 'Verifying Payment...' : `Complete Payment (${formatPrice(totals.total)}) [Dev]`}</span>
                      </button>

                      <button
                        type="button"
                        disabled={isVerifyingPayment}
                        onClick={handleSimulateFailure}
                        className="w-full py-2.5 rounded-full border border-red-500/30 text-red-300 hover:bg-red-500/10 text-[11px] font-sans font-medium transition-colors cursor-pointer"
                      >
                        Simulate Payment Decline (Test Failure Flow) [Dev]
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    disabled={isVerifyingPayment}
                    onClick={() => setStep('review')}
                    className="w-full text-center text-xs text-on-surface/50 hover:text-on-surface transition-colors py-1 cursor-pointer"
                  >
                    Cancel and Return to Review
                  </button>
                </div>
              </div>
            )}

            {/* STEP: PAYMENT FAILED RECOVERY (Section 15) */}
            {activeStep === 'payment_failed' && (
              <div className="flex-1 flex flex-col justify-between p-6 bg-[#130C08]">
                <div className="space-y-6 max-w-sm mx-auto w-full pt-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-red-950/60 border border-red-500/50 flex items-center justify-center text-red-400 mx-auto shadow-[0_0_24px_rgba(239,68,68,0.2)]">
                    <span className="material-symbols-outlined text-3xl">error</span>
                  </div>

                  <div>
                    <span className="font-sans text-[10px] uppercase tracking-widest text-red-400 font-bold">
                      Payment Unsuccessful
                    </span>
                    <h3 className="font-serif text-2xl text-on-surface font-normal mt-0.5">
                      Transaction Declined
                    </h3>
                    <p className="font-sans text-xs text-red-300/80 mt-2 bg-red-950/30 p-3 rounded-xl border border-red-900/40">
                      {paymentFailureReason || 'The payment provider was unable to authorize the charge.'}
                    </p>
                  </div>

                  {/* Idempotent Safety Notice */}
                  <div className="p-3.5 rounded-xl bg-surface-container border border-outline-variant/30 text-left text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-primary font-bold text-[11px]">
                      <span className="material-symbols-outlined text-sm">info</span>
                      <span>Order Preserved</span>
                    </div>
                    <p className="text-on-surface/70 text-[11px] leading-relaxed">
                      Your order reference <span className="font-mono text-primary font-bold">{orderRef}</span> remains safely on file. Retrying will not create duplicate charges.
                    </p>
                  </div>
                </div>

                {/* Recovery Buttons */}
                <div className="space-y-2.5 max-w-sm mx-auto w-full pt-6">
                  <button
                    type="button"
                    onClick={handleRetryPayment}
                    className="w-full h-12 rounded-full bg-primary text-[#120B08] font-bold text-xs uppercase tracking-wider hover:bg-primary-hover transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">refresh</span>
                    <span>Try Payment Again</span>
                  </button>

                  {(restaurantConfig.payments?.allow_pay_at_counter ?? true) && (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleSwitchToCounterPayment}
                      className="w-full h-11 rounded-full border border-[#D4AF37]/30 text-primary hover:bg-[#D4AF37]/10 font-sans text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      {isSubmitting ? 'Updating Order...' : 'Pay at Counter Instead'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* STEP: ORDER CONFIRMED (Section 16) */}
            {activeStep === 'confirmed' && (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-5 bg-[#130C08] overflow-y-auto">
                <div className="w-20 h-20 rounded-full bg-[#1C120D] border border-primary/40 flex items-center justify-center text-primary shadow-[0_0_30px_rgba(212,175,55,0.25)]">
                  <span className="material-symbols-outlined text-4xl">check_circle</span>
                </div>

                <div>
                  <span className="font-sans text-[10px] uppercase tracking-widest text-primary font-bold">
                    Order Confirmed
                  </span>
                  <h3 className="font-serif text-2xl text-on-surface font-normal mt-1">
                    Thank You, {customerName}!
                  </h3>
                  <p className="font-serif text-xl text-primary mt-1 font-bold tracking-wider font-mono">
                    {orderRef}
                  </p>
                  <p className="text-xs text-on-surface/80 mt-0.5 font-sans font-medium">
                    {restaurantConfig.businessName}
                  </p>
                  <p className="font-sans text-xs text-on-surface/60 mt-2 max-w-xs mx-auto leading-relaxed">
                    Your order has been recorded and transmitted to the kitchen team.
                  </p>
                </div>

                {/* Operational Details Card */}
                <div className="w-full max-w-sm rounded-2xl bg-[#160E0A] border border-[#D4AF37]/25 p-4 space-y-2 text-xs font-sans text-left">
                  <div className="flex justify-between items-center">
                    <span className="text-on-surface/60">Dining Option:</span>
                    <span className="font-semibold text-on-surface">
                      {(isQrOrder && isQrValid && qrTable) || orderType === 'dine-in'
                        ? `Dine-in (Table ${isQrOrder && isQrValid && qrTable ? qrTable : tableNumber})`
                        : 'Takeaway'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-white/5">
                    <span className="text-on-surface/60">Payment Status:</span>
                    {paidAmount !== null ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold font-mono">
                        PAID ({formatPrice(paidAmount)})
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold font-mono">
                        PAY AT COUNTER ({formatPrice(confirmedTotal ?? totals.total)})
                      </span>
                    )}
                  </div>
                </div>

                {/* Contact Actions: Call, WhatsApp, Maps */}
                <div className="w-full max-w-sm grid grid-cols-3 gap-2">
                  <a
                    href={`tel:${restaurantConfig.contact.phone}`}
                    className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-[#160E0A] border border-white/10 hover:border-primary/30 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg text-primary">call</span>
                    <span className="text-[9px] uppercase tracking-wider font-semibold text-on-surface/70">Call</span>
                  </a>
                  <a
                    href={`https://wa.me/${(restaurantConfig.contact.whatsapp || clientDetails.whatsapp).replace(/\D/g, '')}?text=${encodeURIComponent(`Hi! I just placed order ${orderRef}. Thank you!`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-[#160E0A] border border-white/10 hover:border-emerald-500/30 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg text-emerald-400">chat</span>
                    <span className="text-[9px] uppercase tracking-wider font-semibold text-on-surface/70">WhatsApp</span>
                  </a>
                  <a
                    href={clientDetails.googleMapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-[#160E0A] border border-white/10 hover:border-sky-500/30 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg text-sky-400">location_on</span>
                    <span className="text-[9px] uppercase tracking-wider font-semibold text-on-surface/70">Directions</span>
                  </a>
                </div>

                {/* Order Again Button */}
                <button
                  type="button"
                  onClick={() => {
                    // Items are still in the cart context from this session - just reset to cart step
                    setStep('cart');
                  }}
                  className="w-full max-w-sm h-11 rounded-full border border-[#D4AF37]/30 text-primary hover:bg-[#D4AF37]/10 font-sans text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">replay</span>
                  <span>Order Again</span>
                </button>

                {/* Google Review Link */}
                {(clientDetails.googleReviewLink && clientDetails.googleReviewLink !== 'https://search.google.com/local/writereview?placeid=YOUR_PLACE_ID') && (
                  <a
                    href={clientDetails.googleReviewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full max-w-sm p-3.5 rounded-2xl bg-[#160E0A] border border-white/10 hover:border-primary/25 flex items-center justify-between text-xs font-sans transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                        <span className="material-symbols-outlined text-base text-amber-400">star</span>
                      </div>
                      <div className="text-left">
                        <p className="text-on-surface font-semibold">Enjoyed your experience?</p>
                        <p className="text-on-surface/50 text-[10px] mt-0.5">Leave us a Google Review ★★★★★</p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-sm text-primary group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setStep('cart');
                    setIsDrawerOpen(false);
                  }}
                  className="w-full max-w-sm h-12 rounded-full bg-primary text-[#120B08] font-bold text-xs uppercase tracking-wider hover:bg-primary-hover transition-colors shadow-md cursor-pointer"
                >
                  Done
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
