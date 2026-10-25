import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';

const TARGET_WIDTHS = [1280, 1366, 1440, 1920, 768, 390];

const PAGES_TO_AUDIT = [
  { name: 'homepage', path: '/' },
  { name: 'menu', path: '/?view=menu' },
  { name: 'qr-ordering', path: '/qr?table=07' },
  { name: 'privacy', path: '/privacy' },
  { name: 'terms', path: '/terms' },
  { name: 'not-found', path: '/404' },
  { name: 'staff-login', path: '/staff/login' },
  { name: 'kitchen-display', path: '/staff/kitchen' },
  { name: 'dashboard', path: '/staff/dashboard' },
];

test.describe('Comprehensive Visual, Accessibility & Quality Audit across All Pages', () => {
  test.beforeAll(async () => {
    const screenshotDir = path.resolve(process.cwd(), 'test-results', 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
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
  });

  for (const pageItem of PAGES_TO_AUDIT) {
    for (const width of TARGET_WIDTHS) {
      test(`[${pageItem.name}] at ${width}px — zero icon fallbacks, zero raw entities, zero repeated phrases, zero overflow, zero contrast errors, zero console errors`, async ({
        page,
      }, testInfo) => {
        if (testInfo.project.name !== 'chromium') {
          test.skip(true, 'Targeted width matrix is fully validated under Desktop Chromium engine');
        }

        const consoleErrors: string[] = [];
        page.on('console', (msg) => {
          if (msg.type() === 'error') {
            const txt = msg.text();
            if (!txt.includes('favicon') && !txt.includes('Failed to load resource')) {
              consoleErrors.push(txt);
            }
          }
        });
        page.on('pageerror', (err) => {
          consoleErrors.push(err.message);
        });

        const height = width <= 768 ? (width === 390 ? 844 : 1024) : 900;
        await page.setViewportSize({ width, height });
        await page.emulateMedia({ reducedMotion: 'reduce' });

        // Navigate
        await page.goto(pageItem.path, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1200);

        // Wait for font ready
        await page.evaluate(async () => {
          try {
            await document.fonts.load('24px "Material Symbols Outlined"');
            await document.fonts.ready;
          } catch {
            // ignore
          }
        });

        // 1. Console Errors Assertion
        expect(consoleErrors, `Console errors on ${pageItem.name} at ${width}px`).toEqual([]);

        // 2. Horizontal Overflow Assertion (Zero horizontal scrollbar at 6 widths)
        const overflow = await page.evaluate(() => {
          const docW = document.documentElement.scrollWidth;
          const bodyW = document.body.scrollWidth;
          const winW = window.innerWidth;
          const maxW = Math.max(docW, bodyW);
          return {
            maxW,
            winW,
            overflowPx: Math.max(0, maxW - winW),
          };
        });
        expect(
          overflow.overflowPx,
          `Horizontal scroll overflow detected on ${pageItem.name} at ${width}px (${overflow.overflowPx}px)`
        ).toBeLessThanOrEqual(1);

        // 3. Icon-font Text Fallbacks Assertion (Ligatures must not render as plain text strings)
        const brokenIcons = await page.evaluate(() => {
          const elements = Array.from(document.querySelectorAll('.material-symbols-outlined, [class*="material-symbols"]'));
          const errors: string[] = [];
          for (const el of elements) {
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) continue;
            const text = (el.textContent || '').trim();
            if (!text) continue;
            const fontSize = parseFloat(style.fontSize) || 24;
            // If rendered as ASCII characters instead of ligature glyph, width is vastly wider than font-size
            if (text.length >= 3 && rect.width > fontSize * 2.2) {
              errors.push(`Broken icon text fallback: "${text}" (width: ${rect.width}px vs font-size: ${fontSize}px)`);
            }
          }
          return errors;
        });
        expect(brokenIcons, `Icon fallback errors on ${pageItem.name} at ${width}px`).toEqual([]);

        // 4. Raw HTML Entities Assertion (Zero &amp;, &lt;, &gt;, &#\d+; rendered to user)
        const rawEntities = await page.evaluate(() => {
          const text = document.body.innerText;
          const issues: string[] = [];
          const matches = text.matchAll(/(&amp;|&lt;|&gt;|&#\d+;)/g);
          for (const m of matches) {
            issues.push(`Found raw entity literal in UI text: "${m[1]}"`);
          }
          return issues;
        });
        expect(rawEntities, `Raw HTML entity literals on ${pageItem.name} at ${width}px`).toEqual([]);

        // 5. Repeated Phrases Assertion (Zero duplicate consecutive phrases in headings)
        const duplicatePhrases = await page.evaluate(() => {
          const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
          const issues: string[] = [];
          for (const h of headings) {
            const txt = (h.textContent || '').trim().replace(/\s+/g, ' ');
            if (!txt || txt.length < 10) continue;
            const words = txt.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
            for (let i = 0; i < words.length - 3; i++) {
              const phrase = words.slice(i, i + 2).join(' ');
              const remainder = words.slice(i + 2).join(' ');
              if (remainder.startsWith(phrase)) {
                issues.push(`Repeated phrase "${phrase}" in: "${txt}"`);
              }
            }
          }
          return issues;
        });
        expect(duplicatePhrases, `Duplicate repeated phrases in headings on ${pageItem.name} at ${width}px`).toEqual([]);

        // 6. Axe-Core WCAG AA Color Contrast Violations Assertion
        const axeResults = await new AxeBuilder({ page })
          .withTags(['wcag2aa'])
          .withRules(['color-contrast'])
          .analyze();
        expect(
          axeResults.violations,
          `Axe-core color contrast violations on ${pageItem.name} at ${width}px: ${JSON.stringify(axeResults.violations, null, 2)}`
        ).toEqual([]);

        // 7. Capture and save committed screenshot
        const screenshotPath = path.resolve(
          process.cwd(),
          'test-results',
          'screenshots',
          `audit-${pageItem.name}-${width}px.png`
        );
        await page.screenshot({ path: screenshotPath, fullPage: false });
        expect(fs.existsSync(screenshotPath)).toBe(true);
      });
    }
  }
});
