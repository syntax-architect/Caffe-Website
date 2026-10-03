import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { MenuItem, MenuCategory, EditableMenuItemInput } from '../types/menu';

export { MENU_CATEGORIES_FALLBACK, MENU_ITEMS_FALLBACK } from '../data/menuFallbacks';
import { MENU_CATEGORIES_FALLBACK, MENU_ITEMS_FALLBACK } from '../data/menuFallbacks';
let inMemoryMenuCache: MenuItem[] = [...MENU_ITEMS_FALLBACK];

/**
 * Fetches all menu categories ordered by sort_order.
 */
export async function fetchMenuCategories(): Promise<MenuCategory[]> {
  if (!isSupabaseConfigured || !supabase) {
    return MENU_CATEGORIES_FALLBACK;
  }

  try {
    const { data, error } = await supabase
      .from('menu_categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error || !data || data.length === 0) {
      return MENU_CATEGORIES_FALLBACK;
    }

    return data as MenuCategory[];
  } catch (err) {
    console.warn('[menuService] Error fetching menu categories, using fallback:', err);
    return MENU_CATEGORIES_FALLBACK;
  }
}

/**
 * Fetches all menu items ordered by sort_order and name.
 * Populates in-memory cache and returns canonical catalog.
 */
export async function fetchMenuItems(): Promise<MenuItem[]> {
  if (!isSupabaseConfigured || !supabase) {
    return inMemoryMenuCache;
  }

  try {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.warn('[menuService] Error loading menu_items from database, using cached fallback:', error.message);
      return inMemoryMenuCache;
    }

    if (Array.isArray(data) && data.length > 0) {
      inMemoryMenuCache = data.map((row: any) => ({
        ...row,
        category: row.category_id,
        image: row.image_url,
        tag: row.popular ? 'Bestseller' : null,
      }));
    }

    return inMemoryMenuCache;
  } catch (err) {
    console.error('[menuService] Exception loading menu_items:', err);
    return inMemoryMenuCache;
  }
}

/**
 * Looks up a canonical menu item by id or name authoritatively.
 */
export async function getCanonicalMenuItem(idOrName: string): Promise<MenuItem | null> {
  const clean = String(idOrName || '').trim().toLowerCase();
  if (!clean) return null;

  // Check cache first
  const cached = inMemoryMenuCache.find(
    (m) => m.id.toLowerCase() === clean || m.name.toLowerCase() === clean
  );
  if (cached) return cached;

  // If not in cache and Supabase is configured, query database
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .or(`id.eq.${clean},name.ilike.${clean}`)
        .maybeSingle();

      if (!error && data) {
        const item: MenuItem = {
          ...data,
          category: data.category_id,
          image: data.image_url,
          tag: data.popular ? 'Bestseller' : null,
        };
        // Add to cache
        inMemoryMenuCache.push(item);
        return item;
      }
    } catch {
      // Fallback
    }
  }

  return null;
}

/**
 * Inserts or updates a menu item in table 'menu_items'.
 * Enforces RLS: only active staff with role 'owner' or 'manager' are permitted.
 */
export async function upsertMenuItem(
  item: EditableMenuItemInput
): Promise<{ success: boolean; item?: MenuItem; error?: string }> {
  const targetId = item.id || `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const payload = {
    id: targetId,
    category_id: item.category_id,
    name: item.name.trim(),
    description: item.description?.trim() || null,
    price: Number(item.price),
    diet: item.diet || 'veg',
    image_url: item.image_url || null,
    popular: Boolean(item.popular),
    available: item.available !== false,
    sort_order: item.sort_order ?? 0,
    allergens: item.allergens || [],
    updated_at: new Date().toISOString(),
  };

  if (!isSupabaseConfigured || !supabase) {
    const formattedItem: MenuItem = {
      ...payload,
      category: payload.category_id,
      image: payload.image_url || undefined,
      description: payload.description || '',
      allergens: payload.allergens,
      tag: payload.popular ? 'Bestseller' : null,
    };
    const existingIdx = inMemoryMenuCache.findIndex((i) => i.id === targetId);
    if (existingIdx !== -1) {
      inMemoryMenuCache[existingIdx] = formattedItem;
    } else {
      inMemoryMenuCache.unshift(formattedItem);
    }
    return { success: true, item: formattedItem };
  }

  try {
    const { data, error } = await supabase
      .from('menu_items')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error('[menuService] Error saving menu item:', error.message);
      if (error.message.toLowerCase().includes('row-level security') || error.message.toLowerCase().includes('policy')) {
        return {
          success: false,
          error: 'Access denied: Only active restaurant owners and managers can modify the menu catalog.',
        };
      }
      return { success: false, error: error.message };
    }

    const saved: MenuItem = {
      ...data,
      category: data.category_id,
      image: data.image_url,
      tag: data.popular ? 'Bestseller' : null,
    };

    const existingIdx = inMemoryMenuCache.findIndex((i) => i.id === targetId);
    if (existingIdx !== -1) {
      inMemoryMenuCache[existingIdx] = saved;
    } else {
      inMemoryMenuCache.unshift(saved);
    }

    return { success: true, item: saved };
  } catch (err: any) {
    console.error('[menuService] Exception saving menu item:', err);
    return { success: false, error: err.message || 'Failed to save menu item.' };
  }
}

/**
 * Toggles or updates the operational availability of a menu item in table 'menu_items'.
 */
export async function updateMenuItemAvailability(
  id: string,
  available: boolean
): Promise<{ success: boolean; error?: string }> {
  // Update cache immediately
  const cached = inMemoryMenuCache.find((i) => i.id === id);
  if (cached) {
    cached.available = available;
  }

  if (!isSupabaseConfigured || !supabase) {
    return { success: true };
  }

  try {
    const { error } = await supabase
      .from('menu_items')
      .update({
        available,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('[menuService] Error updating availability:', error.message);
      return { success: false, error: error.message };
    }

    // Also sync legacy availability map for backwards compatibility
    try {
      await supabase
        .from('menu_item_availability')
        .upsert({
          item_id: id,
          is_available: available,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'item_id' });
    } catch {
      // Ignore legacy sync errors
    }

    return { success: true };
  } catch (err: any) {
    console.error('[menuService] Exception updating availability:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Deletes a menu item from table 'menu_items'.
 * Enforces RLS: owner/manager only.
 */
export async function deleteMenuItem(
  id: string
): Promise<{ success: boolean; error?: string }> {
  inMemoryMenuCache = inMemoryMenuCache.filter((i) => i.id !== id);

  if (!isSupabaseConfigured || !supabase) {
    return { success: true };
  }

  try {
    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[menuService] Error deleting menu item:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[menuService] Exception deleting menu item:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Subscribes to Supabase Realtime changes on 'menu_items' and 'menu_categories'.
 * Updates are pushed live to customer and staff devices without redeploying.
 */
export function subscribeToMenuRealtime(
  onItemsChange: () => void
): () => void {
  if (!isSupabaseConfigured || !supabase) {
    return () => {};
  }

  try {
    const channelName = `realtime-menu-${Date.now()}`;
    const channel: RealtimeChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_items' },
        async () => {
          await fetchMenuItems();
          onItemsChange();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_categories' },
        async () => {
          await fetchMenuItems();
          onItemsChange();
        }
      )
      .subscribe();

    const client = supabase;
    return () => {
      if (client) {
        client.removeChannel(channel);
      }
    };
  } catch (err) {
    console.warn('[menuService] Could not establish menu realtime subscription:', err);
    return () => {};
  }
}
