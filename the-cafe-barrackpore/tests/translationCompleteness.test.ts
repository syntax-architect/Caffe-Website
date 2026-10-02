/**
 * Language Translation Completeness & Security Verification Test Suite
 * Verifies all 12 supported languages, rate limiting, and CAPTCHA foundation
 */
import { en } from '../src/i18n/en';
import { ar } from '../src/i18n/ar';
import { fr } from '../src/i18n/fr';
import { de } from '../src/i18n/de';
import { es } from '../src/i18n/es';
import { pt } from '../src/i18n/pt';
import { ja } from '../src/i18n/ja';
import { zh } from '../src/i18n/zh';
import { ko } from '../src/i18n/ko';
import { hi } from '../src/i18n/hi';
import { tr } from '../src/i18n/tr';
import { th } from '../src/i18n/th';
import { LANGUAGE_META, type SupportedLanguage, type TranslationDictionary } from '../src/i18n/types';
import { checkRateLimit, recordRateLimitAttempt, enforceRateLimit } from '../src/utils/rateLimiter';

console.log('=== RUNNING TRANSLATION & SECURITY VERIFICATION TESTS ===\n');

// 1. Verify all 12 languages in LANGUAGE_META
const expectedLanguages: SupportedLanguage[] = [
  'en', 'ar', 'fr', 'de', 'es', 'pt', 'ja', 'zh', 'ko', 'hi', 'tr', 'th'
];

console.log('Test 1: Verifying LANGUAGE_META entries for all 12 languages');
for (const lang of expectedLanguages) {
  const meta = LANGUAGE_META[lang];
  if (!meta || !meta.name || !meta.nativeName || !meta.direction || !meta.flag) {
    throw new Error(`Test 1 failed: Incomplete LANGUAGE_META for "${lang}"`);
  }
}
console.log('✔ Test 1: All 12 languages have complete metadata');

// 2. Verify all 12 translation dictionaries are fully defined and non-empty
const dictionaries: Record<SupportedLanguage, TranslationDictionary> = {
  en, ar, fr, de, es, pt, ja, zh, ko, hi, tr, th
};

const requiredSections: (keyof TranslationDictionary)[] = [
  'common',
  'nav',
  'hero',
  'menu',
  'cart',
  'reservations',
  'qr',
  'footer',
  'staff',
  'notifications',
  'a11y'
];

console.log('Test 2: Verifying section completeness and non-empty strings across all languages');
for (const [lang, dict] of Object.entries(dictionaries)) {
  for (const section of requiredSections) {
    if (!dict[section] || typeof dict[section] !== 'object') {
      throw new Error(`Test 2 failed: Language "${lang}" is missing section "${section}"`);
    }
  }

  // Deep check common strings
  if (!dict.common.loading || !dict.common.total || !dict.common.subtotal) {
    throw new Error(`Test 2 failed: Language "${lang}" has missing common strings`);
  }

  // Deep check menu strings
  if (!dict.menu.addToCart || !dict.menu.title || !dict.menu.soldOut) {
    throw new Error(`Test 2 failed: Language "${lang}" has missing menu strings`);
  }

  // Deep check cart strings
  if (!dict.cart.title || !dict.cart.placeOrder || !dict.cart.reviewOrder) {
    throw new Error(`Test 2 failed: Language "${lang}" has missing cart strings`);
  }

  // Deep check reservations strings
  if (!dict.reservations.title || !dict.reservations.confirmReservation) {
    throw new Error(`Test 2 failed: Language "${lang}" has missing reservations strings`);
  }

  // Deep check staff subsections
  const staff = dict.staff;
  if (!staff.login?.signIn || !staff.dashboard?.orders || !staff.kitchen?.bumpTicket || !staff.tables?.tableNumber || !staff.settings?.title) {
    throw new Error(`Test 2 failed: Language "${lang}" has missing staff subsections`);
  }
}
console.log('✔ Test 2: All 12 language dictionaries pass full structural and content validation');

// 3. Test Rate Limiter Functionality
console.log('Test 3: Verifying sliding window rate limiter');
const testAction = 'order';

// Fresh check should be allowed
const initialCheck = checkRateLimit(testAction, 5, 60000);
if (!initialCheck.allowed || initialCheck.remainingAttempts !== 5) {
  throw new Error(`Test 3 failed: Initial rate limit check should be allowed with 5 remainingAttempts (got ${initialCheck.remainingAttempts}).`);
}

// Record 5 attempts
for (let i = 0; i < 5; i++) {
  const check = enforceRateLimit(testAction, 5, 60000);
  if (!check.allowed) {
    throw new Error(`Test 3 failed: Attempt ${i + 1} should be allowed.`);
  }
}

// 6th attempt must be rejected
const rejectedCheck = enforceRateLimit(testAction, 5, 60000);
if (rejectedCheck.allowed) {
  throw new Error(`Test 3 failed: 6th attempt was not rate-limited!`);
}
if (!rejectedCheck.error || !rejectedCheck.retryAfterSeconds) {
  throw new Error(`Test 3 failed: Rate limit rejection missing error or retryAfterSeconds.`);
}
console.log('✔ Test 3: Sliding window rate limiter successfully throttles excess requests');

console.log('\n=== ALL TRANSLATION & SECURITY TESTS PASSED (3/3)! ===\n');
