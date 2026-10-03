import type { RestaurantLocalizationConfig } from '../types/restaurantConfig';
import type { SEOConfig } from '../context/SiteConfigContext';
import { MENU_CATEGORIES_FALLBACK, MENU_ITEMS_FALLBACK } from '../services/menuService';
import type { MenuItem, MenuCategory } from '../types/menu';
import { getPublicSiteOrigin } from './url';

export const SUPPORTED_SEO_LANGUAGES = [
  'en',
  'hi',
  'ar',
  'de',
  'es',
  'fr',
  'ja',
  'ko',
  'pt',
  'th',
  'tr',
  'zh',
] as const;

export interface PageSEOMetadata {
  title: string;
  description: string;
  canonicalUrl: string;
  robots: string;
  ogType: 'website' | 'restaurant.restaurant';
  ogImage: string;
  ogImageWidth: number;
  ogImageHeight: number;
  ogImageAlt: string;
  twitterCard: 'summary_large_image' | 'summary';
  hreflangs: Array<{ lang: string; href: string }>;
  structuredData: Record<string, any>[];
}

export function generatePageSEO(options: {
  pathname: string;
  restaurantConfig: RestaurantLocalizationConfig;
  seoConfig?: SEOConfig;
  menuItems?: MenuItem[];
  categories?: MenuCategory[];
  origin?: string;
  googleVerificationToken?: string;
}): PageSEOMetadata {
  const origin = options.origin || getPublicSiteOrigin();
  const config = options.restaurantConfig;
  const path = options.pathname.replace(/\/$/, '') || '/';
  const businessName = config.businessName || 'The Café Barrackpore';
  const city = config.address.city || 'Barrackpore';
  const shareImage = options.seoConfig?.image || `${origin}/images/og-share.jpg`;

  // Route categorization
  const isHome = path === '/' || path === '';
  const isPrivacy = path === '/privacy' || path === '/privacy-policy';
  const isTerms = path === '/terms' || path === '/terms-of-service';
  const isQR = path === '/qr' || path === '/qr-generator';
  const isStaff = path.startsWith('/staff') || path === '/reset-password' || path === '/kitchen';

  let title = `${businessName} | Best Artisanal Cafe & Wood-Fired Pizza in ${city}`;
  let description =
    options.seoConfig?.description ||
    `Experience cozy elegance at ${businessName}. Serving artisanal single-origin coffee, hand-stretched wood-fired pizzas, gourmet burgers, and handcrafted mocktails in ${city}.`;
  let canonicalPath = path;
  let robots = 'index, follow';
  let ogType: 'website' | 'restaurant.restaurant' = 'restaurant.restaurant';

  if (isHome) {
    title = options.seoConfig?.title || `${businessName} | Best Cafe & Pizza in ${city}`;
    canonicalPath = '';
  } else if (isPrivacy) {
    title = `Privacy Policy | ${businessName}`;
    description = `Read the privacy policy for ${businessName}. Understand how we handle dining orders, QR sessions, and guest data with strict security.`;
    canonicalPath = '/privacy';
    ogType = 'website';
  } else if (isTerms) {
    title = `Terms of Service | ${businessName}`;
    description = `Review terms and conditions for dining reservations, takeaways, and contactless QR table ordering at ${businessName}.`;
    canonicalPath = '/terms';
    ogType = 'website';
  } else if (isQR) {
    title = `Digital Table Ordering | ${businessName}`;
    description = `Contactless in-house dining menu for ${businessName}. Select artisanal dishes and order directly to your table.`;
    canonicalPath = '/qr';
    robots = 'noindex, nofollow';
    ogType = 'website';
  } else if (isStaff) {
    title = `Staff Portal | ${businessName}`;
    description = `Authorized staff and kitchen administration portal for ${businessName}.`;
    canonicalPath = '/staff/login';
    robots = 'noindex, nofollow';
    ogType = 'website';
  }

  const canonicalUrl = `${origin}${canonicalPath}`;

  // Multi-language hreflang alternates (for public indexing)
  const hreflangs: Array<{ lang: string; href: string }> = [
    { lang: 'x-default', href: isHome ? `${origin}/` : canonicalUrl },
  ];

  if (isHome) {
    for (const lang of SUPPORTED_SEO_LANGUAGES) {
      hreflangs.push({
        lang,
        href: `${origin}/?lang=${lang}`,
      });
    }
  }

  // Schema.org Structured Data
  const structuredData: Record<string, any>[] = [];

  if (isHome) {
    const rawItems = options.menuItems && options.menuItems.length > 0 ? options.menuItems : MENU_ITEMS_FALLBACK;
    const rawCategories = options.categories && options.categories.length > 0 ? options.categories : MENU_CATEGORIES_FALLBACK;

    const currency = config.currency || 'INR';
    const currencySymbol = config.currencySymbol || '₹';

    // Group menu items by category for MenuSection
    const menuSections = rawCategories.map((cat) => {
      const itemsInCat = rawItems
        .filter((item) => item.category_id === cat.id || item.category === cat.id || item.category === cat.name)
        .slice(0, 15); // Top 15 per section for rich snippets

      return {
        '@type': 'MenuSection',
        name: cat.name,
        hasMenuItem: itemsInCat.map((item) => ({
          '@type': 'MenuItem',
          name: item.name,
          description: item.description || `${item.name} freshly prepared at ${businessName}`,
          offers: {
            '@type': 'Offer',
            price: item.price.toString(),
            priceCurrency: currency,
            availability: item.available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          },
          ...(item.diet === 'veg' || item.diet === 'vegan'
            ? { suitableForDiet: 'https://schema.org/VegetarianDiet' }
            : {}),
        })),
      };
    });

    const restaurantSchema: Record<string, any> = {
      '@context': 'https://schema.org',
      '@type': ['Restaurant', 'CafeOrCoffeeShop'],
      '@id': `${origin}/#restaurant`,
      name: businessName,
      alternateName: config.shortName || 'The Café',
      url: origin,
      telephone: config.contact.phone,
      email: config.contact.email || 'concierge@thecafebarrackpore.com',
      image: [
        shareImage,
        `${origin}/images/hero-bar.webp`,
        `${origin}/images/story-pour.webp`,
        `${origin}/images/gallery-pizza.webp`,
      ],
      logo: `${origin}/logo.webp`,
      description,
      address: {
        '@type': 'PostalAddress',
        streetAddress: config.address.line1,
        addressLocality: config.address.city,
        addressRegion: config.address.region,
        postalCode: config.address.postalCode,
        addressCountry: config.country === 'India' ? 'IN' : config.country,
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: 22.7634,
        longitude: 88.3582,
      },
      hasMap: 'https://maps.google.com/?q=The+Cafe+Barrackpore',
      priceRange: `${currencySymbol}${currencySymbol}`,
      servesCuisine: ['Cafe', 'Artisanal Coffee', 'Italian', 'Wood-Fired Pizza', 'Chinese', 'Continental'],
      currenciesAccepted: currency,
      paymentAccepted: 'Cash, Credit Card, Debit Card, UPI, Digital Wallets',
      openingHoursSpecification: [
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
          opens: config.openingTime || '11:00',
          closes: config.closingTime || '23:30',
        },
      ],
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.8',
        reviewCount: '192',
        bestRating: '5',
        worstRating: '1',
      },
      acceptsReservations: config.isTableBookingEnabled ? 'True' : 'False',
      potentialAction: {
        '@type': 'ReserveAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${origin}/#reserve-section`,
          inLanguage: 'en',
          actionPlatform: ['http://schema.org/DesktopWebPlatform', 'http://schema.org/MobileWebPlatform'],
        },
        result: {
          '@type': 'FoodEstablishmentReservation',
          name: `Table Reservation at ${businessName}`,
        },
      },
      hasMenu: {
        '@type': 'Menu',
        name: `${businessName} Curated Gastronomy Menu`,
        url: `${origin}/#menu-section`,
        hasMenuSection: menuSections,
      },
    };

    structuredData.push(restaurantSchema);
  }

  return {
    title,
    description,
    canonicalUrl,
    robots,
    ogType,
    ogImage: shareImage,
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogImageAlt: `${businessName} - Cantonment Dining Retreat`,
    twitterCard: 'summary_large_image',
    hreflangs,
    structuredData,
  };
}
