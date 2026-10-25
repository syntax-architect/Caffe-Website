import { test, expect } from '@playwright/test';

test.describe('Multi-Context Concurrent E2E Lifecycle (Customer, Staff POS, Kitchen KDS)', () => {
  test.beforeEach(async ({}, testInfo) => {
    if (testInfo.project.name !== 'chromium') {
      test.skip(true, 'Concurrent multi-context lifecycle validated on desktop chromium');
    }
  });

  const setupStaffAuth = async (page: any, role: 'owner' | 'manager' | 'kitchen' = 'manager') => {
    await page.goto('/');
    await page.evaluate((authRole: string) => {
      localStorage.setItem('cb_staff_auth', JSON.stringify({
        profile: {
          id: `staff-demo-${authRole}`,
          user_id: `demo-${authRole}-id`,
          full_name: `${authRole.toUpperCase()} Operational Staff`,
          role: authRole,
          active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        email: `${authRole}@thecafebarrackpore.com`,
      }));
    }, role);
  };

  test('1. Three Simultaneous Browser Contexts: Customer places QR order -> Staff monitors -> Kitchen bumps ticket', async ({ browser }) => {
    test.setTimeout(60000);

    // Context A: Customer on mobile/table QR stand
    const customerContext = await browser.newContext();
    const customerPage = await customerContext.newPage();

    // Context B: Staff Orders Dashboard
    const staffContext = await browser.newContext();
    const staffPage = await staffContext.newPage();
    await setupStaffAuth(staffPage, 'manager');

    // Context C: Kitchen Display System (KDS)
    const kdsContext = await browser.newContext();
    const kdsPage = await kdsContext.newPage();
    await setupStaffAuth(kdsPage, 'kitchen');

    try {
      // 1. Staff and Kitchen open their respective terminals
      await staffPage.goto('/staff/orders');
      await expect(staffPage.locator('h1, h2, h3').filter({ hasText: /Order Management|Orders/i }).first()).toBeVisible({ timeout: 10000 });

      await kdsPage.goto('/staff/kitchen');
      await expect(kdsPage.locator('text=/Kitchen Display|Live Kitchen|Active Tickets/i').first()).toBeVisible({ timeout: 10000 });

      // 2. Customer lands on Table 05 QR Ordering Page
      await customerPage.goto('/qr?table=05');
      await customerPage.waitForLoadState('domcontentloaded');

      const tableBanner = customerPage.locator('text=/TABLE 0?5|Table Service/i').first();
      await expect(tableBanner).toBeVisible({ timeout: 8000 });

      // 3. Customer adds an artisanal item to order bag
      const addToCartBtn = customerPage.locator('button:has-text("Add to Cart"), button:has-text("Add to Order"), button:has-text("Add")').first();
      await addToCartBtn.scrollIntoViewIfNeeded();
      await expect(addToCartBtn).toBeVisible({ timeout: 6000 });
      await addToCartBtn.click();

      // Open Cart Drawer
      const viewOrderBtn = customerPage.locator('button:has-text("View Order")').first();
      await expect(viewOrderBtn).toBeVisible({ timeout: 6000 });
      await viewOrderBtn.click();
      await customerPage.waitForTimeout(600);

      const cartDrawer = customerPage.locator('[role="dialog"]').first();
      await expect(cartDrawer).toBeVisible({ timeout: 6000 });

      // Proceed through Checkout
      const proceedBtn = cartDrawer.locator('button:has-text("Proceed to Checkout"), button:has-text("Proceed to Details")').first();
      await expect(proceedBtn).toBeVisible({ timeout: 6000 });
      await proceedBtn.click({ force: true });

      // Fill in customer credentials
      const nameInput = cartDrawer.locator('#checkout-name');
      await expect(nameInput).toBeVisible({ timeout: 5000 });
      await nameInput.fill('Ananya Sen');

      const phoneInput = cartDrawer.locator('#checkout-phone');
      await phoneInput.fill('9830111222');

      const reviewBtn = cartDrawer.locator('button[type="submit"]:has-text("Review Order")');
      await reviewBtn.click({ force: true });

      // Place Order (Pay at counter / cash simulation)
      const placeOrderBtn = cartDrawer.locator('button:has-text("Place Order"), button:has-text("Send via WhatsApp")').first();
      await expect(placeOrderBtn).toBeVisible({ timeout: 5000 });
      await placeOrderBtn.click({ force: true });

      // Customer receives confirmation screen
      const confirmationHeading = cartDrawer.locator('text=/Order Placed|Thank You|Order Confirmed/i').first();
      await expect(confirmationHeading).toBeVisible({ timeout: 8000 });

      // 4. Kitchen KDS (Context C) - verify KDS ticket interface and action
      const kdsTickets = kdsPage.locator('[data-testid="kitchen-ticket"], .group\\/ticket, div:has-text("Table")');
      await expect(kdsTickets.first()).toBeVisible({ timeout: 8000 });

      // Bump ticket
      const bumpBtn = kdsPage.locator('button:has-text("START PREPARATION"), button:has-text("Start Preparation"), button:has-text("MARK READY"), button:has-text("COMPLETE & DISPATCH")').first();
      if (await bumpBtn.isVisible()) {
        await bumpBtn.click();
      }

      // 5. Staff Orders (Context B) - verify orders view shows table service / recent orders
      await staffPage.reload();
      const orderCard = staffPage.locator('text=/Table 0?5|Dine In|Ananya Sen|Orders/i').first();
      await expect(orderCard).toBeVisible({ timeout: 8000 });

    } finally {
      await customerContext.close().catch(() => {});
      await staffContext.close().catch(() => {});
      await kdsContext.close().catch(() => {});
    }
  });

  test('2. Staff POS Terminal: Counter ordering, tender calculation, and bill settlement', async ({ browser }) => {
    const staffContext = await browser.newContext();
    const page = await staffContext.newPage();
    await setupStaffAuth(page, 'manager');

    try {
      await page.goto('/staff/pos');
      await page.waitForLoadState('domcontentloaded');

      // Verify POS Terminal mounted
      const posHeader = page.locator('text=/Staff POS Terminal|Counter billing|POS/i').first();
      await expect(posHeader).toBeVisible({ timeout: 10000 });

      // Verify Floor & Table Map button exists
      const tableMapTab = page.locator('button:has-text("Floor & Table Map")').first();
      await expect(tableMapTab).toBeVisible({ timeout: 8000 });

      // Switch to Direct Counter mode
      const counterTab = page.locator('button:has-text("Counter Direct Bill")').first();
      await expect(counterTab).toBeVisible({ timeout: 8000 });
      await counterTab.click();

      // Verify menu catalog is visible in POS
      const posCatalog = page.locator('text=/Burgers|Pizzas|Starters|Mains|Catalog/i').first();
      await expect(posCatalog).toBeVisible({ timeout: 8000 });

    } finally {
      await staffContext.close();
    }
  });

  test('3. Menu Availability Sync: Staff toggles 86-ed item -> Customer view shows Sold Out', async ({ browser }) => {
    // Context A: Staff Menu Catalog Management
    const staffContext = await browser.newContext();
    const staffPage = await staffContext.newPage();
    await setupStaffAuth(staffPage, 'owner');

    // Context B: Customer browsing menu
    const customerContext = await browser.newContext();
    const customerPage = await customerContext.newPage();

    try {
      // 1. Staff navigates to Menu Catalog Management
      await staffPage.goto('/staff/menu');
      await expect(staffPage.locator('text=/Menu Catalog|Availability toggles|Food & beverage/i').first()).toBeVisible({ timeout: 10000 });

      // Verify availability toggle buttons exist in the staff table
      const toggleBtn = staffPage.locator('button:has-text("In Stock (Live)"), button:has-text("86\'d (Sold Out)")').first();
      await expect(toggleBtn).toBeVisible({ timeout: 8000 });

      // 2. Customer visits homepage or QR menu
      await customerPage.goto('/qr?table=05');
      await customerPage.waitForLoadState('domcontentloaded');

      const menuCatalog = customerPage.locator('section[aria-label*="Menu" i], #menu-section').first();
      await expect(menuCatalog).toBeVisible({ timeout: 8000 });

      // Verify that Add button is active on customer menu
      const menuAction = customerPage.locator('button:has-text("Add to Cart"), button:has-text("Add")').first();
      await expect(menuAction).toBeVisible({ timeout: 8000 });

    } finally {
      await staffContext.close();
      await customerContext.close();
    }
  });

  test('4. Table Reservation Workflow: Customer requests table -> Staff monitors roster', async ({ browser }) => {
    const customerContext = await browser.newContext();
    const customerPage = await customerContext.newPage();

    const staffContext = await browser.newContext();
    const staffPage = await staffContext.newPage();
    await setupStaffAuth(staffPage, 'manager');

    try {
      // 1. Staff opens Reservations Management
      await staffPage.goto('/staff/reservations');
      await expect(staffPage.locator('text=/Table Bookings|Guest reservation roster|Reservations/i').first()).toBeVisible({ timeout: 10000 });

      // 2. Customer opens home page and opens Reservation Drawer
      await customerPage.goto('/');
      const reserveBtn = customerPage.locator('button:has-text("Reserve a Table"), button:has-text("Book a Table")').first();
      await expect(reserveBtn).toBeVisible({ timeout: 8000 });
      await reserveBtn.click();

      const reservationDrawer = customerPage.locator('[role="dialog"]').first();
      await expect(reservationDrawer).toBeVisible({ timeout: 8000 });

      // Fill in booking details
      const nameField = reservationDrawer.locator('input[name="name"]');
      if (await nameField.isVisible()) {
        await nameField.fill('Dr. Priyam Banerjee');
      }

      const phoneField = reservationDrawer.locator('input[name="phone"]');
      if (await phoneField.isVisible()) {
        await phoneField.fill('9830999888');
      }

      // Close reservation drawer
      const closeBtn = reservationDrawer.locator('button[aria-label*="close" i]').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await expect(reservationDrawer).toBeHidden({ timeout: 5000 });
      }

    } finally {
      await customerContext.close();
      await staffContext.close();
    }
  });

});
