# Production Deployment Checklist: Fury Studios Hospitality Platform

**Scope:** Production infrastructure provisioning, build verification, migration deployment, Edge Function configuration, domain cutover, and post-launch smoke testing.

---

## 1. Build & Release Validation
- [ ] Confirm execution directory: web application is under `the-cafe-barrackpore/` and CMS is under `studio/`.
- [ ] Install dependencies cleanly using lockfiles:
  ```powershell
  npm ci --prefix the-cafe-barrackpore
  npm ci --prefix studio
  ```
- [ ] Execute validation pipeline:
  ```powershell
  npm run lint --prefix the-cafe-barrackpore
  npm test --prefix the-cafe-barrackpore
  npm run build --prefix the-cafe-barrackpore
  npm run build --prefix studio
  ```
- [ ] Audit dependencies:
  ```powershell
  npm run audit --prefix the-cafe-barrackpore
  ```
  *(Confirms zero production vulnerabilities in web client).*
- [ ] Review SSR prerender output in `dist/` and `dist/index.html` to confirm no private credentials, development error banners, or unauthorized tenant references leak into static pages.
- [ ] Keep `.env` and local credentials strictly excluded from git tracking.

---

## 2. Infrastructure & Environment Separation
- [ ] Provision distinct staging and production environments (Supabase, Vercel/Render, Stripe/Razorpay).
- [ ] Configure client-side public variables in production hosting:
  - `VITE_SUPABASE_URL`: Production Supabase Project URL
  - `VITE_SUPABASE_ANON_KEY`: Production Supabase Anon Public Key
  - `VITE_PUBLIC_SITE_URL`: Production custom domain (`https://restaurant.com`)
  - `VITE_SANITY_PROJECT_ID`: Client's dedicated Sanity Project ID
  - `VITE_SANITY_DATASET`: `production`
- [ ] Configure server-side secrets in Supabase Edge Function Secrets Vault:
  - `ALLOWED_ORIGIN`: Exact production domain
  - `PUBLIC_SITE_URL`: Exact production domain
  - `STRIPE_SECRET_KEY`: Production live secret key (`sk_live_...`)
  - `STRIPE_WEBHOOK_SECRET`: Production webhook endpoint signing secret (`whsec_...`)
  - `RAZORPAY_KEY_ID`: Production Key ID (`rzp_live_...`)
  - `RAZORPAY_KEY_SECRET`: Production Key Secret
  - `RAZORPAY_WEBHOOK_SECRET`: Production Webhook secret
  - `TURNSTILE_SECRET_KEY`: Cloudflare Turnstile secret key
  - `CRON_SECRET`: Random 64-character secret for scheduled jobs
- [ ] Verify that source maps do not expose private source details or secrets to browser clients.

---

## 3. Database Schema, Migrations, & Edge Functions
- [ ] Create a full database backup before applying migrations.
- [ ] Deploy migrations `001_initial_schema.sql` through `016_security_hardening.sql` sequentially via Supabase CLI:
  ```bash
  supabase db push --linked
  ```
- [ ] Verify Row Level Security (RLS) is enabled on all tables:
  ```sql
  SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
  ```
- [ ] Deploy all Supabase Edge Functions:
  ```bash
  supabase functions deploy create-payment
  supabase functions deploy create-stripe-checkout
  supabase functions deploy create-razorpay-order
  supabase functions deploy payment-webhook
  supabase functions deploy process-refund
  supabase functions deploy payment-health-check
  supabase functions deploy daily-sales-summary
  supabase functions deploy stock-alerts
  supabase functions deploy verify-turnstile
  ```
- [ ] Configure webhook URLs in Stripe / Razorpay merchant dashboard:
  - `https://<project-ref>.supabase.co/functions/v1/payment-webhook`
  - Select events: `payment_intent.succeeded`, `checkout.session.completed`, `payment.captured`, `payment.failed`.

---

## 4. Hosting, DNS, SSL, & Performance
- [ ] Configure custom domain DNS records:
  - CNAME or A records pointing to hosting provider (Vercel / Cloudflare Pages / Render).
- [ ] Enforce HTTPS / TLS 1.3 with automated certificate renewal.
- [ ] Verify HTTP response security headers in `public/_headers`:
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- [ ] Verify caching headers: immutable caching for hashed assets in `/assets/`, `no-cache` for `index.html`.
- [ ] Verify responsive imagery and font preloading; confirm LCP element renders within 1.5s on mobile network.

---

## 5. Post-Deployment Smoke Verification
- [ ] **Customer Front-End:** Visit `https://restaurant.com`. Verify hero image, typography, smooth scrolling, and section transitions load cleanly without console errors.
- [ ] **Menu Navigation:** Verify categories, item prices, veg toggles, and item modals render correct dishes and currency.
- [ ] **QR Code Route:** Visit `https://restaurant.com/qr?table=01`. Confirm table number is recognized and displayed.
- [ ] **Cart & Order Flow:** Place a controlled live test order. Verify subtotal, tax calculation, and order reference creation.
- [ ] **Payment Processing:** If live payments are configured, test a small live transaction (or sandbox transaction in staging), confirm payment capture in gateway, and check order status update.
- [ ] **KDS Screen:** Log in to `/staff/kitchen` on a staff tablet. Confirm test order appears immediately and status transitions respond.
- [ ] **Owner Dashboard:** Log in to `/staff/dashboard`. Verify the order appears in sales metrics and can be reviewed in order history.
- [ ] **Reservation Flow:** Submit a test reservation. Confirm reference is issued and record appears in dashboard calendar.
- [ ] **Refund Reconciliation:** If testing refunds, confirm gateway status matches local payment record.
- [ ] **Production Sign-Off:** Formally sign off on production readiness with client stakeholders.
