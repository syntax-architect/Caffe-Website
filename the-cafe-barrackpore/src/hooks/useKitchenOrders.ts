import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type {
  KitchenOrder,
  KitchenFilter,
  KitchenConnectionStatus,
} from '../services/kitchenService';
import {
  fetchKitchenOrders,
  transitionOrderStatus,
  playKitchenChime,
  unlockAudioContext,
  getSoundPreference,
  setSoundPreference,
  getDensityPreference,
  setDensityPreference,
  isKdsEligible,
} from '../services/kitchenService';

export const useKitchenOrders = () => {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [completedOrders, setCompletedOrders] = useState<KitchenOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<KitchenConnectionStatus>('live');
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(getSoundPreference());
  const [density, setDensityState] = useState<'comfortable' | 'compact'>(getDensityPreference());
  const [filter, setFilter] = useState<KitchenFilter>('all');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isMutatingId, setIsMutatingId] = useState<string | null>(null);
  const [newOrderAlert, setNewOrderAlert] = useState<{ ref: string; table: string | null } | null>(null);

  // Sound ref to avoid stale closures in event listeners
  const soundRef = useRef(soundEnabled);
  useEffect(() => {
    soundRef.current = soundEnabled;
  }, [soundEnabled]);

  /**
   * Loads active orders and reconciles with existing state
   */
  const loadOrders = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    setError(null);
    try {
      const data = await fetchKitchenOrders();
      setOrders(data.activeOrders);
      setCompletedOrders(data.completedOrders);
      setConnectionStatus('live');
    } catch (err) {
      console.error('[useKitchenOrders] Error loading orders:', err);
      setError('Unable to load kitchen orders. Tap retry to reconnect.');
      setConnectionStatus('offline');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    let isCancelled = false;
    fetchKitchenOrders()
      .then((data) => {
        if (!isCancelled) {
          setOrders(data.activeOrders);
          setCompletedOrders(data.completedOrders);
          setConnectionStatus('live');
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error('[useKitchenOrders] Error loading orders:', err);
          setError('Unable to load kitchen orders. Tap retry to reconnect.');
          setConnectionStatus('offline');
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  /**
   * Sound toggle with browser permission unlocking
   */
  const toggleSound = useCallback(async () => {
    const nextState = !soundRef.current;
    if (nextState) {
      // Unmute: attempt audio context resume
      await unlockAudioContext();
      playKitchenChime();
    }
    setSoundPreference(nextState);
    setSoundEnabledState(nextState);
  }, []);

  /**
   * Density toggle
   */
  const handleSetDensity = useCallback((nextDensity: 'comfortable' | 'compact') => {
    setDensityPreference(nextDensity);
    setDensityState(nextDensity);
  }, []);

  /**
   * Handles incoming new order event (deduplicated & KDS payment safety checked)
   */
  const handleNewOrder = useCallback((incoming: KitchenOrder) => {
    // KDS SAFETY: Exclude unpaid orders from active Kitchen columns
    if (!isKdsEligible(incoming)) {
      return;
    }

    setOrders((prev) => {
      // Prevent duplicate tickets if event fired multiple times
      if (prev.some((o) => o.id === incoming.id || o.order_ref === incoming.order_ref)) {
        return prev;
      }
      return [incoming, ...prev];
    });

    // Alert & Chime
    if (soundRef.current) {
      playKitchenChime();
    }
    setNewOrderAlert({ ref: incoming.order_ref, table: incoming.table_number });

    // Auto-dismiss alert after 6s
    setTimeout(() => {
      setNewOrderAlert((current) => (current?.ref === incoming.order_ref ? null : current));
    }, 6000);
  }, []);

  /**
   * Handles order status and payment updates across tickets
   */
  const handleStatusUpdate = useCallback((orderId: string, newStatus: string, fullOrder?: KitchenOrder) => {
    setOrders((prev) => {
      if (newStatus === 'completed') {
        const target = prev.find((o) => o.id === orderId);
        if (target) {
          setCompletedOrders((c) => [{ ...target, status: 'completed' }, ...c.slice(0, 14)]);
        }
        return prev.filter((o) => o.id !== orderId);
      }

      if (newStatus === 'cancelled') {
        return prev.filter((o) => o.id !== orderId);
      }

      // Check payment eligibility if fullOrder is provided
      if (fullOrder) {
        if (!isKdsEligible(fullOrder)) {
          // If payment was cancelled or failed, remove from active display
          return prev.filter((o) => o.id !== orderId);
        }

        // If previously held because unpaid and now marked paid, promote to active orders
        const exists = prev.some((o) => o.id === orderId);
        if (!exists && ['pending', 'confirmed', 'preparing', 'ready'].includes(newStatus)) {
          if (soundRef.current) {
            playKitchenChime();
          }
          setNewOrderAlert({ ref: fullOrder.order_ref, table: fullOrder.table_number });
          return [fullOrder, ...prev];
        }
      }

      return prev.map((o) => {
        if (o.id === orderId) {
          return {
            ...o,
            status: newStatus as KitchenOrder['status'],
            updated_at: new Date().toISOString(),
            ...(fullOrder || {}),
          };
        }
        return o;
      });
    });
  }, []);

  /**
   * Supabase Realtime & Cross-tab Synchronization
   */
  useEffect(() => {
    // 1. Supabase Realtime Channel
    let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;

    if (supabase && isSupabaseConfigured) {
      channel = supabase
        .channel('kds-orders-realtime')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'orders' },
          async (payload) => {
            const raw = payload.new as KitchenOrder;
            // Fetch items for the new order
            try {
              const { data: items } = await supabase!
                .from('order_items')
                .select('*')
                .eq('order_id', raw.id);

              const fullOrder: KitchenOrder = {
                ...raw,
                items: (items || []).map((it) => ({
                  id: it.id,
                  item_name: it.item_name,
                  quantity: Number(it.quantity) || 1,
                  unit_price: Number(it.unit_price) || 0,
                  line_total: Number(it.line_total) || 0,
                  selected_options: it.selected_options || {},
                })),
              };
              handleNewOrder(fullOrder);
            } catch (e) {
              console.warn('[useKitchenOrders] Failed to load items for new order:', e);
              handleNewOrder({ ...raw, items: [] });
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'orders' },
          (payload) => {
            const updated = payload.new as KitchenOrder;
            handleStatusUpdate(updated.id, updated.status, updated);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setConnectionStatus('live');
          } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
            setConnectionStatus('reconnecting');
            // Attempt reconciliation after short delay
            setTimeout(() => loadOrders(false), 2000);
          } else if (status === 'CLOSED') {
            setConnectionStatus('offline');
          }
        });
    }

    // 2. Local Custom Events (Demo mode & in-page events)
    const onCustomOrderCreated = (e: Event) => {
      const customEvent = e as CustomEvent<KitchenOrder>;
      if (customEvent.detail) {
        handleNewOrder(customEvent.detail);
      }
    };

    const onCustomStatusChanged = (e: Event) => {
      const customEvent = e as CustomEvent<{ orderId: string; newStatus: string; order?: KitchenOrder }>;
      if (customEvent.detail) {
        handleStatusUpdate(customEvent.detail.orderId, customEvent.detail.newStatus, customEvent.detail.order);
      }
    };

    // 3. Storage Event (Cross-tab sync in same browser)
    const onStorageSync = (e: StorageEvent) => {
      if (e.key === 'cafe_latest_order_event' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed.event === 'created' && parsed.order) {
            handleNewOrder(parsed.order);
          } else if (parsed.event === 'status_changed' && parsed.orderId) {
            handleStatusUpdate(parsed.orderId, parsed.newStatus, parsed.order);
          }
        } catch (err) {
          console.warn('[useKitchenOrders] Storage sync parse error:', err);
        }
      }
    };

    // 4. Online/Offline window listeners
    const handleOnline = () => {
      setConnectionStatus('reconnecting');
      loadOrders(false);
    };
    const handleOffline = () => setConnectionStatus('offline');

    window.addEventListener('cafe:order-created', onCustomOrderCreated);
    window.addEventListener('cafe:order-status-changed', onCustomStatusChanged);
    window.addEventListener('storage', onStorageSync);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
      window.removeEventListener('cafe:order-created', onCustomOrderCreated);
      window.removeEventListener('cafe:order-status-changed', onCustomStatusChanged);
      window.removeEventListener('storage', onStorageSync);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleNewOrder, handleStatusUpdate, loadOrders]);

  /**
   * Advances an active order to its next stage
   * New -> Preparing -> Ready -> Completed
   */
  const advanceOrder = async (order: KitchenOrder) => {
    let nextStatus: KitchenOrder['status'];
    if (order.status === 'pending' || order.status === 'confirmed') {
      nextStatus = 'preparing';
    } else if (order.status === 'preparing') {
      nextStatus = 'ready';
    } else if (order.status === 'ready') {
      nextStatus = 'completed';
    } else {
      return;
    }

    setIsMutatingId(order.id);
    setActionError(null);

    // Optimistic UI update
    handleStatusUpdate(order.id, nextStatus);

    const result = await transitionOrderStatus(order.id, order.status, nextStatus);

    setIsMutatingId(null);

    if (!result.success) {
      // Revert & notify
      setActionError(result.error || 'Could not update order status.');
      loadOrders(false);
    }
  };

  /**
   * Recalls a completed order back to 'ready'
   */
  const recallOrder = async (order: KitchenOrder) => {
    setIsMutatingId(order.id);
    setActionError(null);

    // Remove from completed, add to active as 'ready'
    setCompletedOrders((prev) => prev.filter((o) => o.id !== order.id));
    setOrders((prev) => [{ ...order, status: 'ready' }, ...prev]);

    const result = await transitionOrderStatus(order.id, 'completed', 'ready');
    setIsMutatingId(null);

    if (!result.success) {
      setActionError(result.error || 'Could not recall order.');
      loadOrders(false);
    }
  };

  /**
   * Cancels an order with status 'cancelled'
   */
  const cancelOrder = async (order: KitchenOrder) => {
    setIsMutatingId(order.id);
    setActionError(null);

    setOrders((prev) => prev.filter((o) => o.id !== order.id));

    const result = await transitionOrderStatus(order.id, order.status, 'cancelled');
    setIsMutatingId(null);

    if (!result.success) {
      setActionError(result.error || 'Could not cancel order.');
      loadOrders(false);
    }
  };

  // Grouped active orders by column status
  const newOrders = orders.filter((o) => o.status === 'pending' || o.status === 'confirmed');
  const preparingOrders = orders.filter((o) => o.status === 'preparing');
  const readyOrders = orders.filter((o) => o.status === 'ready');

  // Filter application
  const applyFilter = (list: KitchenOrder[]) => {
    if (filter === 'all') return list;
    return list.filter((o) => o.order_type === filter);
  };

  return {
    orders,
    newOrders: applyFilter(newOrders),
    preparingOrders: applyFilter(preparingOrders),
    readyOrders: applyFilter(readyOrders),
    completedOrders,
    counts: {
      new: newOrders.length,
      preparing: preparingOrders.length,
      ready: readyOrders.length,
      totalActive: orders.length,
      completed: completedOrders.length,
    },
    isLoading,
    error,
    actionError,
    clearActionError: () => setActionError(null),
    connectionStatus,
    soundEnabled,
    toggleSound,
    density,
    setDensity: handleSetDensity,
    filter,
    setFilter,
    advanceOrder,
    recallOrder,
    cancelOrder,
    isMutatingId,
    newOrderAlert,
    dismissAlert: () => setNewOrderAlert(null),
    refreshOrders: () => loadOrders(false),
  };
};
