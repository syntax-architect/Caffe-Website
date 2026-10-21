import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useSiteConfig } from '../../context/SiteConfigContext';
import { fetchDashboardOverview } from '../../services/dashboardService';
import type { DashboardOverviewData } from '../../types/dashboard';
import type { OrderRecord } from '../../types/order';
import type { ReservationRecord } from '../../types/reservation';
import { createOrder } from '../../services/orderService';
import { unlockAudioContext, playKitchenOrderBell } from '../../services/soundService';
import { fetchOwnerAnalytics, fetchLowStockItems } from '../../services/ownerService';
import type { OwnerAnalytics } from '../../types/owner';
import type { StockAlertItem } from '../../services/ownerService';
import { formatCurrency } from '../../utils/currency';

interface SimulatedTopItem {
  item_name: string;
  total_quantity: number;
  total_revenue: number;
}

const SIMULATED_TOP_SELLING_ITEMS: SimulatedTopItem[] = [
  { item_name: 'Single-Origin Cappuccino', total_quantity: 24, total_revenue: 5280 },
  { item_name: 'Wood-Fired Margherita', total_quantity: 19, total_revenue: 9405 },
  { item_name: 'Special Chicken On A Bun', total_quantity: 14, total_revenue: 5320 },
  { item_name: 'Chinese Banquet Platter', total_quantity: 11, total_revenue: 7480 },
];

const SIMULATED_PEAK_HOURS = [
  { hour: 11, order_count: 1, revenue: 650 },
  { hour: 12, order_count: 2, revenue: 1480 },
  { hour: 13, order_count: 3, revenue: 2310 },
  { hour: 14, order_count: 2, revenue: 1540 },
  { hour: 15, order_count: 1, revenue: 760 },
  { hour: 16, order_count: 1, revenue: 680 },
  { hour: 17, order_count: 2, revenue: 1620 },
  { hour: 18, order_count: 4, revenue: 3120 },
  { hour: 19, order_count: 11, revenue: 8450 }, // Peaking 19:00 - 21:30
  { hour: 20, order_count: 14, revenue: 10820 }, // Peak summit (20:00)
  { hour: 21, order_count: 6, revenue: 4620 },  // Peak (21:00-21:30)
  { hour: 22, order_count: 1, revenue: 790 },
];

const SIMULATED_RECENT_ORDERS: OrderRecord[] = [
  {
    id: 'sim-ord-1',
    order_ref: 'CB-2026-F942',
    customer_name: 'Pooja Sengupta',
    customer_phone: '9830111222',
    order_type: 'dine_in',
    table_number: '04',
    subtotal: 1480,
    total: 1480,
    currency: 'INR',
    status: 'preparing',
    source: 'qr',
    payment_required: false,
    payment_status: 'not_required',
    created_at: '2026-10-21T19:24:00.000Z',
    updated_at: '2026-10-21T19:24:00.000Z',
    items: [],
  } as any,
  {
    id: 'sim-ord-2',
    order_ref: 'CB-2026-M810',
    customer_name: 'Rohan Banerjee',
    customer_phone: '9830222333',
    order_type: 'dine_in',
    table_number: '08',
    subtotal: 2150,
    total: 2150,
    currency: 'INR',
    status: 'preparing',
    source: 'qr',
    payment_required: false,
    payment_status: 'not_required',
    created_at: '2026-10-21T19:20:00.000Z',
    updated_at: '2026-10-21T19:20:00.000Z',
    items: [],
  } as any,
  {
    id: 'sim-ord-3',
    order_ref: 'CB-2026-K105',
    customer_name: 'Siddharth Roy',
    customer_phone: '9830333444',
    order_type: 'dine_in',
    table_number: '11',
    subtotal: 1890,
    total: 1890,
    currency: 'INR',
    status: 'preparing',
    source: 'qr',
    payment_required: false,
    payment_status: 'not_required',
    created_at: '2026-10-21T19:16:00.000Z',
    updated_at: '2026-10-21T19:16:00.000Z',
    items: [],
  } as any,
  {
    id: 'sim-ord-4',
    order_ref: 'CB-2026-T304',
    customer_name: 'Tanushree Deb',
    customer_phone: '9830444555',
    order_type: 'takeaway',
    table_number: null,
    subtotal: 780,
    total: 780,
    currency: 'INR',
    status: 'preparing',
    source: 'website',
    payment_required: true,
    payment_status: 'paid',
    created_at: '2026-10-21T19:12:00.000Z',
    updated_at: '2026-10-21T19:12:00.000Z',
    items: [],
  } as any,
  {
    id: 'sim-ord-5',
    order_ref: 'CB-2026-W512',
    customer_name: 'Debashis Das',
    customer_phone: '9830555666',
    order_type: 'dine_in',
    table_number: '02',
    subtotal: 1250,
    total: 1250,
    currency: 'INR',
    status: 'preparing',
    source: 'qr',
    payment_required: false,
    payment_status: 'not_required',
    created_at: '2026-10-21T19:08:00.000Z',
    updated_at: '2026-10-21T19:08:00.000Z',
    items: [],
  } as any,
  {
    id: 'sim-ord-6',
    order_ref: 'CB-2026-B721',
    customer_name: 'Ayesha Khan',
    customer_phone: '9830666777',
    order_type: 'dine_in',
    table_number: '07',
    subtotal: 1620,
    total: 1620,
    currency: 'INR',
    status: 'preparing',
    source: 'qr',
    payment_required: false,
    payment_status: 'not_required',
    created_at: '2026-10-21T19:02:00.000Z',
    updated_at: '2026-10-21T19:02:00.000Z',
    items: [],
  } as any,
];

const SIMULATED_RESERVATIONS: ReservationRecord[] = [
  {
    id: 'sim-res-1',
    customer_name: 'Dr. A. Mukherjee',
    customer_phone: '9830001122',
    party_size: 4,
    reservation_date: '2026-10-21',
    reservation_time: '19:30',
    table_number: '03',
    status: 'seated',
    special_requests: 'Riverside window booth preferred',
    created_at: '2026-10-21T10:00:00.000Z',
    updated_at: '2026-10-21T19:30:00.000Z',
  } as any,
  {
    id: 'sim-res-2',
    customer_name: 'S. Ganguly (Anniversary)',
    customer_phone: '9830002233',
    party_size: 2,
    reservation_date: '2026-10-21',
    reservation_time: '20:00',
    table_number: '07',
    status: 'seated',
    special_requests: 'Candlelight setting for 10th anniversary',
    created_at: '2026-10-21T10:00:00.000Z',
    updated_at: '2026-10-21T20:00:00.000Z',
  } as any,
  {
    id: 'sim-res-3',
    customer_name: 'B. K. Sen (Family Gathering)',
    customer_phone: '9830003344',
    party_size: 6,
    reservation_date: '2026-10-21',
    reservation_time: '20:30',
    table_number: '09',
    status: 'seated',
    special_requests: 'Quiet area with high-chair needed',
    created_at: '2026-10-21T10:00:00.000Z',
    updated_at: '2026-10-21T20:30:00.000Z',
  } as any,
  {
    id: 'sim-res-4',
    customer_name: 'P. Roychoudhury (VIP Club)',
    customer_phone: '9830004455',
    party_size: 8,
    reservation_date: '2026-10-21',
    reservation_time: '21:00',
    table_number: '12',
    status: 'confirmed',
    special_requests: 'VIP Private Lounge reserve & pre-order dinner',
    created_at: '2026-10-21T10:00:00.000Z',
    updated_at: '2026-10-21T21:00:00.000Z',
  } as any,
];

interface DashboardOverviewProps {
  onNavigate: (path: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onNavigate }) => {
  const { staffProfile } = useAuth();
  const { restaurantConfig, formatPrice } = useSiteConfig();
  const [data, setData] = useState<DashboardOverviewData | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('cafe_dashboard_overview_cache');
        if (cached) return JSON.parse(cached);
      } catch {
        // ignore
      }
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        return !localStorage.getItem('cafe_dashboard_overview_cache');
      } catch {
        return true;
      }
    }
    return true;
  });
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulatePeakService, setSimulatePeakService] = useState<boolean>(false);
  const [simulationMessage, setSimulationMessage] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<OwnerAnalytics | null>(null);
  const [lowStockItems, setLowStockItems] = useState<StockAlertItem[]>([]);

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
      .then((overview) => {
        setData(overview);
        try {
          localStorage.setItem('cafe_dashboard_overview_cache', JSON.stringify(overview));
        } catch {
          // ignore
        }
      })
      .catch((err) => console.error('Failed to load overview:', err))
      .finally(() => {
        setIsLoading(false);
        setIsRefreshing(false);
      });
    fetchOwnerAnalytics().then(setAnalytics).catch(console.error);
    fetchLowStockItems().then(setLowStockItems).catch(console.error);
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
        try {
          localStorage.setItem('cafe_dashboard_overview_cache', JSON.stringify(overview));
        } catch {
          // ignore
        }
      }
    });
    fetchOwnerAnalytics().then((a) => { if (isMounted) setAnalytics(a); });
    fetchLowStockItems().then((items) => { if (isMounted) setLowStockItems(items); });
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

            <div className="flex items-center gap-3 shrink-0 flex-wrap sm:flex-nowrap">
              {/* Executive Demo Simulation Toggle Button */}
              <button
                type="button"
                onClick={() => setSimulatePeakService((prev) => !prev)}
                className={`group py-2.5 px-4 rounded-xl border text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer active:scale-[0.98] ${
                  simulatePeakService
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
                    : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08] text-stone-300 hover:text-white'
                }`}
                title={simulatePeakService ? 'Switch to Live Database Feed' : 'Simulate Peak Evening (Friday Dinner Rush)'}
              >
                <span
                  className={`material-symbols-outlined text-base ${
                    simulatePeakService ? 'text-amber-400 animate-pulse' : 'text-[#D4AF37]'
                  }`}
                >
                  {simulatePeakService ? 'bolt' : 'speed'}
                </span>
                <span>{simulatePeakService ? 'Live Database Feed' : 'Simulate Peak Evening'}</span>
                {simulatePeakService && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-400 text-black">
                    DEMO
                  </span>
                )}
              </button>

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

      {/* Simulated Telemetry Alert Banner */}
      {simulatePeakService && (
        <section aria-label="Demo Simulation Active" className="p-1 rounded-2xl bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent border border-amber-500/40 shadow-lg animate-fadeIn">
          <div className="rounded-[calc(1rem-0.25rem)] bg-[#14100C]/90 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-amber-400 animate-ping shrink-0" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold border border-amber-500/40">
                    DEMO SIMULATION
                  </span>
                  <span className="text-xs font-bold text-white tracking-wide">
                    Peak Friday Dinner Service Telemetry Active
                  </span>
                </div>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  Cockpit populated with high-volume telemetry for sales presentations. Live database queries remain authoritative.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSimulatePeakService(false)}
              className="px-3.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-semibold text-stone-200 hover:text-white transition-all cursor-pointer shrink-0"
            >
              Exit Simulation
            </button>
          </div>
        </section>
      )}

      {/* KPI Cards Grid - Double-Bezel Hardware Architecture */}
      <section aria-label="Key Performance Indicators" className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* KPI 1: Today's Orders / Daily Volume */}
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
                {isLoading ? '...' : (simulatePeakService ? '48 Orders' : kpis.todayOrdersCount)}
              </p>
              <div className="flex items-center gap-1.5 mt-1 text-[11px] text-stone-400">
                <span className="text-emerald-400 font-medium">100% synced</span>
                <span>• {simulatePeakService ? 'DEMO SIMULATION' : "Today's tickets"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 2: Today's Revenue / Gross Revenue */}
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
                {isLoading
                  ? '...'
                  : (simulatePeakService
                      ? formatCurrency(36840, restaurantConfig.currency, restaurantConfig.locale)
                      : formatPrice(kpis.todayRevenue))}
              </p>
              <div className="flex items-center gap-1.5 mt-1 text-[11px] text-stone-400">
                <span className="text-stone-300 font-mono text-[10px]">
                  {simulatePeakService ? 'DEMO SIMULATION' : 'Net of voids'}
                </span>
                <span>• Live revenue</span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 3: Pending Orders / Active Kitchen */}
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
                {isLoading ? '...' : (simulatePeakService ? '6 Preparing' : kpis.pendingOrdersCount)}
              </p>
              <div className="flex items-center gap-1.5 mt-1 text-[11px] text-stone-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span>{simulatePeakService ? 'DEMO SIMULATION' : 'Pending prep'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 4: Today's Reservations / Table Covers */}
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
                {isLoading ? '...' : (simulatePeakService ? '11 / 12 Seated' : kpis.todayReservationsCount)}
              </p>
              <div className="flex items-center gap-1.5 mt-1 text-[11px] text-stone-400">
                <span className="text-stone-300 font-mono text-[10px]">
                  {simulatePeakService ? 'DEMO SIMULATION' : 'Dining schedule'}
                </span>
                <span>• {simulatePeakService ? 'Peak covers' : 'Reserved today'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 5: Average Order Value */}
        <div className="group p-1 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.07] shadow-lg transition-transform duration-300 hover:-translate-y-0.5">
          <div className="rounded-[calc(1rem-0.25rem)] bg-[#120F0D]/95 border border-white/[0.04] p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] h-full flex flex-col justify-between">
            <div className="flex items-center justify-between text-stone-400 mb-2">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-sky-400 font-semibold">
                Average Order Value
              </span>
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400">
                <span className="material-symbols-outlined text-base">moving</span>
              </div>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-serif font-bold text-sky-400 tracking-tight">
                {isLoading
                  ? '...'
                  : (simulatePeakService
                      ? formatCurrency(767, restaurantConfig.currency, restaurantConfig.locale)
                      : formatPrice(analytics?.averageOrderValue || 0))}
              </p>
              <div className="flex items-center gap-1.5 mt-1 text-[11px] text-stone-400">
                <span className="text-stone-300 font-mono text-[10px]">
                  {simulatePeakService ? 'DEMO SIMULATION' : 'AOV'}
                </span>
                <span>• Today</span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 6: Repeat Customers */}
        <div className="group p-1 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.07] shadow-lg transition-transform duration-300 hover:-translate-y-0.5">
          <div className="rounded-[calc(1rem-0.25rem)] bg-[#120F0D]/95 border border-white/[0.04] p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] h-full flex flex-col justify-between">
            <div className="flex items-center justify-between text-stone-400 mb-2">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-violet-400 font-semibold">
                Repeat Customers
              </span>
              <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/25 flex items-center justify-center text-violet-400">
                <span className="material-symbols-outlined text-base">loyalty</span>
              </div>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-serif font-bold text-violet-300 tracking-tight">
                {isLoading ? '...' : (simulatePeakService ? '64% Returning' : (analytics?.repeatCustomerCount || 0))}
              </p>
              <div className="flex items-center gap-1.5 mt-1 text-[11px] text-stone-400">
                <span className="text-stone-300 font-mono text-[10px]">
                  {simulatePeakService ? 'DEMO SIMULATION' : 'Loyalty'}
                </span>
                <span>• Returning</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- NEW OWNER SECTIONS ---------------- */}
      {lowStockItems.length > 0 && (
        <section aria-label="Stock Alerts" className="p-1 rounded-2xl bg-gradient-to-b from-red-500/[0.08] to-white/[0.02] border border-red-500/[0.15] shadow-lg">
          <div className="rounded-[calc(1rem-0.25rem)] bg-[#120F0D]/95 border border-red-500/[0.08] p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-red-400 text-lg">inventory_2</span>
              <h3 className="text-xs uppercase tracking-[0.16em] font-bold text-red-300">Low Stock Alerts</h3>
              <span className="ml-auto px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[10px] font-bold border border-red-500/30">{lowStockItems.length} items</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {lowStockItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-xs text-white font-medium truncate">{item.name}</span>
                  {item.stock_count === 0 ? (
                    <span className="px-2 py-0.5 rounded-full bg-red-500/25 text-red-300 text-[10px] font-bold border border-red-500/40">SOLD OUT</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">{item.stock_count} left</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Selling Items */}
        <section aria-label="Top Selling Items" className="p-1 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.07] shadow-xl">
          <div className="rounded-[calc(2rem-0.25rem)] bg-[#120F0D]/95 border border-white/[0.04] p-6 h-full">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-[#D4AF37]">star</span>
              <h3 className="font-serif text-lg font-bold text-white tracking-wide">Top Selling Items</h3>
              {simulatePeakService && (
                <span className="ml-auto px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[9px] font-mono font-bold border border-amber-500/30">
                  DEMO SIMULATION
                </span>
              )}
            </div>
            <div className="space-y-2">
              {(simulatePeakService ? SIMULATED_TOP_SELLING_ITEMS : (analytics?.topSellingItems || [])).map((item, index) => (
                <div key={item.item_name} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-md bg-[#D4AF37]/10 flex items-center justify-center text-xs font-bold text-[#F3C766]">{index + 1}</span>
                    <span className="text-sm font-medium text-white">
                      {item.item_name} {simulatePeakService ? `(${item.total_quantity})` : ''}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-emerald-400">{formatPrice(item.total_revenue)}</div>
                    <div className="text-[10px] text-stone-400">{item.total_quantity} sold</div>
                  </div>
                </div>
              ))}
              {!simulatePeakService && (!analytics?.topSellingItems || analytics.topSellingItems.length === 0) && (
                <div className="text-center py-6 text-stone-500 text-sm">No sales data available</div>
              )}
            </div>
          </div>
        </section>

        {/* Busiest / Peak Hours */}
        <section aria-label="Busiest Hours" className="p-1 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.07] shadow-xl">
          <div className="rounded-[calc(2rem-0.25rem)] bg-[#120F0D]/95 border border-white/[0.04] p-6 h-full flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-[#D4AF37]">bar_chart</span>
              <h3 className="font-serif text-lg font-bold text-white tracking-wide">Peak Hours</h3>
              {simulatePeakService && (
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-[10px] font-mono text-[#D4AF37] font-semibold hidden sm:inline">
                    Peak: 19:00 – 21:30
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[9px] font-mono font-bold border border-amber-500/30">
                    DEMO SIMULATION
                  </span>
                </div>
              )}
            </div>
            
            <div className="flex items-end gap-1 h-32 mt-auto">
              {(() => {
                const hoursList = simulatePeakService ? SIMULATED_PEAK_HOURS : (analytics?.busiestHours || []);
                const maxCount = Math.max(...hoursList.map((x) => x.order_count), 1);
                return hoursList.map((h) => {
                  const heightPct = (h.order_count / maxCount) * 100;
                  const isPeakHour = simulatePeakService && (h.hour >= 19 && h.hour <= 21);
                  return (
                    <div key={h.hour} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className={`w-full rounded-t-md min-h-[2px] transition-all ${
                          isPeakHour
                            ? 'bg-gradient-to-t from-amber-500 to-[#F3C766] shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                            : 'bg-gradient-to-t from-[#D4AF37]/60 to-[#D4AF37]'
                        }`}
                        style={{ height: `${heightPct}%` }}
                        title={`${h.order_count} orders, ${formatPrice(h.revenue)} ${isPeakHour ? '(Peak 19:00 - 21:30)' : ''}`}
                      />
                      <span className={`text-[9px] font-mono ${isPeakHour ? 'text-[#F3C766] font-bold' : 'text-stone-500'}`}>
                        {h.hour > 12 ? h.hour - 12 : h.hour}{h.hour >= 12 ? 'p' : 'a'}
                      </span>
                    </div>
                  );
                });
              })()}
              {!simulatePeakService && (!analytics?.busiestHours || analytics.busiestHours.length === 0) && (
                <div className="w-full text-center text-stone-500 text-sm mb-12">No hourly data available</div>
              )}
            </div>
          </div>
        </section>
      </div>

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
                <div className="flex items-center gap-2">
                  <h3 className="font-serif text-lg font-bold text-white tracking-wide">
                    Live Order Activity
                  </h3>
                  {simulatePeakService && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[9px] font-mono font-bold border border-amber-500/30">
                      DEMO SIMULATION
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-400">
                  {simulatePeakService
                    ? 'Simulated Friday dinner rush telemetry streaming from Floor QR & Direct Channels'
                    : 'Transactions streaming from Dining Room QR & Direct Channels'}
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

            {!simulatePeakService && isLoading ? (
              <div className="py-16 text-center text-stone-400 text-xs">
                <span className="w-6 h-6 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin inline-block mb-3" />
                <p>Loading live activity...</p>
              </div>
            ) : (!simulatePeakService && (!data || data.recentOrders.length === 0)) ? (
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
                    {(simulatePeakService ? SIMULATED_RECENT_ORDERS : data!.recentOrders).map((order) => {
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
                          <td className="py-3.5 font-mono font-bold text-[#F3C766] group-hover:underline flex items-center gap-1.5">
                            <span>{order.order_ref}</span>
                            {simulatePeakService && (
                              <span className="px-1.5 py-0.2 rounded text-[8px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                DEMO
                              </span>
                            )}
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
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif text-lg font-bold text-white tracking-wide">
                      Today's Bookings
                    </h3>
                    {simulatePeakService && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[9px] font-mono font-bold border border-amber-500/30">
                        DEMO SIMULATION
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-400">
                    {simulatePeakService ? 'Simulated dinner service seating schedule' : 'Seating schedule'}
                  </p>
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

              {!simulatePeakService && isLoading ? (
                <div className="py-16 text-center text-stone-400 text-xs">
                  <span className="w-5 h-5 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin inline-block mb-2" />
                  <p>Loading schedule...</p>
                </div>
              ) : (!simulatePeakService && (!data || data.todayReservations.length === 0)) ? (
                <div className="py-16 text-center text-stone-400 text-xs">
                  <span className="material-symbols-outlined text-3xl mb-2 text-stone-600 block">event_seat</span>
                  No reservations booked for today.
                </div>
              ) : (
                <div className="space-y-3">
                  {(simulatePeakService ? SIMULATED_RESERVATIONS : data!.todayReservations).map((res) => (
                    <div
                      key={res.id}
                      onClick={() => onNavigate('/staff/reservations')}
                      className="p-3.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] hover:border-[#D4AF37]/35 cursor-pointer transition-all duration-200"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-white">{res.customer_name}</p>
                          {simulatePeakService && (
                            <span className="px-1.5 py-0.2 rounded text-[8px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              DEMO
                            </span>
                          )}
                        </div>
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
