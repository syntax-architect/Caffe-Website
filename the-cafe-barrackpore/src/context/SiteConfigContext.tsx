import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { client, urlFor } from '../lib/sanityClient';
import { siteConfig as fallbackConfig } from '../data/siteConfig';
import {
  getPersistedContent,
  saveContentSection,
  CONTENT_UPDATED_EVENT,
} from '../services/contentPersistenceService';

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
}

export interface SEOConfig {
  title?: string;
  description?: string;
  image?: string;
}

import { DEFAULT_RESTAURANT_CONFIG, RESTAURANT_PRESETS } from '../config/restaurantPresets';
import type { RestaurantLocalizationConfig } from '../types/restaurantConfig';
import { formatCurrency } from '../utils/currency';
import {
  formatRestaurantDate,
  formatRestaurantTime,
  formatRestaurantDateTime,
} from '../utils/datetime';
import {
  fetchRestaurantSettings,
  updateRestaurantSettings,
} from '../services/dashboardService';
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
      enabled: settings.payment_enabled ?? (preset.payments?.enabled ?? false),
      provider: (settings.payment_provider as any) || preset.payments?.provider || 'stripe',
      mode: (settings.payment_mode as any) || preset.payments?.mode || 'disabled',
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
  seo: SEOConfig;
  logoUrl: string;
  isLoading: boolean;
  error: Error | null;
  updateSection: (
    section: 'hero' | 'ourStory' | 'specials' | 'gallery',
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
    image: '/images/hero-bar.webp',
  },
  gallery: {
    images: fallbackConfig.gallery.images,
  },
  aboutVibe: {
    images: fallbackConfig.aboutVibe.images,
  },
  seo: {
    title: 'The Cafe Barrackpore | Best Cafe & Pizza in Barrackpore',
    description:
      'Experience cozy elegance at The Cafe Barrackpore. Serving artisanal coffee, wood-fired pizzas, gourmet burgers, and mocktails in Barrackpore.',
    image: '/images/hero-bar.webp',
  },
  logoUrl: '/logo.webp',
  isLoading: true,
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
  const [config, setConfig] = useState<SiteConfigContextType>(() => {
    // Initial state with persisted overrides applied
    const persisted = getPersistedContent();
    return {
      ...defaultContextValue,
      hero: {
        ...defaultContextValue.hero,
        ...(persisted.hero || {}),
      },
      ourStory: {
        ...defaultContextValue.ourStory,
        ...(persisted.ourStory || {}),
      },
      specials: {
        ...defaultContextValue.specials,
        ...(persisted.specials || {}),
      },
      gallery: {
        images: persisted.gallery?.images || defaultContextValue.gallery.images,
      },
    };
  });

  useEffect(() => {
    let isMounted = true;

    const fetchUnifiedConfig = async () => {
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Sanity siteConfig request timed out')), 8000)
        );

        const fetchPromise = client.fetch(
          `*[_type == "siteConfig"][0]{
            title,
            logo,
            heroImage,
            ourStoryImage,
            galleryImages,
            aboutVibeImages,
            seoTitle,
            seoDescription,
            seoImage
          }`
        );

        const data: any = await Promise.race([fetchPromise, timeoutPromise]);

        if (!isMounted) return;

        const persisted = getPersistedContent();

        if (data) {
          // Resolve hero image
          const heroAsset: HeroConfig = {
            src: persisted.hero?.src || (data.heroImage
              ? urlFor(data.heroImage).width(1200).auto('format').quality(80).url()
              : defaultContextValue.hero.src),
            alt: persisted.hero?.alt || 'Hero Image',
            headline: persisted.hero?.headline || defaultContextValue.hero.headline,
            subtext: persisted.hero?.subtext || defaultContextValue.hero.subtext,
          };

          // Resolve ourStory image
          const ourStoryAsset: OurStoryConfig = {
            src: persisted.ourStory?.src || (data.ourStoryImage
              ? urlFor(data.ourStoryImage).width(1200).auto('format').quality(80).url()
              : defaultContextValue.ourStory.src),
            alt: persisted.ourStory?.alt || 'Our Story Image',
            title: persisted.ourStory?.title || defaultContextValue.ourStory.title,
            description: persisted.ourStory?.description || defaultContextValue.ourStory.description,
          };

          // Resolve gallery images
          let galleryImages: ImageAsset[] = persisted.gallery?.images || defaultContextValue.gallery.images;
          if (!persisted.gallery?.images && Array.isArray(data.galleryImages) && data.galleryImages.length > 0) {
            galleryImages = data.galleryImages.map((img: any, idx: number) => ({
              src: urlFor(img).width(800).auto('format').quality(80).url(),
              alt: fallbackConfig.gallery.images[idx]?.alt || `Gallery Image ${idx + 1}`,
            }));
          }

          // Resolve aboutVibe images
          let aboutVibeImages: ImageAsset[] = defaultContextValue.aboutVibe.images;
          if (Array.isArray(data.aboutVibeImages) && data.aboutVibeImages.length > 0) {
            aboutVibeImages = data.aboutVibeImages.map((item: any, idx: number) => ({
              src: item.image
                ? urlFor(item.image).width(800).auto('format').quality(80).url()
                : fallbackConfig.aboutVibe.images[idx]?.src || '',
              alt: item.alt || fallbackConfig.aboutVibe.images[idx]?.alt || `Vibe Image ${idx + 1}`,
            }));
          }

          // Resolve SEO
          const seoConfig: SEOConfig = {
            title: data.seoTitle || defaultContextValue.seo.title,
            description: data.seoDescription || defaultContextValue.seo.description,
            image: data.seoImage
              ? urlFor(data.seoImage).width(1200).height(630).url()
              : defaultContextValue.seo.image,
          };

          // Resolve Logo
          let resolvedLogo = defaultContextValue.logoUrl;
          if (data.logo) {
            try {
              resolvedLogo = urlFor(data.logo).width(400).auto('format').quality(80).url();
              if (typeof window !== 'undefined') {
                localStorage.setItem('cafe_logo', resolvedLogo);
              }
            } catch {
              // Retain fallback logo
            }
          }

          setConfig((prev) => ({
            ...prev,
            hero: heroAsset,
            ourStory: ourStoryAsset,
            gallery: { images: galleryImages },
            aboutVibe: { images: aboutVibeImages },
            seo: seoConfig,
            logoUrl: resolvedLogo,
            isLoading: false,
            error: null,
          }));
        } else {
          setConfig((prev) => ({ ...prev, isLoading: false }));
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.warn('Unable to load Sanity siteConfig, retaining fallback configuration:', err);
        setConfig((prev) => ({
          ...prev,
          isLoading: false,
          error: err instanceof Error ? err : new Error(String(err)),
        }));
      }
    };

    fetchUnifiedConfig();

    return () => {
      isMounted = false;
    };
  }, []);

  // Listen to live updates from ContentManagement save events
  useEffect(() => {
    const handleContentUpdated = (e: Event) => {
      const custom = e as CustomEvent<{ section: string; data: any }>;
      if (custom.detail) {
        const { section, data } = custom.detail;
        setConfig((prev) => {
          if (section === 'hero') {
            return { ...prev, hero: { ...prev.hero, ...data } };
          } else if (section === 'ourStory') {
            return { ...prev, ourStory: { ...prev.ourStory, ...data } };
          } else if (section === 'specials') {
            return { ...prev, specials: { ...prev.specials, ...data } };
          } else if (section === 'gallery') {
            return { ...prev, gallery: { images: data.images || data } };
          }
          return prev;
        });
      }
    };

    window.addEventListener(CONTENT_UPDATED_EVENT, handleContentUpdated);
    return () => {
      window.removeEventListener(CONTENT_UPDATED_EVENT, handleContentUpdated);
    };
  }, []);

  const updateSection = async (
    section: 'hero' | 'ourStory' | 'specials' | 'gallery',
    data: any
  ): Promise<boolean> => {
    const res = await saveContentSection(section, data);
    if (res.success) {
      setConfig((prev) => {
        if (section === 'hero') {
          return { ...prev, hero: { ...prev.hero, ...data } };
        } else if (section === 'ourStory') {
          return { ...prev, ourStory: { ...prev.ourStory, ...data } };
        } else if (section === 'specials') {
          return { ...prev, specials: { ...prev.specials, ...data } };
        } else if (section === 'gallery') {
          return { ...prev, gallery: { images: data.images || data } };
        }
        return prev;
      });
      return true;
    }
    return false;
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
    fetchRestaurantSettings()
      .then((settings) => {
        if (!isMounted) return;
        if (settings) {
          const mapped = mapSettingsToConfig(settings);
          setRestaurantConfig(mapped);
          if (typeof window !== 'undefined') {
            localStorage.setItem(RESTAURANT_CONFIG_STORAGE_KEY, JSON.stringify(mapped));
          }
        }
      })
      .catch((err) => {
        console.warn('Unable to load restaurant settings, retaining fallback:', err);
      });

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
        payment_provider: merged.payments.provider,
        payment_mode: merged.payments.mode,
      };
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
