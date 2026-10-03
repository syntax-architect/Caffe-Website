import { renderToString } from 'react-dom/server';
import { I18nProvider } from './i18n';
import { SiteConfigProvider } from './context/SiteConfigContext';
import { AuthProvider } from './context/AuthContext';
import { TableProvider } from './context/TableContext';
import App from './App';
import { MetaTags } from './components/MetaTags';
import { PrivacyPolicyPage } from './components/legal/PrivacyPolicyPage';
import { TermsPage } from './components/legal/TermsPage';
import { generatePageSEO, type PageSEOMetadata } from './utils/seo';
import { DEFAULT_RESTAURANT_CONFIG } from './config/restaurantPresets';

export interface RenderResult {
  html: string;
  seo: PageSEOMetadata;
}

export function render(url: string): RenderResult {
  const cleanUrl = url.replace(/\/$/, '') || '/';
  const isPrivacy = cleanUrl === '/privacy' || cleanUrl === '/privacy-policy';
  const isTerms = cleanUrl === '/terms' || cleanUrl === '/terms-of-service';

  let appComponent: React.ReactNode;
  if (isPrivacy) {
    appComponent = <PrivacyPolicyPage />;
  } else if (isTerms) {
    appComponent = <TermsPage />;
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
        <MetaTags pathname={cleanUrl} />
        <AuthProvider>
          {appComponent}
        </AuthProvider>
      </SiteConfigProvider>
    </I18nProvider>
  );

  const html = renderToString(wrapped);

  const seo = generatePageSEO({
    pathname: cleanUrl,
    restaurantConfig: DEFAULT_RESTAURANT_CONFIG,
    seoConfig: {
      title: 'The Café Barrackpore | Best Artisanal Cafe & Wood-Fired Pizza in Barrackpore',
      description:
        'Experience cozy elegance at The Café Barrackpore. Serving single-origin artisanal coffee, hand-stretched wood-fired pizzas, gourmet burgers, and handcrafted mocktails in Barrackpore.',
      image: 'https://thecafebarrackpore.com/images/og-share.jpg',
    },
    origin: 'https://thecafebarrackpore.com',
  });

  return { html, seo };
}
