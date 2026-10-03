# Security Architecture & Operations Guide
## The Café Barrackpore — Hospitality Operations Digital System

This document provides an accurate, implementation-verified overview of the security architecture, access controls, edge functions, database protections, and operational procedures implemented in The Café Barrackpore web application and database infrastructure.

---

## 1. Threat Model & Security Posture Overview

The Café Barrackpore platform processes public food orders, table reservations, menu browsing, and staff operations. The security posture enforces **Defense in Depth** across five distinct layers:

```
[ Client Browser / Mobile Web ]
               │
               ▼
[ Edge Security Headers & Cloudflare Turnstile ] (CSP, HSTS, X-Frame-Options, Bot Defense)
               │
               ▼
[ Edge Functions & API Gateway ] (Strict CORS, Upstash/Postgres Rate Limiter, Cron Secret Auth)
               │
               ▼
[ Supabase Authentication & Session Controls ] (5-Attempt Brute-Force Lockout, 30-min Inactivity Timeout, Global Sign Out)
               │
               ▼
[ PostgreSQL Hardened Core ] (Granular RLS, Revoked Public Writes, Single-Use Verified Tokens, Two-UUID Payment Tokens, Atomic SECURITY DEFINER RPCs)
```

---

## 2. Database Hardening & Row Level Security (RLS)

All database security controls are codified in migrations `001` through `016`, consolidated into the single deployment script: [`supabase/all_migrations_combined.sql`](file:///supabase/all_migrations_combined.sql).

### 2.1 Row Level Security (RLS) Enabled Across Tables
Row Level Security is enabled on all active application tables:
- `orders`
- `order_items`
- `reservations`
- `restaurant_tables`
- `menu_categories`
- `menu_items`
- `menu_item_availability`
- `restaurant_settings`
- `site_content`
- `staff_profiles`
- `discount_codes`
- `payments`
- `verified_tokens`
- `rate_limits`
- `happy_hour_schedules`

### 2.2 Least-Privilege Grant Revocation
All default public mutations have been revoked:
```sql
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON TABLE public.orders FROM anon;
REVOKE ALL ON TABLE public.order_items FROM anon;
REVOKE ALL ON TABLE public.payments FROM anon;
REVOKE ALL ON TABLE public.staff_profiles FROM anon;
REVOKE SELECT ON TABLE public.discount_codes FROM anon;
REVOKE INSERT ON TABLE public.orders FROM anon, authenticated;
REVOKE INSERT ON TABLE public.reservations FROM anon, authenticated;
```

Only necessary read privileges are granted back to `anon`:
- `menu_categories` (SELECT)
- `menu_items` (SELECT)
- `site_content` (SELECT)
- `restaurant_tables` (SELECT active tables only)
- `menu_item_availability` (SELECT)
- `restaurant_settings` (SELECT)

### 2.3 Protection of Customer PII & Orders
- `orders`, `order_items`, and `payments` are completely revoked from `anon`. Scrapers or unauthorized users cannot query customer names, phone numbers, addresses, or order history.
- Active staff access is restricted by tenant `restaurant_id` and verified using `public.is_active_staff(auth.uid())`.
- Diners check order status exclusively through `get_order_status_by_token(order_ref, payment_token)`.

### 2.4 Granular Table & Menu Availability Policies
- `restaurant_tables` and `menu_item_availability` use granular `SELECT`, `INSERT`, `UPDATE`, and `DELETE` policies (no permissive `FOR ALL`).
- Anonymous users can only `SELECT` active dining tables and availability records.
- Only active staff with role `owner` or `manager` may mutate tables and menu availability.
- All `UPDATE` policies include matching `WITH CHECK` clauses.

### 2.5 Discount Code Protection
- Direct table `SELECT` on `discount_codes` is revoked from `anon` (dropping the legacy public validate policy).
- Diners validate promo codes through `validate_discount_code(code)` RPC (`SECURITY DEFINER`), which returns only the discount amount, type, and order thresholds, preventing leakage of usage counts, total limits, or campaign metadata.

---

## 3. Atomic Stored Procedures (RPCs)

Direct table `INSERT` into `orders` and `reservations` is prohibited for both anonymous and authenticated users. All orders and reservations must be processed through server-side `SECURITY DEFINER` procedures with `SET search_path = public, pg_temp`:

### 3.1 `create_order_atomic(p_order, p_items)`
1. **Turnstile Verification:** Consumes a single-use token from `public.verified_tokens`. Raises an exception if the token is missing, invalid, or expired.
2. **Item & Quantity Clamping:** Caps orders at 40 distinct items. Enforces quantity between 1 and 50 per item.
3. **Server-Side Pricing Authority:** Ignores any client-supplied unit price, subtotal, or total. Looks up authoritative prices directly in `public.menu_items`, verifies `available = true`, and checks `menu_item_availability`.
4. **Authoritative Settings:** Overrides client-supplied `restaurant_id` with `public.restaurant_settings`. Computes statutory tax (inclusive or exclusive) server-side.
5. **Random References:** Generates random order references using `CB-YYYY-XXXXXXXXXX` (never sequential).
6. **Double-UUID Payment Tokens:** Generates a 64-character raw payment token composed of two concatenated `gen_random_uuid()` calls with dashes stripped. Computes the SHA-256 hash, stores `payment_token_hash` in `public.orders`, and returns the raw token once to the caller.

### 3.2 `create_reservation_atomic(p_reservation)`
1. **Turnstile Verification:** Consumes a single-use token from `public.verified_tokens` for action `reservation`. Raises an exception if missing or expired.
2. **Validation:** Validates customer name (>= 2 chars), phone number, party size (1–20 guests), and reservation date/time.
3. **Collision Resistance:** Generates a unique reservation reference `RS-YYYY-XXXX`.

### 3.3 `get_order_status_by_token(p_order_ref, p_payment_token)`
- Validates SHA-256 hash of the provided `payment_token` against `orders.payment_token_hash`.
- Returns only the order's status, payment status, totals, and line items, preventing IDOR access to orders.

---

## 4. Edge Functions, Payment Security & Cron Authorization

### 4.1 Payment Initialization Security
- Edge functions `create-payment`, `create-razorpay-order`, and `create-stripe-checkout`:
  - Require both `order_ref` and `payment_token`.
  - Fetch the order from the database and verify `payment_token` by computing its SHA-256 hash and performing a constant-time `timingSafeEqual` comparison against `orders.payment_token_hash`.
  - Require the `PUBLIC_SITE_URL` environment variable; zero localhost or fallback domain defaults are permitted in production.
  - Append `payment_token` to callback/redirect URLs so checkout return handlers can poll status safely.

### 4.2 Payment Webhook Authority (`payment-webhook`)
- Only the `payment-webhook` Edge Function (operating under the Supabase `service_role`) may write payment records or update order statuses to `paid`.
- Browser client services (`paymentService.ts` and `orderService.ts`) contain zero direct table writes to `payments` or `orders`.
- Webhook signatures (Stripe webhook signature, Razorpay webhook signature) are cryptographically validated using `crypto.subtle`.
- Fails with a 500 configuration error if currency or required order settings are absent (zero hardcoded `'INR'` fallbacks).

### 4.3 Scheduled Cron Functions (`daily-sales-summary` & `stock-alerts`)
- Require an `x-cron-secret` request header equal to the `CRON_SECRET` environment variable. Returns HTTP `401 Unauthorized` on mismatch.
- Fetch restaurant name and currency strictly from `public.restaurant_settings`. If unconfigured, the functions abort with a 500 configuration error (zero `'INR'` or `'The Café Barrackpore'` fallbacks).

### 4.4 Bot Defense & Rate Limiting
- `verify-turnstile` Edge Function verifies Cloudflare Turnstile tokens via Cloudflare's `siteverify` API.
- Rate limiting is implemented in `supabase/functions/_shared/rateLimiter.ts` using Upstash Redis (if configured via `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`) or the PostgreSQL `public.rate_limits` table via service role client.
- Successful Turnstile validations issue a 5-minute single-use token inserted into `public.verified_tokens`, which is consumed atomically upon order or reservation creation.

---

## 5. Authentication & Staff Session Security

### 5.1 Brute Force Protection & Account Lockout
- Managed via `src/utils/security.ts`.
- 5 consecutive failed login attempts locks staff login on the client for **15 minutes**.
- Lockout counters track email addresses with countdown timers displayed on the login interface.

### 5.2 Password Complexity Standards
- Validated on staff password resets and creations:
  - Minimum 10 characters
  - At least one uppercase letter (`A-Z`)
  - At least one lowercase letter (`a-z`)
  - At least one numeric digit (`0-9`)
  - At least one special symbol

### 5.3 Inactivity Session Timeout
- Governed by `src/hooks/useStaffSessionTimeout.ts`.
- Tracks user interactions across staff views and terminates the session after **30 minutes** of complete inactivity.

### 5.4 Global Session Revocation
- Staff can invoke `signOutEverywhere()` from the dashboard to execute `supabase.auth.signOut({ scope: 'global' })`, immediately revoking refresh tokens across all devices.

### 5.5 Role-Based Access Control (RBAC)
- Client roles (`owner`, `manager`, `staff`) are verified against `public.staff_profiles` linked to `auth.uid()`.
- RLS enforces table permissions at the database layer on every query, ensuring frontend route guards cannot be bypassed.

---

## 6. Frontend & Asset Security

### 6.1 HTTP Security Headers
Configured across `public/_headers`, `vercel.json`, and hosting environments:
- `Content-Security-Policy`: Restricts scripts, styles, images, and fonts to authorized origins and CDNs.
- `Strict-Transport-Security`: `max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options`: `nosniff`
- `X-Frame-Options`: `DENY`
- `Referrer-Policy`: `strict-origin-when-cross-origin`
- `Permissions-Policy`: `camera=(), microphone=(), geolocation=(), payment=(self)`

### 6.2 Upload Sanitization
- Governed by `src/services/storageService.ts`:
  - 5 MB maximum file size.
  - Safe image MIME type whitelist (`jpeg`, `png`, `webp`, `avif`, `svg+xml`).
  - Strict textual scanning of SVG files to reject embedded `<script>`, event attributes (`onload`, `onerror`), and `javascript:` URLs.

### 6.3 PII and Secret Scrubbing
- Client logs in `src/services/logger.ts` strip sensitive order payloads and credentials in production builds.
- Error boundary (`src/components/ErrorBoundary.tsx`) catches runtime errors and presents friendly messages, suppressing raw database exceptions or stack traces.

---

## 7. Secrets Management & Deployment Integrity

### 7.1 Single Deployment Script
- The single authoritative database deployment file is [`supabase/all_migrations_combined.sql`](file:///supabase/all_migrations_combined.sql).
- The obsolete `consolidated_schema.sql` file has been deleted.
- Migrations `001` through `016` are sequenced with unique numbers:
  1. `001_initial_orders.sql`
  2. `002_reservations.sql`
  3. `003_staff_profiles.sql`
  4. `004_restaurant_tables.sql`
  5. `005_menu_availability.sql`
  6. `006_kitchen_realtime.sql`
  7. `007_internationalization.sql`
  8. `008_payment_architecture.sql`
  9. `009_menu_and_secure_orders.sql`
  10. `010_menu_and_site_content.sql`
  11. `011_multi_tenant_and_allergens.sql`
  12. `012_provider_agnostic_payments.sql`
  13. `013_owner_features.sql`
  14. `014_order_caps_and_direct_insert_lockdown.sql`
  15. `015_complete_image_sync.sql`
  16. `016_security_hardening.sql`

### 7.2 Secrets Separation
- Public client variables (prefixed with `VITE_`) contain only public identifiers: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SITE_URL`.
- Server secrets (`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `CRON_SECRET`, `TURNSTILE_SECRET_KEY`) reside exclusively in Supabase Vault / Edge Function secrets and are never exposed to the browser.
