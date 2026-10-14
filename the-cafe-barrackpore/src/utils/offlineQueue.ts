/**
 * Offline-First IndexedDB Order Queue & Auto-Sync Engine
 * Commercial Grade — Zero Cost Resilience for Unstable Kitchen & Floor WiFi
 * Stores pending orders locally in IndexedDB when offline or network drops,
 * automatically syncing with backend RPC when connectivity is restored.
 */

import type { CreateOrderPayload } from '../types/order';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface QueuedOfflineOrder {
  id: string;
  order_ref: string;
  payload: CreateOrderPayload;
  queued_at: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  attempts: number;
  last_error?: string | null;
}

const DB_NAME = 'cafe_offline_store';
const STORE_NAME = 'queued_orders';
const DB_VERSION = 1;

/**
 * Opens or initializes the native IndexedDB database
 */
function openOfflineDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'order_ref' });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('queued_at', 'queued_at', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.warn('[OfflineQueue] IndexedDB open error, falling back to in-memory');
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

/**
 * Enqueues an order into local IndexedDB
 */
export async function enqueueOfflineOrder(
  payload: CreateOrderPayload,
  orderRef: string
): Promise<QueuedOfflineOrder> {
  const queuedOrder: QueuedOfflineOrder = {
    id: `offline-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    order_ref: orderRef,
    payload,
    queued_at: new Date().toISOString(),
    status: 'pending',
    attempts: 0,
    last_error: null,
  };

  const db = await openOfflineDB();
  if (db) {
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(queuedOrder);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('[OfflineQueue] Failed to put into IndexedDB:', err);
    }
  }

  // Backup in localStorage for instant retrieval / legacy browser safety
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('cafe_offline_orders_backup');
      const list: QueuedOfflineOrder[] = raw ? JSON.parse(raw) : [];
      list.push(queuedOrder);
      localStorage.setItem('cafe_offline_orders_backup', JSON.stringify(list.slice(-50)));
      window.dispatchEvent(new CustomEvent('cafe:offline-queue-changed', { detail: { count: list.length } }));
    } catch {
      // ignore
    }
  }

  return queuedOrder;
}

/**
 * Retrieves all pending unsynced offline orders
 */
export async function getPendingOfflineOrders(): Promise<QueuedOfflineOrder[]> {
  const db = await openOfflineDB();
  if (db) {
    try {
      return await new Promise<QueuedOfflineOrder[]>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          const all = (req.result || []) as QueuedOfflineOrder[];
          resolve(all.filter((o) => o.status === 'pending' || o.status === 'failed'));
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      // fallback to localStorage
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('cafe_offline_orders_backup');
      const list: QueuedOfflineOrder[] = raw ? JSON.parse(raw) : [];
      return list.filter((o) => o.status === 'pending' || o.status === 'failed');
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Gets count of pending offline orders
 */
export async function getPendingOfflineCount(): Promise<number> {
  const pending = await getPendingOfflineOrders();
  return pending.length;
}

/**
 * Removes or marks an offline order as synced
 */
export async function markOfflineOrderSynced(orderRef: string): Promise<void> {
  const db = await openOfflineDB();
  if (db) {
    try {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(orderRef);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    } catch {
      // ignore
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('cafe_offline_orders_backup');
      if (raw) {
        const list: QueuedOfflineOrder[] = JSON.parse(raw);
        const updated = list.filter((o) => o.order_ref !== orderRef);
        localStorage.setItem('cafe_offline_orders_backup', JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('cafe:offline-queue-changed', { detail: { count: updated.length } }));
      }
    } catch {
      // ignore
    }
  }
}

/**
 * Flushes all pending offline orders to Supabase backend in FIFO order
 */
export async function syncOfflineOrders(): Promise<{ synced: number; failed: number }> {
  if (typeof window === 'undefined' || !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  if (!isSupabaseConfigured || !supabase) {
    return { synced: 0, failed: 0 };
  }

  const pending = await getPendingOfflineOrders();
  if (pending.length === 0) {
    return { synced: 0, failed: 0 };
  }

  let synced = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      const payload = item.payload;
      const restaurantId = payload.restaurant_id || 'the-cafe-barrackpore';
      const isCounterPayment = payload.payment_provider === 'counter' || payload.payment_status === 'pay_at_counter';

      const { data: rpcData, error: rpcError } = await supabase.rpc('create_order_atomic', {
        p_order: {
          order_ref: item.order_ref,
          restaurant_id: restaurantId,
          customer_name: payload.customer_name.trim(),
          customer_phone: payload.customer_phone.trim(),
          order_type: payload.order_type,
          table_number: payload.order_type === 'dine_in' ? payload.table_number?.trim() : null,
          special_requests: payload.special_requests?.trim() || null,
          source: payload.source || 'website',
          currency: payload.currency || 'INR',
          payment_method: isCounterPayment ? 'counter' : 'online',
          payment_provider: payload.payment_provider || null,
          payment_reference: payload.payment_reference || null,
          verified_token: payload.verified_token || null,
        },
        p_items: payload.items.map((it: any) => ({
          id: (it as any).menu_item_id || it.id,
          quantity: it.quantity || 1,
          selected_options: (it as any).selected_options || {},
        })),
      });

      if (!rpcError && rpcData?.order_id) {
        await markOfflineOrderSynced(item.order_ref);
        synced++;
        window.dispatchEvent(new CustomEvent('cafe:offline-order-synced', {
          detail: { orderRef: item.order_ref, orderId: rpcData.order_id },
        }));
      } else if (rpcError && rpcError.code === '23505') {
        // Order ref was already processed by backend, consider synced
        await markOfflineOrderSynced(item.order_ref);
        synced++;
      } else {
        failed++;
      }
    } catch (err) {
      failed++;
      console.warn('[OfflineQueue] Sync failed for order:', item.order_ref, err);
    }
  }

  window.dispatchEvent(new CustomEvent('cafe:offline-sync-completed', {
    detail: { synced, failed, remaining: pending.length - synced },
  }));

  return { synced, failed };
}

/**
 * Initializes listeners for online/offline events
 */
let isListenerInitialized = false;
export function initOfflineSyncListener(): () => void {
  if (typeof window === 'undefined' || isListenerInitialized) {
    return () => {};
  }

  isListenerInitialized = true;

  const handleOnline = () => {
    console.info('[OfflineQueue] Device returned online, flushing pending orders...');
    syncOfflineOrders();
  };

  window.addEventListener('online', handleOnline);

  // Attempt initial sync on startup
  if (navigator.onLine) {
    setTimeout(() => {
      syncOfflineOrders();
    }, 3000);
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    isListenerInitialized = false;
  };
}
