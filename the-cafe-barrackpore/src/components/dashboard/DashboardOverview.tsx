import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { fetchDashboardOverview } from '../../services/dashboardService';
import type { DashboardOverviewData } from '../../types/dashboard';

interface DashboardOverviewProps {
  onNavigate: (path: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onNavigate }) => {
  const { staffProfile } = useAuth();
  const [data, setData] = useState<DashboardOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Dynamic greeting based on current hour
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const loadOverview = () => {
    setIsLoading(true);
    fetchDashboardOverview()
      .then((overview) => setData(overview))
      .catch((err) => console.error('Failed to load overview:', err))
      .finally(() => setIsLoading(false));
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
    <div className="space-y-8">
      {/* Welcome Banner */}
      <section className="bg-gradient-to-r from-surface-container to-surface-container-high border border-outline-variant/40 rounded-3xl p-6 sm:p-8 relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-xs uppercase tracking-widest text-primary font-serif font-bold mb-1">
            {getGreeting()}, {staffProfile?.full_name?.split(' ')[0] || 'Team'}
          </p>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-on-surface tracking-tight">
            The Café Barrackpore Command Center
          </h2>
          <p className="text-outline text-xs sm:text-sm mt-1 max-w-xl">
            Live overview of today's dine-in table orders, takeaway counter, and reservations.
          </p>
        </div>
        <div className="absolute right-0 top-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      </section>

      {/* KPI Cards Grid */}
      <section aria-label="Key Performance Indicators" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Today's Orders */}
        <div className="bg-surface-container border border-outline-variant/40 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-outline mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Today's Orders</span>
            <span className="material-symbols-outlined text-lg text-primary">receipt_long</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold font-serif text-on-surface">
            {isLoading ? '...' : kpis.todayOrdersCount}
          </p>
          <p className="text-[10px] text-outline mt-1">Total registered tickets</p>
        </div>

        {/* KPI 2: Today's Revenue */}
        <div className="bg-surface-container border border-outline-variant/40 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-outline mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Today's Revenue</span>
            <span className="material-symbols-outlined text-lg text-emerald-400">payments</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold font-serif text-on-surface">
            {isLoading ? '...' : `₹${kpis.todayRevenue.toLocaleString('en-IN')}`}
          </p>
          <p className="text-[10px] text-outline mt-1">Excludes cancelled orders</p>
        </div>

        {/* KPI 3: Pending Orders */}
        <div className="bg-surface-container border border-outline-variant/40 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-outline mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Pending Orders</span>
            <span className="material-symbols-outlined text-lg text-amber-400">hourglass_top</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold font-serif text-amber-400">
            {isLoading ? '...' : kpis.pendingOrdersCount}
          </p>
          <p className="text-[10px] text-outline mt-1">Awaiting kitchen confirmation</p>
        </div>

        {/* KPI 4: Today's Reservations */}
        <div className="bg-surface-container border border-outline-variant/40 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-outline mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Today's Bookings</span>
            <span className="material-symbols-outlined text-lg text-primary">event_seat</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold font-serif text-on-surface">
            {isLoading ? '...' : kpis.todayReservationsCount}
          </p>
          <p className="text-[10px] text-outline mt-1">Table reservation requests</p>
        </div>
      </section>

      {/* Quick Operational Actions */}
      <section aria-label="Quick Actions">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs uppercase tracking-wider font-bold text-outline">
            Quick Actions
          </h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <button
            type="button"
            onClick={() => onNavigate('/staff/kitchen')}
            className="p-3.5 rounded-2xl bg-surface-container hover:bg-surface-container-high border border-primary/40 text-left transition-all group shadow-sm flex items-center gap-3 bg-gradient-to-br from-primary/10 to-transparent"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary group-hover:scale-105 transition-transform shadow-sm">
              <span className="material-symbols-outlined text-xl">soup_kitchen</span>
            </div>
            <div>
              <p className="text-xs font-bold text-primary flex items-center gap-1.5">
                <span>Kitchen KDS</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </p>
              <p className="text-[10px] text-outline">Real-time prep screen</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('/staff/orders')}
            className="p-3.5 rounded-2xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-left transition-all group shadow-sm flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-xl">receipt_long</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-on-surface">Orders Board</p>
              <p className="text-[10px] text-outline">Manage active orders</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('/staff/reservations')}
            className="p-3.5 rounded-2xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-left transition-all group shadow-sm flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-xl">event_seat</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-on-surface">Reservations</p>
              <p className="text-[10px] text-outline">View dining bookings</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('/staff/tables')}
            className="p-3.5 rounded-2xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-left transition-all group shadow-sm flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-xl">qr_code_2</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-on-surface">Tables & QR</p>
              <p className="text-[10px] text-outline">Floor map & QR print</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('/staff/menu')}
            className="p-3.5 rounded-2xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-left transition-all group shadow-sm flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-xl">menu_book</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-on-surface">Menu Items</p>
              <p className="text-[10px] text-outline">Update pricing & stock</p>
            </div>
          </button>
        </div>
      </section>

      {/* Main Grid: Live Orders & Today's Reservations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Live Orders (2 cols on lg) */}
        <section className="lg:col-span-2 bg-surface-container border border-outline-variant/40 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-serif text-lg font-bold text-on-surface">Live Order Activity</h3>
              <p className="text-xs text-outline">Recent transactions from website & QR codes</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/staff/orders')}
              className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
            >
              View all orders
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-outline text-xs">Loading live orders...</div>
          ) : !data || data.recentOrders.length === 0 ? (
            <div className="py-12 text-center text-outline text-xs">
              <span className="material-symbols-outlined text-3xl mb-2 opacity-50 block">receipt_long</span>
              No orders registered yet today.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-outline-variant/30 text-outline text-[11px] uppercase tracking-wider">
                    <th className="pb-3 font-semibold">Ref</th>
                    <th className="pb-3 font-semibold">Customer</th>
                    <th className="pb-3 font-semibold">Service</th>
                    <th className="pb-3 font-semibold">Amount</th>
                    <th className="pb-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {data.recentOrders.map((order) => {
                    const statusColor = {
                      pending: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
                      confirmed: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
                      preparing: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
                      ready: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
                      completed: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
                      cancelled: 'bg-red-500/10 text-red-300 border-red-500/30',
                    }[order.status] || 'bg-stone-500/10 text-stone-300 border-stone-500/30';

                    return (
                      <tr
                        key={order.id}
                        onClick={() => onNavigate('/staff/orders')}
                        className="hover:bg-surface-container-high/60 cursor-pointer transition-colors"
                      >
                        <td className="py-3 font-mono font-bold text-primary">{order.order_ref}</td>
                        <td className="py-3 text-on-surface font-medium">{order.customer_name}</td>
                        <td className="py-3 text-outline">
                          {order.order_type === 'dine_in'
                            ? `Dine-in (${order.table_number || 'Table'})`
                            : 'Takeaway'}
                        </td>
                        <td className="py-3 font-semibold text-on-surface">₹{order.total}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusColor}`}>
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
        </section>

        {/* Today's Reservations (1 col on lg) */}
        <section className="bg-surface-container border border-outline-variant/40 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-serif text-lg font-bold text-on-surface">Today's Bookings</h3>
                <p className="text-xs text-outline">Upcoming table schedule</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('/staff/reservations')}
                className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
              >
                View all
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>

            {isLoading ? (
              <div className="py-12 text-center text-outline text-xs">Loading reservations...</div>
            ) : !data || data.todayReservations.length === 0 ? (
              <div className="py-12 text-center text-outline text-xs">
                <span className="material-symbols-outlined text-3xl mb-2 opacity-50 block">event_seat</span>
                No reservations scheduled for today.
              </div>
            ) : (
              <div className="space-y-3">
                {data.todayReservations.map((res) => (
                  <div
                    key={res.id}
                    onClick={() => onNavigate('/staff/reservations')}
                    className="p-3 rounded-2xl bg-surface-container-high/60 border border-outline-variant/30 hover:border-primary/40 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-on-surface">{res.customer_name}</p>
                      <span className="font-mono text-xs font-bold text-primary">{res.reservation_time}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[11px] text-outline">
                      <span>Party of {res.party_size} guests</span>
                      <span className="capitalize text-emerald-400 font-medium">{res.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-outline-variant/20 mt-6 text-center">
            <button
              type="button"
              onClick={loadOverview}
              className="text-xs text-outline hover:text-on-surface inline-flex items-center gap-1.5 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              Refresh Live Data
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default DashboardOverview;
