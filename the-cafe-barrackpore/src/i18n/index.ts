/**
 * i18n Module Public API
 * Re-exports everything needed for internationalization throughout the app.
 */
export { I18nProvider, useI18n, useOptionalI18n, getStoredStaffLanguage, getActiveStaffUserId, STAFF_LANGUAGE_STORAGE_PREFIX } from './I18nContext';
export { LANGUAGE_META } from './types';
export type {
  SupportedLanguage,
  LanguageDirection,
  LanguageMeta,
  TranslationDictionary,
} from './types';
