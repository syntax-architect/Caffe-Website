import { useState, useEffect } from 'react';
import { client } from '../lib/sanityClient';
import imageUrlBuilder from '@sanity/image-url';

const builder = imageUrlBuilder(client);
function urlFor(source: any) {
  return builder.image(source);
}

export function useLogo() {
  const [logoUrl, setLogoUrl] = useState('/logo.png');

  useEffect(() => {
    let mounted = true;
    const fetchLogo = async () => {
      try {
        const config = await client.fetch(`*[_type == "siteConfig"][0]{ logo }`);
        if (config?.logo && mounted) {
          setLogoUrl(urlFor(config.logo).width(400).auto('format').quality(80).url());
        }
      } catch (error) {
        console.error("Error fetching logo from Sanity:", error);
      }
    };
    fetchLogo();
    return () => { mounted = false; };
  }, []);

  return logoUrl;
}
