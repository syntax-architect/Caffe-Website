import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { siteConfig as fallbackConfig } from '../data/siteConfig';
import type { 
  SpecialCombo, 
  SpecialBadge,
  StoryChapter, 
  GalleryItem,
  AmbienceChip,
  AmbienceAudioConfig,
  AmbienceMetric,
  AmbienceItem,
  VIPPerk,
} from '../services/siteContentService';
import {
  DEFAULT_STORY_CHAPTERS,
  DEFAULT_GALLERY_ITEMS,
  DEFAULT_SITE_CONTENT,
  DEFAULT_AMBIENCE_CHIPS,
  DEFAULT_AMBIENCE_AUDIO,
  DEFAULT_AMBIENCE_METRICS,
  DEFAULT_AMBIENCE_ITEMS,
  DEFAULT_SPECIAL_BADGES,
  DEFAULT_SPECIAL_COMBOS,
  DEFAULT_VIP_PERKS,
} from '../services/siteContentService';

export interface ImageAsset {
  src: string;
  alt: string;
}

export interface HeroConfig extends ImageAsset {
  headline?: string;
  headlineItalic?: string;
  subtext?: string;
  mobileSrc?: string;
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

export interface OurStoryConfig extends ImageAsset {
  title?: string;
  description?: string;
  tagline?: string;
  hudLocation?: string;
  hudAmbiance?: string;
  chapters?: StoryChapter[];
}

export interface GalleryConfig {
  eyebrow?: string;
  title?: string;
  description?: string;
  images: ImageAsset[];
  items?: GalleryItem[];
}

export interface SpecialsConfig {
  enabled?: boolean;
  eyebrow?: string;
  title: string;
  description: string;
  image?: string;
  badges?: SpecialBadge[];
  combos?: SpecialCombo[];
}

export interface AboutVibeConfig {
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
  images: ImageAsset[];
}

export interface SEOConfig {
  title?: string;
  description?: string;
  image?: string;
}

export interface VIPClubConfig extends ImageAsset {
  enabled?: boolean;
  badge?: string;
  badgeIcon?: string;
  eyebrow?: string;
  title?: string;
  titleItalic?: string;
  subtitle?: string;
  programmeName?: string;
  perks?: VIPPerk[];
  ctaLabel?: string;
  placeholder?: string;
  disclaimer?: string;
  successTitle?: string;
  successMessage?: string;
}

import { DEFAULT_RESTAURANT_CONFIG, RESTAURANT_PRESETS } from '../config/restaurantPresets';
import type { RestaurantLocalizationConfig } from '../types/restaurantConfig';
import type { RestaurantEngineConfig, RestaurantVisualTheme, ThemePresetId } from '../types/restaurantEngine';
import { defaultEngineConfig } from '../config/defaultEngineConfig';
import { getThemePreset } from '../config/themePresets';
import { formatCurrency } from '../utils/currency';
import {
  formatRestaurantDate,
  formatRestaurantTime,
  formatRestaurantDateTime,
} from '../utils/datetime';

import type { RestaurantSettings } from '../types/dashboard';

export const RESTAURANT_CONFIG_STORAGE_KEY = 'cafe_restaurant_config';
export const RESTAURANT_CONFIG_UPDATED_EVENT = 'cafe:restaurant_config_updated';

const mapSettingsToConfig = (
  settings: Partial<RestaurantSettings>
): RestaurantLocalizationConfig => {
  const country = settings.country || 'IN';
  const preset = RESTAURANT_PRESETS[country] || RESTAURANT_PRESETS.IN;

  return {
    country,
    businessName: settings.business_name || DEFAULT_RESTAURANT_CONFIG.businessName,
    shortName: DEFAULT_RESTAURANT_CONFIG.shortName,
    currency: settings.currency || preset.currency,
    currencySymbol: settings.currency_symbol || preset.currencySymbol,
    locale: settings.locale || preset.locale,
    timezone: settings.timezone || preset.timezone,
    phoneCountryCode: settings.phone_country_code || preset.phoneCountryCode,
    phoneValidationMode: 'country',
    openingTime: settings.opening_time || DEFAULT_RESTAURANT_CONFIG.openingTime,
    closingTime: settings.closing_time || DEFAULT_RESTAURANT_CONFIG.closingTime,
    isOrderingEnabled: settings.is_ordering_enabled ?? true,
    isTableBookingEnabled: settings.is_table_booking_enabled ?? true,
    announcementBanner: settings.announcement_banner ?? null,
    governingLaw: settings.governing_law || undefined,
    tax: {
      enabled: settings.tax_enabled ?? true,
      mode: (settings.tax_mode as any) || preset.taxMode,
      label: settings.tax_label || preset.taxLabel,
      rate: settings.tax_rate ?? preset.taxRate,
    },
    dietary: {
      system: (settings.dietary_system as any) || preset.dietarySystem,
    },
    contact: {
      primaryMethod: (settings.primary_contact_method as any) || preset.primaryContactMethod,
      phone: settings.phone || DEFAULT_RESTAURANT_CONFIG.contact.phone,
      displayPhone: settings.phone || DEFAULT_RESTAURANT_CONFIG.contact.displayPhone,
      whatsapp: settings.phone || DEFAULT_RESTAURANT_CONFIG.contact.whatsapp,
      email: settings.email || DEFAULT_RESTAURANT_CONFIG.contact.email,
    },
    address: {
      line1: settings.address || DEFAULT_RESTAURANT_CONFIG.address.line1,
      city: settings.city || DEFAULT_RESTAURANT_CONFIG.address.city,
      region: settings.state_region || DEFAULT_RESTAURANT_CONFIG.address.region,
      postalCode: settings.postal_code || DEFAULT_RESTAURANT_CONFIG.address.postalCode,
      country: country === 'IN' ? 'India' : country,
    },
    payments: {
      enabled: settings.payments_enabled ?? settings.payment_enabled ?? (preset.payments?.enabled ?? false),
      payments_enabled: settings.payments_enabled ?? settings.payment_enabled ?? (preset.payments?.enabled ?? false),
      provider: (settings.payment_provider as any) || preset.payments?.provider || 'none',
      mode: (settings.payment_mode as any) || preset.payments?.mode || 'disabled',
      allow_pay_at_counter: settings.allow_pay_at_counter ?? true,
    },
  };
};

export interface SiteConfigContextType {
  hero: HeroConfig;
  ourStory: OurStoryConfig;
  specials: SpecialsConfig;
  gallery: GalleryConfig;
  aboutVibe: AboutVibeConfig;
  vipClub: VIPClubConfig;
  seo: SEOConfig;
  logoUrl: string;
  isLoading: boolean;
  error: Error | null;
  updateSection: (
    section: 'hero' | 'ourStory' | 'aboutVibe' | 'specials' | 'gallery' | 'branding' | 'vipClub',
    data: any
  ) => Promise<boolean>;

  // Localization and international restaurant configuration
  restaurantConfig: RestaurantLocalizationConfig;
  /** Unified Restaurant Engine Configuration (theme, layout variants, section toggles) */
  engineConfig: RestaurantEngineConfig;
  formatPrice: (amount: number, customCurrency?: string) => string;
  formatDate: (date: Date | string) => string;
  formatTime: (date: Date | string) => string;
  formatDateTime: (date: Date | string) => string;
  updateRestaurantConfig: (
    updates: Partial<RestaurantLocalizationConfig>
  ) => Promise<boolean>;
  setThemePreset?: (presetId: ThemePresetId) => void;
  setCustomTheme?: (theme: RestaurantVisualTheme) => void;
}

const defaultContextValue: SiteConfigContextType = {
  hero: {
    src: DEFAULT_SITE_CONTENT.hero.src || fallbackConfig.hero.image,
    mobileSrc: DEFAULT_SITE_CONTENT.hero.mobileSrc,
    alt: DEFAULT_SITE_CONTENT.hero.alt || fallbackConfig.hero.alt,
    headline: DEFAULT_SITE_CONTENT.hero.headline || 'NOCTURNAL',
    headlineItalic: DEFAULT_SITE_CONTENT.hero.headlineItalic || 'Gastronomy.',
    subtext:
      DEFAULT_SITE_CONTENT.hero.subtext ||
      'Where artisan coffee meets handcrafted cocktails & gourmet comfort food in a strictly premium, nocturnal setting.',
    eyebrowBadge: DEFAULT_SITE_CONTENT.hero.eyebrowBadge,
    coordinates: DEFAULT_SITE_CONTENT.hero.coordinates,
    primaryCtaText: DEFAULT_SITE_CONTENT.hero.primaryCtaText,
    primaryCtaHref: DEFAULT_SITE_CONTENT.hero.primaryCtaHref,
    secondaryCtaText: DEFAULT_SITE_CONTENT.hero.secondaryCtaText,
    showPrimaryCta: DEFAULT_SITE_CONTENT.hero.showPrimaryCta,
    showSecondaryCta: DEFAULT_SITE_CONTENT.hero.showSecondaryCta,
    establishmentLabel: DEFAULT_SITE_CONTENT.hero.establishmentLabel,
    scrollLabel: DEFAULT_SITE_CONTENT.hero.scrollLabel,
  },
  ourStory: {
    src: DEFAULT_SITE_CONTENT.story.src || fallbackConfig.ourStory.image,
    alt: DEFAULT_SITE_CONTENT.story.alt || fallbackConfig.ourStory.alt,
    title: DEFAULT_SITE_CONTENT.story.title || 'Crafting Barrackpore’s finest nocturnal escape',
    description:
      DEFAULT_SITE_CONTENT.story.description ||
      'Conceived as an antidote to urban rush, The Café Barrackpore reimagines colonial Bengal heritage into an intimate, contemporary nocturnal haven where time gently slows down.',
    tagline: DEFAULT_SITE_CONTENT.story.tagline,
    hudLocation: DEFAULT_SITE_CONTENT.story.hudLocation,
    hudAmbiance: DEFAULT_SITE_CONTENT.story.hudAmbiance,
    chapters: DEFAULT_SITE_CONTENT.story.chapters || DEFAULT_STORY_CHAPTERS,
  },
  specials: {
    enabled: DEFAULT_SITE_CONTENT.specials.enabled ?? true,
    eyebrow: DEFAULT_SITE_CONTENT.specials.eyebrow || "Chef's Signature Banquets",
    title: DEFAULT_SITE_CONTENT.specials.title || 'Special Banquet & Hangout Platters',
    description:
      DEFAULT_SITE_CONTENT.specials.description ||
      'Generous sharing platters with sizzling pan-Asian or smoky clay oven selections, made fresh to order.',
    image: DEFAULT_SITE_CONTENT.specials.image || '/images/hero-cinematic.jpg',
    badges: DEFAULT_SITE_CONTENT.specials.badges || DEFAULT_SPECIAL_BADGES,
    combos: DEFAULT_SITE_CONTENT.specials.combos || DEFAULT_SPECIAL_COMBOS,
  },
  gallery: {
    eyebrow: DEFAULT_SITE_CONTENT.gallery.eyebrow,
    title: DEFAULT_SITE_CONTENT.gallery.title,
    description: DEFAULT_SITE_CONTENT.gallery.description,
    images: DEFAULT_SITE_CONTENT.gallery.images,
    items: DEFAULT_SITE_CONTENT.gallery.items || DEFAULT_GALLERY_ITEMS,
  },
  aboutVibe: {
    enabled: DEFAULT_SITE_CONTENT.aboutVibe.enabled ?? true,
    eyebrowBadge: DEFAULT_SITE_CONTENT.aboutVibe.eyebrowBadge || 'Cantonment Ambience',
    eyebrowSub: DEFAULT_SITE_CONTENT.aboutVibe.eyebrowSub || 'Nocturne Sanctuary',
    eyebrowText: DEFAULT_SITE_CONTENT.aboutVibe.eyebrowText || 'COLONIAL CHARM • VINTAGE GLOW',
    title: DEFAULT_SITE_CONTENT.aboutVibe.title || 'The Atmosphere.',
    titleItalic: DEFAULT_SITE_CONTENT.aboutVibe.titleItalic || 'Atmosphere',
    description:
      DEFAULT_SITE_CONTENT.aboutVibe.description ||
      'Inspired by British-colonial vintage charms blended with a nocturnal lounge glow, our tufted sapphire velvet booths and golden filament fixtures create an intimate sanctuary for relaxed sophistication.',
    chips: DEFAULT_SITE_CONTENT.aboutVibe.chips || DEFAULT_AMBIENCE_CHIPS,
    audio: DEFAULT_SITE_CONTENT.aboutVibe.audio || DEFAULT_AMBIENCE_AUDIO,
    metrics: DEFAULT_SITE_CONTENT.aboutVibe.metrics || DEFAULT_AMBIENCE_METRICS,
    items: DEFAULT_SITE_CONTENT.aboutVibe.items || DEFAULT_AMBIENCE_ITEMS,
    images: (DEFAULT_SITE_CONTENT.aboutVibe.images as ImageAsset[]) || fallbackConfig.aboutVibe.images,
  },
  vipClub: {
    enabled: DEFAULT_SITE_CONTENT.vipClub.enabled ?? true,
    badge: DEFAULT_SITE_CONTENT.vipClub.badge || "PRIVATE MEMBERS' SALON",
    badgeIcon: DEFAULT_SITE_CONTENT.vipClub.badgeIcon || 'hotel_class',
    eyebrow: DEFAULT_SITE_CONTENT.vipClub.eyebrow || "Connoisseurs' Privileges",
    title: DEFAULT_SITE_CONTENT.vipClub.title || 'Join the Nocturnal Circle',
    titleItalic: DEFAULT_SITE_CONTENT.vipClub.titleItalic || 'Nocturnal Circle',
    subtitle:
      DEFAULT_SITE_CONTENT.vipClub.subtitle ||
      'Receive discreet invitations to weekend acoustic line-ups, secret seasonal chef previews, and priority booth reservations.',
    programmeName: DEFAULT_SITE_CONTENT.vipClub.programmeName || 'Nocturnal Circle',
    src: DEFAULT_SITE_CONTENT.vipClub.src || '/images/vip-nocturnal-circle.jpg',
    alt: DEFAULT_SITE_CONTENT.vipClub.alt || 'The Café Barrackpore Nocturnal VIP Salon',
    perks: DEFAULT_SITE_CONTENT.vipClub.perks || DEFAULT_VIP_PERKS,
    ctaLabel: DEFAULT_SITE_CONTENT.vipClub.ctaLabel || 'Join Privileges',
    placeholder: DEFAULT_SITE_CONTENT.vipClub.placeholder || 'Enter your private email',
    disclaimer:
      DEFAULT_SITE_CONTENT.vipClub.disclaimer ||
      'Discreet hospitality notifications only • Strictly no spam • Unsubscribe anytime',
    successTitle: DEFAULT_SITE_CONTENT.vipClub.successTitle || 'Welcome to the Inner Circle',
    successMessage:
      DEFAULT_SITE_CONTENT.vipClub.successMessage ||
      'Your invitation has been recorded. Discreet seasonal invitations will arrive in your private inbox.',
  },
  seo: {
    title: 'The Cafe Barrackpore | Best Cafe & Pizza in Barrackpore',
    description:
      'Experience cozy elegance at The Cafe Barrackpore. Serving artisanal coffee, wood-fired pizzas, gourmet burgers, and mocktails in Barrackpore.',
    image: '/images/hero-cinematic.jpg',
  },
  logoUrl: '/logo.webp',
  isLoading: false,
  error: null,
  updateSection: async () => false,

  restaurantConfig: DEFAULT_RESTAURANT_CONFIG,
  engineConfig: defaultEngineConfig,
  formatPrice: (amount: number, customCurrency?: string) =>
    formatCurrency(
      amount,
      customCurrency || DEFAULT_RESTAURANT_CONFIG.currency,
      DEFAULT_RESTAURANT_CONFIG.locale
    ),
  formatDate: (date: Date | string) =>
    formatRestaurantDate(
      date,
      DEFAULT_RESTAURANT_CONFIG.timezone,
      DEFAULT_RESTAURANT_CONFIG.locale
    ),
  formatTime: (date: Date | string) =>
    formatRestaurantTime(
      date,
      DEFAULT_RESTAURANT_CONFIG.timezone,
      DEFAULT_RESTAURANT_CONFIG.locale
    ),
  formatDateTime: (date: Date | string) =>
    formatRestaurantDateTime(
      date,
      DEFAULT_RESTAURANT_CONFIG.timezone,
      DEFAULT_RESTAURANT_CONFIG.locale
    ),
  updateRestaurantConfig: async () => false,
  setThemePreset: () => {},
  setCustomTheme: () => {},
};

const SiteConfigContext = createContext<SiteConfigContextType>(defaultContextValue);

export const SiteConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<SiteConfigContextType>(defaultContextValue);
  const [activeTheme, setActiveTheme] = useState<RestaurantVisualTheme>(() => defaultEngineConfig.theme);

  const setThemePreset = (presetId: ThemePresetId) => {
    setActiveTheme(getThemePreset(presetId));
  };

  const setCustomTheme = (theme: RestaurantVisualTheme) => {
    setActiveTheme(theme);
  };

  // Initial load of content from Supabase site_content table
  useEffect(() => {
    let isMounted = true;

    const loadContent = async () => {
      try {
        const { fetchAllSiteContent } = await import('../services/siteContentService');
        const content = await fetchAllSiteContent();
        if (!isMounted) return;

        setConfig((prev) => {
          const heroSrc = content.hero.src || defaultContextValue.hero.src;
          const heroAlt = content.hero.alt || defaultContextValue.hero.alt;
          const heroHeadline = content.hero.headline || defaultContextValue.hero.headline;
          const heroHeadlineItalic = content.hero.headlineItalic || defaultContextValue.hero.headlineItalic;
          const heroSubtext = content.hero.subtext || defaultContextValue.hero.subtext;

          const storySrc = content.story.src || defaultContextValue.ourStory.src;
          const storyAlt = content.story.alt || defaultContextValue.ourStory.alt;
          const storyTitle = content.story.title || defaultContextValue.ourStory.title;
          const storyDesc = content.story.description || defaultContextValue.ourStory.description;
          const storyChapters = content.story.chapters || defaultContextValue.ourStory.chapters;

          const specialsTitle = content.specials.title || defaultContextValue.specials.title;
          const specialsDesc = content.specials.description || defaultContextValue.specials.description;
          const specialsImage = content.specials.image || defaultContextValue.specials.image;

          const galleryEyebrow = content.gallery.eyebrow || defaultContextValue.gallery.eyebrow;
          const galleryTitle = content.gallery.title || defaultContextValue.gallery.title;
          const galleryDesc = content.gallery.description || defaultContextValue.gallery.description;
          const galleryItems = content.gallery.items || defaultContextValue.gallery.items;
          const galleryImages = content.gallery.images || defaultContextValue.gallery.images;

          return {
            ...prev,
            hero: {
              ...prev.hero,
              ...content.hero,
              src: heroSrc,
              alt: heroAlt,
              headline: heroHeadline,
              headlineItalic: heroHeadlineItalic,
              subtext: heroSubtext,
            },
            ourStory: {
              ...prev.ourStory,
              ...content.story,
              src: storySrc,
              alt: storyAlt,
              title: storyTitle,
              description: storyDesc,
              chapters: storyChapters,
            },
            aboutVibe: {
              ...prev.aboutVibe,
              ...content.aboutVibe,
              images: (content.aboutVibe?.images as ImageAsset[]) || prev.aboutVibe.images,
              items: content.aboutVibe?.items || prev.aboutVibe.items,
              chips: content.aboutVibe?.chips || prev.aboutVibe.chips,
              audio: content.aboutVibe?.audio || prev.aboutVibe.audio,
              metrics: content.aboutVibe?.metrics || prev.aboutVibe.metrics,
            },
            specials: {
              ...prev.specials,
              ...content.specials,
              title: specialsTitle,
              description: specialsDesc,
              image: specialsImage,
              badges: content.specials?.badges || prev.specials.badges,
              combos: content.specials?.combos || prev.specials.combos,
            },
            gallery: {
              eyebrow: galleryEyebrow,
              title: galleryTitle,
              description: galleryDesc,
              images: galleryImages,
              items: galleryItems,
            },
            vipClub: {
              ...prev.vipClub,
              ...content.vipClub,
              src: content.vipClub?.src || defaultContextValue.vipClub.src,
              alt: content.vipClub?.alt || defaultContextValue.vipClub.alt,
              title: content.vipClub?.title || defaultContextValue.vipClub.title,
              subtitle: content.vipClub?.subtitle || defaultContextValue.vipClub.subtitle,
              perks: content.vipClub?.perks || prev.vipClub.perks,
            },
            logoUrl: content.branding?.logoUrl || prev.logoUrl,
            error: null,
          };
        });
      } catch (err: any) {
        if (!isMounted) return;
        console.warn('[SiteConfigContext] Failed loading site_content, using defaults:', err);
        setConfig((prev) => ({ ...prev, isLoading: false }));
      }
    };

    const isPublicPage = typeof window !== 'undefined' && !window.location.pathname.startsWith('/staff');
    if (!isPublicPage) {
      loadContent();
    }

    // Attach Realtime subscription only on staff/admin routes where content editing happens
    let unsubscribe = () => {};
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/staff')) {
      import('../services/siteContentService').then(({ subscribeToSiteContentChanges }) => {
        if (!isMounted) return;
        unsubscribe = subscribeToSiteContentChanges((key, value) => {
          if (!isMounted || !value) return;

          setConfig((prev) => {
            if (key === 'hero') {
              return { ...prev, hero: { ...prev.hero, ...value } };
            } else if (key === 'story' || key === 'ourStory') {
              return { ...prev, ourStory: { ...prev.ourStory, ...value } };
            } else if (key === 'aboutVibe') {
              const updatedVibe = Array.isArray(value) ? { images: value } : value;
              return { 
                ...prev, 
                aboutVibe: { 
                  ...prev.aboutVibe, 
                  ...updatedVibe,
                  images: updatedVibe.images || prev.aboutVibe.images,
                  items: updatedVibe.items || prev.aboutVibe.items,
                  chips: updatedVibe.chips || prev.aboutVibe.chips,
                  audio: updatedVibe.audio || prev.aboutVibe.audio,
                  metrics: updatedVibe.metrics || prev.aboutVibe.metrics,
                } 
              };
            } else if (key === 'specials') {
              return { ...prev, specials: { ...prev.specials, ...value } };
            } else if (key === 'gallery') {
              const galleryImages = value.images || (value.items ? value.items.map((i: any) => ({ src: i.src, alt: i.alt })) : prev.gallery.images);
              return { 
                ...prev, 
                gallery: { 
                  ...prev.gallery, 
                  ...value, 
                  images: galleryImages, 
                  items: value.items || prev.gallery.items 
                } 
              };
            } else if (key === 'branding') {
              return { ...prev, logoUrl: value.logoUrl || prev.logoUrl };
            } else if (key === 'vipClub') {
              return { ...prev, vipClub: { ...prev.vipClub, ...value } };
            }
            return prev;
          });
        });
      }).catch(() => {});
    }

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const updateSection = async (
    section: 'hero' | 'ourStory' | 'aboutVibe' | 'specials' | 'gallery' | 'branding' | 'vipClub',
    data: any
  ): Promise<boolean> => {
    // 1. Persist to authoritative Supabase site_content table
    try {
      const { updateSiteContent } = await import('../services/siteContentService');
      const result = await updateSiteContent(section, data);
      if (result.success) {
        // 2. Immediately update local state
        setConfig((prev) => {
          if (section === 'hero') {
            return { ...prev, hero: { ...prev.hero, ...data } };
          } else if (section === 'ourStory') {
            return { ...prev, ourStory: { ...prev.ourStory, ...data } };
          } else if (section === 'aboutVibe') {
            const updatedVibe = Array.isArray(data) ? { images: data } : data;
            return { 
              ...prev, 
              aboutVibe: { 
                ...prev.aboutVibe, 
                ...updatedVibe,
                images: updatedVibe.images || prev.aboutVibe.images,
                items: updatedVibe.items || prev.aboutVibe.items,
                chips: updatedVibe.chips || prev.aboutVibe.chips,
                audio: updatedVibe.audio || prev.aboutVibe.audio,
                metrics: updatedVibe.metrics || prev.aboutVibe.metrics,
              } 
            };
          } else if (section === 'specials') {
            return { ...prev, specials: { ...prev.specials, ...data } };
          } else if (section === 'gallery') {
            const galleryImages = data.images || (data.items ? data.items.map((i: any) => ({ src: i.src, alt: i.alt })) : prev.gallery.images);
            return { 
              ...prev, 
              gallery: { 
                ...prev.gallery, 
                ...data, 
                images: galleryImages, 
                items: data.items || prev.gallery.items 
              } 
            };
          } else if (section === 'branding') {
            return { ...prev, logoUrl: data.logoUrl || prev.logoUrl };
          } else if (section === 'vipClub') {
            return { ...prev, vipClub: { ...prev.vipClub, ...data } };
          }
          return prev;
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const [restaurantConfig, setRestaurantConfig] = useState<RestaurantLocalizationConfig>(() => {
    if (typeof window === 'undefined') return DEFAULT_RESTAURANT_CONFIG;
    try {
      const stored = localStorage.getItem(RESTAURANT_CONFIG_STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_RESTAURANT_CONFIG, ...JSON.parse(stored) };
      }
    } catch {
      // fallback
    }
    return DEFAULT_RESTAURANT_CONFIG;
  });

  useEffect(() => {
    let isMounted = true;
    const syncSettings = () => {
      import('../services/dashboardService')
        .then(({ fetchRestaurantSettings }) => fetchRestaurantSettings())
        .then((settings) => {
          if (!isMounted) return;
          if (settings) {
            const mapped = mapSettingsToConfig(settings);
            setRestaurantConfig((prev) => {
              if (JSON.stringify(prev) === JSON.stringify(mapped)) {
                return prev;
              }
              return mapped;
            });
            if (typeof window !== 'undefined') {
              localStorage.setItem(RESTAURANT_CONFIG_STORAGE_KEY, JSON.stringify(mapped));
            }
          }
        })
        .catch((err) => {
          console.warn('Unable to load restaurant settings, retaining fallback:', err);
        });
    };

    const isPublicPage = typeof window !== 'undefined' && !window.location.pathname.startsWith('/staff');
    if (!isPublicPage) {
      syncSettings();
    }

    return () => {
      isMounted = false;
    };
  }, []);

  // Listen to live updates from SettingsManagement or other tabs
  useEffect(() => {
    const handleConfigUpdated = (e: Event) => {
      const custom = e as CustomEvent<RestaurantLocalizationConfig>;
      if (custom.detail) {
        setRestaurantConfig(custom.detail);
      }
    };

    window.addEventListener(RESTAURANT_CONFIG_UPDATED_EVENT, handleConfigUpdated);
    return () => {
      window.removeEventListener(RESTAURANT_CONFIG_UPDATED_EVENT, handleConfigUpdated);
    };
  }, []);

  const updateRestaurantConfig = async (
    updates: Partial<RestaurantLocalizationConfig>
  ): Promise<boolean> => {
    const merged: RestaurantLocalizationConfig = {
      ...restaurantConfig,
      ...updates,
      tax: {
        ...restaurantConfig.tax,
        ...(updates.tax || {}),
      },
      dietary: {
        ...restaurantConfig.dietary,
        ...(updates.dietary || {}),
      },
      contact: {
        ...restaurantConfig.contact,
        ...(updates.contact || {}),
      },
      address: {
        ...restaurantConfig.address,
        ...(updates.address || {}),
      },
      payments: {
        ...restaurantConfig.payments,
        ...(updates.payments || {}),
      },
    };

    setRestaurantConfig(merged);
    if (typeof window !== 'undefined') {
      localStorage.setItem(RESTAURANT_CONFIG_STORAGE_KEY, JSON.stringify(merged));
      window.dispatchEvent(
        new CustomEvent(RESTAURANT_CONFIG_UPDATED_EVENT, { detail: merged })
      );
    }

    try {
      const settingsPayload: RestaurantSettings = {
        business_name: merged.businessName,
        phone: merged.contact.phone,
        address: merged.address.line1,
        is_ordering_enabled: merged.isOrderingEnabled,
        is_table_booking_enabled: merged.isTableBookingEnabled,
        opening_time: merged.openingTime,
        closing_time: merged.closingTime,
        announcement_banner: merged.announcementBanner,
        country: merged.country,
        currency: merged.currency,
        currency_symbol: merged.currencySymbol,
        locale: merged.locale,
        timezone: merged.timezone,
        phone_country_code: merged.phoneCountryCode,
        tax_enabled: merged.tax.enabled,
        tax_mode: merged.tax.mode,
        tax_label: merged.tax.label,
        tax_rate: merged.tax.rate,
        dietary_system: merged.dietary.system,
        primary_contact_method: merged.contact.primaryMethod,
        email: merged.contact.email,
        city: merged.address.city,
        state_region: merged.address.region,
        postal_code: merged.address.postalCode,
        payment_enabled: merged.payments.enabled,
        payments_enabled: merged.payments.enabled,
        payment_provider: merged.payments.provider,
        payment_mode: merged.payments.mode,
        allow_pay_at_counter: merged.payments.allow_pay_at_counter ?? true,
        governing_law: merged.governingLaw || null,
      };
      const { updateRestaurantSettings } = await import('../services/dashboardService');
      await updateRestaurantSettings(settingsPayload);
    } catch (err) {
      console.warn('Could not sync restaurant settings to remote store:', err);
    }

    return true;
  };

  const formatPrice = (amount: number, customCurrency?: string) =>
    formatCurrency(
      amount,
      customCurrency || restaurantConfig.currency,
      restaurantConfig.locale
    );

  const formatDate = (date: Date | string) =>
    formatRestaurantDate(
      date,
      restaurantConfig.timezone,
      restaurantConfig.locale
    );

  const formatTime = (date: Date | string) =>
    formatRestaurantTime(
      date,
      restaurantConfig.timezone,
      restaurantConfig.locale
    );

  const formatDateTime = (date: Date | string) =>
    formatRestaurantDateTime(
      date,
      restaurantConfig.timezone,
      restaurantConfig.locale
    );

  // Dynamically assemble engineConfig reflecting current restaurantConfig and live content state
  const engineConfig: RestaurantEngineConfig = {
    ...defaultEngineConfig,
    operational: restaurantConfig,
    theme: activeTheme,
    content: {
      hero: {
        headline: config.hero.headline || defaultEngineConfig.content?.hero?.headline || '',
        subtext: config.hero.subtext || defaultEngineConfig.content?.hero?.subtext || '',
        src: config.hero.src,
        alt: config.hero.alt,
      },
      story: {
        title: config.ourStory.title || defaultEngineConfig.content?.story?.title || '',
        description: config.ourStory.description || defaultEngineConfig.content?.story?.description || '',
        src: config.ourStory.src,
        alt: config.ourStory.alt,
      },
      specials: {
        title: config.specials.title,
        description: config.specials.description,
        image: config.specials.image || '',
        combos: config.specials.combos,
      },
      gallery: config.gallery,
      aboutVibe: config.aboutVibe,
      vipClub: {
        title: config.vipClub.title || '',
        subtitle: config.vipClub.subtitle || '',
        src: config.vipClub.src,
        alt: config.vipClub.alt,
      },
      branding: {
        logoUrl: config.logoUrl,
        alt: `${restaurantConfig.businessName} Crest`,
      },
    },
  };

  return (
    <SiteConfigContext.Provider
      value={{
        ...config,
        updateSection,
        restaurantConfig,
        engineConfig,
        formatPrice,
        formatDate,
        formatTime,
        formatDateTime,
        updateRestaurantConfig,
        setThemePreset,
        setCustomTheme,
      }}
    >
      {children}
    </SiteConfigContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useSiteConfig = (): SiteConfigContextType => {
  const context = useContext(SiteConfigContext);
  if (!context) {
    throw new Error('useSiteConfig must be used within a SiteConfigProvider');
  }
  return context;
};
