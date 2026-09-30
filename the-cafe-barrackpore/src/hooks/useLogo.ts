import { useSiteConfig } from '../context/SiteConfigContext';

export function useLogo() {
  const { logoUrl } = useSiteConfig();
  return logoUrl;
}
