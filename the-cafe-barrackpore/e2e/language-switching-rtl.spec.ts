import { test, expect } from '@playwright/test';
import type { SupportedLanguage } from '../src/i18n/types';

/**
 * End-to-End Test Suite: 12-Language Switching, Dynamic Text Updates, and RTL/LTR Direction
 *
 * Verifies:
 * 1. LanguageSwitcher switches seamlessly across all 12 supported languages.
 * 2. Text updates dynamically across the UI on selection.
 * 3. Arabic ('ar') dynamically sets <html dir="rtl" lang="ar"> and updates layout.
 * 4. Non-Arabic languages dynamically set <html dir="ltr" lang="[code]">.
 * 5. Selected language persists in localStorage ('cafe_language') across page refreshes.
 */

const LANGUAGES: { code: SupportedLanguage; name: string; nativeName: string; dir: 'ltr' | 'rtl'; sampleText: string }[] = [
  { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr', sampleText: 'Reserve a Table' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', dir: 'rtl', sampleText: 'احجز طاولة' },
  { code: 'fr', name: 'French', nativeName: 'Français', dir: 'ltr', sampleText: 'Réserver une table' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', dir: 'ltr', sampleText: 'Tisch reservieren' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', dir: 'ltr', sampleText: 'Reservar mesa' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', dir: 'ltr', sampleText: 'Reservar Mesa' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', dir: 'ltr', sampleText: '席を予約する' },
  { code: 'zh', name: 'Chinese', nativeName: '简体中文', dir: 'ltr', sampleText: '立即订座' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', dir: 'ltr', sampleText: '테이블 예약' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', dir: 'ltr', sampleText: 'टेबल बुक करें' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', dir: 'ltr', sampleText: 'Masa Ayırt' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', dir: 'ltr', sampleText: 'จองโต๊ะล่วงหน้า' },
];

test.describe('Global Restaurant i18n & RTL Multi-Language Switching', () => {

  test.beforeEach(async ({ page }) => {
    // Start with a clean localStorage
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('cafe_language'));
    await page.reload();
  });

  test('1. Verify default language is English LTR', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('dir', 'ltr');
    await expect(html).toHaveAttribute('lang', 'en');
  });

  test('2. Cycle through all 12 languages: verify text updates and RTL/LTR attribute changes', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/');

    for (const lang of LANGUAGES) {
      // Open the Language Switcher trigger in the header
      const trigger = page.locator('[data-testid="language-switcher-trigger"]').first();
      await expect(trigger).toBeVisible({ timeout: 10000 });
      await trigger.click();

      // Click the option corresponding to the language code
      const option = page.locator(`[data-testid="lang-option-${lang.code}"]`).first();
      await expect(option).toBeVisible({ timeout: 5000 });
      await option.click();

      // Assert <html dir="..." lang="...">
      const html = page.locator('html');
      await expect(html).toHaveAttribute('dir', lang.dir, { timeout: 8000 });
      await expect(html).toHaveAttribute('lang', lang.code, { timeout: 8000 });

      // Assert localStorage persistence
      const savedLang = await page.evaluate(() => localStorage.getItem('cafe_language'));
      expect(savedLang).toBe(lang.code);

      // Verify that sample translated text appears on page (e.g. Hero reservation button)
      const reservationCta = page.locator(`text=${lang.sampleText}`).first();
      await expect(reservationCta).toBeAttached({ timeout: 8000 });
    }
  });

  test('3. Arabic RTL layout integrity and reload persistence', async ({ page }) => {
    await page.goto('/');

    // Switch to Arabic
    const trigger = page.locator('[data-testid="language-switcher-trigger"]').first();
    await trigger.click();
    const arOption = page.locator('[data-testid="lang-option-ar"]').first();
    await arOption.click();

    // Verify Arabic RTL attributes
    const html = page.locator('html');
    await expect(html).toHaveAttribute('dir', 'rtl');
    await expect(html).toHaveAttribute('lang', 'ar');

    // Reload page to test cold persistence
    await page.reload();

    // Expect Arabic and RTL to remain active after reload
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');

    // Verify Arabic navigation items are present
    const arabicNavOrder = page.locator('text=احجز طاولة').first();
    await expect(arabicNavOrder).toBeAttached();

    // Verify localStorage retains 'ar'
    const stored = await page.evaluate(() => localStorage.getItem('cafe_language'));
    expect(stored).toBe('ar');
  });

  test('4. Footer Language Switcher works and syncs with header', async ({ page }) => {
    await page.goto('/');

    // Scroll to footer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Open footer language switcher
    const footerTrigger = page.locator('[data-testid="language-switcher-trigger-footer"]').first();
    await expect(footerTrigger).toBeVisible({ timeout: 8000 });
    await footerTrigger.click();

    // Select German ('de')
    const deOption = page.locator('[data-testid="lang-option-de"]').first();
    await expect(deOption).toBeVisible();
    await deOption.click();

    // Verify German is active
    const html = page.locator('html');
    await expect(html).toHaveAttribute('lang', 'de');
    await expect(html).toHaveAttribute('dir', 'ltr');

    // Check header displays German flag/code
    const headerTrigger = page.locator('[data-testid="language-switcher-trigger"]').first();
    await expect(headerTrigger).toContainText(/de/i);
  });
});
