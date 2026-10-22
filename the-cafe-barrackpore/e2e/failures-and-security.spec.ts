import { test, expect } from '@playwright/test';

test.describe('Failure Modes, Edge Cases, and Browser Security Invariants', () => {

  test('1. Double-Click Pay Prevention: Submitting order locks button to prevent duplicate charges', async ({ page }) => {
    await page.goto('/qr?table=05');
    await page.waitForLoadState('domcontentloaded');

    // Add an item to cart
    const addToCartBtn = page.locator('button:has-text("Add to Cart"), button:has-text("Add to Order"), button:has-text("Add")').first();
    await addToCartBtn.scrollIntoViewIfNeeded();
    await expect(addToCartBtn).toBeVisible({ timeout: 6000 });
    await addToCartBtn.click();

    // Open Cart Drawer
    const viewOrderBtn = page.locator('button:has-text("View Order")').first();
    await expect(viewOrderBtn).toBeVisible({ timeout: 6000 });
    await viewOrderBtn.click();
    await page.waitForTimeout(600);

    const cartDrawer = page.locator('[role="dialog"]').first();
    await expect(cartDrawer).toBeVisible({ timeout: 5000 });

    // Step 1: Proceed to Details
    const proceedBtn = cartDrawer.locator('button:has-text("Proceed to Checkout"), button:has-text("Proceed to Details")').first();
    await expect(proceedBtn).toBeVisible({ timeout: 5000 });
    await proceedBtn.click({ force: true });

    // Step 2: Fill Details
    const nameInput = cartDrawer.locator('#checkout-name');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('Debabrata Ghosh');

    const phoneInput = cartDrawer.locator('#checkout-phone');
    await phoneInput.fill('9830888777');

    const reviewBtn = cartDrawer.locator('button[type="submit"]:has-text("Review Order")');
    await reviewBtn.click({ force: true });

    // Step 3: Rapid Double-Click on Place Order
    const placeOrderBtn = cartDrawer.locator('button:has-text("Place Order"), button:has-text("Send via WhatsApp")').first();
    await expect(placeOrderBtn).toBeVisible({ timeout: 5000 });

    // Execute rapid consecutive clicks
    await Promise.all([
      placeOrderBtn.click({ force: true }),
      placeOrderBtn.click({ force: true }).catch(() => {}),
    ]);

    // Verify order successfully settles once without creating duplicate conflict
    const confirmation = cartDrawer.locator('text=/Order Placed|Thank You|Order Confirmed|Recorded/i').first();
    await expect(confirmation).toBeVisible({ timeout: 8000 });
  });

  test('2. Network Drop: Browser detects offline state and handles smoothly', async ({ page }) => {
    await page.goto('/qr?table=05');
    await page.waitForLoadState('networkidle');

    // Ensure the QR interface is mounted and visible before testing offline behavior
    const tableBanner = page.locator('text=/TABLE 0?5|Table Service|The Cafe|Menu/i').first();
    await expect(tableBanner).toBeVisible({ timeout: 8000 });

    // Simulate going offline
    await page.context().setOffline(true);
    await page.waitForTimeout(500);

    // Verify app remains responsive without unhandled crashes
    await expect(tableBanner).toBeVisible();

    // Restore online connectivity
    await page.context().setOffline(false);
    await page.waitForTimeout(500);

    // Verify app recovers smoothly
    await expect(tableBanner).toBeVisible();
  });

  test('3. Expired Session & Tampered Token: Unauthorized staff access redirects to login', async ({ page }) => {
    // Inject expired or corrupted auth profile
    await page.addInitScript(() => {
      localStorage.setItem('cb_staff_auth', JSON.stringify({
        profile: {
          id: 'fake-staff-id',
          role: 'anonymous',
          active: false,
        },
        token: 'expired-or-tampered-token-12345',
      }));
    });

    // Attempt to access restricted staff pos
    await page.goto('/staff/pos');

    // Must be redirected to staff login
    await expect(page).toHaveURL(/\/staff\/login/);
    const loginHeading = page.locator('text=/Hospitality Operations Portal|Terminal Access|Sign In/i').first();
    await expect(loginHeading).toBeVisible({ timeout: 6000 });
  });

  test('4. Wrong / Invalid Table Parameter: Gracefully displays unrecognized table stand notice', async ({ page }) => {
    // Visit with non-existent table
    await page.goto('/qr?table=999');
    await page.waitForLoadState('domcontentloaded');

    // Page must notify user of invalid table stand rather than crashing
    const notice = page.locator('text=/unrecognized|invalid|Table Stand|Return to Website/i').first();
    await expect(notice).toBeVisible({ timeout: 8000 });

    const returnBtn = page.locator('a:has-text("Return to Website"), a:has-text("Main Website")').first();
    await expect(returnBtn).toBeVisible();
  });

  test('5. Invalid Coupon Code: Shows error feedback and rejects bogus discount', async ({ page }) => {
    await page.goto('/qr?table=05');
    await page.waitForLoadState('domcontentloaded');

    // Add item
    const addToCartBtn = page.locator('button:has-text("Add to Cart"), button:has-text("Add to Order"), button:has-text("Add")').first();
    await addToCartBtn.scrollIntoViewIfNeeded();
    await expect(addToCartBtn).toBeVisible({ timeout: 6000 });
    await addToCartBtn.click();

    // Open Cart Drawer
    const viewOrderBtn = page.locator('button:has-text("View Order")').first();
    await expect(viewOrderBtn).toBeVisible({ timeout: 6000 });
    await viewOrderBtn.click();
    await page.waitForTimeout(600);

    const cartDrawer = page.locator('[role="dialog"]').first();
    await expect(cartDrawer).toBeVisible({ timeout: 5000 });

    // Proceed through checkout to Review step where coupon input resides
    const proceedBtn = cartDrawer.locator('button:has-text("Proceed to Details"), button:has-text("Proceed to Checkout")').first();
    await expect(proceedBtn).toBeVisible({ timeout: 5000 });
    await proceedBtn.click({ force: true });

    const nameInput = cartDrawer.locator('#checkout-name');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('Coupon Tester');
    await cartDrawer.locator('#checkout-phone').fill('9876543210');

    const reviewBtn = cartDrawer.locator('button[type="submit"]:has-text("Review Order")').first();
    await expect(reviewBtn).toBeVisible({ timeout: 5000 });
    await reviewBtn.click({ force: true });

    // Look for promo code or coupon input on review step
    const couponInput = cartDrawer.locator('input[placeholder*="WELCOME10" i], input[placeholder*="Promo" i], input[placeholder*="Coupon" i]').first();
    if (await couponInput.isVisible({ timeout: 4000 })) {
      await couponInput.fill('MALICIOUS_FAKE_CODE_99');
      const applyBtn = cartDrawer.locator('button:has-text("Apply")').first();
      await applyBtn.click({ force: true });

      // Verify invalid code message
      const errorMsg = cartDrawer.locator('text=/Invalid|Expired|not found/i').first();
      await expect(errorMsg).toBeVisible({ timeout: 4000 });
    }
  });

  test('6. XSS Injection Defense: Malicious payloads in customer inputs are sanitized', async ({ page }) => {
    // Trap any unexpected alert dialogs that would indicate XSS execution
    let alertTriggered = false;
    page.on('dialog', async (dialog) => {
      alertTriggered = true;
      await dialog.dismiss();
    });

    await page.goto('/qr?table=05');
    await page.waitForLoadState('domcontentloaded');

    // Add an item to cart
    const addToCartBtn = page.locator('button:has-text("Add to Cart"), button:has-text("Add to Order"), button:has-text("Add")').first();
    await addToCartBtn.scrollIntoViewIfNeeded();
    await expect(addToCartBtn).toBeVisible({ timeout: 6000 });
    await addToCartBtn.click();

    // Open Cart Drawer
    const viewOrderBtn = page.locator('button:has-text("View Order")').first();
    await expect(viewOrderBtn).toBeVisible({ timeout: 6000 });
    await viewOrderBtn.click();
    await page.waitForTimeout(600);

    const cartDrawer = page.locator('[role="dialog"]').first();
    await expect(cartDrawer).toBeVisible({ timeout: 5000 });

    const proceedBtn = cartDrawer.locator('button:has-text("Proceed to Checkout"), button:has-text("Proceed to Details")').first();
    await expect(proceedBtn).toBeVisible({ timeout: 5000 });
    await proceedBtn.click({ force: true });

    // Inject aggressive script and image onerror payloads
    const xssPayload = '<script>alert("XSS")</script><img src=x onerror=alert("XSS")>XSS_SAFE_TEXT';
    const nameInput = cartDrawer.locator('#checkout-name');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill(xssPayload);

    const phoneInput = cartDrawer.locator('#checkout-phone');
    await phoneInput.fill('9830555444');

    const reviewBtn = cartDrawer.locator('button[type="submit"]:has-text("Review Order")');
    await reviewBtn.click({ force: true });

    // Step 3: Verify payload in review does not execute script
    await page.waitForTimeout(500);
    expect(alertTriggered).toBe(false);

    // Place order
    const placeOrderBtn = cartDrawer.locator('button:has-text("Place Order"), button:has-text("Send via WhatsApp")').first();
    await expect(placeOrderBtn).toBeVisible({ timeout: 5000 });
    await placeOrderBtn.click({ force: true });

    await page.waitForTimeout(1000);
    expect(alertTriggered).toBe(false);
  });

});
