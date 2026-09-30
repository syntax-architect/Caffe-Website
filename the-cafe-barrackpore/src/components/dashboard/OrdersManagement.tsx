import React, { useState, useEffect, useCallback } from 'react';
import { fetchOrders, fetchOrderItems, updateOrderStatus } from '../../services/dashboardService';
import { useNotification } from '../../hooks/useNotification';
import type { OrderRecord, OrderStatus } from '../../types/order';

interface OrderItemRecord {
  id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export const OrdersManagement: React.FC = () => {
  const { addNotification } = useNotification();

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Selected Order for Detail Drawer
  const [activeOrder, setActiveOrder] = useState<OrderRecord | null>(null);
  const [activeOrderItems, setActiveOrderItems] = useState<OrderItemRecord[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState<boolean>(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);

  const loadOrders = useCallback(async () => {
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
    }
  }, [selectedStatus, selectedType, searchQuery]);

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
        addNotification('success', 'Order Updated', `Order status updated to ${newStatus.toUpperCase()}`);
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
    { id: 'all', label: 'All Orders' },
    { id: 'pending', label: 'New / Pending' },
    { id: 'confirmed', label: 'Confirmed' },
    { id: 'preparing', label: 'Preparing' },
    { id: 'ready', label: 'Ready' },
    { id: 'completed', label: 'Completed' },
    { id: 'cancelled', label: 'Cancelled' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'confirmed':
        return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
      case 'preparing':
        return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
      case 'ready':
        return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
      case 'completed':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'cancelled':
        return 'bg-red-500/15 text-red-300 border-red-500/30';
      default:
        return 'bg-stone-500/15 text-stone-300 border-stone-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-lg pointer-events-none">
            search
          </span>
          <input
            type="text"
            placeholder="Search by ref, customer, phone, or table..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-container border border-outline-variant/60 rounded-xl pl-10 pr-4 py-2 text-xs text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-3">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-surface-container border border-outline-variant/60 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
          >
            <option value="all">All Service Types</option>
            <option value="dine_in">Dine-in Only</option>
            <option value="takeaway">Takeaway Only</option>
          </select>

          <button
            type="button"
            onClick={loadOrders}
            className="p-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/60 text-outline hover:text-on-surface transition-colors"
            title="Refresh Orders"
          >
            <span className="material-symbols-outlined text-lg">refresh</span>
          </button>
        </div>
      </div>

      {/* Status Segmented Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-outline-variant/30 scrollbar-none">
        {statusTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSelectedStatus(tab.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              selectedStatus === tab.id
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-outline hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Orders Table Container */}
      <div className="bg-surface-container border border-outline-variant/40 rounded-3xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="py-20 text-center text-outline text-xs">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="py-20 text-center text-outline text-xs flex flex-col items-center">
            <span className="material-symbols-outlined text-4xl mb-2 opacity-40">receipt_long</span>
            <p className="font-semibold text-sm text-on-surface">No orders found</p>
            <p className="text-[11px] mt-1 max-w-sm">
              No orders matched the current status or search filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-outline-variant/30 bg-surface-container-high/40 text-outline text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-5 font-semibold">Reference</th>
                  <th className="py-3 px-4 font-semibold">Customer</th>
                  <th className="py-3 px-4 font-semibold">Service</th>
                  <th className="py-3 px-4 font-semibold">Time</th>
                  <th className="py-3 px-4 font-semibold">Amount</th>
                  <th className="py-3 px-4 font-semibold">Source</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-5 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => handleSelectOrder(order)}
                    className="hover:bg-surface-container-high/60 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-5 font-mono font-bold text-primary">{order.order_ref}</td>
                    <td className="py-3.5 px-4">
                      <p className="font-medium text-on-surface">{order.customer_name}</p>
                      <p className="text-[10px] text-outline font-mono">{order.customer_phone}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      {order.order_type === 'dine_in' ? (
                        <span className="inline-flex items-center gap-1 text-on-surface">
                          <span className="material-symbols-outlined text-xs text-primary">restaurant</span>
                          <span>Table {order.table_number || '--'}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-outline">
                          <span className="material-symbols-outlined text-xs">takeout_dining</span>
                          <span>Takeaway</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-outline font-mono text-[11px]">
                      {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-on-surface">₹{order.total}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ${
                        order.source === 'qr' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-surface-container-highest text-outline'
                      }`}>
                        {order.source || 'website'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectOrder(order);
                        }}
                        className="px-3 py-1 rounded-lg bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/40 text-[11px] font-semibold text-primary transition-colors"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Detail Drawer */}
      {activeOrder && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            onClick={() => setActiveOrder(null)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
          />

          {/* Drawer Body */}
          <div className="relative w-full max-w-lg bg-surface-container-high h-full shadow-2xl border-l border-outline-variant/40 flex flex-col justify-between overflow-y-auto p-6 sm:p-8 z-10 animate-in slide-in-from-right duration-200">
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-outline-variant/30 mb-6">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-outline font-semibold">Order Details</span>
                  <h3 className="text-xl font-mono font-bold text-primary mt-0.5">{activeOrder.order_ref}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveOrder(null)}
                  className="p-2 rounded-full hover:bg-surface-container text-outline hover:text-on-surface transition-colors"
                  aria-label="Close drawer"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>

              {/* Status and Action Buttons */}
              <div className="mb-6 p-4 rounded-2xl bg-surface-container border border-outline-variant/30">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-outline uppercase tracking-wider font-semibold">Current State</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusColor(activeOrder.status)}`}>
                    {activeOrder.status}
                  </span>
                </div>

                {/* Workflow Status Controls */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-outline-variant/20">
                  {activeOrder.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        disabled={isUpdatingStatus}
                        onClick={() => handleStatusChange(activeOrder.id, 'confirmed')}
                        className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow"
                      >
                        Confirm Order
                      </button>
                      <button
                        type="button"
                        disabled={isUpdatingStatus}
                        onClick={() => handleStatusChange(activeOrder.id, 'cancelled')}
                        className="py-2 px-3 rounded-xl bg-red-900/40 hover:bg-red-900/60 text-red-200 border border-red-500/30 font-semibold text-xs transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  )}

                  {activeOrder.status === 'confirmed' && (
                    <>
                      <button
                        type="button"
                        disabled={isUpdatingStatus}
                        onClick={() => handleStatusChange(activeOrder.id, 'preparing')}
                        className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors shadow"
                      >
                        Send to Kitchen (Preparing)
                      </button>
                      <button
                        type="button"
                        disabled={isUpdatingStatus}
                        onClick={() => handleStatusChange(activeOrder.id, 'cancelled')}
                        className="py-2 px-3 rounded-xl bg-red-900/40 hover:bg-red-900/60 text-red-200 border border-red-500/30 font-semibold text-xs transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  )}

                  {activeOrder.status === 'preparing' && (
                    <button
                      type="button"
                      disabled={isUpdatingStatus}
                      onClick={() => handleStatusChange(activeOrder.id, 'ready')}
                      className="w-full py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition-colors shadow"
                    >
                      Mark Ready for Dispatch
                    </button>
                  )}

                  {activeOrder.status === 'ready' && (
                    <button
                      type="button"
                      disabled={isUpdatingStatus}
                      onClick={() => handleStatusChange(activeOrder.id, 'completed')}
                      className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow"
                    >
                      Mark Order Completed
                    </button>
                  )}

                  {activeOrder.status === 'completed' && (
                    <p className="text-[11px] text-emerald-400 font-semibold py-1">
                      ✔ Order successfully served and closed.
                    </p>
                  )}

                  {activeOrder.status === 'cancelled' && (
                    <p className="text-[11px] text-red-400 font-semibold py-1">
                      ✖ Order was cancelled.
                    </p>
                  )}
                </div>
              </div>

              {/* Customer and Service Info */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-3.5 rounded-2xl bg-surface-container border border-outline-variant/30">
                  <span className="text-[10px] uppercase text-outline font-semibold">Customer</span>
                  <p className="text-xs font-bold text-on-surface mt-0.5">{activeOrder.customer_name}</p>
                  <p className="text-xs text-primary font-mono mt-0.5">{activeOrder.customer_phone}</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-surface-container border border-outline-variant/30">
                  <span className="text-[10px] uppercase text-outline font-semibold">Service Type</span>
                  <p className="text-xs font-bold text-on-surface mt-0.5">
                    {activeOrder.order_type === 'dine_in' ? `Table ${activeOrder.table_number}` : 'Takeaway'}
                  </p>
                  <p className="text-[10px] text-outline mt-0.5 capitalize">Channel: {activeOrder.source || 'website'}</p>
                </div>
              </div>

              {/* Special Requests */}
              {activeOrder.special_requests && (
                <div className="mb-6 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
                  <span className="text-[10px] uppercase font-bold text-amber-300 block mb-0.5">Kitchen Note</span>
                  <p>{activeOrder.special_requests}</p>
                </div>
              )}

              {/* Ordered Items Table */}
              <div className="mb-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-outline mb-3">Order Items</h4>
                {isLoadingItems ? (
                  <p className="text-xs text-outline py-4">Fetching order line items...</p>
                ) : activeOrderItems.length === 0 ? (
                  <p className="text-xs text-outline py-4">No line item breakdown available.</p>
                ) : (
                  <div className="divide-y divide-outline-variant/20 rounded-2xl bg-surface-container border border-outline-variant/30 p-3">
                    {activeOrderItems.map((item) => (
                      <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px]">
                            {item.quantity}
                          </span>
                          <span className="font-medium text-on-surface">{item.item_name}</span>
                        </div>
                        <span className="font-mono text-on-surface">₹{item.line_total}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Financial Totals */}
              <div className="p-4 rounded-2xl bg-surface-container border border-outline-variant/30 space-y-1.5 text-xs">
                <div className="flex justify-between text-outline">
                  <span>Subtotal</span>
                  <span className="font-mono">₹{activeOrder.subtotal}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-on-surface pt-2 border-t border-outline-variant/20">
                  <span>Total Amount</span>
                  <span className="text-primary font-mono font-serif">₹{activeOrder.total}</span>
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="pt-6 border-t border-outline-variant/30 mt-6 flex gap-3">
              <a
                href={`https://wa.me/91${activeOrder.customer_phone.replace(/\D/g, '')}?text=Hello%20${encodeURIComponent(activeOrder.customer_name)},%20regarding%20your%20order%20${activeOrder.order_ref}%20at%20The%20Café%20Barrackpore:`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 px-4 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow"
              >
                <span className="material-symbols-outlined text-base">chat</span>
                Customer WhatsApp
              </a>

              <button
                type="button"
                onClick={() => setActiveOrder(null)}
                className="py-2.5 px-6 rounded-full bg-surface-container hover:bg-surface-container-highest border border-outline-variant/40 text-xs font-semibold text-on-surface transition-colors"
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
