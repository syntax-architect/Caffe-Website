import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const TARGET_WIDTHS = [1920, 1440, 1366, 1280, 768, 390];

test.describe('Header Responsiveness & Anti-Clipping Audit across Viewports', () => {
  test.beforeAll(async () => {
    const screenshotDir = path.resolve(process.cwd(), 'test-results', 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  for (const width of TARGET_WIDTHS) {
    test(`Header layout at ${width}px: language switcher, cart button, book button fully visible, zero horizontal scroll`, async ({ page }) => {
      const height = width <= 768 ? 844 : 900;
      await page.setViewportSize({ width, height });

      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      // Ensure fonts are ready
      await page.evaluate(async () => {
        try {
          await document.fonts.load('24px "Material Symbols Outlined"');
          await document.fonts.ready;
        } catch {
          // ignore
        }
      });

      // 1. Language switcher must be fully visible
      const langTrigger = page.locator('[data-testid="language-switcher-trigger"]');
      await expect(langTrigger).toBeVisible();
      const langBox = await langTrigger.boundingBox();
      expect(langBox, 'Language switcher bounding box must exist').not.toBeNull();
      if (langBox) {
        expect(langBox.x, 'Language switcher x position >= 0').toBeGreaterThanOrEqual(0);
        expect(langBox.x + langBox.width, 'Language switcher right edge <= viewport width').toBeLessThanOrEqual(width + 1);
        expect(langBox.width, 'Language switcher width > 0').toBeGreaterThan(20);
        expect(langBox.height, 'Language switcher height > 0').toBeGreaterThan(20);
      }

      // 2. Cart button must be fully visible
      const cartButton = page.locator('[data-testid="header-cart-button"]');
      await expect(cartButton).toBeVisible();
      const cartBox = await cartButton.boundingBox();
      expect(cartBox, 'Cart button bounding box must exist').not.toBeNull();
      if (cartBox) {
        expect(cartBox.x, 'Cart button x position >= 0').toBeGreaterThanOrEqual(0);
        expect(cartBox.x + cartBox.width, 'Cart button right edge <= viewport width').toBeLessThanOrEqual(width + 1);
        expect(cartBox.width, 'Cart button width > 0').toBeGreaterThan(20);
        expect(cartBox.height, 'Cart button height > 0').toBeGreaterThan(20);
      }

      // 3. Book button must be fully visible (at 1280, 1366, 1440, 1920, 768, 390)
      const bookButton = page.locator('[data-testid="header-book-button"]');
      await expect(bookButton).toBeVisible();
      const bookBox = await bookButton.boundingBox();
      expect(bookBox, 'Book button bounding box must exist').not.toBeNull();
      if (bookBox) {
        expect(bookBox.x, 'Book button x position >= 0').toBeGreaterThanOrEqual(0);
        expect(bookBox.x + bookBox.width, 'Book button right edge <= viewport width').toBeLessThanOrEqual(width + 1);
        expect(bookBox.width, 'Book button width > 0').toBeGreaterThan(20);
        expect(bookBox.height, 'Book button height > 0').toBeGreaterThan(20);
      }

      // 4. Strict Horizontal Scroll Invariant: document.documentElement.scrollWidth <= window.innerWidth
      const horizontalOverflow = await page.evaluate(() => {
        const docWidth = document.documentElement.scrollWidth;
        const bodyWidth = document.body.scrollWidth;
        const winWidth = window.innerWidth;
        const maxScrollWidth = Math.max(docWidth, bodyWidth);
        return {
          docWidth,
          bodyWidth,
          winWidth,
          hasScroll: maxScrollWidth > winWidth,
          overflowPx: Math.max(0, maxScrollWidth - winWidth),
        };
      });

      expect(
        horizontalOverflow.hasScroll,
        `Page must not have horizontal scroll at ${width}px (overflow: ${horizontalOverflow.overflowPx}px)`
      ).toBe(false);

      // 5. Navigation collapse / shrink behavior
      if (width >= 1024) {
        // Desktop nav must be visible
        const desktopNav = page.locator('[data-testid="header-desktop-nav"]');
        await expect(desktopNav).toBeVisible();

        const navBox = await desktopNav.boundingBox();
        expect(navBox).not.toBeNull();
        if (navBox) {
          expect(navBox.x).toBeGreaterThanOrEqual(0);
          expect(navBox.x + navBox.width).toBeLessThanOrEqual(width);
        }

        // At 1280px & 1366px, desktop nav must have shrunk into icon-only mode before clipping
        if (width <= 1366) {
          const navTextVisible = await page.evaluate(() => {
            const nav = document.querySelector('[data-testid="header-desktop-nav"]');
            if (!nav) return false;
            const textSpans = Array.from(nav.querySelectorAll('[data-testid="nav-item-text"]'));
            // Check if text spans are hidden on screens < 1440px
            return textSpans.some((span) => {
              const style = window.getComputedStyle(span);
              return style.display !== 'none' && style.visibility !== 'hidden';
            });
          });
          expect(
            navTextVisible,
            `At ${width}px, desktop nav text must collapse to icon-only mode before any clipping`
          ).toBe(false);
        }
      } else {
        // Mobile / tablet: desktop nav must be hidden and hamburger menu trigger visible
        const desktopNav = page.locator('[data-testid="header-desktop-nav"]');
        await expect(desktopNav).toBeHidden();

        const mobileMenuTrigger = page.locator('[data-testid="header-mobile-menu-trigger"]');
        await expect(mobileMenuTrigger).toBeVisible();
      }

      // 6. Capture screenshot at this width
      const screenshotPath = path.resolve(process.cwd(), 'test-results', 'screenshots', `header-${width}px.png`);
      await page.screenshot({ path: screenshotPath });
      expect(fs.existsSync(screenshotPath), `Screenshot at ${width}px must be written to disk`).toBe(true);

      const headerBar = page.locator('header').first();
      const headerBarPath = path.resolve(process.cwd(), 'test-results', 'screenshots', `header-bar-${width}px.png`);
      await headerBar.screenshot({ path: headerBarPath });
      expect(fs.existsSync(headerBarPath), `Header bar screenshot at ${width}px must exist`).toBe(true);
    });
  }
});
