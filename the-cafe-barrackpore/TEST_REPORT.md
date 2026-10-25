# Real Automated Test Report & Certification Audit
**Execution Date:** 2026-10-25T13:35:46+05:30  
**Target Architecture:** Multi-Tenant Hospitality Engine — The Café Barrackpore  
**Environment:** Production Build & Preview (`VITE_CLIENT_MODE=production`, port 4173) & Local Full-Stack (`http://localhost:5175`)  
**Engines & Test Runners:** Playwright Chromium (Headless), Vitest/TSX, PGlite (Real PostgreSQL 18 in-Wasm), Oxlint, TypeScript Compiler (`tsc -b`)

---

## Executive Summary
| Test Category | Suites Executed | Passed | Failed | Success Rate | Real Execution Time |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Material Symbols Glyph Validation** | 5 Suites (All Routes) | 5 | 0 | **100%** | 14.0s |
| **Header Multi-Viewport Anti-Clipping** | 6 Viewports | 6 | 0 | **100%** | 18.1s |
| **Pre-Sale Hotfix Acceptance** | 6 Viewports | 6 | 0 | **100%** | 24.0s |
| **Production CSP & External Provider Audit** | 11 Tests | 11 | 0 | **100%** | 33.4s |
| **Audit Evidence Generation** | 7 Scenarios | 7 | 0 | **100%** | 11.7s |
| **Backend, Tax & PostgreSQL Suites** | 49 Suites | 49 | 0 | **100%** | ~110s |
| **Linter (`oxlint`)** | 286 Files | 286 Clean | 0 Errors | **100%** | 504ms |
| **TypeScript Typecheck (`tsc -b`)** | Project Monorepo | 0 Errors | 0 Errors | **100%** | 8.2s |
| **Production Build (`VITE_CLIENT_MODE=production`)** | Font, LQIP, Vite, SSR | Complete | 0 Errors | **100%** | 38.5s |

---

## 1. Material Symbols Subset & Glyph Integrity
- **Command:** `npx playwright test e2e/material-symbols-glyphs.spec.ts --project=chromium`
- **Result:** **5 / 5 PASSED** (14.0s)
- **Status:** **PASS** ✅
- **Key Verifications:**
  1. Font subset rebuilt taking all quoted tokens in `src`, retaining 328 ligatures and 255 unique glyphs (28.8 KB, 99.3% payload savings).
  2. Fixed icon picker modal in `MenuManagement.tsx` restricted exclusively to curated subset icons from `categoryIcons.ts`.
  3. Visited Customer Landing, Drawers, QR Table Ordering, Staff Login, KDS, Dashboard Orders, POS, Content, Tables, Settings, and Discounts.
  4. Confirmed `local_pizza`, `ramen_dining`, `speed`, `volume_off`, `view_compact`, `arrow_drop_down`, and all other glyphs render as authentic graphic ligatures rather than visible fallback text strings.

---

## 2. Header Responsiveness & Viewport Anti-Clipping
- **Command:** `npx playwright test e2e/header-responsive.spec.ts --project=chromium`
- **Result:** **6 / 6 PASSED** (18.1s)
- **Target Viewports:** 1920px, 1440px, 1366px, 1280px, 768px, 390px
- **Status:** **PASS** ✅
- **Key Invariants Verified:**
  1. **Strict Horizontal Scroll Invariant:** `document.documentElement.scrollWidth <= window.innerWidth` across all 6 viewports (`overflowPx: 0`).
  2. **Language Switcher Visibility:** Bounding box containment confirmed at 1920, 1440, 1366, 1280, 768, and 390 px with zero clipping.
  3. **Cart Button Visibility:** Bounding box fully visible inside viewport boundaries at all widths.
  4. **Book Table CTA Visibility:** Reserved calendar CTA pill button renders as `inline-flex` with responsive typography across all desktop and mobile viewports.
  5. **Graceful Nav Shrink:** Desktop nav gracefully transitions to compact icon pills below 1440px (at 1280px & 1366px), collapsing text labels before any horizontal clipping occurs.

### Viewport Screenshot Evidence:
- **1920px Full Desktop & Header Bar:**  
  ![Header 1920px](test-results/screenshots/header-1920px.png)  
  ![Header Bar 1920px](test-results/screenshots/header-bar-1920px.png)
- **1440px Standard Desktop & Header Bar:**  
  ![Header 1440px](test-results/screenshots/header-1440px.png)  
  ![Header Bar 1440px](test-results/screenshots/header-bar-1440px.png)
- **1366px Laptop & Header Bar (Icon-Only Nav Mode):**  
  ![Header 1366px](test-results/screenshots/header-1366px.png)  
  ![Header Bar 1366px](test-results/screenshots/header-bar-1366px.png)
- **1280px Compact Desktop & Header Bar (Icon-Only Nav Mode):**  
  ![Header 1280px](test-results/screenshots/header-1280px.png)  
  ![Header Bar 1280px](test-results/screenshots/header-bar-1280px.png)
- **768px Tablet & Header Bar:**  
  ![Header 768px](test-results/screenshots/header-768px.png)  
  ![Header Bar 768px](test-results/screenshots/header-bar-768px.png)
- **390px Mobile & Header Bar:**  
  ![Header 390px](test-results/screenshots/header-390px.png)  
  ![Header Bar 390px](test-results/screenshots/header-bar-390px.png)

---

## 3. Peak Evening Simulation Guard
- **Status:** **PASS** ✅
- **Verification Details:** Gated "Simulate Peak Evening" simulation button and telemetry banners in `DashboardOverview.tsx` behind `import.meta.env.VITE_CLIENT_MODE === 'demo'`.
- **Production Guard:** When `VITE_CLIENT_MODE=production`, simulation controls are completely stripped from rendering. Verified via unit test invariant in `tests/dashboardFoundation.test.ts`.

---

## 4. Multilingual Staff Side Localization
- **Status:** **PASS** ✅
- **Components Fully Localized:**
  - `SettingsManagement.tsx`
  - `POSManagement.tsx`
  - `CashDrawerManagement.tsx`
  - `OrdersManagement.tsx`
  - `ContentManagement.tsx`
  - `PrinterSettingsSection.tsx`
  - `BillSettlementModal.tsx`
  - `MenuManagement.tsx`
- **Audit Verification:** Extended `tests/hardcodedEnglishStrings.test.ts` to scan multiline JSX, `title`, `placeholder`, `aria-label`, and ternaries.
- **Result:** `AUDIT PASSED: All 43 customer, staff, kitchen & dashboard components are 100% localized via t()!`

---

## 5. Strict Tax Invariant & Owner Go-Live Gating
- **Test Command:** `npx tsx tests/migration028TaxAndPinSecurity.test.ts`
- **Result:** **5 / 5 PASSED**
- **Status:** **PASS** ✅
- **Key Invariants Verified:**
  1. `public.resolve_dated_tax_rate` raises loud `NO_MATCHING_TAX_RULE` exception when tax is enabled but no verified jurisdiction rule matches (zero 0% tax leakage).
  2. `canJurisdictionGoLive` blocks go-live in `SettingsManagement.tsx` if taxes are unverified or unconfigured.

---

## 6. Cryptographic Blowfish Manager PIN Hashing
- **Migration:** `supabase/migrations/028_tax_strict_gating_and_pgcrypto.sql`
- **Status:** **PASS** ✅
- **Key Invariants Verified:**
  1. Replaced SHA-256 with `pgcrypto` `crypt(trim(p_pin), gen_salt('bf', 8))`.
  2. `internal_verify_pin_hash` verifies blowfish bcrypt (`$2%`) hashes while maintaining seamless backward compatibility for existing salted SHA-256 records.
  3. 5-attempt rate limit lockout, 15-minute cooldown, and audit log tracking strictly preserved.

---

## 7. Production CSP & External Provider Integration
- **Command:** `npx playwright test e2e/production-csp-external-scripts.spec.ts --project=chromium`
- **Environment:** Production preview server (`vite preview --port 4173`) with production CSP headers.
- **Result:** **11 / 11 PASSED** (33.4s)
- **Status:** **PASS** ✅
- **Key Verifications:**
  1. **Strict CSP Header:** Confirmed production headers include `default-src 'self'`, `https://challenges.cloudflare.com`, `https://js.stripe.com`, `https://checkout.razorpay.com`, `https://cdn.razorpay.com`, `https://maps.google.com`, `https://*.supabase.co`.
  2. **Zero CSP Violations Across All Routes:** Visited `/`, `/?view=menu`, `/?table=T1`, `/?staff=login`, `/?view=kitchen`, `/?view=dashboard`. Verified 0 CSP errors in browser console or page error events.
  3. **Stripe SDK (`https://js.stripe.com/v3/`):** Loaded and verified functional (`window.Stripe` function initialized).
  4. **Razorpay Checkout SDK (`https://checkout.razorpay.com/v1/checkout.js`):** Loaded and verified functional (`window.Razorpay` initialized, risk-detection bundle allowed).
  5. **Cloudflare Turnstile API (`https://challenges.cloudflare.com/turnstile/v0/api.js`):** Loaded and verified functional (`window.turnstile` initialized).
  6. **Google Maps Embed:** Loaded inside `iframe` with zero `frame-src` blocking.

---

## 8. Audit Evidence Screenshots
The following real runtime captures are committed to the repository in `the-cafe-barrackpore/test-results/screenshots/`:
- **Desktop Customer Homepage:**  
  ![Customer Homepage](test-results/screenshots/step1_customer_homepage_desktop.png)
- **Mobile Customer Journey (Pixel 5):**  
  ![Mobile Pixel 5](test-results/screenshots/step2_customer_mobile_pixel5.png)
- **QR Table Stand Ordering (Table 07):**  
  ![QR Table Ordering](test-results/screenshots/step3_qr_ordering_table_07.png)
- **Multilingual Staff Operations Login:**  
  ![Staff Login Multilingual](test-results/screenshots/step4_staff_login_multilingual.png)
- **Live Kitchen Display System (KDS):**  
  ![Kitchen Display System](test-results/screenshots/step5_kitchen_display_system.png)
- **POS Operations Terminal & Cash Drawer:**  
  ![POS Terminal & Drawer](test-results/screenshots/step6_pos_terminal_and_drawer.png)
- **Non-Latin Localization (Japanese & Arabic):**  
  ![Non-Latin Japanese Localization](test-results/screenshots/step7_non_latin_japanese.png)
