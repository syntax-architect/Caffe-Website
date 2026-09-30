import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { ImageAsset } from '../context/SiteConfigContext';

export interface PersistedContentData {
  hero?: {
    headline?: string;
    subtext?: string;
    src?: string;
    alt?: string;
  };
  ourStory?: {
    title?: string;
    description?: string;
    src?: string;
    alt?: string;
  };
  specials?: {
    title?: string;
    description?: string;
    image?: string;
  };
  gallery?: {
    images?: ImageAsset[];
  };
}

export interface PersistedMenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  diet: 'veg' | 'nv' | 'vegan';
  tag?: string;
  available?: boolean;
  image?: any;
}

const CONTENT_STORAGE_KEY = 'cafe_persisted_content';
const MENU_STORAGE_KEY = 'cafe_persisted_menu';

export const CONTENT_UPDATED_EVENT = 'cafe:content-updated';
export const MENU_UPDATED_EVENT = 'cafe:menu-updated';

/**
 * Retrieve saved content overrides from persistent storage.
 */
export function getPersistedContent(): PersistedContentData {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CONTENT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Save section content persistently and broadcast update event.
 */
export async function saveContentSection(
  section: 'hero' | 'ourStory' | 'specials' | 'gallery',
  data: any
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Update persistent local storage first for resilient immediate updates
    const current = getPersistedContent();
    const updated: PersistedContentData = {
      ...current,
      [section]: {
        ...(current[section] || {}),
        ...data,
      },
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem(CONTENT_STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(
        new CustomEvent(CONTENT_UPDATED_EVENT, { detail: { section, data: updated[section] } })
      );
    }

    // 2. Dispatch secure server-side mutation if server endpoint / edge function is available
    await dispatchServerSanityMutation('siteConfig', section, data);

    return { success: true };
  } catch (err: any) {
    console.error(`[contentPersistenceService] Error saving ${section}:`, err);
    return { success: false, error: err.message || 'Failed to save section content' };
  }
}

/**
 * Retrieve saved menu overrides from persistent storage.
 */
export function getPersistedMenuItems(): Record<string, PersistedMenuItem> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(MENU_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Save a menu item mutation persistently.
 */
export async function saveMenuItemMutation(
  item: PersistedMenuItem
): Promise<{ success: boolean; error?: string }> {
  try {
    const current = getPersistedMenuItems();
    const updated = {
      ...current,
      [item.id]: item,
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent(MENU_UPDATED_EVENT, { detail: item }));
    }

    // Dispatch secure server-side mutation
    await dispatchServerSanityMutation('menuItem', item.id, item);

    return { success: true };
  } catch (err: any) {
    console.error(`[contentPersistenceService] Error saving menu item ${item.name}:`, err);
    return { success: false, error: err.message || 'Failed to save menu item' };
  }
}

/**
 * Secure server-side mutation dispatcher.
 * Never transmits or exposes private tokens to client.
 */
async function dispatchServerSanityMutation(
  docType: 'siteConfig' | 'menuItem',
  target: string,
  payload: any
): Promise<void> {
  // Try Supabase Edge Function first if configured
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (token) {
        const response = await fetch('/api/sanity-mutate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            docType,
            target,
            payload,
          }),
        });

        if (response.ok) {
          const res = await response.json();
          if (res.success) {
            console.log(`[contentPersistenceService] Server mutation dispatched for ${docType}:${target}`);
            return;
          }
        }
      }
    } catch {
      // Fallback to local persistence
    }
  }

  // Also try local dev server endpoint
  try {
    await fetch('/api/sanity-mutate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        docType,
        target,
        payload,
      }),
    });
  } catch {
    // Local persistence already succeeded
  }
}
