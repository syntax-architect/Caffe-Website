import React, { useEffect } from 'react';
import { useSiteConfig } from '../context/SiteConfigContext';

export const MetaTags: React.FC = () => {
  const { seo } = useSiteConfig();

  useEffect(() => {
    if (!seo) return;

    if (seo.title) {
      document.title = seo.title;
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute('content', seo.title);
      else {
        const meta = document.createElement('meta');
        meta.setAttribute('property', 'og:title');
        meta.content = seo.title;
        document.head.appendChild(meta);
      }
    }

    if (seo.description) {
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute('content', seo.description);
      else {
        const meta = document.createElement('meta');
        meta.name = 'description';
        meta.content = seo.description;
        document.head.appendChild(meta);
      }

      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) ogDesc.setAttribute('content', seo.description);
      else {
        const meta = document.createElement('meta');
        meta.setAttribute('property', 'og:description');
        meta.content = seo.description;
        document.head.appendChild(meta);
      }
    }

    if (seo.image) {
      const ogImage = document.querySelector('meta[property="og:image"]');
      if (ogImage) ogImage.setAttribute('content', seo.image);
      else {
        const meta = document.createElement('meta');
        meta.setAttribute('property', 'og:image');
        meta.content = seo.image;
        document.head.appendChild(meta);
      }
    }
  }, [seo]);

  return null;
};
