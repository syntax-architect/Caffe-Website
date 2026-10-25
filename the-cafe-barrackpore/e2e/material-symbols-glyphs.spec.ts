import { test, expect } from '@playwright/test';

test.describe('Material Symbols Glyph Rendering Audit (All Pages)', () => {
  const setStaffAuth = async (page: any) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'cb_staff_auth',
        JSON.stringify({
          staff: {
            id: 'staff-demo-owner',
            user_id: 'demo-owner-id',
            full_name: 'Owner Administrator',
            role: 'owner',
            active: true,
          },
          email: 'owner@thecafebarrackpore.com',
          expiresAt: Date.now() + 86400000,
        })
      );
    });
  };

  /**
   * Evaluates all visible .material-symbols-outlined elements on the page.
   * Fails if any element renders as visible fallback text instead of a glyph.
   */
  const assertAllGlyphsRendered = async (page: any, pageLabel: string) => {
    // 1. Ensure fonts are loaded and ready
    const isFontLoaded = await page.evaluate(async () => {
      try {
        await document.fonts.load('24px "Material Symbols Outlined"');
        await document.fonts.ready;
        return document.fonts.check('24px "Material Symbols Outlined"');
      } catch {
        return false;
      }
    });
    expect(isFontLoaded, `Material Symbols Outlined font must be loaded on ${pageLabel}`).toBe(true);

    // 2. Inspect every .material-symbols-outlined element on the page
    const failures = await page.evaluate((label: string) => {
      const elements = Array.from(document.querySelectorAll('.material-symbols-outlined'));
      const errors: Array<{
        page: string;
        text: string;
        width: number;
        height: number;
        fontSize: string;
        reason: string;
      }> = [];

      for (const el of elements) {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          continue;
        }

        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) {
          continue;
        }

        const text = (el.textContent || '').trim();
        if (!text) continue;

        const fontSize = parseFloat(style.fontSize) || 24;

        // When a ligature fails to map to a glyph, the browser renders the raw ASCII text
        // (e.g. 'local_pizza' is 11 chars, width > 60px vs fontSize 20px).
        // A real ligature glyph maintains an aspect ratio close to 1:1, width <= fontSize * 1.8.
        if (text.length >= 3 && rect.width > fontSize * 2.0) {
          errors.push({
            page: label,
            text,
            width: Math.round(rect.width * 10) / 10,
            height: Math.round(rect.height * 10) / 10,
            fontSize: style.fontSize,
            reason: `Rendered as text characters (${rect.width.toFixed(1)}px width vs fontSize ${fontSize}px)`,
          });
        }
      }

      return errors;
    }, pageLabel);

    if (failures.length > 0) {
      console.error(`Broken icons on ${pageLabel}:`, failures);
    }
    expect(failures, `Found ${failures.length} broken icons on ${pageLabel}`).toEqual([]);
  };

  test('Customer Landing Page & Interactive Drawers (local_pizza, ramen_dining, etc.)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await assertAllGlyphsRendered(page, 'Customer Landing Page (/)');

    // Test Cart Drawer icons
    const cartBtn = page.locator('button[title*="Bag"], button[aria-label*="cart" i], [data-testid="header-cart-button"]').first();
    if (await cartBtn.isVisible()) {
      await cartBtn.click();
      await page.waitForTimeout(400);
      await assertAllGlyphsRendered(page, 'Cart Drawer');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // Test Reservation Drawer icons
    const bookBtn = page.locator('button:has-text("Book"), button:has-text("Table")').first();
    if (await bookBtn.isVisible()) {
      await bookBtn.click();
      await page.waitForTimeout(400);
      await assertAllGlyphsRendered(page, 'Reservation Drawer');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  });

  test('Customer QR Ordering & Information Pages', async ({ page }) => {
    const pages = ['/qr', '/qr-generator', '/privacy', '/terms', '/order-success', '/staff/login', '/reset-password'];
    for (const url of pages) {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(400);
      await assertAllGlyphsRendered(page, `Customer Page (${url})`);
    }
  });

  test('Dashboard Overview & Kitchen (speed, bolt, volume_off, view_compact)', async ({ page }) => {
    await page.goto('/staff/login', { waitUntil: 'domcontentloaded' });
    await setStaffAuth(page);

    // Dashboard Overview (has speed/bolt icon)
    await page.goto('/staff/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await assertAllGlyphsRendered(page, 'Staff Dashboard Overview');

    // Kitchen KDS (has volume_off/volume_up, view_compact/view_comfortable)
    await page.goto('/staff/kitchen', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await assertAllGlyphsRendered(page, 'Kitchen KDS Bump Screen');
  });

  test('Dashboard Orders & POS (arrow_drop_down, payments, point_of_sale)', async ({ page }) => {
    await page.goto('/staff/login', { waitUntil: 'domcontentloaded' });
    await setStaffAuth(page);

    // Orders Management (has arrow_drop_down)
    await page.goto('/staff/orders', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await assertAllGlyphsRendered(page, 'Staff Orders Management');

    // POS Terminal
    await page.goto('/staff/pos', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await assertAllGlyphsRendered(page, 'Staff POS Terminal');

    // Cash Drawer & Shifts
    await page.goto('/staff/drawer', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await assertAllGlyphsRendered(page, 'Staff Cash Drawer');
  });

  test('Dashboard Management Modules (Menu, Tables, Content, Staff, Settings, Discounts, Audit)', async ({ page }) => {
    await page.goto('/staff/login', { waitUntil: 'domcontentloaded' });
    await setStaffAuth(page);

    const dashboardPages = [
      '/staff/menu',
      '/staff/tables',
      '/staff/content',
      '/staff/customers',
      '/staff/discounts',
      '/staff/staff',
      '/staff/audit',
      '/staff/settings',
      '/staff/reservations',
    ];

    for (const url of dashboardPages) {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(400);
      await assertAllGlyphsRendered(page, `Dashboard Module (${url})`);
    }
  });
});
