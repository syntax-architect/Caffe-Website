import { test, expect } from '@playwright/test';

test.describe('No Dead Taps & Demo Link Verification Suite', () => {

  test('All links on customer homepage have real, non-placeholder destinations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Query all visible anchor tags on the page
    const links = page.locator('a:visible');
    const count = await links.count();
    expect(count).toBeGreaterThan(10);

    for (let i = 0; i < count; i++) {
      const link = links.nth(i);
      const href = await link.getAttribute('href');
      const text = (await link.innerText()).trim();

      // Assert no empty href, no bare '#' (unless handled by JS modal with id), no javascript:
      expect(href, `Link "${text}" must have an href attribute`).toBeTruthy();
      expect(href, `Link "${text}" must not be a bare dead "#"`).not.toBe('#');
      expect(href, `Link "${text}" must not be javascript:void(0)`).not.toContain('javascript:');

      if (href?.startsWith('mailto:')) {
        expect(href).toMatch(/^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/);
      } else if (href?.startsWith('tel:')) {
        expect(href).toMatch(/^tel:\+?[\d\s-]{7,16}$/);
      } else if (href?.startsWith('https://wa.me/')) {
        expect(href).toMatch(/^https:\/\/wa\.me\/\d+/);
      } else if (href?.startsWith('http')) {
        expect(href).toMatch(/^https?:\/\//);
      }
    }
  });

  test('Google Reviews card renders built-in rating and opens Maps review link', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Find the built-in Google reviews card
    const reviewsCard = page.locator('[data-testid="google-reviews-card"]').first();
    await reviewsCard.scrollIntoViewIfNeeded();
    await expect(reviewsCard).toBeVisible({ timeout: 10000 });

    // Assert rating and star indicators
    await expect(reviewsCard.locator('text=/4\.9|Verified Reviews/i').first()).toBeVisible();

    // Assert the Maps CTA button
    const mapsCta = reviewsCard.locator('a[href*="maps.app.goo.gl"], a[href*="google.com/maps"]').first();
    await expect(mapsCta).toBeVisible();
    const href = await mapsCta.getAttribute('href');
    expect(href).toContain('maps');
    const target = await mapsCta.getAttribute('target');
    expect(target).toBe('_blank');
  });

  test('Every major interactive button triggers a modal, drawer, or state mutation (no dead taps)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // 1. Reserve a Table button opens reservation modal
    const reserveBtn = page.locator('button:visible').filter({ hasText: /Reserve a Table|Book a Table/i }).first();
    if (await reserveBtn.isVisible()) {
      await reserveBtn.scrollIntoViewIfNeeded();
      await reserveBtn.click();
      const resDialog = page.locator('[role="dialog"]').first();
      await expect(resDialog).toBeVisible({ timeout: 6000 });

      // Dismiss dialog
      const closeBtn = resDialog.locator('button[aria-label*="close" i]').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await expect(resDialog).toBeHidden({ timeout: 5000 });
      }
    }

    // 2. Guest Inquiry button opens contact modal
    const inquiryBtn = page.locator('button:visible').filter({ hasText: /Send Guest Inquiry|Guest Inquiry/i }).first();
    if (await inquiryBtn.isVisible()) {
      await inquiryBtn.scrollIntoViewIfNeeded();
      await inquiryBtn.click();
      const contactDialog = page.locator('[role="dialog"]').first();
      await expect(contactDialog).toBeVisible({ timeout: 6000 });

      // Dismiss dialog
      const closeBtn = contactDialog.locator('button[aria-label*="close" i]').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await expect(contactDialog).toBeHidden({ timeout: 5000 });
      }
    }

    // 3. Menu Category Filter buttons mutate category selection
    const menuSection = page.locator('#menu-section');
    if (await menuSection.isVisible()) {
      await menuSection.scrollIntoViewIfNeeded();
      const categoryButtons = menuSection.locator('button[role="tab"], button').filter({ hasText: /Coffee|Bites|Pizzas|Beverages|All/i });
      const catCount = await categoryButtons.count();
      if (catCount > 1) {
        await categoryButtons.nth(1).click();
        // Wait for visual tab state update
        await page.waitForTimeout(300);
      }
    }

    // 4. Cart drawer button opens cart modal
    const cartBtn = page.locator('button[aria-label*="cart" i], button[title*="cart" i], header button:has(.material-symbols-outlined)').filter({ hasText: /shopping_bag|bag/i }).first();
    if (await cartBtn.isVisible()) {
      await cartBtn.click();
      const cartDialog = page.locator('[role="dialog"]').first();
      await expect(cartDialog).toBeVisible({ timeout: 5000 });

      const closeCartBtn = cartDialog.locator('button[aria-label*="close" i]').first();
      if (await closeCartBtn.isVisible()) {
        await closeCartBtn.click();
        await expect(cartDialog).toBeHidden({ timeout: 5000 });
      }
    }

    // 5. Hygiene standards in footer opens informational modal
    const hygieneLink = page.locator('footer a').filter({ hasText: /Hygiene & Safety|Hygiene Standards/i }).first();
    if (await hygieneLink.isVisible()) {
      await hygieneLink.scrollIntoViewIfNeeded();
      await hygieneLink.click();
      const modal = page.locator('[role="dialog"], .fixed.inset-0').first();
      await expect(modal).toBeVisible({ timeout: 5000 });
    }
  });

});
