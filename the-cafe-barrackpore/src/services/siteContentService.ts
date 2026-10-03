import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface HeroContent {
  headline: string;
  subtext: string;
  src: string;
  alt: string;
}

export interface StoryContent {
  title: string;
  description: string;
  src: string;
  alt: string;
}

export interface SpecialCombo {
  id: string;
  name: string;
  category: string;
  diet: 'all' | 'nv' | 'veg';
  price: number;
  badge: string;
  serves: string;
  description: string;
  image: string;
}

export interface SpecialsContent {
  title: string;
  description: string;
  image: string;
  combos?: SpecialCombo[];
}

export interface GalleryContent {
  images: Array<{
    src: string;
    alt: string;
  }>;
}

export interface AboutVibeContent {
  images: Array<{
    src: string;
    alt: string;
  }>;
}

export interface BrandingContent {
  logoUrl: string;
  alt: string;
}

export interface AllSiteContent {
  hero: HeroContent;
  story: StoryContent;
  aboutVibe: AboutVibeContent;
  specials: SpecialsContent;
  gallery: GalleryContent;
  branding: BrandingContent;
}

export const DEFAULT_SITE_CONTENT: AllSiteContent = {
  hero: {
    headline: 'Step Into Barrackpore’s Trendsetting Dining Retreat',
    subtext: 'Where artisan coffee meets handcrafted cocktails & gourmet comfort food in a strictly premium, nocturnal setting.',
    src: '/images/hero-bar.webp',
    alt: 'The Café Barrackpore — Nocturnal Cocktail & Espresso Lounge',
  },
  story: {
    title: 'Crafting Barrackpore’s finest nocturnal escape',
    description:
      'We believe that true luxury lies in the details. From sourcing the most vibrant, local ingredients from surrounding farms to hand-selecting the perfect acoustic backdrop, every element of our space is intentionally curated.',
    src: '/images/story-pour.webp',
    alt: 'Artisanal Espresso Pour',
  },
  aboutVibe: {
    images: [
      { src: '/images/components/comp_img_0.webp', alt: 'Midnight Velvet Booth Seating' },
      { src: '/images/components/comp_img_2.webp', alt: 'Live Acoustic & Reading Nook' },
      { src: '/images/components/comp_img_3.webp', alt: 'Signature Brew Bar & Mixology' },
      { src: '/images/components/comp_img_1.webp', alt: 'Artisan Platters and Comfort Food' },
    ],
  },
  specials: {
    title: 'Special Banquet & Hangout Platters',
    description: 'Generous sharing platters with sizzling pan-Asian or smoky clay oven selections, made fresh to order.',
    image: '/images/hero-bar.webp',
    combos: [
      {
        id: 'combo-chinese-platter',
        name: 'Chinese Platter',
        category: 'mains-platters',
        diet: 'nv',
        price: 380,
        badge: 'CHINESE BANQUET',
        serves: '2–3 Guests',
        description: 'Delicate steamed momos, golden spring rolls & wok-tossed spicy chilli bites.',
        image: '/images/platters/platter-chinese.webp',
      },
      {
        id: 'combo-tandoori-platter',
        name: 'Tandoori Platter',
        category: 'mains-platters',
        diet: 'nv',
        price: 450,
        badge: 'TANDOORI ROYALE',
        serves: '2–3 Guests',
        description: 'Smoky clay oven kebabs, succulent tikka, fresh mint chutney & garlic butter naan.',
        image: '/images/platters/platter-tandoori.webp',
      },
      {
        id: 'combo-rice-noodles-bowl',
        name: 'Rice & Noodles Bowl',
        category: 'mains-platters',
        diet: 'all',
        price: 240,
        badge: 'PAN-ASIAN SHARING',
        serves: '1–2 Guests',
        description: 'Wok-tossed Hakka noodles, fragrant fried rice & crispy Manchurian gravy.',
        image: '/images/platters/platter-bowl.webp',
      },
    ],
  },
  gallery: {
    images: [
      { src: '/images/gallery-couple.webp', alt: 'Nightlife Couple' },
      { src: '/images/gallery-pizza.webp', alt: 'Wood-Fired Pizza' },
      { src: '/images/gallery-beans.webp', alt: 'Artisanal Coffee Beans' },
      { src: '/images/gallery-guitar.webp', alt: 'Acoustic Weekend Guitar' },
    ],
  },
  branding: {
    logoUrl: '/logo.webp',
    alt: 'The Café Barrackpore Crest',
  },
};

/**
 * Automatically upgrades any legacy or blurry image URLs from older database seeds
 * to their ultra-sharp high-resolution 4K counterparts.
 */
export function upgradeLegacyImageUrl(url: string | undefined): string {
  if (!url) return '';
  if (url.includes('hero-bar')) {
    return '/images/hero-cinematic.jpg';
  }
  if (url.includes('story-pour')) {
    return '/images/story-luxury-pour.jpg';
  }
  if (url.includes('platter-chinese') && !url.includes('highres')) {
    return '/images/platters/platter-chinese-highres.jpg';
  }
  if (url.includes('platter-tandoori') && !url.includes('highres')) {
    return '/images/platters/platter-tandoori-highres.jpg';
  }
  if (url.includes('platter-bowl') && !url.includes('highres')) {
    return '/images/platters/platter-bowl-highres.jpg';
  }
  if (url.includes('comp_img_') && !url.includes('highres')) {
    const match = url.match(/comp_img_(\d+)/);
    if (match) return `/images/components/comp_img_${match[1]}_highres.jpg`;
  }
  if (url.includes('gallery-') && !url.includes('highres')) {
    const match = url.match(/gallery-([a-z0-9_-]+)/);
    if (match) return `/images/gallery-${match[1]}-highres.jpg`;
  }
  return url;
}

/**
 * Fetches all site content sections from Supabase table 'site_content'.
 */
export async function fetchAllSiteContent(): Promise<AllSiteContent> {
  const content: AllSiteContent = { ...DEFAULT_SITE_CONTENT };

  if (!isSupabaseConfigured || !supabase) {
    return content;
  }

  try {
    const { data, error } = await supabase
      .from('site_content')
      .select('key, value');

    if (error) {
      console.warn('[siteContentService] Failed to load site_content from database:', error.message);
      return content;
    }

    if (Array.isArray(data)) {
      for (const row of data) {
        if (row.key === 'hero' && row.value) {
          content.hero = { 
            ...DEFAULT_SITE_CONTENT.hero, 
            ...row.value,
            src: upgradeLegacyImageUrl(row.value.src || DEFAULT_SITE_CONTENT.hero.src)
          };
        } else if ((row.key === 'story' || row.key === 'ourStory') && row.value) {
          content.story = { 
            ...DEFAULT_SITE_CONTENT.story, 
            ...row.value,
            src: upgradeLegacyImageUrl(row.value.src || DEFAULT_SITE_CONTENT.story.src)
          };
        } else if (row.key === 'aboutVibe' && row.value) {
          const rawImgs = Array.isArray(row.value.images) ? row.value.images : DEFAULT_SITE_CONTENT.aboutVibe.images;
          content.aboutVibe = {
            images: rawImgs.map((img: any) => ({ ...img, src: upgradeLegacyImageUrl(img.src) })),
          };
        } else if (row.key === 'specials' && row.value) {
          const rawCombos = Array.isArray(row.value.combos) ? row.value.combos : DEFAULT_SITE_CONTENT.specials.combos;
          content.specials = {
            ...DEFAULT_SITE_CONTENT.specials,
            ...row.value,
            image: upgradeLegacyImageUrl(row.value.image || DEFAULT_SITE_CONTENT.specials.image),
            combos: rawCombos?.map((c: any) => ({ ...c, image: upgradeLegacyImageUrl(c.image) })),
          };
        } else if (row.key === 'gallery' && row.value) {
          const rawImgs = Array.isArray(row.value.images) ? row.value.images : DEFAULT_SITE_CONTENT.gallery.images;
          content.gallery = {
            images: rawImgs.map((img: any) => ({ ...img, src: upgradeLegacyImageUrl(img.src) })),
          };
        } else if (row.key === 'branding' && row.value) {
          content.branding = { ...DEFAULT_SITE_CONTENT.branding, ...row.value };
        }
      }
    }

    return content;
  } catch (err) {
    console.error('[siteContentService] Error fetching site content:', err);
    return content;
  }
}

/**
 * Updates a specific site content section in table 'site_content'.
 * Enforces RLS: only active staff with role 'owner' or 'manager' are allowed.
 */
export async function updateSiteContent(
  key: 'hero' | 'story' | 'ourStory' | 'aboutVibe' | 'specials' | 'gallery' | 'branding',
  value: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  const canonicalKey = key === 'ourStory' ? 'story' : key;

  if (!isSupabaseConfigured || !supabase) {
    const proc = (globalThis as any).process;
    const isDev = typeof import.meta !== 'undefined' && import.meta.env
      ? Boolean(import.meta.env.DEV)
      : (proc ? proc.env?.NODE_ENV !== 'production' : false);

    if (isDev) {
      // In dev simulation without Supabase, return success
      return { success: true };
    }
    return { success: false, error: 'Database connection is not configured.' };
  }

  try {
    const { error } = await supabase
      .from('site_content')
      .upsert({
        key: canonicalKey,
        value,
        restaurant_id: 'the-cafe-barrackpore',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

    if (error) {
      console.error(`[siteContentService] Error updating ${canonicalKey}:`, error.message);
      if (error.message.toLowerCase().includes('row-level security') || error.message.toLowerCase().includes('policy')) {
        return {
          success: false,
          error: 'Access denied: Only active restaurant owners and managers can update website content.',
        };
      }
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error(`[siteContentService] Exception updating ${canonicalKey}:`, err);
    return { success: false, error: err.message || 'Failed to update website content.' };
  }
}

/**
 * Subscribes to Realtime updates on table 'site_content'.
 * Fires callback whenever any section is updated so changes appear live without redeploying.
 */
export function subscribeToSiteContentChanges(
  onUpdate: (key: string, value: any) => void
): () => void {
  if (!isSupabaseConfigured || !supabase) {
    return () => {};
  }

  try {
    const channelName = `realtime-site-content-${Date.now()}`;
    const channel: RealtimeChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_content' },
        (payload: any) => {
          const row = payload.new || payload.old;
          if (row && row.key) {
            onUpdate(row.key, row.value);
          }
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
    console.warn('[siteContentService] Could not establish realtime subscription:', err);
    return () => {};
  }
}
