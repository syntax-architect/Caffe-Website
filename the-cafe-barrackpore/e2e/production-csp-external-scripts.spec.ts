import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import http from 'node:http';

let previewProcess: ChildProcess | null = null;
const PREVIEW_PORT = 4173;
const PREVIEW_URL = `http://localhost:${PREVIEW_PORT}`;

// Helper to poll until preview server is responding
async function waitForServer(url: string, timeoutMs = 25000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.get(url, (res) => {
          if (res.statusCode && res.statusCode < 500) {
            resolve();
          } else {
            reject(new Error(`Status ${res.statusCode}`));
          }
        });
        req.on('error', reject);
        req.setTimeout(1000, () => {
          req.destroy();
          reject(new Error('Timeout'));
        });
      });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw new Error(`Preview server at ${url} did not respond within ${timeoutMs}ms`);
}

test.beforeAll(async () => {
  // Check if preview server is already running
  try {
    await waitForServer(PREVIEW_URL, 1500);
    console.log(`[Preview] Existing server detected on ${PREVIEW_URL}`);
    return;
  } catch {
    // Need to launch preview server
  }

  const isWin = process.platform === 'win32';
  const npxCmd = isWin ? 'npx.cmd' : 'npx';
  const rootDir = process.cwd();

  console.log(`[Preview] Launching vite preview on port ${PREVIEW_PORT}...`);
  previewProcess = spawn(npxCmd, ['vite', 'preview', '--port', String(PREVIEW_PORT), '--host'], {
    cwd: rootDir,
    stdio: 'pipe',
    shell: true,
    env: {
      ...process.env,
      VITE_CLIENT_MODE: 'production',
    },
  });

  previewProcess.stdout?.on('data', (d) => {
    const msg = d.toString();
    if (msg.includes('Local:')) {
      console.log(`[Preview Server] ${msg.trim()}`);
    }
  });

  previewProcess.stderr?.on('data', (d) => {
    console.error(`[Preview Error] ${d.toString().trim()}`);
  });

  await waitForServer(PREVIEW_URL, 25000);
  console.log(`[Preview] Server successfully ready on ${PREVIEW_URL}`);
});

test.afterAll(async () => {
  if (previewProcess && previewProcess.pid) {
    console.log('[Preview] Shutting down preview server...');
    if (process.platform === 'win32') {
      try {
        spawn('taskkill', ['/pid', String(previewProcess.pid), '/f']);
      } catch {
        // ignore
      }
    } else {
      previewProcess.kill('SIGTERM');
    }
    previewProcess = null;
  }
});

test.describe('Production Preview CSP & External Integration Audit', () => {
  test.describe.configure({ mode: 'serial' });
  test('1. Preview server emits strict production Content-Security-Policy header', async () => {
    const res = await new Promise<{ headers: http.IncomingHttpHeaders; statusCode?: number }>((resolve, reject) => {
      const req = http.get(PREVIEW_URL, (r) => {
        resolve({ headers: r.headers, statusCode: r.statusCode });
      });
      req.on('error', reject);
    });

    expect(res.statusCode).toBe(200);
    const csp = (res.headers['content-security-policy'] as string) || '';
    expect(csp).toBeTruthy();

    console.log(`[Verified CSP Header]: ${csp.substring(0, 120)}...`);

    // Invariant: Critical external providers MUST be whitelisted in CSP
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain('https://challenges.cloudflare.com');
    expect(csp).toContain('https://js.stripe.com');
    expect(csp).toContain('https://checkout.razorpay.com');
    expect(csp).toContain('https://cdn.razorpay.com');
    expect(csp).toContain('https://maps.google.com');
    expect(csp).toContain('https://*.supabase.co');
  });

  const routesToTest = [
    { name: 'Customer Home & Landing', path: '/' },
    { name: 'Menu & Catalogue', path: '/?view=menu' },
    { name: 'QR Table Ordering Interface', path: '/?table=T1' },
    { name: 'Staff Operations Login', path: '/?staff=login' },
    { name: 'Kitchen Display App (KDS)', path: '/?view=kitchen' },
    { name: 'Management Dashboard', path: '/?view=dashboard' },
  ];

  for (const route of routesToTest) {
    test(`2. Route "${route.name}" (${route.path}) has ZERO CSP violation errors`, async ({ page }) => {
      const cspViolations: string[] = [];

      page.on('console', (msg) => {
        const text = msg.text();
        if (
          /violates the following Content Security Policy|Content-Security-Policy|blocked by CSP/i.test(text)
        ) {
          cspViolations.push(`Console CSP error: ${text}`);
        }
      });

      page.on('pageerror', (err) => {
        const text = err.message;
        if (
          /violates the following Content Security Policy|Content-Security-Policy|blocked by CSP/i.test(text)
        ) {
          cspViolations.push(`Page error: ${text}`);
        }
      });

      const response = await page.goto(`${PREVIEW_URL}${route.path}`, {
        waitUntil: 'domcontentloaded',
      });

      expect(response?.status()).toBeLessThan(400);

      // Wait 1.5s for initial background network fetches and animations
      await page.waitForTimeout(1500);

      if (cspViolations.length > 0) {
        console.error(`Found CSP violations on ${route.path}:`, cspViolations);
      }
      expect(cspViolations).toEqual([]);
    });
  }

  test('3. Stripe SDK (https://js.stripe.com/v3/) loads successfully under production CSP', async ({ page }) => {
    const cspViolations: string[] = [];
    page.on('console', (msg) => {
      if (/violates the following Content Security Policy/i.test(msg.text())) {
        cspViolations.push(msg.text());
      }
    });

    await page.goto(`${PREVIEW_URL}/`, { waitUntil: 'domcontentloaded' });

    const stripeAvailable = await page.evaluate(async () => {
      return new Promise<boolean>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://js.stripe.com/v3/';
        script.async = true;
        script.onload = () => {
          resolve(typeof (window as any).Stripe === 'function');
        };
        script.onerror = () => {
          reject(new Error('Stripe script failed to load'));
        };
        document.head.appendChild(script);
      });
    });

    expect(stripeAvailable).toBe(true);
    expect(cspViolations).toEqual([]);
    console.log('✔ Stripe SDK verified functional under CSP.');
  });

  test('4. Razorpay Checkout SDK (https://checkout.razorpay.com/v1/checkout.js) loads successfully under production CSP', async ({ page }) => {
    const cspViolations: string[] = [];
    page.on('console', (msg) => {
      if (/violates the following Content Security Policy/i.test(msg.text())) {
        cspViolations.push(msg.text());
      }
    });

    await page.goto(`${PREVIEW_URL}/`, { waitUntil: 'domcontentloaded' });

    const razorpayAvailable = await page.evaluate(async () => {
      return new Promise<boolean>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.onload = () => {
          resolve(typeof (window as any).Razorpay === 'function');
        };
        script.onerror = () => {
          reject(new Error('Razorpay script failed to load'));
        };
        document.head.appendChild(script);
      });
    });

    expect(razorpayAvailable).toBe(true);
    expect(cspViolations).toEqual([]);
    console.log('✔ Razorpay Checkout SDK verified functional under CSP.');
  });

  test('5. Cloudflare Turnstile API (https://challenges.cloudflare.com/turnstile/v0/api.js) loads successfully under production CSP', async ({ page }) => {
    const cspViolations: string[] = [];
    page.on('console', (msg) => {
      if (/violates the following Content Security Policy/i.test(msg.text())) {
        cspViolations.push(msg.text());
      }
    });

    await page.goto(`${PREVIEW_URL}/`, { waitUntil: 'domcontentloaded' });

    const turnstileAvailable = await page.evaluate(async () => {
      return new Promise<boolean>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.onload = () => {
          resolve(typeof (window as any).turnstile !== 'undefined');
        };
        script.onerror = () => {
          reject(new Error('Turnstile script failed to load'));
        };
        document.head.appendChild(script);
      });
    });

    expect(turnstileAvailable).toBe(true);
    expect(cspViolations).toEqual([]);
    console.log('✔ Cloudflare Turnstile API verified functional under CSP.');
  });

  test('6. Google Maps iframe embed loads successfully with zero CSP frame-src blocking', async ({ page }) => {
    const cspViolations: string[] = [];
    page.on('console', (msg) => {
      if (/violates the following Content Security Policy/i.test(msg.text())) {
        cspViolations.push(msg.text());
      }
    });

    await page.goto(`${PREVIEW_URL}/`, { waitUntil: 'domcontentloaded' });

    const mapsLoaded = await page.evaluate(async () => {
      return new Promise<boolean>((resolve, reject) => {
        const iframe = document.createElement('iframe');
        iframe.src = 'https://maps.google.com/maps?q=The+Cafe+Barrackpore&output=embed';
        iframe.style.width = '300px';
        iframe.style.height = '200px';
        iframe.onload = () => resolve(true);
        iframe.onerror = () => reject(new Error('Google Maps iframe failed to load'));
        document.body.appendChild(iframe);
      });
    });

    expect(mapsLoaded).toBe(true);
    expect(cspViolations).toEqual([]);
    console.log('✔ Google Maps embed iframe verified functional under CSP.');
  });
});
