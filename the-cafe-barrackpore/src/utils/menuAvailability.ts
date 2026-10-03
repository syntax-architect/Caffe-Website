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
    console.warn('[menuAvailability] Failed to save local availability:', err);
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
