import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { siteConfig as fallbackConfig } from '../data/siteConfig';
import type { SpecialCombo } from '../services/siteContentService';

export interface ImageAsset {
  src: string;
  alt: string;
}

export interface HeroConfig extends ImageAsset {
  headline?: string;
  subtext?: string;
}

export interface OurStoryConfig extends ImageAsset {
  title?: string;
  description?: string;
}

export interface SpecialsConfig {
  title: string;
  description: string;
  image?: string;
  combos?: SpecialCombo[];
}

export interface SEOConfig {
  title?: string;
  description?: string;
  image?: string;
}

export interface VIPClubConfig extends ImageAsset {
  title?: string;
  subtitle?: string;
}

import { DEFAULT_RESTAURANT_CONFIG, RESTAURANT_PRESETS } from '../config/restaurantPresets';
import type { RestaurantLocalizationConfig } from '../types/restaurantConfig';
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
  gallery: {
    images: ImageAsset[];
  };
  aboutVibe: {
    images: ImageAsset[];
  };
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
  formatPrice: (amount: number, customCurrency?: string) => string;
  formatDate: (date: Date | string) => string;
  formatTime: (date: Date | string) => string;
  formatDateTime: (date: Date | string) => string;
  updateRestaurantConfig: (
    updates: Partial<RestaurantLocalizationConfig>
  ) => Promise<boolean>;
}

const defaultContextValue: SiteConfigContextType = {
  hero: {
    src: fallbackConfig.hero.image,
    alt: fallbackConfig.hero.alt,
    headline: 'Step Into Barrackpore’s Trendsetting Dining Retreat',
    subtext:
      'Where artisan coffee meets handcrafted cocktails & gourmet comfort food in a strictly premium, nocturnal setting.',
  },
  ourStory: {
    src: fallbackConfig.ourStory.image,
    alt: fallbackConfig.ourStory.alt,
    title: 'Crafting Barrackpore’s finest nocturnal escape',
    description:
      'We believe that true luxury lies in the details. From sourcing the most vibrant, local ingredients from surrounding farms to hand-selecting the perfect acoustic backdrop, every element of our space is intentionally curated.',
  },
  specials: {
    title: 'Special Banquet & Hangout Platters',
    description:
      'Generous sharing platters with sizzling pan-Asian or smoky clay oven selections, made fresh to order.',
    image: '/images/hero-cinematic.jpg',
  },
  gallery: {
    images: fallbackConfig.gallery.images,
  },
  aboutVibe: {
    images: fallbackConfig.aboutVibe.images,
  },
  vipClub: {
    src: '/images/vip-nocturnal-circle.jpg',
    alt: 'The Café Barrackpore Nocturnal VIP Salon',
    title: 'The Nocturnal Society',
    subtitle: 'An intimate speakeasy membership for Barrackpore’s discerning patrons.',
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
};

const SiteConfigContext = createContext<SiteConfigContextType>(defaultContextValue);

export const SiteConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<SiteConfigContextType>(defaultContextValue);

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
          const heroSubtext = content.hero.subtext || defaultContextValue.hero.subtext;

          const storySrc = content.story.src || defaultContextValue.ourStory.src;
          const storyAlt = content.story.alt || defaultContextValue.ourStory.alt;
          const storyTitle = content.story.title || defaultContextValue.ourStory.title;
          const storyDesc = content.story.description || defaultContextValue.ourStory.description;

          const specialsTitle = content.specials.title || defaultContextValue.specials.title;
          const specialsDesc = content.specials.description || defaultContextValue.specials.description;
          const specialsImage = content.specials.image || defaultContextValue.specials.image;

          const hasHeroChanged =
            heroSrc !== prev.hero.src ||
            heroAlt !== prev.hero.alt ||
            heroHeadline !== prev.hero.headline ||
            heroSubtext !== prev.hero.subtext;

          const hasStoryChanged =
            storySrc !== prev.ourStory.src ||
            storyAlt !== prev.ourStory.alt ||
            storyTitle !== prev.ourStory.title ||
            storyDesc !== prev.ourStory.description;

          const hasSpecialsChanged =
            specialsTitle !== prev.specials.title ||
            specialsDesc !== prev.specials.description ||
            specialsImage !== prev.specials.image;

          if (!hasHeroChanged && !hasStoryChanged && !hasSpecialsChanged) {
            return prev;
          }

          return {
            ...prev,
            hero: hasHeroChanged
              ? { src: heroSrc, alt: heroAlt, headline: heroHeadline, subtext: heroSubtext }
              : prev.hero,
            ourStory: hasStoryChanged
              ? { src: storySrc, alt: storyAlt, title: storyTitle, description: storyDesc }
              : prev.ourStory,
            aboutVibe: {
              images: content.aboutVibe?.images || prev.aboutVibe.images,
            },
            specials: {
              title: specialsTitle,
              description: specialsDesc,
              image: specialsImage,
              combos: content.specials?.combos || prev.specials.combos,
            },
            gallery: {
              images: content.gallery.images || defaultContextValue.gallery.images,
            },
            vipClub: {
              src: content.vipClub?.src || defaultContextValue.vipClub.src,
              alt: content.vipClub?.alt || defaultContextValue.vipClub.alt,
              title: content.vipClub?.title || defaultContextValue.vipClub.title,
              subtitle: content.vipClub?.subtitle || defaultContextValue.vipClub.subtitle,
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
              return { ...prev, aboutVibe: { images: value.images || value } };
            } else if (key === 'specials') {
              return { ...prev, specials: { ...prev.specials, ...value } };
            } else if (key === 'gallery') {
              return { ...prev, gallery: { images: value.images || value } };
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
            return { ...prev, aboutVibe: { images: data.images || data } };
          } else if (section === 'specials') {
            return { ...prev, specials: { ...prev.specials, ...data } };
          } else if (section === 'gallery') {
            return { ...prev, gallery: { images: data.images || data } };
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

  return (
    <SiteConfigContext.Provider
      value={{
        ...config,
        updateSection,
        restaurantConfig,
        formatPrice,
        formatDate,
        formatTime,
        formatDateTime,
        updateRestaurantConfig,
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
