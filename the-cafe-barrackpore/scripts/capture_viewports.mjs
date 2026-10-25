import { chromium } from '@playwright/test';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/Pc/.gemini/antigravity/brain/4dd0dfe2-9331-4d4a-8ef2-df3bfd3dffab';
const BASE_URL = process.env.BASE_URL || 'http://localhost:5175';
const prefix = process.argv[2] || 'after';

async function capture() {
  console.log(`Starting viewport capture with prefix "${prefix}" against ${BASE_URL}...`);
  const browser = await chromium.launch({ headless: true });

  const viewports = [
    { width: 390, height: 844, name: '390' },
    { width: 768, height: 1024, name: '768' },
    { width: 1366, height: 768, name: '1366' },
    { width: 1920, height: 1080, name: '1920' },
  ];

  for (const vp of viewports) {
    console.log(`Capturing customer site at ${vp.width}x${vp.height}...`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    // 1. Hero / Main page top
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1600);
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, `${prefix}_${vp.name}.png`),
      fullPage: false,
    });
    console.log(`  -> ${prefix}_${vp.name}.png`);

    // 2. Our Spaces / About section
    const aboutSection = page.locator('#about-and-vibe');
    if (await aboutSection.count() > 0) {
      await aboutSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, `${prefix}_${vp.name}_about.png`),
        fullPage: false,
      });
      console.log(`  -> ${prefix}_${vp.name}_about.png`);
    }

    // 3. Menu section
    const menuSection = page.locator('#menu-section');
    if (await menuSection.count() > 0) {
      await menuSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, `${prefix}_${vp.name}_menu.png`),
        fullPage: false,
      });
      console.log(`  -> ${prefix}_${vp.name}_menu.png`);
    }

    await context.close();
  }

  // Capture Dashboard
  console.log(`Capturing dashboard at 1366x768...`);
  const dashContext = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1,
  });
  const dashPage = await dashContext.newPage();
  await dashPage.goto(`${BASE_URL}/staff/dashboard`, { waitUntil: 'networkidle' });
  await dashPage.waitForTimeout(1600);
  await dashPage.screenshot({
    path: path.join(ARTIFACT_DIR, `${prefix}_dashboard.png`),
    fullPage: false,
  });
  console.log(`  -> ${prefix}_dashboard.png`);
  await dashContext.close();

  await browser.close();
  console.log('Capture complete!');
}

capture().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
