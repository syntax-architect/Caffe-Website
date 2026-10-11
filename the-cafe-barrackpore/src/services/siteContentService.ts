import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface HeroContent {
  headline?: string;
  headlineItalic?: string;
  subtext?: string;
  src?: string;
  mobileSrc?: string;
  alt?: string;
  eyebrowBadge?: string;
  coordinates?: string;
  primaryCtaText?: string;
  primaryCtaHref?: string;
  secondaryCtaText?: string;
  showPrimaryCta?: boolean;
  showSecondaryCta?: boolean;
  establishmentLabel?: string;
  scrollLabel?: string;
}

export interface StoryChapter {
  id: string;
  step: string;
  badge: string;
  title: string;
  titleItalic: string;
  description: string;
  highlight: string;
  image: string;
  imageAlt?: string;
}

export interface StoryContent {
  title: string;
  description: string;
  src: string;
  alt: string;
  tagline?: string;
  hudLocation?: string;
  hudAmbiance?: string;
  chapters?: StoryChapter[];
}

export interface GalleryItem {
  id: string;
  src: string;
  alt: string;
  tag?: string;
  caption?: string;
  title?: string;
  aspectVariant?: 'tall' | 'wide' | 'square';
}

export interface SpecialBadge {
  text: string;
  icon?: string;
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
  enabled?: boolean;
  eyebrow?: string;
  title: string;
  description: string;
  image: string;
  badges?: SpecialBadge[];
  combos?: SpecialCombo[];
}

export interface GalleryContent {
  eyebrow?: string;
  title?: string;
  description?: string;
  images: Array<{
    src: string;
    alt: string;
  }>;
  items?: GalleryItem[];
}

export interface AmbienceMetric {
  label: string;
  value: string;
  highlight?: string;
}

export interface AmbienceChip {
  label: string;
  value: string;
}

export interface AmbienceAudioConfig {
  enabled?: boolean;
  title?: string;
  src?: string;
  badge?: string;
}

export interface AmbienceItem {
  id: string;
  title: string;
  eyebrow?: string;
  badge?: string;
  description?: string;
  image?: string;
  imageAlt?: string;
  icon?: string;
  aspectVariant?: 'tall' | 'wide' | 'standard';
  metric?: AmbienceMetric;
}

export interface AboutVibeContent {
  enabled?: boolean;
  eyebrowBadge?: string;
  eyebrowSub?: string;
  eyebrowText?: string;
  title?: string;
  titleItalic?: string;
  description?: string;
  chips?: AmbienceChip[];
  audio?: AmbienceAudioConfig;
  metrics?: AmbienceMetric[];
  items?: AmbienceItem[];
  images?: Array<{
    src: string;
    alt: string;
  }>;
}

export interface BrandingContent {
  logoUrl: string;
  alt: string;
}

export interface VIPPerk {
  id: string;
  title: string;
  description: string;
  icon?: string;
}

export interface VIPClubContent {
  enabled?: boolean;
  badge?: string;
  badgeIcon?: string;
  eyebrow?: string;
  title: string;
  titleItalic?: string;
  subtitle: string;
  programmeName?: string;
  src: string;
  alt: string;
  perks?: VIPPerk[];
  ctaLabel?: string;
  placeholder?: string;
  disclaimer?: string;
  successTitle?: string;
  successMessage?: string;
}

export interface AllSiteContent {
  hero: HeroContent;
  story: StoryContent;
  aboutVibe: AboutVibeContent;
  specials: SpecialsContent;
  gallery: GalleryContent;
  branding: BrandingContent;
  vipClub: VIPClubContent;
}

export const DEFAULT_STORY_CHAPTERS: StoryChapter[] = [
  {
    id: 'chapter-1',
    step: '01',
    badge: 'THE PHILOSOPHY',
    title: 'A retreat from the',
    titleItalic: 'rushed ordinary.',
    description:
      'Conceived as an antidote to urban rush, The Café Barrackpore reimagines colonial Bengal heritage into an intimate, contemporary nocturnal haven where time gently slows down.',
    highlight: 'Slow living in the heart of Barrackpore.',
    image: '/images/story/story-chapter-1.webp',
    imageAlt: 'Heritage Colonial Nocturnal Salon with Teak Archways and Velvet Seating',
  },
  {
    id: 'chapter-2',
    step: '02',
    badge: '2200K NOCTURNAL RITUAL',
    title: 'The Sanctuary of',
    titleItalic: 'amber warmth.',
    description:
      'Tufted sapphire velvet booths, hand-finished walnut surfaces, and warm 2200K tungsten filament lighting create an unhurried sanctuary tailored for meaningful conversations.',
    highlight: 'Acoustic jazz, smoked vanilla & single-origin aromas.',
    image: '/images/story/story-chapter-2.webp',
    imageAlt: 'Warm 2200K Tungsten Edison Glow and Handcrafted Nocturnal Cocktails',
  },
  {
    id: 'chapter-3',
    step: '03',
    badge: 'ARTISANAL GASTRONOMY',
    title: 'Crafted with',
    titleItalic: 'obsessive intent.',
    description:
      'From hand-pulled espresso crema and slow cold-drip extractions to wood-fired artisanal sourdough pizzas and sizzling tandoori banquets, every creation is an intentional celebration.',
    highlight: 'Locally sourced botanicals & master culinary craft.',
    image: '/images/story/story-chapter-3.webp',
    imageAlt: 'Artisanal Wood-Fired Sourdough Pizza and Hand-Pulled Espresso Crema',
  },
];

export const DEFAULT_GALLERY_ITEMS: GalleryItem[] = [
  {
    id: 'gallery-couple',
    src: '/images/gallery-couple.webp',
    alt: 'Nightlife Couple',
    tag: 'Intimate Evenings',
    caption: 'Bespoke booth seating bathed in low filament glow.',
    aspectVariant: 'tall',
  },
  {
    id: 'gallery-pizza',
    src: '/images/gallery-pizza.webp',
    alt: 'Wood-Fired Pizza',
    tag: 'Wood-Fired Artisans',
    caption: 'Hand-stretched sourdough pizzas fresh from the flame.',
    aspectVariant: 'wide',
  },
  {
    id: 'gallery-beans',
    src: '/images/gallery-beans.webp',
    alt: 'Artisanal Coffee Beans',
    tag: 'Single-Origin Brews',
    caption: 'Artisanal espresso & slow cold drip extractions.',
    aspectVariant: 'square',
  },
  {
    id: 'gallery-guitar',
    src: '/images/gallery-guitar.webp',
    alt: 'Acoustic Weekend Guitar',
    tag: 'Acoustic Weekends',
    caption: 'Live unplugged melodies and twilight conversations.',
    aspectVariant: 'square',
  },
];

export const DEFAULT_AMBIENCE_CHIPS: AmbienceChip[] = [
  { label: 'Lighting', value: '2200K Amber' },
  { label: 'Seating', value: 'Sapphire Velvet' },
  { label: 'Soundscape', value: 'Nocturne Jazz' },
];

export const DEFAULT_AMBIENCE_AUDIO: AmbienceAudioConfig = {
  enabled: true,
  title: 'Lounge Soundscape',
  src: 'https://assets.mixkit.co/music/preview/mixkit-chill-bro-494.mp3',
  badge: 'Live',
};

export const DEFAULT_AMBIENCE_METRICS: AmbienceMetric[] = [
  { label: 'Lighting', value: 'Warm Amber', highlight: '2200K' },
  { label: 'Aroma', value: 'Smoked Vanilla & Arabica' },
];

export const DEFAULT_AMBIENCE_ITEMS: AmbienceItem[] = [
  {
    id: 'vibe-seating',
    title: 'Private Velvet Booths',
    eyebrow: '01 • SEATING',
    badge: 'SEATING',
    description: 'Tufted sapphire velvet booths nestled under warm amber lighting for intimate gatherings.',
    image: '/images/components/comp_img_1.webp',
    imageAlt: 'Midnight Velvet Booth Dining & Warm Filament Lighting',
    icon: 'chair',
    aspectVariant: 'tall',
  },
  {
    id: 'vibe-nocturne',
    title: 'Iconic Neon Accents',
    eyebrow: '02 • NOCTURNE',
    badge: 'NOCTURNE',
    description: 'Moody twilight aesthetic with handcrafted filament lighting and intimate acoustic melodies.',
    image: '/images/components/comp_img_2.webp',
    imageAlt: 'Live Acoustic Guitar Performance on Speakeasy Stage',
    icon: 'flare',
    aspectVariant: 'standard',
  },
  {
    id: 'vibe-gastronomy',
    title: 'Curated Plating',
    eyebrow: '03 • GASTRONOMY',
    badge: 'GASTRONOMY',
    description: 'Artisanal culinary creations and mixology served with contemporary elegance and passion.',
    image: '/images/components/comp_img_3.webp',
    imageAlt: 'Signature Craft Cocktail with Charred Rosemary on Marble Counter',
    icon: 'restaurant',
    aspectVariant: 'standard',
  },
];

export const DEFAULT_SPECIAL_BADGES: SpecialBadge[] = [
  { text: 'Ideal for 2–3 Guests', icon: 'groups' },
  { text: 'Made Fresh to Order', icon: 'skillet' },
];

export const DEFAULT_SPECIAL_COMBOS: SpecialCombo[] = [
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
];

export const DEFAULT_VIP_PERKS: VIPPerk[] = [
  {
    id: 'perk-priority',
    title: 'Priority',
    description: 'Weekend prime booth access',
    icon: 'event_seat',
  },
  {
    id: 'perk-secret-menus',
    title: 'Secret Menus',
    description: 'Off-menu seasonal tastings',
    icon: 'restaurant_menu',
  },
  {
    id: 'perk-live-music',
    title: 'Live Acoustix',
    description: 'Reserved guest artist rows',
    icon: 'music_note',
  },
];

export const DEFAULT_SITE_CONTENT: AllSiteContent = {
  hero: {
    headline: 'NOCTURNAL',
    headlineItalic: 'Gastronomy.',
    subtext: 'Where artisan coffee meets handcrafted cocktails & gourmet comfort food in a strictly premium, nocturnal setting.',
    src: '/images/hero-bar.webp',
    mobileSrc: '/images/hero-bar-mobile.webp',
    alt: 'The Café Barrackpore — Nocturnal Cocktail & Espresso Lounge',
    eyebrowBadge: 'CAFÉ • BAR • BARRACKPORE',
    coordinates: '22.76° N, 88.37° E',
    primaryCtaText: 'Explore Curated Menu',
    primaryCtaHref: '#menu-section',
    secondaryCtaText: 'Reserve a Table',
    showPrimaryCta: true,
    showSecondaryCta: true,
    establishmentLabel: 'EST. CANTONMENT',
    scrollLabel: 'SCROLL TO DISCOVER',
  },
  story: {
    title: 'Crafting Barrackpore’s finest nocturnal escape',
    description:
      'Conceived as an antidote to urban rush, The Café Barrackpore reimagines colonial Bengal heritage into an intimate, contemporary nocturnal haven where time gently slows down.',
    src: '/images/story/story-chapter-1.webp',
    alt: 'The Café Barrackpore Heritage Nocturnal Salon',
    tagline: 'THE PHILOSOPHY & HERITAGE',
    hudLocation: 'EST. BARRACKPORE',
    hudAmbiance: '2200K NOCTURNE',
    chapters: DEFAULT_STORY_CHAPTERS,
  },
  aboutVibe: {
    enabled: true,
    eyebrowBadge: 'Cantonment Ambience',
    eyebrowSub: 'Nocturne Sanctuary',
    eyebrowText: 'COLONIAL CHARM • VINTAGE GLOW',
    title: 'The Atmosphere.',
    titleItalic: 'Atmosphere',
    description:
      'Inspired by British-colonial vintage charms blended with a nocturnal lounge glow, our tufted sapphire velvet booths and golden filament fixtures create an intimate sanctuary for relaxed sophistication.',
    chips: DEFAULT_AMBIENCE_CHIPS,
    audio: DEFAULT_AMBIENCE_AUDIO,
    metrics: DEFAULT_AMBIENCE_METRICS,
    items: DEFAULT_AMBIENCE_ITEMS,
    images: [
      { src: '/images/components/comp_img_1.webp', alt: 'Midnight Velvet Booth Dining & Warm Filament Lighting' },
      { src: '/images/components/comp_img_2.webp', alt: 'Live Acoustic Guitar Performance on Speakeasy Stage' },
      { src: '/images/components/comp_img_3.webp', alt: 'Signature Craft Cocktail with Charred Rosemary on Marble Counter' },
      { src: '/images/components/comp_img_0.webp', alt: 'Artisan Espresso Crema on Dark Wood' },
    ],
  },
  specials: {
    enabled: true,
    eyebrow: "Chef's Signature Banquets",
    title: 'Special Banquet & Hangout Platters',
    description: 'Generous sharing platters with sizzling pan-Asian or smoky clay oven selections, made fresh to order.',
    image: '/images/hero-bar.webp',
    badges: DEFAULT_SPECIAL_BADGES,
    combos: DEFAULT_SPECIAL_COMBOS,
  },
  gallery: {
    eyebrow: 'Visual Chronicles',
    title: 'Moments Captured at The Café',
    description: 'A glimpse into the nocturnal atmosphere, handcrafted cuisine, and acoustic energy at Barrackpore’s premier dining retreat.',
    images: DEFAULT_GALLERY_ITEMS.map((item) => ({ src: item.src, alt: item.alt })),
    items: DEFAULT_GALLERY_ITEMS,
  },
  branding: {
    logoUrl: '/logo.webp',
    alt: 'The Café Barrackpore Crest',
  },
  vipClub: {
    enabled: true,
    badge: "PRIVATE MEMBERS' SALON",
    badgeIcon: 'hotel_class',
    eyebrow: "Connoisseurs' Privileges",
    title: 'Join the Nocturnal Circle',
    titleItalic: 'Nocturnal Circle',
    subtitle: 'Receive discreet invitations to weekend acoustic line-ups, secret seasonal chef previews, and priority booth reservations.',
    programmeName: 'Nocturnal Circle',
    src: '/images/vip-nocturnal-circle.jpg',
    alt: 'The Café Barrackpore Nocturnal VIP Salon',
    perks: DEFAULT_VIP_PERKS,
    ctaLabel: 'Join Privileges',
    placeholder: 'Enter your private email',
    disclaimer: 'Discreet hospitality notifications only • Strictly no spam • Unsubscribe anytime',
    successTitle: 'Welcome to the Inner Circle',
    successMessage: 'Your invitation has been recorded. Discreet seasonal invitations will arrive in your private inbox.',
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

  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('cafe_demo_site_content');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.hero) content.hero = { ...content.hero, ...parsed.hero };
        if (parsed.story) content.story = { ...content.story, ...parsed.story };
        if (parsed.aboutVibe) content.aboutVibe = { ...content.aboutVibe, ...parsed.aboutVibe };
        if (parsed.specials) content.specials = { ...content.specials, ...parsed.specials };
        if (parsed.gallery) content.gallery = { ...content.gallery, ...parsed.gallery };
        if (parsed.branding) content.branding = { ...content.branding, ...parsed.branding };
        if (parsed.vipClub) content.vipClub = { ...content.vipClub, ...parsed.vipClub };
      }
    } catch {
      // ignore
    }
  }

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
            src: upgradeLegacyImageUrl(row.value.src || DEFAULT_SITE_CONTENT.hero.src),
            mobileSrc: row.value.mobileSrc 
              ? upgradeLegacyImageUrl(row.value.mobileSrc) 
              : DEFAULT_SITE_CONTENT.hero.mobileSrc,
          };
        } else if ((row.key === 'story' || row.key === 'ourStory') && row.value) {
          const rawChapters: StoryChapter[] = Array.isArray(row.value.chapters)
            ? row.value.chapters.map((chap: any, idx: number) => ({
                id: chap.id || `chapter-${idx + 1}`,
                step: chap.step || String(idx + 1).padStart(2, '0'),
                badge: chap.badge || '',
                title: chap.title || '',
                titleItalic: chap.titleItalic || '',
                description: chap.description || '',
                highlight: chap.highlight || '',
                image: upgradeLegacyImageUrl(chap.image),
                imageAlt: chap.imageAlt || '',
              }))
            : DEFAULT_STORY_CHAPTERS.map((c, i) =>
                i === 0 && row.value.description ? { ...c, description: row.value.description } : c
              );

          content.story = { 
            ...DEFAULT_SITE_CONTENT.story, 
            ...row.value,
            src: upgradeLegacyImageUrl(row.value.src || DEFAULT_SITE_CONTENT.story.src),
            chapters: rawChapters,
          };
        } else if (row.key === 'aboutVibe' && row.value) {
          const rawItems: AmbienceItem[] = Array.isArray(row.value.items)
            ? row.value.items.map((item: any, idx: number) => ({
                id: item.id || `vibe-${idx + 1}`,
                title: item.title || '',
                eyebrow: item.eyebrow,
                badge: item.badge,
                description: item.description,
                image: item.image ? upgradeLegacyImageUrl(item.image) : undefined,
                imageAlt: item.imageAlt || item.title || '',
                icon: item.icon,
                aspectVariant: item.aspectVariant || (idx === 0 ? 'tall' : 'standard'),
                metric: item.metric,
              }))
            : (Array.isArray(row.value.images)
                ? row.value.images.slice(0, 3).map((img: any, idx: number) => {
                    const fallbackItem = DEFAULT_AMBIENCE_ITEMS[idx] || DEFAULT_AMBIENCE_ITEMS[0];
                    return {
                      id: `vibe-legacy-${idx + 1}`,
                      title: fallbackItem.title,
                      eyebrow: fallbackItem.eyebrow,
                      badge: fallbackItem.badge,
                      description: fallbackItem.description,
                      image: upgradeLegacyImageUrl(img.src),
                      imageAlt: img.alt || fallbackItem.imageAlt,
                      icon: fallbackItem.icon,
                      aspectVariant: fallbackItem.aspectVariant,
                    };
                  })
                : DEFAULT_AMBIENCE_ITEMS);

          const rawImages = Array.isArray(row.value.images)
            ? row.value.images.map((img: any) => ({ ...img, src: upgradeLegacyImageUrl(img.src) }))
            : rawItems.filter((i) => Boolean(i.image)).map((i) => ({ src: i.image!, alt: i.imageAlt || i.title }));

          content.aboutVibe = {
            ...DEFAULT_SITE_CONTENT.aboutVibe,
            ...row.value,
            items: rawItems,
            images: rawImages,
            chips: Array.isArray(row.value.chips) ? row.value.chips : DEFAULT_AMBIENCE_CHIPS,
            audio: row.value.audio ? { ...DEFAULT_AMBIENCE_AUDIO, ...row.value.audio } : DEFAULT_AMBIENCE_AUDIO,
            metrics: Array.isArray(row.value.metrics) ? row.value.metrics : DEFAULT_AMBIENCE_METRICS,
          };
        } else if (row.key === 'specials' && row.value) {
          const rawCombos = Array.isArray(row.value.combos)
            ? row.value.combos.map((c: any) => ({
                ...c,
                image: upgradeLegacyImageUrl(c.image),
              }))
            : DEFAULT_SPECIAL_COMBOS;

          content.specials = {
            ...DEFAULT_SITE_CONTENT.specials,
            ...row.value,
            image: upgradeLegacyImageUrl(row.value.image || DEFAULT_SITE_CONTENT.specials.image),
            badges: Array.isArray(row.value.badges) ? row.value.badges : DEFAULT_SPECIAL_BADGES,
            combos: rawCombos,
          };
        } else if (row.key === 'gallery' && row.value) {
          const rawItems: GalleryItem[] = Array.isArray(row.value.items)
            ? row.value.items.map((item: any, idx: number) => ({
                id: item.id || `gallery-item-${idx + 1}`,
                src: upgradeLegacyImageUrl(item.src),
                alt: item.alt || '',
                tag: item.tag || '',
                caption: item.caption || '',
                title: item.title,
                aspectVariant: item.aspectVariant || (idx === 0 ? 'tall' : idx === 1 ? 'wide' : 'square'),
              }))
            : (Array.isArray(row.value.images)
                ? row.value.images.map((img: any, idx: number) => {
                    const fallbackItem = DEFAULT_GALLERY_ITEMS[idx] || DEFAULT_GALLERY_ITEMS[0];
                    return {
                      id: `gallery-legacy-${idx + 1}`,
                      src: upgradeLegacyImageUrl(img.src),
                      alt: img.alt || fallbackItem.alt,
                      tag: fallbackItem.tag,
                      caption: fallbackItem.caption,
                      aspectVariant: fallbackItem.aspectVariant,
                    };
                  })
                : DEFAULT_GALLERY_ITEMS);

          content.gallery = {
            ...DEFAULT_SITE_CONTENT.gallery,
            ...row.value,
            items: rawItems,
            images: rawItems.map((item) => ({ src: item.src, alt: item.alt })),
          };
        } else if (row.key === 'branding' && row.value) {
          content.branding = { ...DEFAULT_SITE_CONTENT.branding, ...row.value };
        } else if (row.key === 'vipClub' && row.value) {
          const rawPerks: VIPPerk[] = Array.isArray(row.value.perks)
            ? row.value.perks.map((p: any, idx: number) => ({
                id: p.id || `perk-${idx + 1}`,
                title: p.title || '',
                description: p.description || '',
                icon: p.icon || 'star',
              }))
            : DEFAULT_VIP_PERKS;

          content.vipClub = {
            ...DEFAULT_SITE_CONTENT.vipClub,
            ...row.value,
            src: upgradeLegacyImageUrl(row.value.src || DEFAULT_SITE_CONTENT.vipClub.src),
            perks: rawPerks,
          };
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
  key: 'hero' | 'story' | 'ourStory' | 'aboutVibe' | 'specials' | 'gallery' | 'branding' | 'vipClub',
  value: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  const canonicalKey = key === 'ourStory' ? 'story' : key;

  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('cafe_demo_site_content');
      const parsed = raw ? JSON.parse(raw) : {};
      parsed[canonicalKey] = value;
      localStorage.setItem('cafe_demo_site_content', JSON.stringify(parsed));
    } catch {
      // ignore
    }
  }

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
