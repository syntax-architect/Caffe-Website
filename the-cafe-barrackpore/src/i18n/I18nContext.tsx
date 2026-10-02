/**
 * Internationalization (i18n) Context & Provider
 * Global Restaurant Platform — Zero-Code Language Switching
 *
 * Provides:
 * - Dynamic language switching at runtime
 * - Nested dot-path string lookup via `t('cart.title')` 
 * - RTL/LTR direction management
 * - Persistent language preference via localStorage
 * - Automatic HTML dir/lang attribute updates
 */
import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { SupportedLanguage, TranslationDictionary, LanguageDirection, LanguageMeta } from './types';
import { LANGUAGE_META } from './types';
import { en } from './en';

const I18N_STORAGE_KEY = 'cafe_language';

/**
 * Lazy-loaded language packs — only English is bundled by default.
 * Other languages are loaded on demand to keep the initial bundle small.
 */
const languageLoaders: Record<SupportedLanguage, () => Promise<{ default?: TranslationDictionary; [key: string]: any }>> = {
  en: () => Promise.resolve({ en }),
  ar: () => import('./ar'),
  fr: () => import('./fr'),
  de: () => import('./de'),
  es: () => import('./es'),
  pt: () => import('./pt'),
  ja: () => import('./ja'),
  zh: () => import('./zh'),
  ko: () => import('./ko'),
  hi: () => import('./hi'),
  tr: () => import('./tr'),
  th: () => import('./th'),
};

/**
 * Deep-access a nested object by dot-path.
 * `getNestedValue({ cart: { title: 'Bag' } }, 'cart.title')` → `'Bag'`
 */
function getNestedValue(obj: any, path: string): string | undefined {
  return path.split('.').reduce((acc, key) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return acc[key];
    }
    return undefined;
  }, obj);
}

export interface I18nContextType {
  /** Current active language code */
  language: SupportedLanguage;
  /** Current text direction ('ltr' or 'rtl') */
  direction: LanguageDirection;
  /** Metadata for the current language */
  meta: LanguageMeta;
  /** Whether a language pack is currently loading */
  isLoading: boolean;
  /** All available languages */
  availableLanguages: LanguageMeta[];
  /**
   * Translation function. Accepts dot-path keys:
   * `t('cart.title')` → "Your Order"
   * Optional `fallback` overrides the English default if key is missing.
   */
  t: (key: string, fallback?: string) => string;
  /** Switch to a different language */
  setLanguage: (lang: SupportedLanguage) => void;
}

const defaultContext: I18nContextType = {
  language: 'en',
  direction: 'ltr',
  meta: LANGUAGE_META.en,
  isLoading: false,
  availableLanguages: Object.values(LANGUAGE_META),
  t: (key: string, fallback?: string) => getNestedValue(en, key) || fallback || key,
  setLanguage: () => {},
};

const I18nContext = createContext<I18nContextType>(defaultContext);

export const I18nProvider: React.FC<{ children: ReactNode; defaultLanguage?: SupportedLanguage }> = ({
  children,
  defaultLanguage,
}) => {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    if (typeof window === 'undefined') return defaultLanguage || 'en';
    try {
      const stored = localStorage.getItem(I18N_STORAGE_KEY);
      if (stored && stored in LANGUAGE_META) {
        return stored as SupportedLanguage;
      }
    } catch {
      // Fallback
    }
    return defaultLanguage || 'en';
  });

  const [translations, setTranslations] = useState<TranslationDictionary>(en);
  const [isLoading, setIsLoading] = useState(false);

  const direction: LanguageDirection = LANGUAGE_META[language]?.direction || 'ltr';
  const meta: LanguageMeta = LANGUAGE_META[language] || LANGUAGE_META.en;

  // Load language pack when language changes
  useEffect(() => {
    let cancelled = false;

    if (language === 'en') {
      setTranslations(en);
      return;
    }

    setIsLoading(true);
    const loader = languageLoaders[language];

    if (loader) {
      loader()
        .then((module) => {
          if (cancelled) return;
          // Module exports the translation as named export matching the language code
          const dict = module.default || module[language] || en;
          setTranslations(dict);
          setIsLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          console.warn(`[i18n] Failed to load language pack: ${language}, falling back to English`);
          setTranslations(en);
          setIsLoading(false);
        });
    } else {
      setTranslations(en);
      setIsLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [language]);

  // Update HTML attributes when direction or language changes
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('dir', direction);
    document.documentElement.setAttribute('lang', language);
  }, [language, direction]);

  const t = useCallback(
    (key: string, fallback?: string): string => {
      const value = getNestedValue(translations, key);
      if (value !== undefined) return value;

      // Fallback to English if the key is missing in the current language
      const englishValue = getNestedValue(en, key);
      if (englishValue !== undefined) return englishValue;

      return fallback || key;
    },
    [translations]
  );

  const setLanguage = useCallback((lang: SupportedLanguage) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(I18N_STORAGE_KEY, lang);
      } catch {
        // Ignore
      }
    }
  }, []);

  return (
    <I18nContext.Provider
      value={{
        language,
        direction,
        meta,
        isLoading,
        availableLanguages: Object.values(LANGUAGE_META),
        t,
        setLanguage,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
};

/**
 * Hook to access translations and language configuration.
 * Usage:
 * ```tsx
 * const { t, language, direction, setLanguage } = useI18n();
 * return <h1>{t('hero.viewMenu')}</h1>;
 * ```
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
