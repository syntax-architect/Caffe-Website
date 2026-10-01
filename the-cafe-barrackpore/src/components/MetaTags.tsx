import React, { useEffect } from 'react';
import { useSiteConfig } from '../context/SiteConfigContext';
import { getPublicSiteOrigin } from '../utils/url';

export const MetaTags: React.FC = () => {
  const { seo, restaurantConfig } = useSiteConfig();

  useEffect(() => {
    const origin = getPublicSiteOrigin();
    const effectiveTitle = seo?.title || `${restaurantConfig.businessName} | Artisanal Dining & Coffee`;
    const effectiveDesc =
      seo?.description ||
      `Experience refined dining and handcrafted cuisine at ${restaurantConfig.businessName} in ${restaurantConfig.address.city}.`;
    const effectiveImage = seo?.image || `${origin}/images/hero-bar.webp`;

    // 1. Document Title
    document.title = effectiveTitle;

    // Helper to safely set meta tag
    const setMeta = (attr: 'name' | 'property', key: string, content: string) => {
      let meta = document.querySelector(`meta[${attr}="${key}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attr, key);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };

    // 2. Standard Meta Tags
    setMeta('name', 'description', effectiveDesc);
    setMeta('name', 'author', restaurantConfig.businessName);

    // 3. Open Graph Meta Tags
    setMeta('property', 'og:title', effectiveTitle);
    setMeta('property', 'og:description', effectiveDesc);
    setMeta('property', 'og:image', effectiveImage);
    setMeta('property', 'og:site_name', restaurantConfig.businessName);
    setMeta('property', 'og:url', typeof window !== 'undefined' ? window.location.href : origin);

    // 4. Canonical Link Tag
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href =
      typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}`
        : origin;

    // 5. Schema.org JSON-LD Structured Data
    try {
      const script = document.getElementById('restaurant-schema');
      if (script) {
        const schema = {
          '@context': 'https://schema.org',
          '@type': 'Restaurant',
          name: restaurantConfig.businessName,
          image: effectiveImage,
          url: origin,
          telephone: restaurantConfig.contact.phone,
          address: {
            '@type': 'PostalAddress',
            streetAddress: restaurantConfig.address.line1,
            addressLocality: restaurantConfig.address.city,
            addressRegion: restaurantConfig.address.region,
            postalCode: restaurantConfig.address.postalCode,
            addressCountry: restaurantConfig.country,
          },
          priceRange: `${restaurantConfig.currencySymbol}${restaurantConfig.currencySymbol}`,
          openingHoursSpecification: [
            {
              '@type': 'OpeningHoursSpecification',
              dayOfWeek: [
                'Monday',
                'Tuesday',
                'Wednesday',
                'Thursday',
                'Friday',
                'Saturday',
                'Sunday',
              ],
              opens: restaurantConfig.openingTime || '11:00',
              closes: restaurantConfig.closingTime || '23:00',
            },
          ],
        };
        script.textContent = JSON.stringify(schema, null, 2);
      }
    } catch {
      // Ignored in non-DOM or restricted environments
    }
  }, [seo, restaurantConfig]);

  return null;
};
