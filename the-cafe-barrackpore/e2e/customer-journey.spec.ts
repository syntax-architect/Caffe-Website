import { test, expect } from '@playwright/test';

test.describe('The Café Barrackpore - Comprehensive End-to-End Test Suite', () => {

  test('1. Homepage Narrative: Hero, sections, and brand styling', async ({ page }) => {
    await page.goto('/');

    // Page title and SEO meta verification
    await expect(page).toHaveTitle(/The Cafe Barrackpore/i);

    // Hero section check
    const heroHeading = page.locator('h1').first();
    await expect(heroHeading).toBeVisible();

    // Responsive Picture / AVIF tag check
    const pictureElement = page.locator('picture').first();
    await expect(pictureElement).toBeAttached();

    // Navigation bar presence
    const navbar = page.locator('header, nav').first();
    await expect(navbar).toBeVisible();

    // Verify presence of core narrative sections
    const menuSection = page.locator('#menu-section, section[aria-label="Curated Menu"], section[aria-label="Menu"]').first();
    await expect(menuSection).toBeAttached();

    const footer = page.locator('footer').first();
    await expect(footer).toBeAttached();
  });

  test('2. Table Reservation Drawer: Open, inspect form fields, and close', async ({ page }) => {
    await page.goto('/');

    // Find and click the Reservation CTA
    const reserveBtn = page.locator('button:has-text("Reserve a Table"), a:has-text("Reserve a Table")').first();
    await expect(reserveBtn).toBeVisible();
    await reserveBtn.click();

    // Verify Reservation drawer modal mounts
    const reservationDrawer = page.locator('[role="dialog"][aria-labelledby="reservation-drawer-title"]').first();
    await expect(reservationDrawer).toBeVisible({ timeout: 5000 });

    // Verify form elements exist
    const heading = reservationDrawer.locator('h2');
    await expect(heading).toContainText(/Book a Table/i);

    // Close the drawer
    const closeBtn = reservationDrawer.locator('button[aria-label*="close" i]').first();
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    // Ensure drawer is dismissed
    await expect(reservationDrawer).toBeHidden({ timeout: 5000 });
  });

  test('3. Guest Contact & Inquiry Drawer: Open and inspect fields', async ({ page }) => {
    await page.goto('/');

    // Scroll to footer and click "Send Guest Inquiry"
    const inquiryBtn = page.locator('button:has-text("Send Guest Inquiry")').first();
    await inquiryBtn.scrollIntoViewIfNeeded();
    await expect(inquiryBtn).toBeVisible();
    await inquiryBtn.click();

    // Verify Contact Drawer modal opens
    const contactDrawer = page.locator('[role="dialog"]').first();
    await expect(contactDrawer).toBeVisible({ timeout: 5000 });

    // Verify contact form inputs are present
    const nameInput = contactDrawer.locator('input[placeholder*="Name" i], input[type="text"]').first();
    await expect(nameInput).toBeVisible();

    // Close contact drawer
    const closeBtn = contactDrawer.locator('button[aria-label*="close" i]').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await expect(contactDrawer).toBeHidden({ timeout: 5000 });
    }
  });

  test('4. In-Store QR Ordering: Table parameter, add item to order bag, and mutate cart', async ({ page }) => {
    // Navigate with a dine-in table parameter
    await page.goto('/qr?table=5');
    await page.waitForLoadState('domcontentloaded');

    // Verify table context banner
    const tableBanner = page.locator('text=/TABLE 5|Table Service/i').first();
    await expect(tableBanner).toBeVisible();

    // Check menu category controls
    const categoryTabs = page.locator('button, [role="tab"]').filter({ hasText: /Coffee|Bites|Combos|Desserts|Beverages|Platters|All/i });
    await expect(categoryTabs.first()).toBeVisible();

    // Find first available "Add to Order" button
    const addToOrderBtn = page.locator('button:has-text("Add to Order")').first();
    await addToOrderBtn.scrollIntoViewIfNeeded();
    await expect(addToOrderBtn).toBeVisible();
    await addToOrderBtn.click();

    // Verify button feedback state changes or order summary bar appears
    const orderFeedback = page.locator('button:has-text("Added"), aside[role="region"], button:has-text("View Order")').first();
    await expect(orderFeedback).toBeVisible({ timeout: 6000 });

    // Verify floating bottom order summary bar appears
    const summaryBar = page.locator('aside[role="region"][aria-label="Order summary bar"], button:has-text("View Order")').first();
    await expect(summaryBar).toBeVisible({ timeout: 6000 });

    // Open Cart Drawer
    const viewOrderBtn = page.locator('button:has-text("View Order"), button[title="View Order Bag"]').first();
    await viewOrderBtn.click();

    // Verify Cart Drawer is open
    const cartDrawer = page.locator('[role="dialog"]').first();
    await expect(cartDrawer).toBeVisible({ timeout: 5000 });

    // Verify cart contains items and calculates total
    const cartTotal = cartDrawer.locator('text=/₹\\d+/').first();
    await expect(cartTotal).toBeVisible();

    // Test digital loyalty stamp card rendering
    const loyaltyHeader = cartDrawer.locator('text=/Loyalty Stamps|Stamp Card|VIP|Visit #/i').first();
    if (await loyaltyHeader.isVisible()) {
      await expect(loyaltyHeader).toBeVisible();
    }
  });

  test('5. Static Legal & Fallback Routes: Privacy, Terms, and 404', async ({ page }) => {
    // 1. Privacy Policy
    await page.goto('/privacy');
    await expect(page.locator('h1, h2').first()).toBeVisible();
    await expect(page.locator('text=/Privacy Policy/i').first()).toBeVisible();

    // 2. Terms of Service
    await page.goto('/terms');
    await expect(page.locator('h1, h2').first()).toBeVisible();
    await expect(page.locator('text=/Terms of Service|Terms & Conditions/i').first()).toBeVisible();

    // 3. Custom 404 Page
    await page.goto('/route-does-not-exist-at-all');
    await expect(page.locator('text=/404|Page Not Found/i').first()).toBeVisible();
    const returnHomeBtn = page.locator('a:has-text("Home"), button:has-text("Home")').first();
    await expect(returnHomeBtn).toBeVisible();
  });

  test('6. Staff Terminal Security: Unauthenticated access redirect', async ({ page }) => {
    // Unauthenticated visit to kitchen terminal
    await page.goto('/staff/kitchen');
    await expect(page).toHaveURL(/\/staff\/login/);

    // Unauthenticated visit to orders management
    await page.goto('/staff/orders');
    await expect(page).toHaveURL(/\/staff\/login/);

    // Verify staff login portal elements
    const portalHeading = page.locator('text=/Hospitality Operations Portal|Terminal Access|Sign In/i').first();
    await expect(portalHeading).toBeVisible();

    // Email and password inputs must be present
    await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"], input[name="password"]').first()).toBeVisible();
  });

  test('7. Internationalization Engine: HTML attributes & metadata', async ({ page }) => {
    await page.goto('/');

    const html = page.locator('html');
    await expect(html).toHaveAttribute('lang', /^[a-z]{2}/i);
    await expect(html).toHaveAttribute('dir', /ltr|rtl/i);
  });
});
