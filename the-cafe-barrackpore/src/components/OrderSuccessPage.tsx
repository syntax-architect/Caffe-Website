import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useSiteConfig } from '../context/SiteConfigContext';

interface OrderStatusData {
  order_ref: string;
  status: string;
  payment_status: string;
  total: number;
  payment_amount?: number;
  currency: string;
  created_at: string;
  customer_name?: string;
  order_type?: string;
  table_number?: string | null;
}

export const OrderSuccessPage: React.FC = () => {
  const { restaurantConfig, formatPrice } = useSiteConfig();

  const [orderRef, setOrderRef] = useState<string>('');
  const [token, setToken] = useState<string>('');
  const [isCancelled, setIsCancelled] = useState<boolean>(false);
  const [orderData, setOrderData] = useState<OrderStatusData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState<number>(0);

  // Clear cart upon arriving on order success / return page
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('cafe_cart');
        window.dispatchEvent(new CustomEvent('cafe:cart-cleared'));
      } catch {
        // ignore
      }
    }
  }, []);

  // Parse URL query parameters
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref') || params.get('orderRef') || '';
    const paymentToken = params.get('token') || params.get('paymentToken') || '';
    const cancelled = params.get('cancelled') === 'true';

    setOrderRef(ref);
    setToken(paymentToken);
    setIsCancelled(cancelled);

    if (cancelled) {
      setLoading(false);
    }
  }, []);

  const fetchStatus = useCallback(async (ref: string, paymentToken: string) => {
    if (!ref) {
      setLoading(false);
      setErrorMessage('No order reference found in URL.');
      return;
    }

    // In local demo / offline mode
    if (!isSupabaseConfigured || !supabase) {
      try {
        const raw = localStorage.getItem('cafe_demo_orders');
        if (raw) {
          const orders = JSON.parse(raw);
          const found = orders.find((o: any) => o.order_ref === ref);
          if (found) {
            setOrderData({
              order_ref: found.order_ref,
              status: found.status || 'pending',
              payment_status: found.payment_status || 'paid',
              total: found.total || 0,
              payment_amount: found.payment_amount ?? found.total,
              currency: found.currency || restaurantConfig.currency,
              created_at: found.created_at || new Date().toISOString(),
              customer_name: found.customer_name,
              order_type: found.order_type,
              table_number: found.table_number,
            });
            setLoading(false);
            return;
          }
        }
      } catch {
        // ignore
      }

      // Simulated demo fallback
      setOrderData({
        order_ref: ref,
        status: 'pending',
        payment_status: 'paid',
        total: 0,
        currency: restaurantConfig.currency,
        created_at: new Date().toISOString(),
      });
      setLoading(false);
      return;
    }

    try {
      if (paymentToken) {
        const { data, error } = await supabase.rpc('get_order_status_by_token', {
          p_order_ref: ref,
          p_payment_token: paymentToken,
        });

        if (error) {
          setErrorMessage(error.message || 'Could not verify order status.');
          setLoading(false);
          return;
        }

        if (data && data.success) {
          setOrderData(data);
          setLoading(false);
          return;
        } else if (data && !data.success) {
          setErrorMessage(data.error || 'Invalid or expired payment confirmation.');
          setLoading(false);
          return;
        }
      }

      // Fallback: Query order status directly via order_ref if token is missing
      const { data: directOrder, error: directErr } = await supabase
        .from('orders')
        .select('order_ref, status, payment_status, total, payment_amount, currency, created_at, customer_name, order_type, table_number')
        .eq('order_ref', ref)
        .maybeSingle();

      if (!directErr && directOrder) {
        setOrderData(directOrder as OrderStatusData);
      } else {
        setErrorMessage('Order record could not be found.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error fetching order status.');
    } finally {
      setLoading(false);
    }
  }, [restaurantConfig.currency]);

  // Initial fetch and Realtime subscription
  useEffect(() => {
    if (!orderRef || isCancelled) return;
    fetchStatus(orderRef, token);

    if (isSupabaseConfigured && supabase) {
      const channel = supabase
        .channel(`order_success_${orderRef}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `order_ref=eq.${orderRef}`,
          },
          (payload: any) => {
            if (payload.new) {
              setOrderData((prev) => ({
                ...(prev || {}),
                order_ref: payload.new.order_ref,
                status: payload.new.status,
                payment_status: payload.new.payment_status,
                total: payload.new.total,
                payment_amount: payload.new.payment_amount ?? payload.new.total,
                currency: payload.new.currency,
                created_at: payload.new.created_at,
                customer_name: payload.new.customer_name,
                order_type: payload.new.order_type,
                table_number: payload.new.table_number,
              }));
            }
          }
        )
        .subscribe();

      return () => {
        supabase?.removeChannel(channel);
      };
    }
  }, [orderRef, token, isCancelled, fetchStatus]);

  // Polling fallback while payment status is pending (waiting for webhook reconciliation)
  useEffect(() => {
    if (!orderRef || isCancelled || !orderData) return;
    if (orderData.payment_status === 'paid' || orderData.payment_status === 'failed' || pollCount >= 30) {
      return;
    }

    const interval = setInterval(() => {
      setPollCount((prev) => prev + 1);
      fetchStatus(orderRef, token);
    }, 2500);

    return () => clearInterval(interval);
  }, [orderRef, token, isCancelled, orderData, pollCount, fetchStatus]);

  const isPaid = orderData?.payment_status === 'paid' || orderData?.payment_status === 'not_required';
  const isPendingPayment = !isCancelled && orderData && orderData.payment_status === 'pending';
  const isFailed = !isCancelled && orderData && orderData.payment_status === 'failed';

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="min-h-screen bg-[#070605] text-stone-200 flex flex-col justify-between selection:bg-[#D4AF37]/30 selection:text-[#D4AF37]">
      {/* Background Ambient Lighting */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-[#D4AF37]/5 blur-[120px] pointer-events-none -z-10" />

      {/* Header Bar */}
      <header className="border-b border-white/[0.06] bg-[#0E0B09]/80 backdrop-blur-md sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 group">
          <span className="w-8 h-8 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] text-xs font-serif font-bold group-hover:scale-105 transition-transform">
            {restaurantConfig.businessName ? restaurantConfig.businessName.charAt(0) : 'C'}
          </span>
          <span className="font-serif text-sm tracking-wider font-bold text-white group-hover:text-[#D4AF37] transition-colors">
            {restaurantConfig.businessName || 'Restaurant Terminal'}
          </span>
        </a>

        <a
          href="/"
          className="text-xs font-mono text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] hover:border-white/[0.2]"
        >
          <span className="material-symbols-outlined text-sm">home</span>
          Return to Menu
        </a>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-center">
        {loading ? (
          <div className="text-center py-16 space-y-4">
            <div className="w-12 h-12 rounded-full border-2 border-stone-800 border-t-[#D4AF37] animate-spin mx-auto" />
            <p className="font-mono text-xs uppercase tracking-widest text-[#D4AF37]">
              Reconciling Order Confirmation...
            </p>
          </div>
        ) : isCancelled ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 sm:p-8 rounded-[2rem] bg-[#120F0D] border border-amber-500/20 shadow-2xl text-center space-y-6"
          >
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto text-2xl font-bold">
              ✕
            </div>
            <div>
              <h1 className="font-serif text-2xl font-bold text-white">Payment Cancelled</h1>
              <p className="text-xs text-zinc-400 mt-2 max-w-sm mx-auto">
                Your checkout session was cancelled or dismissed. No charge has been made to your account.
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="/"
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#D4AF37] text-black text-xs font-mono uppercase font-bold tracking-wider hover:bg-[#E5C158] transition-colors"
              >
                Return to Menu
              </a>
            </div>
          </motion.div>
        ) : isFailed ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 sm:p-8 rounded-[2rem] bg-[#120F0D] border border-rose-500/20 shadow-2xl text-center space-y-6"
          >
            <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto text-2xl font-bold">
              !
            </div>
            <div>
              <h1 className="font-serif text-2xl font-bold text-white">Payment Declined</h1>
              <p className="text-xs text-zinc-400 mt-2 max-w-sm mx-auto">
                Your transaction could not be processed by the bank or gateway. Please try an alternative payment method or choose Pay at Counter.
              </p>
            </div>
            {orderRef && (
              <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] font-mono text-xs text-zinc-400">
                Order Ref: <span className="text-white font-bold">{orderRef}</span>
              </div>
            )}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="/"
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#D4AF37] text-black text-xs font-mono uppercase font-bold tracking-wider hover:bg-[#E5C158] transition-colors"
              >
                Try Again
              </a>
            </div>
          </motion.div>
        ) : isPendingPayment ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 sm:p-8 rounded-[2rem] bg-[#120F0D] border border-[#D4AF37]/30 shadow-2xl text-center space-y-6"
          >
            <div className="relative w-16 h-16 mx-auto">
              <div className="w-16 h-16 rounded-full border-2 border-stone-800 border-t-[#D4AF37] animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D4AF37] animate-ping" />
              </div>
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">
                Live Webhook Reconciliation
              </span>
              <h1 className="font-serif text-2xl font-bold text-white mt-1">
                Awaiting Gateway Settlement
              </h1>
              <p className="text-xs text-zinc-400 mt-2 max-w-sm mx-auto">
                We received your authorization. Confirming payment settlement with your bank and registering your kitchen ticket...
              </p>
            </div>
            {orderRef && (
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/[0.08] font-mono text-xs text-zinc-400 flex items-center justify-between">
                <span>Order Reference:</span>
                <span className="text-[#D4AF37] font-bold">{orderRef}</span>
              </div>
            )}
            <p className="text-[11px] font-mono text-zinc-500">
              Checking status every few seconds · Please do not close this window
            </p>
          </motion.div>
        ) : isPaid ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-6 sm:p-8 rounded-[2rem] bg-[#120F0D] border border-[#D4AF37]/40 shadow-2xl space-y-6"
          >
            {/* Top Success Badge */}
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto text-2xl shadow-[0_0_24px_rgba(52,211,153,0.2)]">
                ✓
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-emerald-400 font-bold">
                  Payment Verified · Order Placed
                </span>
                <h1 className="font-serif text-2xl sm:text-3xl font-bold text-white mt-1">
                  Thank You for Dining With Us
                </h1>
                <p className="text-xs text-zinc-400 mt-1.5">
                  Your payment has cleared and your order ticket has been dispatched to the kitchen.
                </p>
              </div>
            </div>

            {/* Receipt Summary Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-black/40 border border-white/[0.08] space-y-3.5">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] text-xs">
                <span className="font-mono text-zinc-400">Order Reference</span>
                <span className="font-mono text-sm font-bold text-[#D4AF37]">{orderData?.order_ref}</span>
              </div>

              {orderData?.order_type && (
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-zinc-400">Dining Mode</span>
                  <span className="font-mono text-zinc-200 capitalize">
                    {orderData.order_type === 'dine_in'
                      ? `Dine-In ${orderData.table_number ? `(Table ${orderData.table_number})` : ''}`
                      : 'Takeaway Package'}
                  </span>
                </div>
              )}

              {orderData?.customer_name && (
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-zinc-400">Guest Name</span>
                  <span className="font-mono text-zinc-200">{orderData.customer_name}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-sm">
                <span className="font-mono text-zinc-300">Total Settled</span>
                <span className="font-mono text-base font-bold text-emerald-400">
                  {formatPrice(orderData?.payment_amount ?? orderData?.total ?? 0, orderData?.currency)}
                </span>
              </div>
            </div>

            {/* Preparation Stepper */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold block">
                Order Live Status
              </span>
              <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono">
                <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300">
                  <div className="font-bold text-xs">✓ 1</div>
                  <span>Received</span>
                </div>
                <div className="p-2 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37]">
                  <div className="font-bold text-xs animate-pulse">● 2</div>
                  <span>Preparing</span>
                </div>
                <div className="p-2 rounded-lg bg-zinc-900 border border-white/[0.04] text-zinc-500">
                  <div className="font-bold text-xs">○ 3</div>
                  <span>Service</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handlePrint}
                className="flex-1 py-3 px-4 rounded-xl border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-xs font-mono text-zinc-200 font-medium transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">print</span>
                Print Receipt
              </button>
              <a
                href="/"
                className="flex-1 py-3 px-4 rounded-xl bg-[#D4AF37] hover:bg-[#E5C158] text-black text-xs font-mono uppercase font-bold tracking-wider transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">restaurant</span>
                Back to Menu
              </a>
            </div>
          </motion.div>
        ) : (
          <div className="p-8 rounded-2xl bg-[#120F0D] border border-white/[0.08] text-center space-y-4">
            <h2 className="text-lg font-bold text-white">Order Status</h2>
            <p className="text-xs text-zinc-400">
              {errorMessage || 'Unable to retrieve order details. Please verify your reference at the counter.'}
            </p>
            <a
              href="/"
              className="inline-block mt-4 px-6 py-2.5 rounded-xl bg-[#D4AF37] text-black text-xs font-mono font-bold"
            >
              Return Home
            </a>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="p-6 border-t border-white/[0.06] text-center text-[11px] font-mono text-zinc-500">
        {restaurantConfig.businessName} · Secure Payment Settlement Protocol
      </footer>
    </div>
  );
};
