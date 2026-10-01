import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface MenuItemAvailability {
  item_id: string;
  is_available: boolean;
  reason?: string;
  updated_at?: string;
}

const LOCAL_STORAGE_KEY = 'cafe_menu_availability';
export const AVAILABILITY_EVENT = 'cafe:menu-availability-changed';

let memoryAvailabilityMap: Record<string, boolean> = {};

/**
 * Retrieve cached availability map from local persistent storage or in-memory fallback.
 * Map shape: { [itemId: string]: boolean } where false means sold-out / 86'd.
 */
export function getLocalAvailabilityMap(): Record<string, boolean> {
  if (typeof window === 'undefined') return { ...memoryAvailabilityMap };
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return { ...memoryAvailabilityMap };
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : { ...memoryAvailabilityMap };
  } catch {
    return { ...memoryAvailabilityMap };
  }
}

/**
 * Save availability map to local persistent storage and broadcast change.
 */
export function saveLocalAvailabilityMap(map: Record<string, boolean>): void {
  memoryAvailabilityMap = { ...map };
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent(AVAILABILITY_EVENT, { detail: map }));
  } catch (err) {
    console.warn('[menuAvailabilityService] Failed to save local availability:', err);
  }
}

/**
 * Fetch all availability overrides from Supabase (or fallback local cache).
 */
export async function fetchAvailabilityMap(): Promise<Record<string, boolean>> {
  const localMap = getLocalAvailabilityMap();

  if (!isSupabaseConfigured || !supabase) {
    return localMap;
  }

  try {
    const { data, error } = await supabase
      .from('menu_item_availability')
      .select('item_id, is_available');

    if (error) {
      console.warn('[menuAvailabilityService] Failed to fetch availability from Supabase, using cache:', error.message);
      return localMap;
    }

    if (Array.isArray(data)) {
      const remoteMap: Record<string, boolean> = { ...localMap };
      for (const row of data) {
        if (row.item_id) {
          remoteMap[row.item_id] = Boolean(row.is_available);
        }
      }
      saveLocalAvailabilityMap(remoteMap);
      return remoteMap;
    }

    return localMap;
  } catch (err) {
    console.warn('[menuAvailabilityService] Error fetching availability:', err);
    return localMap;
  }
}

/**
 * Toggle an item's availability (in stock vs 86'd sold out).
 * Works with active Supabase staff profiles and falls back cleanly in demo mode.
 */
export async function setMenuItemAvailability(
  itemId: string,
  isAvailable: boolean,
  reason: string = "86'd out of stock"
): Promise<{ success: boolean; error?: string }> {
  const currentMap = getLocalAvailabilityMap();
  const updatedMap = {
    ...currentMap,
    [itemId]: isAvailable,
  };
  saveLocalAvailabilityMap(updatedMap);

  if (!isSupabaseConfigured || !supabase) {
    return { success: true };
  }

  try {
    // Attempt RPC first
    const { error: rpcError } = await supabase.rpc('toggle_menu_item_availability', {
      p_item_id: itemId,
      p_is_available: isAvailable,
      p_reason: reason,
    });

    if (!rpcError) {
      return { success: true };
    }

    // Direct table upsert fallback
    const { error: upsertError } = await supabase
      .from('menu_item_availability')
      .upsert({
        item_id: itemId,
        is_available: isAvailable,
        reason,
        updated_at: new Date().toISOString(),
      });

    if (upsertError) {
      console.warn('[menuAvailabilityService] Direct upsert error:', upsertError.message);
      return { success: true }; // Local map already preserved
    }

    return { success: true };
  } catch (err: any) {
    console.error('[menuAvailabilityService] Unexpected toggle error:', err);
    return { success: true };
  }
}

/**
 * Check if a menu item is available for ordering.
 * Default is true (available) unless explicitly recorded as false.
 */
export function isItemAvailable(itemId: string, map?: Record<string, boolean>): boolean {
  const currentMap = map || getLocalAvailabilityMap();
  return currentMap[itemId] !== false;
}
