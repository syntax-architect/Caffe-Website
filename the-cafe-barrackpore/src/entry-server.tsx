import { renderToString } from 'react-dom/server';
import { I18nProvider } from './i18n';
import { SiteConfigProvider } from './context/SiteConfigContext';
import { ThemeRuntime } from './services/themeRuntime';

import { TableProvider } from './context/TableContext';
import App from './App';
import { MetaTags } from './components/MetaTags';
import { PrivacyPolicyPage } from './components/legal/PrivacyPolicyPage';
import { TermsPage } from './components/legal/TermsPage';
import { NotFoundPage } from './components/NotFoundPage';
import { generatePageSEO, type PageSEOMetadata } from './utils/seo';
import { DEFAULT_RESTAURANT_CONFIG } from './config/restaurantPresets';
import { clientDetails } from './config/client';
import { getPublicSiteOrigin } from './utils/url';

export interface RenderResult {
  html: string;
  seo: PageSEOMetadata;
}

export function render(url: string): RenderResult {
  const cleanUrl = url.replace(/\/$/, '') || '/';
  const isPrivacy = cleanUrl === '/privacy' || cleanUrl === '/privacy-policy';
  const isTerms = cleanUrl === '/terms' || cleanUrl === '/terms-of-service';
  const is404 = cleanUrl === '/404';

  let appComponent: React.ReactNode;
  if (isPrivacy) {
    appComponent = <PrivacyPolicyPage />;
  } else if (isTerms) {
    appComponent = <TermsPage />;
  } else if (is404) {
    appComponent = <NotFoundPage />;
  } else {
    appComponent = (
      <TableProvider>
        <App />
      </TableProvider>
    );
  }

  const wrapped = (
    <I18nProvider>
      <SiteConfigProvider>
        <ThemeRuntime />
        <MetaTags pathname={cleanUrl} />
        {appComponent}
      </SiteConfigProvider>
    </I18nProvider>
  );

  const html = renderToString(wrapped);

  const origin = getPublicSiteOrigin();
  const businessName = clientDetails.businessName || DEFAULT_RESTAURANT_CONFIG.businessName;
  const city = clientDetails.location?.city || DEFAULT_RESTAURANT_CONFIG.address.city;

  const seo = generatePageSEO({
    pathname: cleanUrl,
    restaurantConfig: DEFAULT_RESTAURANT_CONFIG,
    seoConfig: {
      title: `${businessName} | Best Artisanal Cafe & Wood-Fired Pizza in ${city}`,
      description:
        `Experience cozy elegance at ${businessName}. Serving single-origin artisanal coffee, hand-stretched wood-fired pizzas, gourmet burgers, and handcrafted mocktails in ${city}.`,
      image: `${origin}/images/og-share.jpg`,
    },
    origin,
  });

  return { html, seo };
}
