import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useSiteConfig } from '../../context/SiteConfigContext';
import { fetchDashboardOverview } from '../../services/dashboardService';
import type { DashboardOverviewData } from '../../types/dashboard';
import { createOrder } from '../../services/orderService';
import { unlockAudioContext, playKitchenOrderBell } from '../../services/soundService';

interface DashboardOverviewProps {
  onNavigate: (path: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onNavigate }) => {
  const { staffProfile } = useAuth();
  const { restaurantConfig, formatPrice } = useSiteConfig();
  const [data, setData] = useState<DashboardOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationMessage, setSimulationMessage] = useState<string | null>(null);

  // Dynamic greeting based on current hour
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const loadOverview = () => {
    setIsRefreshing(true);
    fetchDashboardOverview()
      .then((overview) => setData(overview))
      .catch((err) => console.error('Failed to load overview:', err))
      .finally(() => {
        setIsLoading(false);
        setIsRefreshing(false);
      });
  };

  const handleSimulateTableOrder = async () => {
    setIsSimulating(true);
    setSimulationMessage(null);
    try {
      await unlockAudioContext();
      const testOrder = {
        customer_name: 'Priya Mukherjee (Table 07)',
        customer_phone: '9830111222',
        order_type: 'dine_in' as const,
        table_number: '07',
        items: [
          {
            id: 'pizza-woodfired-1',
            name: 'Wood-Fired Truffle Margherita Pizza',
            price: 495,
            quantity: 1,
          },
          {
            id: 'beverage-coldbrew-1',
            name: 'Signature Vanilla Bean Cold Brew',
            price: 240,
            quantity: 2,
          },
        ],
        special_requests: 'Extra crispy crust, serve drinks together',
        payment_method: 'pay_at_counter' as const,
      };
      const res = await createOrder(testOrder);
      if (res.success) {
        playKitchenOrderBell();
        setSimulationMessage(`Order #${res.orderRef} dispatched for Table 07! Check KDS & Orders.`);
        loadOverview();
        setTimeout(() => setSimulationMessage(null), 6000);
      } else {
        setSimulationMessage(res.error || 'Failed to simulate order.');
      }
    } catch {
      setSimulationMessage('Unexpected error during simulation.');
    } finally {
      setIsSimulating(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    fetchDashboardOverview().then((overview) => {
      if (isMounted) {
        setData(overview);
        setIsLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const kpis = data?.kpis || {
    todayOrdersCount: 0,
    todayRevenue: 0,
    pendingOrdersCount: 0,
    todayReservationsCount: 0,
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Welcome Banner - Double Bezel Executive Card */}
      <section className="p-1.5 sm:p-2 rounded-[2rem] bg-gradient-to-r from-white/[0.08] via-white/[0.03] to-white/[0.01] border border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
        <div className="rounded-[calc(2rem-0.375rem)] bg-gradient-to-br from-[#16120E] via-[#100D0B] to-[#0A0807] border border-white/[0.05] p-6 sm:p-8 relative overflow-hidden shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]">
          {/* Subtle Ambient Radial Wash */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#D4AF37]/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-10 left-1/4 w-60 h-60 bg-[#E58A1F]/5 rounded-full blur-[80px] pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#D4AF37] font-semibold">
                  Live Terminal • {getGreeting()}, {staffProfile?.full_name?.split(' ')[0] || 'Team'}
                </span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-serif font-bold text-white tracking-wide leading-tight">
                {restaurantConfig.businessName} Command Center
              </h2>
              <p className="text-stone-400 text-xs sm:text-sm mt-1.5 max-w-2xl leading-relaxed">
                Real-time operational dashboard for table QR orders, takeaway dispatch, reservations, and inventory flow.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={loadOverview}
                disabled={isRefreshing}
                className="group py-2.5 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-stone-300 hover:text-white transition-all flex items-center gap-2 cursor-pointer active:scale-[0.98]"
              >
                <span
                  className={`material-symbols-outlined text-base text-[#D4AF37] ${
                    isRefreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'
                  }`}
                >
                  refresh
                </span>
                <span>{isRefreshing ? 'Refreshing...' : 'Refresh Feed'}</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('/staff/kitchen')}
                className="group py-2.5 px-5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#F3C766] hover:from-[#c29f2f] hover:to-[#e4b955] text-[#120B08] font-bold text-xs uppercase tracking-wider transition-all duration-300 flex items-center gap-2 shadow-[0_4px_20px_rgba(212,175,55,0.25)] active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-base">soup_kitchen</span>
                <span>Launch KDS</span>
                <span className="w-4 h-4 rounded-full bg-black/15 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                  <span className="material-symbols-outlined text-[10px]">arrow_forward</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* KPI Cards Grid - Double-Bezel Hardware Architecture */}
      <section aria-label="Key Performance Indicators" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Today's Orders */}
        <div className="group p-1 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.07] shadow-lg transition-transform duration-300 hover:-translate-y-0.5">
          <div className="rounded-[calc(1rem-0.25rem)] bg-[#120F0D]/95 border border-white/[0.04] p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] h-full flex flex-col justify-between">
            <div className="flex items-center justify-between text-stone-400 mb-2">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37] font-semibold">
                Daily Volume
              </span>
              <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/25 flex items-center justify-center text-[#F3C766]">
                <span className="material-symbols-outlined text-base">receipt_long</span>
              </div>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight">
                {isLoading ? '...' : kpis.todayOrdersCount}
              </p>
              <div className="flex items-center gap-1.5 mt-1 text-[11px] text-stone-400">
                <span className="text-emerald-400 font-medium">100% synced</span>
                <span>• Today's tickets</span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 2: Today's Revenue */}
        <div className="group p-1 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.07] shadow-lg transition-transform duration-300 hover:-translate-y-0.5">
          <div className="rounded-[calc(1rem-0.25rem)] bg-[#120F0D]/95 border border-white/[0.04] p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] h-full flex flex-col justify-between">
            <div className="flex items-center justify-between text-stone-400 mb-2">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-400 font-semibold">
                Gross Revenue
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                <span className="material-symbols-outlined text-base">payments</span>
              </div>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-serif font-bold text-emerald-400 tracking-tight">
                {isLoading ? '...' : formatPrice(kpis.todayRevenue)}
              </p>
              <div className="flex items-center gap-1.5 mt-1 text-[11px] text-stone-400">
                <span className="text-stone-300 font-mono text-[10px]">Net of voids</span>
                <span>• Live revenue</span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 3: Pending Orders */}
        <div className="group p-1 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.07] shadow-lg transition-transform duration-300 hover:-translate-y-0.5">
          <div className="rounded-[calc(1rem-0.25rem)] bg-[#120F0D]/95 border border-white/[0.04] p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] h-full flex flex-col justify-between">
            <div className="flex items-center justify-between text-stone-400 mb-2">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-400 font-semibold">
                Active Kitchen
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400">
                <span className="material-symbols-outlined text-base">hourglass_top</span>
              </div>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-serif font-bold text-amber-300 tracking-tight">
                {isLoading ? '...' : kpis.pendingOrdersCount}
              </p>
              <div className="flex items-center gap-1.5 mt-1 text-[11px] text-stone-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span>Pending prep</span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 4: Today's Reservations */}
        <div className="group p-1 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.07] shadow-lg transition-transform duration-300 hover:-translate-y-0.5">
          <div className="rounded-[calc(1rem-0.25rem)] bg-[#120F0D]/95 border border-white/[0.04] p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] h-full flex flex-col justify-between">
            <div className="flex items-center justify-between text-stone-400 mb-2">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37] font-semibold">
                Table Covers
              </span>
              <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/25 flex items-center justify-center text-[#F3C766]">
                <span className="material-symbols-outlined text-base">event_seat</span>
              </div>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight">
                {isLoading ? '...' : kpis.todayReservationsCount}
              </p>
              <div className="flex items-center gap-1.5 mt-1 text-[11px] text-stone-400">
                <span className="text-stone-300 font-mono text-[10px]">Dining schedule</span>
                <span>• Reserved today</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Operational Quick Actions Dock */}
      <section aria-label="Operations Quick Actions">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
            <h3 className="text-xs uppercase tracking-[0.16em] font-bold text-stone-300">
              Operations Control Dock
            </h3>
          </div>
          <span className="text-[10px] text-stone-500 font-mono">1-CLICK DISPATCH</span>
        </div>

        {/* Simulation Feedback Alert */}
        {simulationMessage && (
          <div
            role="alert"
            className="mb-3 p-3 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#F3C766] text-xs font-semibold flex items-center justify-between shadow-md animate-fadeIn"
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base">notifications_active</span>
              <span>{simulationMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setSimulationMessage(null)}
              className="text-stone-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Action 1: KDS */}
          <button
            type="button"
            onClick={() => onNavigate('/staff/kitchen')}
            className="p-3.5 rounded-2xl bg-gradient-to-br from-[#1C1610] to-[#120E0A] hover:from-[#261E16] hover:to-[#17120D] border border-[#D4AF37]/40 text-left transition-all duration-300 group shadow-md flex items-center gap-3.5 active:scale-[0.98] cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/20 border border-[#D4AF37]/40 flex items-center justify-center text-[#F3C766] group-hover:scale-110 transition-transform shadow-sm">
              <span className="material-symbols-outlined text-xl">soup_kitchen</span>
            </div>
            <div>
              <p className="text-xs font-bold text-[#F3C766] flex items-center gap-1.5">
                <span>Kitchen KDS</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </p>
              <p className="text-[10px] text-stone-400 mt-0.5">Live cook screen</p>
            </div>
          </button>

          {/* Action 2: Orders */}
          <button
            type="button"
            onClick={() => onNavigate('/staff/orders')}
            className="p-3.5 rounded-2xl bg-[#120F0D] hover:bg-[#1A1613] border border-white/[0.08] hover:border-white/[0.16] text-left transition-all duration-300 group shadow-md flex items-center gap-3.5 active:scale-[0.98] cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.1] flex items-center justify-center text-stone-300 group-hover:scale-110 group-hover:text-[#D4AF37] transition-all">
              <span className="material-symbols-outlined text-xl">receipt_long</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Live Orders</p>
              <p className="text-[10px] text-stone-400 mt-0.5">Manage tickets</p>
            </div>
          </button>

          {/* Action 3: Reservations */}
          <button
            type="button"
            onClick={() => onNavigate('/staff/reservations')}
            className="p-3.5 rounded-2xl bg-[#120F0D] hover:bg-[#1A1613] border border-white/[0.08] hover:border-white/[0.16] text-left transition-all duration-300 group shadow-md flex items-center gap-3.5 active:scale-[0.98] cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.1] flex items-center justify-center text-stone-300 group-hover:scale-110 group-hover:text-amber-300 transition-all">
              <span className="material-symbols-outlined text-xl">event_seat</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Table Booking</p>
              <p className="text-[10px] text-stone-400 mt-0.5">Seating calendar</p>
            </div>
          </button>

          {/* Action 4: Tables & QR */}
          <button
            type="button"
            onClick={() => onNavigate('/staff/tables')}
            className="p-3.5 rounded-2xl bg-[#120F0D] hover:bg-[#1A1613] border border-white/[0.08] hover:border-white/[0.16] text-left transition-all duration-300 group shadow-md flex items-center gap-3.5 active:scale-[0.98] cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.1] flex items-center justify-center text-stone-300 group-hover:scale-110 group-hover:text-[#D4AF37] transition-all">
              <span className="material-symbols-outlined text-xl">qr_code_2</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Floor & QR</p>
              <p className="text-[10px] text-stone-400 mt-0.5">Table tent cards</p>
            </div>
          </button>

          {/* Action 5: Menu Stock */}
          <button
            type="button"
            onClick={() => onNavigate('/staff/menu')}
            className="p-3.5 rounded-2xl bg-[#120F0D] hover:bg-[#1A1613] border border-white/[0.08] hover:border-white/[0.16] text-left transition-all duration-300 group shadow-md flex items-center gap-3.5 active:scale-[0.98] cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.1] flex items-center justify-center text-stone-300 group-hover:scale-110 group-hover:text-emerald-400 transition-all">
              <span className="material-symbols-outlined text-xl">menu_book</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-white">86'd Stock</p>
              <p className="text-[10px] text-stone-400 mt-0.5">Item availability</p>
            </div>
          </button>

          {/* Action 6: Test Simulation Order */}
          <button
            type="button"
            onClick={handleSimulateTableOrder}
            disabled={isSimulating}
            className="p-3.5 rounded-2xl bg-gradient-to-br from-[#1F1710] to-[#120F0D] hover:from-[#2B1F13] hover:to-[#17120D] border border-[#D4AF37]/50 text-left transition-all duration-300 group shadow-md flex items-center gap-3.5 active:scale-[0.98] cursor-pointer disabled:opacity-50"
            title="Simulate dinner service order from Table 07 with audio chime"
          >
            <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/20 border border-[#D4AF37]/40 flex items-center justify-center text-[#F3C766] group-hover:scale-110 transition-transform">
              <span className={`material-symbols-outlined text-xl ${isSimulating ? 'animate-spin' : ''}`}>
                {isSimulating ? 'autorenew' : 'bolt'}
              </span>
            </div>
            <div>
              <p className="text-xs font-bold text-[#F3C766] flex items-center gap-1">
                <span>Test Table 07</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-ping" />
              </p>
              <p className="text-[10px] text-stone-400 mt-0.5">Fire order bell</p>
            </div>
          </button>
        </div>
      </section>

      {/* Main Bento Grid: Live Orders & Today's Reservations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Live Orders (2 cols on lg) */}
        <section className="lg:col-span-2 p-1 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.07] shadow-xl">
          <div className="rounded-[calc(2rem-0.25rem)] bg-[#120F0D]/95 border border-white/[0.04] p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-serif text-lg font-bold text-white tracking-wide">
                  Live Order Activity
                </h3>
                <p className="text-xs text-stone-400">
                  Transactions streaming from Dining Room QR & Direct Channels
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('/staff/orders')}
                className="group text-xs font-semibold text-[#D4AF37] hover:text-[#F3C766] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Orders Center</span>
                <span className="material-symbols-outlined text-sm group-hover:translate-x-0.5 transition-transform">
                  arrow_forward
                </span>
              </button>
            </div>

            {isLoading ? (
              <div className="py-16 text-center text-stone-400 text-xs">
                <span className="w-6 h-6 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin inline-block mb-3" />
                <p>Loading live activity...</p>
              </div>
            ) : !data || data.recentOrders.length === 0 ? (
              <div className="py-16 text-center text-stone-400 text-xs">
                <span className="material-symbols-outlined text-3xl mb-2 text-stone-600 block">receipt_long</span>
                No orders registered yet today.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.08] text-stone-400 text-[10px] font-mono uppercase tracking-wider">
                      <th className="pb-3 font-semibold">Reference</th>
                      <th className="pb-3 font-semibold">Guest</th>
                      <th className="pb-3 font-semibold">Service Type</th>
                      <th className="pb-3 font-semibold">Amount</th>
                      <th className="pb-3 font-semibold text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {data.recentOrders.map((order) => {
                      const statusColor = {
                        pending: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
                        confirmed: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
                        preparing: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
                        ready: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
                        completed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
                        cancelled: 'bg-red-500/15 text-red-300 border-red-500/30',
                      }[order.status] || 'bg-stone-500/15 text-stone-300 border-stone-500/30';

                      return (
                        <tr
                          key={order.id}
                          onClick={() => onNavigate('/staff/orders')}
                          className="hover:bg-white/[0.04] cursor-pointer transition-colors group"
                        >
                          <td className="py-3.5 font-mono font-bold text-[#F3C766] group-hover:underline">
                            {order.order_ref}
                          </td>
                          <td className="py-3.5 text-white font-medium">{order.customer_name}</td>
                          <td className="py-3.5 text-stone-400">
                            {order.order_type === 'dine_in' ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#D4AF37]/10 text-[#F3C766] border border-[#D4AF37]/20 font-mono text-[11px]">
                                Table {order.table_number || '??'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.05] text-stone-300 font-mono text-[11px]">
                                Takeaway
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 font-semibold text-stone-200">
                            {formatPrice(order.total, order.currency)}
                          </td>
                          <td className="py-3.5 text-right">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusColor}`}>
                              {order.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Today's Reservations (1 col on lg) */}
        <section className="p-1 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.07] shadow-xl flex flex-col justify-between">
          <div className="rounded-[calc(2rem-0.25rem)] bg-[#120F0D]/95 border border-white/[0.04] p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-serif text-lg font-bold text-white tracking-wide">
                    Today's Bookings
                  </h3>
                  <p className="text-xs text-stone-400">Seating schedule</p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('/staff/reservations')}
                  className="group text-xs font-semibold text-[#D4AF37] hover:text-[#F3C766] inline-flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>All</span>
                  <span className="material-symbols-outlined text-sm group-hover:translate-x-0.5 transition-transform">
                    arrow_forward
                  </span>
                </button>
              </div>

              {isLoading ? (
                <div className="py-16 text-center text-stone-400 text-xs">
                  <span className="w-5 h-5 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin inline-block mb-2" />
                  <p>Loading schedule...</p>
                </div>
              ) : !data || data.todayReservations.length === 0 ? (
                <div className="py-16 text-center text-stone-400 text-xs">
                  <span className="material-symbols-outlined text-3xl mb-2 text-stone-600 block">event_seat</span>
                  No reservations booked for today.
                </div>
              ) : (
                <div className="space-y-3">
                  {data.todayReservations.map((res) => (
                    <div
                      key={res.id}
                      onClick={() => onNavigate('/staff/reservations')}
                      className="p-3.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] hover:border-[#D4AF37]/35 cursor-pointer transition-all duration-200"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-white">{res.customer_name}</p>
                        <span className="font-mono text-xs font-bold text-[#F3C766] px-2 py-0.5 rounded bg-[#D4AF37]/15 border border-[#D4AF37]/25">
                          {res.reservation_time}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2 text-[11px] text-stone-400">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs text-stone-500">group</span>
                          <span>Party of {res.party_size} guests</span>
                        </span>
                        <span className="capitalize text-emerald-400 font-medium text-[10px] uppercase tracking-wider">
                          {res.status}
                        </span>
                      </div>
                      {res.special_requests && (
                        <p className="text-[10px] text-stone-400 italic mt-1.5 line-clamp-1 border-t border-white/[0.04] pt-1">
                          "{res.special_requests}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-white/[0.06] mt-6 text-center">
              <button
                type="button"
                onClick={loadOverview}
                className="text-xs text-stone-400 hover:text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm text-[#D4AF37]">sync</span>
                <span>Refresh Live Schedule</span>
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default DashboardOverview;
