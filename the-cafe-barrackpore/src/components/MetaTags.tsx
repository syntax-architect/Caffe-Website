import React, { useEffect } from 'react';
import { useSiteConfig } from '../context/SiteConfigContext';
import { generatePageSEO } from '../utils/seo';
import { initAnalytics } from '../services/analyticsService';

interface MetaTagsProps {
  pathname?: string;
}

export const MetaTags: React.FC<MetaTagsProps> = ({ pathname }) => {
  const { seo, restaurantConfig } = useSiteConfig();

  useEffect(() => {
    // Initialize analytics if consent is present
    initAnalytics();

    const currentPath =
      pathname || (typeof window !== 'undefined' ? window.location.pathname : '/');

    const seoData = generatePageSEO({
      pathname: currentPath,
      restaurantConfig,
      seoConfig: seo,
    });

    // 1. Title
    document.title = seoData.title;

    // Helper to safely set or update meta tag
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
    setMeta('name', 'description', seoData.description);
    setMeta('name', 'robots', seoData.robots);
    setMeta('name', 'author', restaurantConfig.businessName);

    // 3. Open Graph Tags
    setMeta('property', 'og:title', seoData.title);
    setMeta('property', 'og:description', seoData.description);
    setMeta('property', 'og:type', seoData.ogType);
    setMeta('property', 'og:url', seoData.canonicalUrl);
    setMeta('property', 'og:site_name', restaurantConfig.businessName);
    setMeta('property', 'og:image', seoData.ogImage);
    setMeta('property', 'og:image:width', seoData.ogImageWidth.toString());
    setMeta('property', 'og:image:height', seoData.ogImageHeight.toString());
    setMeta('property', 'og:image:alt', seoData.ogImageAlt);
    setMeta('property', 'og:locale', restaurantConfig.locale?.replace('-', '_') || 'en_IN');

    // 4. Twitter Card Tags
    setMeta('name', 'twitter:card', seoData.twitterCard);
    setMeta('name', 'twitter:title', seoData.title);
    setMeta('name', 'twitter:description', seoData.description);
    setMeta('name', 'twitter:image', seoData.ogImage);
    setMeta('name', 'twitter:image:alt', seoData.ogImageAlt);

    // 5. Canonical Link
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = seoData.canonicalUrl;

    // 6. Multi-language Hreflang Alternates
    // Remove existing hreflang tags to avoid duplicates on route changes
    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove());
    for (const h of seoData.hreflangs) {
      const link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = h.lang;
      link.href = h.href;
      document.head.appendChild(link);
    }

    // 7. Structured Data (JSON-LD)
    let schemaScript = document.getElementById('restaurant-schema') as HTMLScriptElement | null;
    if (!schemaScript) {
      schemaScript = document.createElement('script');
      schemaScript.id = 'restaurant-schema';
      schemaScript.type = 'application/ld+json';
      document.head.appendChild(schemaScript);
    }

    if (seoData.structuredData.length > 0) {
      schemaScript.textContent = JSON.stringify(
        seoData.structuredData.length === 1 ? seoData.structuredData[0] : seoData.structuredData,
        null,
        2
      );
    } else {
      schemaScript.textContent = '';
    }
  }, [pathname, seo, restaurantConfig]);

  return null;
};

export default MetaTags;
