import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const TARGET_WIDTHS = [1280, 1366, 1440, 1920, 768, 390];

test.describe('Pre-Sale Hotfix Acceptance Verification', () => {
  test.beforeAll(async () => {
    const screenshotDir = path.resolve(process.cwd(), 'test-results', 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  for (const width of TARGET_WIDTHS) {
    test(`Viewport ${width}px: screenshots, zero icon text, zero console errors, fully visible actions`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });
      page.on('pageerror', (err) => {
        consoleErrors.push(err.message);
      });

      const height = width <= 768 ? (width === 390 ? 844 : 1024) : 900;
      await page.setViewportSize({ width, height });

      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      // Wait for Material Symbols font to be completely ready
      await page.evaluate(async () => {
        try {
          await document.fonts.load('24px "Material Symbols Outlined"');
          await document.fonts.ready;
        } catch {
          // ignore
        }
      });

      // 1. Verify Language Switcher is fully visible
      const langTrigger = page.locator('[data-testid="language-switcher-trigger"]');
      await expect(langTrigger).toBeVisible();
      const langBox = await langTrigger.boundingBox();
      expect(langBox, 'Language switcher bounding box must exist').not.toBeNull();
      if (langBox) {
        expect(langBox.x).toBeGreaterThanOrEqual(0);
        expect(langBox.x + langBox.width).toBeLessThanOrEqual(width + 2);
      }

      // 2. Verify Cart Button is fully visible
      const cartButton = page.locator('[data-testid="header-cart-button"]');
      await expect(cartButton).toBeVisible();
      const cartBox = await cartButton.boundingBox();
      expect(cartBox, 'Cart button bounding box must exist').not.toBeNull();
      if (cartBox) {
        expect(cartBox.x).toBeGreaterThanOrEqual(0);
        expect(cartBox.x + cartBox.width).toBeLessThanOrEqual(width + 2);
      }

      // 3. Verify Book Button is fully visible
      const bookButton = page.locator('[data-testid="header-book-button"]');
      await expect(bookButton).toBeVisible();
      const bookBox = await bookButton.boundingBox();
      expect(bookBox, 'Book button bounding box must exist').not.toBeNull();
      if (bookBox) {
        expect(bookBox.x).toBeGreaterThanOrEqual(0);
        expect(bookBox.x + bookBox.width).toBeLessThanOrEqual(width + 2);
      }

      // 4. Verify Zero Horizontal Scroll
      const overflow = await page.evaluate(() => {
        const docWidth = document.documentElement.scrollWidth;
        const bodyWidth = document.body.scrollWidth;
        const winWidth = window.innerWidth;
        const maxScroll = Math.max(docWidth, bodyWidth);
        return {
          maxScroll,
          winWidth,
          hasScroll: maxScroll > winWidth,
          overflowPx: Math.max(0, maxScroll - winWidth),
        };
      });
      expect(
        overflow.hasScroll,
        `Page must not have horizontal scroll at ${width}px (overflow: ${overflow.overflowPx}px)`
      ).toBe(false);

      // 5. Verify Zero Icon Text (all .material-symbols-outlined render as glyphs, not text strings)
      const brokenIcons = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('.material-symbols-outlined'));
        const errors: string[] = [];

        for (const el of elements) {
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            continue;
          }
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue;

          const text = (el.textContent || '').trim();
          if (!text) continue;
          const fontSize = parseFloat(style.fontSize) || 24;

          // If icon is rendering as ASCII characters instead of ligature, width will be much wider than height/fontSize
          if (text.length >= 3 && rect.width > fontSize * 2.0) {
            errors.push(`"${text}" width=${rect.width}px vs fontSize=${fontSize}px`);
          }
        }
        return errors;
      });
      expect(brokenIcons, `Zero icon text violations expected at ${width}px`).toEqual([]);

      // 6. Capture Full Page and Header Screenshots at this width
      const screenshotPath = path.resolve(process.cwd(), 'test-results', 'screenshots', `acceptance-viewport-${width}px.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      expect(fs.existsSync(screenshotPath)).toBe(true);

      const headerBar = page.locator('header').first();
      const headerPath = path.resolve(process.cwd(), 'test-results', 'screenshots', `acceptance-header-${width}px.png`);
      await headerBar.screenshot({ path: headerPath });
      expect(fs.existsSync(headerPath)).toBe(true);

      // 7. Verify Zero Console Errors
      // Filter out non-critical third-party analytics / CSP if simulated in test
      const criticalErrors = consoleErrors.filter(
        (e) => !e.includes('favicon') && !e.includes('analytics') && !e.includes('Failed to load resource')
      );
      expect(criticalErrors, `Zero console errors expected at ${width}px`).toEqual([]);
    });
  }
});
