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

  return (
    <SiteConfigContext.Provider value={{ ...config, updateSection }}>
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
