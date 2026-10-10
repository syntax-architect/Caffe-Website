# Production Readiness Audit: Fury Studios Restaurant Digital Experience

**Scope:** Exhaustive repository audit, source-level code review, security boundary inspection, reproducible build verification, and commercial readiness assessment of the React 19 / Vite application, Supabase database migrations, Supabase Edge Functions, Sanity Studio, and sales assets.  
**Repository Path:** `c:\Users\Pc\OneDrive\Desktop\Caffe BKP`  
**Date:** 2026-10-10  
**Evaluator:** Senior Full-Stack, QA, Security, and Hospitality Systems Engineer  

---

## 1. Internal Inventory (10 Core Dimensions)

### 1.1 Existing Features [VERIFIED]
- **Customer Frontend (React 19, TypeScript, Vite, Tailwind CSS):**
  - Cinematic hero with brand eyebrow badge, high-contrast headline, and responsive WebP picture element (`src/components/Hero.tsx`).
  - Interactive smooth scrolling via Lenis (`src/App.tsx`, `src/utils/scroll.ts`).
  - Scroll-scrubbed culinary canvas animation sequence (`src/components/ScrollSequence.tsx`).
  - Ambient atmosphere & audio vibe gallery (`src/components/AboutVibe.tsx`).
  - Interactive story timeline with pinned scrub chapter progress (`src/components/OurStory.tsx`).
  - Food & cocktail photography showcase with modal preview (`src/components/Gallery.tsx`).
  - Specials and banquet platters banner (`src/components/SpecialsBanner.tsx`).
  - Full categorized digital menu with live search, dietary/veg filter, price formatting, and availability badge (`src/components/Menu.tsx`).
  - VIP Club / Nocturnal Society membership registration (`src/components/VIPClub.tsx`).
  - Double-bezel branded footer with opening hours, hygiene disclosure, and social links (`src/components/Footer.tsx`).
- **Cart & Ordering Workflows:**
  - Drawer-based shopping cart with line-item management, happy hour discounts, promotional codes, tax calculation, and order notes (`src/components/CartDrawer.tsx`).
  - Local demo resilience: offline/unconfigured order submission clearly flags demo mode without false dispatches (`src/components/CartDrawer.tsx`, `src/services/orderService.ts`).
- **Smart QR Table Ordering:**
  - Table number extraction and normalization from query parameters (`/qr?table=07` -> `07`) (`src/components/qr/QROrderingPage.tsx`, `src/utils/qrUtils.ts`).
  - Source tracking distinguishing QR orders from direct website orders (`src/services/orderService.ts`).
- **Table Reservation Workflow:**
  - Date, time, party size, guest contact validation, and duplicate submission guards (`src/components/ReservationDrawer.tsx`, `src/services/reservationService.ts`).
- **Kitchen Display System (KDS):**
  - Real-time order queue with status transitions (`received` -> `preparing` -> `ready` -> `completed` -> `cancelled`), audio alerts, and tactile filters (`src/components/kitchen/KitchenDisplayApp.tsx`).
- **Staff Authentication & Role-Based Access Control:**
  - Role management (`owner`, `manager`, `chef`, `waiter`) with route protection and session management (`src/context/AuthContext.tsx`, `src/components/staff/StaffLoginPage.tsx`).
- **Owner Operations Dashboard:**
  - Revenue analytics, live order stream, reservation calendar, table floor plan, menu item 86'd stock management, staff roster, and audit log (`src/components/dashboard/*`).
- **International Localization & Tax Engine:**
  - 20 country presets with custom currencies, formatting, timezones, phone codes, and tax modes (`inclusive` vs `exclusive`) (`src/config/restaurantPresets.ts`, `src/utils/taxEngine.ts`, `src/utils/currency.ts`).
  - Multi-language dictionary supporting 12 languages (`src/i18n/*`).
- **Build & Static Generation:**
  - Full SSR static prerendering script generating index, privacy, and terms HTML files for search crawlers (`scripts/prerender.ts`).

### 1.2 Implemented but Unverified Features [IMPLEMENTED BUT UNVERIFIED]
- **Sanity CMS Content Sync:** Schema defined in `studio/schemas/` and query services in `src/services/siteContentService.ts`; live remote mutations require client-specific project credentials.
- **Turnstile Bot Protection:** Client component `src/components/common/TurnstileWidget.tsx` and edge function `verify-turnstile`; requires live Cloudflare site key.
- **SMS/WhatsApp Notifications:** Dispatch logic in `src/services/notificationService.ts` and `CartDrawer.tsx`; live webhook/provider delivery requires Twilio/WhatsApp Business API credentials.
- **Realtime Supabase Channels:** Subscription logic in `src/services/kitchenService.ts` and `src/services/menuAvailabilityService.ts`; verified in mock/local fallback, but unverified on a high-concurrency production websocket.

### 1.3 Broken or Incomplete Features [RESOLVED / BLOCKED]
- **`process-refund` Edge Function Defect [RESOLVED]:** Previously attempted to query `is_active` on `staff_profiles` (schema column is `active`), lacked tenant filtering on order lookups, and did not handle provider rejections. Fixed and guarded with regression tests in `tests/databaseSecurityHardening.test.ts`.
- **Async createOrder Execution in Test Suite [RESOLVED]:** `tests/bugHuntVerification.test.ts` had an unawaited promise in Test 1. Fixed to `await createOrder(...)`.
- **Sanity Studio Dependency Vulnerabilities [FAILED / BLOCKED]:** `studio/` contains 18 dependency advisories in CLI subdependencies; fixing requires either upstream patch or major version downgrade.
- **Multi-Tenant RPC Single-Row Limit [BLOCKED]:** `create_order_atomic` and `create-payment` fetch restaurant settings with `LIMIT 1` rather than querying by explicit `restaurant_id`. Safe for single-tenant deployments; blocks sharing a single database across multiple distinct restaurant clients.

### 1.4 Duplicate Implementations [VERIFIED]
- **Payment Edge Functions:**
  - `create-payment` (provider-agnostic orchestrator).
  - `create-stripe-checkout` (direct Stripe Checkout session creator).
  - `create-razorpay-order` (direct Razorpay Order creator).
  - *Analysis:* Both `StripeAdapter` and `RazorpayAdapter` use `create-payment` as primary and maintain fallback to the provider-specific functions if `create-payment` is unreachable. Preserved for backward compatibility without breaking legacy deployments.

### 1.5 Placeholder Values [IDENTIFIED]
- `index.html`: Line 15 contains `<meta name="google-site-verification" content="verification_token_the_cafe_barrackpore_2026" />` (dummy verification token).
- `src/config/client.ts`: Contains placeholder Elfsight widget ID `YOUR_ELFSIGHT_WIDGET_ID` and Google Place ID `YOUR_PLACE_ID`.
- `.env.example`: Contains dummy keys for Supabase, Stripe, Razorpay, and Cloudflare Turnstile.
- Demo Restaurant Identity: Fallbacks throughout the application default to "The Café Barrackpore" (West Bengal, India, INR currency, Asia/Kolkata timezone).

### 1.6 Security-Sensitive Operations [AUDITED]
- **Row-Level Security (RLS):** 16 database migrations under `supabase/migrations/` enforce RLS on `orders`, `order_items`, `restaurant_tables`, `menu_item_availability`, and `staff_profiles`. Public write access is revoked; orders are mutated only via atomic RPCs or service-role webhooks.
- **Payment Verification:** Webhook signatures for Stripe (`stripe-signature`) and Razorpay (`x-razorpay-signature`) are validated cryptographically before mutating order payment status.
- **Order Polling Security:** Order status polling requires a 64-character SHA-256 payment token hash; anonymous clients cannot iterate order references.
- **Privileged Credentials Hygiene:** Zero service-role keys or private payment secrets are included in client bundles.

### 1.7 Production Deployment Requirements [DOCUMENTED]
- Separate staging and production Supabase projects.
- Server-side environment variables configured in Supabase secret store (`STRIPE_SECRET_KEY`, `RAZORPAY_KEY_SECRET`, `TURNSTILE_SECRET_KEY`, `CRON_SECRET`).
- Client-side public environment variables in Vite (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PUBLIC_SITE_URL`).
- SSL/TLS domain configuration with HTTP Strict Transport Security (HSTS) headers.

### 1.8 Missing Tests [RESOLVED]
- Package script in `the-cafe-barrackpore/package.json` previously omitted `bugHuntVerification.test.ts` and `taxEngine.test.ts`. Both are now integrated into `npm test`. All 14 suites execute sequentially.

### 1.9 Unused Assets and Dependencies [AUDITED]
- `material-symbols-outlined.woff2` is 4.0 MB in `public/fonts/`. Should be subsetted for production deployment.
- High-resolution `.jpg` duplicates exist alongside `.webp` variants in `public/images/`. Preserved to avoid breaking CMS fallback references.

### 1.10 Commercial Blockers [RESOLVED VIA ASSETS]
- Lack of written onboarding and demonstration materials. Resolved through the creation of `CLIENT_DEMO_SCRIPT.md`, `CLIENT_ONBOARDING_CHECKLIST.md`, `PRODUCTION_DEPLOYMENT_CHECKLIST.md`, `COMMERCIAL_OFFER.md`, and `ROI_CALCULATOR_SPEC.md`.

---

## 2. Prioritized Checklist

| Priority | Area | Status | File References | Evidence and Verification Action |
|---|---|---|---|---|
| **P0** | Refund Authorization & Tenant Scope | **VERIFIED** | `supabase/functions/process-refund/index.ts`, `tests/databaseSecurityHardening.test.ts` | Corrected `active` column, scoped updates by `restaurant_id`, verified with Test 13 in `databaseSecurityHardening.test.ts`. |
| **P0** | Multi-Tenant Database Isolation | **BLOCKED BY MISSING CREDENTIALS** | `supabase/migrations/011_multi_tenant_and_allergens.sql`, `supabase/migrations/016_security_hardening.sql` | RLS policies verified by static inspection; live adversarial cross-tenant testing requires a running multi-tenant Supabase instance. |
| **P0** | Payment Gateway End-to-End | **BLOCKED BY MISSING CREDENTIALS** | `src/services/paymentService.ts`, `supabase/functions/create-payment/` | Local calculations and payload validations pass 100%; sandbox payment capture requires active Stripe/Razorpay test keys. |
| **P1** | Reproducible Build & Typecheck | **VERIFIED** | `package.json`, `the-cafe-barrackpore/package.json` | `tsc -b && vite build && scripts/prerender.ts` succeeded with 0 errors. All 14 test suites passed. |
| **P1** | Sanity Studio Build | **VERIFIED** | `studio/package.json`, `studio/sanity.config.ts` | `sanity build` succeeded in 1.2s. |
| **P1** | Demonstration Mode Honesty | **VERIFIED** | `src/components/CartDrawer.tsx`, `src/components/ReservationDrawer.tsx` | Offline/unconfigured demo orders and bookings display clear "Demo Order Only" / "Demo Request Only" badges without making real API calls. |
| **P1** | International Restaurant Presets | **VERIFIED** | `src/config/restaurantPresets.ts`, `tests/taxEngine.test.ts`, `tests/internationalization.test.ts` | Tested 20 countries including US (exclusive sales tax), UK (inclusive VAT), India (inclusive GST), and UAE (5% VAT). |
| **P1** | Sanity Studio Security Advisories | **FAILED** | `studio/package.json`, `studio/package-lock.json` | 18 dependency advisories in deep CLI toolchain. Isolated build works; public hosting should be restricted until upstream patch. |
| **P2** | Asset & Font Payload Optimization | **IMPLEMENTED BUT UNVERIFIED** | `public/fonts/material-symbols-outlined.woff2`, `public/images/` | 4MB icon font and duplicate uncompressed food images present in public bundle. |
| **P2** | SEO & Search Meta Cleanliness | **VERIFIED** | `index.html`, `scripts/prerender.ts`, `src/utils/seo.ts` | SSR prerendering verified for `/`, `/privacy`, `/terms`. Placeholder Search Console tag identified. |
| **P2** | Commercial Sales Collateral | **VERIFIED** | `docs/CLIENT_DEMO_SCRIPT.md`, `docs/COMMERCIAL_OFFER.md`, `docs/ROI_CALCULATOR_SPEC.md` | All 5 client acquisition and deployment documents drafted and verified. |
| **P3** | App Production Dependencies | **VERIFIED** | `the-cafe-barrackpore/package.json` | `npm audit --omit=dev` reported 0 production vulnerabilities. |

---

## 3. Repeatable Verification Commands

Execute from `the-cafe-barrackpore/`:
```powershell
npm test
npm run lint
npm run build
npm run audit
```

Execute from `studio/`:
```powershell
npm run build
```

---

## 4. Release Decision

1. **Client Demonstration:** **READY.** The local development server runs completely offline, shows the full cinematic luxury design, allows menu exploration, simulates cart and reservations with honest demo badges, and supports switching international presets.
2. **Production Deployment:** **CONDITIONAL.** Ready for single-tenant client deployments upon provisioning client credentials (Supabase, Stripe/Razorpay, domain). Multi-tenant hosting (multiple restaurants on one database) requires updating `create_order_atomic` to remove `LIMIT 1` settings queries.
3. **Commercial Readiness:** **READY.** Sales script, onboarding runbook, scope-based pricing model, and ROI calculator specification are finalized.
