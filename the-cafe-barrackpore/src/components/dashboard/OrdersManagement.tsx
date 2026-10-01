import React, { useState, useEffect, useCallback } from 'react';
import { fetchOrders, fetchOrderItems, updateOrderStatus } from '../../services/dashboardService';
import { useNotification } from '../../hooks/useNotification';
import { useSiteConfig } from '../../context/SiteConfigContext';
import { formatCurrency } from '../../utils/currency';
import type { OrderRecord, OrderStatus } from '../../types/order';
import { createOrder } from '../../services/orderService';
import { unlockAudioContext, playKitchenOrderBell } from '../../services/soundService';

interface OrderItemRecord {
  id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export const OrdersManagement: React.FC = () => {
  const { addNotification } = useNotification();
  const { restaurantConfig, formatTime } = useSiteConfig();

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Selected Order for Detail Drawer
  const [activeOrder, setActiveOrder] = useState<OrderRecord | null>(null);
  const [activeOrderItems, setActiveOrderItems] = useState<OrderItemRecord[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState<boolean>(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);

  const loadOrders = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const data = await fetchOrders({
        status: selectedStatus,
        orderType: selectedType,
        search: searchQuery,
      });
      setOrders(data);
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedStatus, selectedType, searchQuery]);

  const handleSimulateTableOrder = async () => {
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
        addNotification('success', 'Order Dispatched', `Table 07 test order #${res.orderRef} placed successfully!`);
        await loadOrders();
      } else {
        addNotification('error', 'Simulation Failed', res.error || 'Could not place test order.');
      }
    } catch {
      addNotification('error', 'Error', 'Failed to simulate test order.');
    }
  };

  useEffect(() => {
    let isMounted = true;
    fetchOrders({
      status: selectedStatus,
      orderType: selectedType,
      search: searchQuery,
    }).then((data) => {
      if (isMounted) {
        setOrders(data);
        setIsLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [selectedStatus, selectedType, searchQuery]);

  const handleSelectOrder = async (order: OrderRecord) => {
    setActiveOrder(order);
    setIsLoadingItems(true);
    try {
      const items = await fetchOrderItems(order.id);
      setActiveOrderItems(items);
    } catch (err) {
      console.error('Error fetching line items:', err);
    } finally {
      setIsLoadingItems(false);
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    setIsUpdatingStatus(true);
    try {
      const res = await updateOrderStatus(orderId, newStatus);
      if (res.success) {
        addNotification(
          'success',
          'Order Updated',
          `Order #${activeOrder?.order_ref || orderId} status changed to ${newStatus.toUpperCase()}`
        );
        if (activeOrder && activeOrder.id === orderId) {
          setActiveOrder({ ...activeOrder, status: newStatus });
        }
        await loadOrders();
      } else {
        addNotification('error', 'Update Failed', res.error || 'Could not update order status.');
      }
    } catch {
      addNotification('error', 'Error', 'Failed to update order status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const statusTabs: Array<{ id: string; label: string }> = [
    { id: 'all', label: 'All Tickets' },
    { id: 'pending', label: 'Pending' },
    { id: 'confirmed', label: 'Confirmed' },
    { id: 'preparing', label: 'Kitchen Prep' },
    { id: 'ready', label: 'Ready' },
    { id: 'completed', label: 'Served' },
    { id: 'cancelled', label: 'Voided' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/35';
      case 'confirmed':
        return 'bg-blue-500/15 text-blue-300 border-blue-500/35';
      case 'preparing':
        return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/35';
      case 'ready':
        return 'bg-purple-500/15 text-purple-300 border-purple-500/35';
      case 'completed':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35';
      case 'cancelled':
        return 'bg-red-500/15 text-red-300 border-red-500/35';
      default:
        return 'bg-stone-500/15 text-stone-300 border-stone-500/35';
    }
  };

  const getPaymentBadge = (status?: string) => {
    switch (status) {
      case 'paid':
        return { label: 'Paid Online', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
      case 'pending':
      case 'processing':
        return { label: 'Payment Pending', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
      case 'failed':
        return { label: 'Payment Failed', cls: 'bg-red-500/15 text-red-300 border-red-500/30' };
      case 'refunded':
      case 'partially_refunded':
        return { label: 'Refunded', cls: 'bg-purple-500/15 text-purple-300 border-purple-500/30' };
      case 'not_required':
      default:
        return { label: 'Pay at Counter', cls: 'bg-stone-500/15 text-stone-300 border-stone-500/30' };
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Search and Control Cockpit */}
      <div className="p-1.5 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.07] shadow-lg">
        <div className="rounded-[calc(1rem-0.125rem)] bg-[#120F0D]/95 border border-white/[0.04] p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input with shortcut hint */}
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-lg pointer-events-none">
              search
            </span>
            <input
              type="text"
              placeholder="Search reference, guest name, phone, or table..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#080706] border border-white/[0.1] focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] rounded-xl pl-10 pr-20 py-2.5 text-xs text-white placeholder:text-stone-500 focus:outline-none transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white text-xs p-1"
              >
                <span className="material-symbols-outlined text-sm">clear</span>
              </button>
            )}
          </div>

          {/* Filter Controls */}
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="bg-[#080706] border border-white/[0.1] focus:border-[#D4AF37] rounded-xl px-3.5 py-2.5 text-xs text-stone-200 focus:outline-none appearance-none pr-8 cursor-pointer"
              >
                <option value="all">All Service Types</option>
                <option value="dine_in">Dine-in (Table)</option>
                <option value="takeaway">Takeaway Counter</option>
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none text-base">
                arrow_drop_down
              </span>
            </div>

            <button
              type="button"
              onClick={handleSimulateTableOrder}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-[#D4AF37]/20 to-[#F3C766]/10 hover:from-[#D4AF37]/30 hover:to-[#F3C766]/20 border border-[#D4AF37]/40 text-[#F3C766] text-xs font-mono font-bold transition-all cursor-pointer shadow-sm active:scale-[0.98]"
              title="Simulate incoming dinner service order from Table 07"
            >
              <span className="material-symbols-outlined text-sm">bolt</span>
              <span className="hidden sm:inline">+ Table 07 Order</span>
            </button>

            <button
              type="button"
              onClick={loadOrders}
              disabled={isRefreshing}
              className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-stone-300 hover:text-white transition-all cursor-pointer"
              title="Refresh Orders"
            >
              <span
                className={`material-symbols-outlined text-lg text-[#D4AF37] ${
                  isRefreshing ? 'animate-spin' : ''
                }`}
              >
                refresh
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Status Segmented Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {statusTabs.map((tab) => {
          const isSelected = selectedStatus === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedStatus(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                isSelected
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#F3C766] text-[#120B08] font-bold shadow-[0_2px_12px_rgba(212,175,55,0.25)]'
                  : 'bg-white/[0.03] text-stone-400 hover:text-white hover:bg-white/[0.06] border border-white/[0.05]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Orders Table Container (Double-Bezel Shell) */}
      <div className="p-1 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.07] shadow-xl overflow-hidden">
        <div className="rounded-[calc(2rem-0.25rem)] bg-[#120F0D]/95 border border-white/[0.04] overflow-hidden">
          {isLoading ? (
            <div className="py-24 text-center text-stone-400 text-xs">
              <span className="w-6 h-6 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin inline-block mb-3" />
              <p>Fetching active tickets...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="py-24 text-center text-stone-400 text-xs flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-center text-stone-600 mb-3">
                <span className="material-symbols-outlined text-3xl">receipt_long</span>
              </div>
              <p className="font-serif font-bold text-base text-white">No Matching Orders Found</p>
              <p className="text-xs text-stone-500 mt-1 max-w-sm">
                No orders match the selected filters. Change filter options or submit a new test ticket.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.08] bg-white/[0.02] text-stone-400 text-[10px] font-mono uppercase tracking-wider">
                      <th className="py-3.5 px-6 font-semibold">Reference</th>
                      <th className="py-3.5 px-4 font-semibold">Guest</th>
                      <th className="py-3.5 px-4 font-semibold">Service</th>
                      <th className="py-3.5 px-4 font-semibold">Time</th>
                      <th className="py-3.5 px-4 font-semibold">Amount</th>
                      <th className="py-3.5 px-4 font-semibold">Payment</th>
                      <th className="py-3.5 px-4 font-semibold">Channel</th>
                      <th className="py-3.5 px-4 font-semibold">Status</th>
                      <th className="py-3.5 px-6 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {orders.map((order) => (
                      <tr
                        key={order.id}
                        onClick={() => handleSelectOrder(order)}
                        className="hover:bg-white/[0.04] cursor-pointer transition-colors group"
                      >
                        <td className="py-4 px-6 font-mono font-bold text-[#F3C766] group-hover:underline">
                          {order.order_ref}
                        </td>
                        <td className="py-4 px-4">
                          <p className="font-semibold text-white">{order.customer_name}</p>
                          <p className="text-[10px] text-stone-400 font-mono mt-0.5">{order.customer_phone}</p>
                        </td>
                        <td className="py-4 px-4">
                          {order.order_type === 'dine_in' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#D4AF37]/15 text-[#F3C766] border border-[#D4AF37]/25 font-mono text-[11px]">
                              <span className="material-symbols-outlined text-[13px]">restaurant</span>
                              <span>Table {order.table_number || '--'}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.05] text-stone-300 font-mono text-[11px]">
                              <span className="material-symbols-outlined text-[13px]">takeout_dining</span>
                              <span>Takeaway</span>
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-stone-400 font-mono text-[11px]">
                          {formatTime(order.created_at)}
                        </td>
                        <td className="py-4 px-4 font-bold text-white text-sm">
                          {formatCurrency(
                            order.total,
                            order.currency || restaurantConfig.currency,
                            restaurantConfig.locale
                          )}
                        </td>
                        <td className="py-4 px-4">
                          {(() => {
                            const badge = getPaymentBadge(order.payment_status);
                            return (
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badge.cls}`}>
                                {badge.label}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-mono tracking-wider ${
                              order.source === 'qr'
                                ? 'bg-[#D4AF37]/15 text-[#F3C766] border border-[#D4AF37]/30'
                                : 'bg-white/[0.05] text-stone-400'
                            }`}
                          >
                            {order.source || 'website'}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(order.status)}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectOrder(order);
                            }}
                            className="px-3.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-[#D4AF37] hover:text-[#120B08] border border-white/[0.1] text-[11px] font-semibold text-[#D4AF37] transition-all"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View (Avoids cramped horizontal scrolling) */}
              <div className="md:hidden divide-y divide-white/[0.05]">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    onClick={() => handleSelectOrder(order)}
                    className="p-4 active:bg-white/[0.05] cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono font-bold text-sm text-[#F3C766]">
                        {order.order_ref}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="font-semibold text-white">{order.customer_name}</span>
                      <span className="font-bold text-white text-sm">
                        {formatCurrency(order.total, order.currency || restaurantConfig.currency, restaurantConfig.locale)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-stone-400">
                      <span>
                        {order.order_type === 'dine_in' ? `Table ${order.table_number || '--'}` : 'Takeaway'}
                      </span>
                      <span className="font-mono">{formatTime(order.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Order Detail Slide-Over Drawer */}
      {activeOrder && (
        <div className="fixed inset-0 z-50 flex justify-end animate-fadeIn">
          {/* Backdrop with Heavy Blur */}
          <div
            onClick={() => setActiveOrder(null)}
            className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
          />

          {/* Drawer Body - Double-Bezel Hardware Architecture */}
          <div className="relative w-full max-w-lg bg-[#110E0C] h-full shadow-[0_0_80px_rgba(0,0,0,0.9)] border-l border-white/[0.1] flex flex-col justify-between overflow-y-auto p-6 sm:p-8 z-10 animate-in slide-in-from-right duration-300">
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-5 border-b border-white/[0.08] mb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#D4AF37]" />
                    <span className="text-[10px] uppercase font-mono tracking-[0.2em] text-[#D4AF37] font-semibold">
                      Ticket Inspector
                    </span>
                  </div>
                  <h3 className="text-2xl font-mono font-bold text-white mt-0.5">
                    {activeOrder.order_ref}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveOrder(null)}
                  className="w-9 h-9 rounded-full bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-stone-400 hover:text-white transition-colors cursor-pointer"
                  aria-label="Close drawer"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              {/* Status and Action Controls */}
              <div className="mb-6 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-stone-400 uppercase tracking-wider font-semibold">
                    Current Ticket State
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusColor(activeOrder.status)}`}>
                    {activeOrder.status}
                  </span>
                </div>

                {/* Workflow Status Controls */}
                <div className="flex flex-wrap gap-2 pt-3 border-t border-white/[0.06]">
                  {activeOrder.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        disabled={isUpdatingStatus}
                        onClick={() => handleStatusChange(activeOrder.id, 'confirmed')}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-[0.98] cursor-pointer"
                      >
                        Confirm Ticket
                      </button>
                      <button
                        type="button"
                        disabled={isUpdatingStatus}
                        onClick={() => handleStatusChange(activeOrder.id, 'cancelled')}
                        className="py-2.5 px-4 rounded-xl bg-red-950/60 hover:bg-red-900/60 text-red-200 border border-red-500/35 font-semibold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                      >
                        Void
                      </button>
                    </>
                  )}

                  {activeOrder.status === 'confirmed' && (
                    <>
                      <button
                        type="button"
                        disabled={isUpdatingStatus}
                        onClick={() => handleStatusChange(activeOrder.id, 'preparing')}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-[0.98] cursor-pointer"
                      >
                        Send to Kitchen (Preparing)
                      </button>
                      <button
                        type="button"
                        disabled={isUpdatingStatus}
                        onClick={() => handleStatusChange(activeOrder.id, 'cancelled')}
                        className="py-2.5 px-4 rounded-xl bg-red-950/60 hover:bg-red-900/60 text-red-200 border border-red-500/35 font-semibold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                      >
                        Void
                      </button>
                    </>
                  )}

                  {activeOrder.status === 'preparing' && (
                    <button
                      type="button"
                      disabled={isUpdatingStatus}
                      onClick={() => handleStatusChange(activeOrder.id, 'ready')}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-[0.98] cursor-pointer"
                    >
                      Mark Ready for Dispatch
                    </button>
                  )}

                  {activeOrder.status === 'ready' && (
                    <button
                      type="button"
                      disabled={isUpdatingStatus}
                      onClick={() => handleStatusChange(activeOrder.id, 'completed')}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-[0.98] cursor-pointer"
                    >
                      Mark Served & Closed
                    </button>
                  )}

                  {activeOrder.status === 'completed' && (
                    <p className="text-xs text-emerald-400 font-semibold py-1">
                      ✔ Ticket successfully served and settled.
                    </p>
                  )}

                  {activeOrder.status === 'cancelled' && (
                    <p className="text-xs text-red-400 font-semibold py-1">
                      ✖ Ticket was voided.
                    </p>
                  )}
                </div>
              </div>

              {/* Guest & Dining Info */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-stone-400 font-semibold">
                    Guest Name
                  </span>
                  <p className="text-xs font-bold text-white mt-1">{activeOrder.customer_name}</p>
                  <p className="text-xs text-[#F3C766] font-mono mt-0.5">{activeOrder.customer_phone}</p>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-stone-400 font-semibold">
                    Service Channel
                  </span>
                  <p className="text-xs font-bold text-white mt-1">
                    {activeOrder.order_type === 'dine_in'
                      ? `Table ${activeOrder.table_number || '--'}`
                      : 'Takeaway Counter'}
                  </p>
                  <p className="text-[10px] text-stone-400 mt-0.5 uppercase tracking-wider">
                    Source: {activeOrder.source || 'website'}
                  </p>
                </div>
              </div>

              {/* Payment Details Card */}
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.07] mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-stone-400 font-semibold">
                    Settlement Status
                  </span>
                  {(() => {
                    const badge = getPaymentBadge(activeOrder.payment_status);
                    return (
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badge.cls}`}>
                        {badge.label}
                      </span>
                    );
                  })()}
                </div>
                <div className="space-y-1 text-xs text-stone-300">
                  <div className="flex justify-between">
                    <span className="text-stone-400">Gateway Provider:</span>
                    <span className="font-mono capitalize text-white">{activeOrder.payment_provider || 'Counter / Cash'}</span>
                  </div>
                  {activeOrder.payment_reference && (
                    <div className="flex justify-between">
                      <span className="text-stone-400">Payment ID:</span>
                      <span className="font-mono text-[#F3C766] truncate max-w-[200px]">{activeOrder.payment_reference}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Kitchen Note */}
              {activeOrder.special_requests && (
                <div className="mb-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
                  <span className="text-[10px] uppercase font-bold text-amber-300 block mb-0.5">
                    Special Kitchen Request
                  </span>
                  <p>{activeOrder.special_requests}</p>
                </div>
              )}

              {/* Line Items Breakdown */}
              <div className="mb-6">
                <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-stone-400 mb-2">
                  Order Line Items
                </h4>
                {isLoadingItems ? (
                  <p className="text-xs text-stone-500 py-4 text-center">Loading items...</p>
                ) : activeOrderItems.length === 0 ? (
                  <p className="text-xs text-stone-500 py-4 text-center">No item details recorded.</p>
                ) : (
                  <div className="divide-y divide-white/[0.05] rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
                    {activeOrderItems.map((item) => (
                      <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          <span className="w-5 h-5 rounded-md bg-[#D4AF37]/20 text-[#F3C766] flex items-center justify-center font-bold text-[10px] font-mono">
                            {item.quantity}
                          </span>
                          <span className="font-medium text-white">{item.item_name}</span>
                        </div>
                        <span className="font-mono text-stone-300">
                          {formatCurrency(
                            item.line_total,
                            activeOrder.currency || restaurantConfig.currency,
                            restaurantConfig.locale
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Financial Totals */}
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.07] space-y-1.5 text-xs">
                <div className="flex justify-between text-stone-400">
                  <span>Subtotal</span>
                  <span className="font-mono">
                    {formatCurrency(
                      activeOrder.subtotal,
                      activeOrder.currency || restaurantConfig.currency,
                      restaurantConfig.locale
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-white/[0.06]">
                  <span>Total Due</span>
                  <span className="text-[#F3C766] font-mono font-serif text-lg">
                    {formatCurrency(
                      activeOrder.total,
                      activeOrder.currency || restaurantConfig.currency,
                      restaurantConfig.locale
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="pt-6 border-t border-white/[0.08] mt-6 flex gap-2.5">
              <a
                href={`https://wa.me/${activeOrder.customer_phone.replace(/\D/g, '')}?text=Hello%20${encodeURIComponent(activeOrder.customer_name)},%20regarding%20your%20order%20${activeOrder.order_ref}%20at%20${encodeURIComponent(restaurantConfig.businessName)}:`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <span className="material-symbols-outlined text-base">chat</span>
                <span>WhatsApp Guest</span>
              </a>

              <button
                type="button"
                onClick={() => window.print()}
                className="py-3 px-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-stone-300 hover:text-white font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Print Kitchen Ticket"
              >
                <span className="material-symbols-outlined text-base">print</span>
                <span>Print</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveOrder(null)}
                className="py-3 px-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-semibold text-stone-300 hover:text-white transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersManagement;
