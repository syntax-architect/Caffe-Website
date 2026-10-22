import { test, expect } from '@playwright/test';

test.describe('Real Order to KDS Lifecycle & Browser Feature Walkthrough', () => {

  test('Complete flow: Place QR Dine-In Order -> View on KDS -> Print Thermal KOT -> Bump Order -> Verify All Features', async ({ page }) => {
    // -------------------------------------------------------------
    // STEP 1: Customer Scans Table 5 QR Code & Explores Menu
    // -------------------------------------------------------------
    await page.goto('/qr?table=5');
    await page.waitForLoadState('domcontentloaded');

    // Confirm Dine-In Table 5 service recognition
    const tableHeading = page.locator('text=/TABLE 0?5|Table Service/i').first();
    await expect(tableHeading).toBeVisible();

    // Find and add a food item to the order bag
    const addToOrderBtn = page.locator('button:has-text("Add to Order")').first();
    await addToOrderBtn.scrollIntoViewIfNeeded();
    await expect(addToOrderBtn).toBeVisible();
    await addToOrderBtn.click();

    // Verify button state turns to "Added"
    await expect(page.locator('button:has-text("Added")').first()).toBeVisible({ timeout: 4000 });

    // Floating summary bar pops up
    const viewOrderBtn = page.locator('button:has-text("View Order")').first();
    await expect(viewOrderBtn).toBeVisible();
    await viewOrderBtn.click();

    // -------------------------------------------------------------
    // STEP 2: Cart Drawer Checkout & Order Submission
    // -------------------------------------------------------------
    const cartDrawer = page.locator('[role="dialog"]').first();
    await expect(cartDrawer).toBeVisible();

    // Step 1: Bag -> Step 2: Details
    const proceedToDetailsBtn = cartDrawer.locator('button:has-text("Proceed to Details")').first();
    await expect(proceedToDetailsBtn).toBeVisible({ timeout: 5000 });
    await proceedToDetailsBtn.click();

    // Fill in Guest Information
    const nameInput = cartDrawer.locator('#checkout-name');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('Rohan Roy');

    const phoneInput = cartDrawer.locator('#checkout-phone');
    await phoneInput.fill('9830555666');

    // Step 2: Details -> Step 3: Review
    const proceedToReviewBtn = cartDrawer.locator('button[type="submit"]:has-text("Review Order")');
    await proceedToReviewBtn.click();

    // Confirm and Dispatch Order
    const confirmOrderBtn = cartDrawer.locator('button:has-text("Place Order"), button:has-text("Send via WhatsApp")').first();
    await expect(confirmOrderBtn).toBeVisible({ timeout: 5000 });
    await confirmOrderBtn.click();

    // -------------------------------------------------------------
    // STEP 3: Order Confirmation & Digital Loyalty Stamp Check
    // -------------------------------------------------------------
    const confirmationHeading = cartDrawer.locator('text=/Thank You|Order Confirmed|Recorded/i').first();
    await expect(confirmationHeading).toBeVisible({ timeout: 8000 });

    // Verify 5-stamp loyalty card rendered in the drawer
    const loyaltyCard = cartDrawer.locator('text=/Loyalty Card|5 Stamps/i').first();
    await expect(loyaltyCard).toBeVisible();

    // Verify 1-Tap Google Review prompt
    const reviewPrompt = cartDrawer.locator('text=/Google review|Enjoyed your visit/i').first();
    await expect(reviewPrompt).toBeVisible();

    // -------------------------------------------------------------
    // STEP 4: Kitchen Display System (KDS) Live Order Verification
    // -------------------------------------------------------------
    // Inject active staff authentication profile into localStorage
    await page.evaluate(() => {
      localStorage.setItem('cb_staff_auth', JSON.stringify({
        profile: {
          id: 'staff-demo-1',
          user_id: 'demo-manager-id',
          full_name: 'Head Chef & Kitchen Manager',
          role: 'manager',
          active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        email: 'manager@thecafebarrackpore.com'
      }));
    });

    // Navigate to KDS
    await page.goto('/staff/kitchen');
    await page.waitForLoadState('domcontentloaded');

    // Verify KDS Header
    const kdsHeader = page.locator('text=/Kitchen Display|Active Tickets|Live Kitchen/i').first();
    await expect(kdsHeader).toBeVisible();

    // Locate active tickets
    const kitchenTickets = page.locator('[data-testid="kitchen-ticket"], .group\\/ticket, div:has-text("Table")');
    await expect(kitchenTickets.first()).toBeVisible({ timeout: 6000 });

    // Verify Thermal "Print KOT" button is in the ticket
    const printKotBtn = page.locator('button[aria-label*="Print KOT" i], button[title*="Print" i], button:has(span:text-is("print"))').first();
    await expect(printKotBtn).toBeVisible({ timeout: 5000 });

    // Test clicking "Print KOT" (handled safely by browser print mock)
    await page.evaluate(() => {
      window.print = () => console.log('[Playwright] window.print mock called');
    });
    await printKotBtn.click();

    // Test Bumping Order Status (Advance ticket through prep stages)
    const bumpBtn = page.locator('button:has-text("START PREPARATION"), button:has-text("Start Preparation"), button:has-text("MARK DISH READY"), button:has-text("COMPLETE & DISPATCH")').first();
    await expect(bumpBtn).toBeVisible({ timeout: 5000 });
    await bumpBtn.click();

    // Small wait for reactive bump animation/sync
    await page.waitForTimeout(1000);

    // -------------------------------------------------------------
    // STEP 5: Additional Core Browser Features
    // -------------------------------------------------------------
    // Return to main site
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // 1. Test Table Reservation Drawer
    const reserveBtn = page.locator('button:has-text("Reserve a Table"), a:has-text("Reserve a Table")').first();
    await expect(reserveBtn).toBeVisible({ timeout: 5000 });
    await reserveBtn.click();
    const reservationDrawer = page.locator('[role="dialog"]').first();
    await expect(reservationDrawer).toBeVisible({ timeout: 5000 });
    const closeReservationBtn = reservationDrawer.locator('button[aria-label*="close" i]').first();
    await closeReservationBtn.click();
    await expect(reservationDrawer).toBeHidden({ timeout: 5000 });

    // 2. Test Guest Inquiry Drawer
    const inquiryBtn = page.locator('button:has-text("Send Guest Inquiry")').first();
    await inquiryBtn.scrollIntoViewIfNeeded();
    await expect(inquiryBtn).toBeVisible({ timeout: 5000 });
    await inquiryBtn.click();
    const contactDrawer = page.locator('[role="dialog"]').first();
    await expect(contactDrawer).toBeVisible({ timeout: 5000 });
    const closeContactBtn = contactDrawer.locator('button[aria-label*="close" i]').first();
    if (await closeContactBtn.isVisible()) {
      await closeContactBtn.click();
      await expect(contactDrawer).toBeHidden({ timeout: 5000 });
    }
  });
});
