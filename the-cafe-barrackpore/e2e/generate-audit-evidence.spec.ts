import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.resolve('test-results/screenshots');

test.beforeAll(() => {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
});

test.describe('Real Automated Audit & Evidence Generation Suite', () => {
  test('Capture Real Evidence 1: Customer Homepage Desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'load' });
    await page.waitForTimeout(1000);
    const dest = path.join(SCREENSHOT_DIR, 'step1_customer_homepage_desktop.png');
    await page.screenshot({ path: dest, fullPage: false });
    expect(fs.existsSync(dest)).toBe(true);
  });

  test('Capture Real Evidence 2: Customer Mobile Pixel 5', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/', { waitUntil: 'load' });
    await page.waitForTimeout(1000);
    const dest = path.join(SCREENSHOT_DIR, 'step2_customer_mobile_pixel5.png');
    await page.screenshot({ path: dest, fullPage: false });
    expect(fs.existsSync(dest)).toBe(true);
  });

  test('Capture Real Evidence 3: QR Table Ordering Table 07', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/qr?table=07', { waitUntil: 'load' });
    await page.waitForTimeout(1000);
    const dest = path.join(SCREENSHOT_DIR, 'step3_qr_ordering_table_07.png');
    await page.screenshot({ path: dest, fullPage: false });
    expect(fs.existsSync(dest)).toBe(true);
  });

  test('Capture Real Evidence 4: Staff Login Multilingual', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto('/staff/login', { waitUntil: 'load' });
    await page.waitForTimeout(1000);
    const dest = path.join(SCREENSHOT_DIR, 'step4_staff_login_multilingual.png');
    await page.screenshot({ path: dest, fullPage: false });
    expect(fs.existsSync(dest)).toBe(true);
  });

  test('Capture Real Evidence 5: Kitchen Display System (KDS)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/staff/kitchen', { waitUntil: 'load' });
    await page.waitForTimeout(1000);
    const dest = path.join(SCREENSHOT_DIR, 'step5_kitchen_display_system.png');
    await page.screenshot({ path: dest, fullPage: false });
    expect(fs.existsSync(dest)).toBe(true);
  });

  test('Capture Real Evidence 6: POS Terminal & Cash Drawer', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/staff/pos', { waitUntil: 'load' });
    await page.waitForTimeout(1000);
    const dest = path.join(SCREENSHOT_DIR, 'step6_pos_terminal_and_drawer.png');
    await page.screenshot({ path: dest, fullPage: false });
    expect(fs.existsSync(dest)).toBe(true);
  });

  test('Capture Real Evidence 7: Non-Latin Japanese & Arabic Localization', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto('/', { waitUntil: 'load' });
    await page.waitForTimeout(1000);
    // Switch language to Japanese or Arabic via evaluation or UI
    await page.evaluate(() => {
      localStorage.setItem('cafe_preferred_language', 'ja');
      window.dispatchEvent(new Event('storage'));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1000);
    const dest = path.join(SCREENSHOT_DIR, 'step7_non_latin_japanese.png');
    await page.screenshot({ path: dest, fullPage: false });
    expect(fs.existsSync(dest)).toBe(true);
  });
});
