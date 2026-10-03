# Enterprise Security Architecture & Operations Guide
## The Café Barrackpore

This document outlines the security architecture, controls, operational procedures, key rotation policies, backup strategies, and incident response checklist implemented to harden The Café Barrackpore web application and database infrastructure to commercial enterprise standards.

---

## 1. Threat Model & Security Posture Overview

The Café Barrackpore application processes public food orders, table reservations, menu browsing, and staff administrative operations. The security posture enforces **Defense in Depth** across five distinct layers:

```
[ Client Browser / Mobile Web ]
               │
               ▼
[ Edge Security Headers & Turnstile CAPTCHA ] (CSP, HSTS, X-Frame-Options, Rate Limits)
               │
               ▼
[ Edge Functions & API Gateway ] (Strict CORS, Origin Validation, Phone/IP Rate Limiting)
               │
               ▼
[ Supabase Authentication & Auth Rules ] (MFA for Owners, 5-Attempt Lockout, Inactivity Timeout, Global Revocation)
               │
               ▼
[ PostgreSQL Hardened Core ] (Multi-tenant RLS by restaurant_id, Atomic Validated RPCs, Revoked Public Grants, Audit Triggers)
```

---

## 2. Database Hardening & Row Level Security (RLS)

All database security controls are codified in migration `supabase/migrations/013_security_hardening.sql`.

### 2.1 Multi-Tenant Isolation by `restaurant_id`
Every single table in the schema enforces Row Level Security (RLS) with explicit policies scoped by `restaurant_id`:
- `restaurants`
- `menu_categories`
- `menu_items`
- `orders`
- `order_items`
- `reservations`
- `customers`
- `staff_profiles`
- `discounts`
- `payments`
- `restaurant_content`
- `order_status_history`
- `audit_log`

### 2.2 Least-Privilege Grant Revocation
All default public and anon table privileges have been revoked:
```sql
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated, public;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, authenticated, public;
```
Only required permissions are explicitly granted:
- `anon` and `authenticated`: `SELECT` on safe public tables (`menu_categories`, `menu_items`, `restaurant_content`, public `restaurants` fields).
- `authenticated`: `SELECT`, `INSERT`, `UPDATE` on staff tables governed strictly by the user's role in `staff_profiles`.

### 2.3 Protection of Customer PII
- Customer phone numbers, emails, order histories, and reservation notes are **never** exposed to the `anon` role via direct `SELECT`.
- Staff members can only view customer and order data belonging to their assigned `restaurant_id`.
- The `customers` table cannot be queried by unauthenticated users.

### 2.4 Atomic Stored Procedures (RPCs)
Direct `INSERT` on `orders`, `order_items`, and `reservations` is revoked for public/anonymous users. All submissions must route through validated `SECURITY DEFINER` stored procedures:

#### `create_order_atomic`
- **Phone Validation:** Strict E.164 / international regex check `^\+?[0-9\s\-()]{7,20}$`.
- **String Length Limits:** Customer name bounded to 2–100 characters; special requests bounded to 500 characters.
- **Quantity Clamping:** Each item quantity must be an integer between 1 and 50. Distinct items capped at 40 per order.
- **Server-Side Pricing Authority:** Ignores any client-supplied `unit_price`, `subtotal`, or `total`. Looks up authoritative prices directly in `public.menu_items` and checks `available = true`. Recomputes subtotal, statutory tax (5% GST), and total server-side.

#### `create_reservation_atomic`
- **Date/Time Validation:** Enforces ISO date formatting and validates party size between 1 and 20 guests.
- **Collision Retry:** Prevents reservation reference duplicates with unique indexing.

---

## 3. Authentication & Staff Session Security

### 3.1 Brute Force Protection & Sliding Lockout
- Managed via `src/utils/security.ts`.
- **Threshold:** 5 consecutive failed login attempts locks the staff account for **15 minutes**.
- Lockout counters are tracked per email address with countdown feedback displayed on `StaffLoginPage`.

### 3.2 Strong Password Complexity Enforcement
Password creation and resets (`ResetPasswordPage`) enforce enterprise criteria:
- Minimum **10 characters** in length
- At least one uppercase letter (`A-Z`)
- At least one lowercase letter (`a-z`)
- At least one numeric digit (`0-9`)
- At least one special symbol (`!@#$%^&*...`)

### 3.3 Multi-Factor Authentication (MFA / 2FA)
- Built on Supabase TOTP MFA standard.
- **Owner Requirement:** Accounts with role `owner` are prompted to register and verify TOTP two-factor authentication upon signing in.
- Staff members can verify TOTP challenges directly on `StaffLoginPage` without disrupting their login flow.

### 3.4 Inactivity Session Timeout
- Governed by `src/hooks/useStaffSessionTimeout.ts`.
- Automatically tracks user interaction (`mousedown`, `keydown`, `touchstart`, `scroll`) across staff screens.
- Throttled activity updates terminate the session and clear memory after **30 minutes** of complete inactivity.

### 3.5 Global Session Revocation ("Sign Out Everywhere")
- Staff members and administrators can invoke `signOutEverywhere()` from the dashboard toolbar or user menu.
- Executes `supabase.auth.signOut({ scope: 'global' })`, immediately revoking all issued refresh tokens across all browsers, tablets, and devices.

### 3.6 Zero Client-Authority Authorization
- Access control decisions are **never** made based on values stored in `localStorage` or `sessionStorage`.
- Roles (`owner`, `manager`, `staff`) are fetched dynamically from `public.staff_profiles` linked to the verified Supabase Auth UID and checked by PostgreSQL RLS on every single query.

---

## 4. API, Edge Functions & Bot Defense

### 4.1 Cloudflare Turnstile Integration
- Public order checkout (`CartDrawer`) and reservation booking (`ReservationDrawer`) include Cloudflare Turnstile CAPTCHA verification.
- Tokens are submitted with payloads and verified server-side via Supabase Edge Function `verify-turnstile` using Cloudflare's `siteverify` endpoint.
- Protects against scripted order spam, inventory exhaustion, and reservation table locking.

### 4.2 Rate Limiting Architecture
- Implemented in `supabase/functions/_shared/rateLimiter.ts` with Upstash Redis support and local sliding-window fallback:
  - **Orders:** 5 requests per 60 seconds per IP; 4 requests per 120 seconds per customer phone.
  - **Reservations:** 5 requests per 60 seconds per IP; 4 requests per 120 seconds per customer phone.
  - **Authentication:** 5 attempts per 15 minutes per IP/account.

### 4.3 Strict Origin & CORS Policy
- Configured in `supabase/functions/_shared/cors.ts`.
- **Zero Wildcards:** Origin `'*'` is strictly rejected.
- Allows only production domain `https://thecafebarrackpore.com` (and localhost origins strictly during local development).
- Standard preflight headers:
  ```http
  Access-Control-Allow-Origin: https://thecafebarrackpore.com
  Access-Control-Allow-Methods: POST, GET, OPTIONS
  Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type
  ```

---

## 5. Frontend & Asset Security

### 5.1 HTTP Security Headers
Configured across `vercel.json`, `public/_headers`, and `render.yaml`:
```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://browser.sentry-cdn.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com https://*.sentry.io; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(self)
```

### 5.2 XSS Sanitization & Image Upload Hardening
- **Zero Unsafe HTML:** All dynamic text rendering avoids `dangerouslySetInnerHTML`. Where rich text is required, it is parsed and sanitized using `dompurify`.
- **Media Upload Validation:** In `src/services/storageService.ts`:
  - Enforces a **5 MB** maximum file size.
  - Whitelists safe MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/avif`, `image/svg+xml`.
  - SVG files undergo deep textual scanning to reject scripts, event handlers (`onload`, `onerror`), and `javascript:` pseudo-protocols.
  - Files are saved strictly in scoped paths: `staff-uploads/{restaurantId}/{folder}/{timestamp}-{safeName}`.

### 5.3 Production Error Telemetry & Log Sanitization
- Configured in `src/services/logger.ts`, `src/components/ErrorBoundary.tsx`, and `src/lib/sentry.ts`.
- In production, console debugging of payloads, customer data, and authentication tokens is stripped.
- Raw stack traces are suppressed in the user-facing UI and replaced with user-friendly error boundaries.
- Unhandled application exceptions are scrubbed of PII and dispatched to Sentry.

---

## 6. Audit Logging & Compliance

### 6.1 Automated Audit Log Schema
The `public.audit_log` table captures critical administrative events:
- Staff logins and logouts
- Menu item price changes (storing previous price, new price, changed by UID)
- Order refund issuances and payment status overrides
- Staff role promotions and demotions
- Restaurant business settings and tax rate changes

### 6.2 PostgreSQL Automated Triggers
Automated database triggers guarantee tamper-resistant logging even if queries originate outside the web app:
- `trg_audit_menu_price_change` on `menu_items` (fired on `UPDATE` of `price`)
- `trg_audit_staff_profile_change` on `staff_profiles` (fired on `INSERT`, `UPDATE`, `DELETE`)
- `trg_audit_restaurant_settings_change` on `restaurants` (fired on `UPDATE` of tax/settings)
- `trg_audit_payment_refund` on `payments` (fired on status transition to `refunded`)

Audit logs can be reviewed by authorized managers and owners directly in the dashboard at `/staff/audit`.

---

## 7. Secrets Management & Key Rotation Procedures

### 7.1 Secret Storage Rules
- `.env` files must **never** be committed to version control. Verified via root `.gitignore`.
- Production credentials are kept exclusively in hosting secret managers (Vercel Environment Variables, Render Secret Files, Supabase Vault).

### 7.2 Key Rotation Schedule & Runbooks

| Secret / Key | Rotation Frequency | Rotation Procedure |
| :--- | :--- | :--- |
| **Supabase JWT Secret** | Annually or upon breach | Supabase Dashboard -> Project Settings -> API -> Generate new JWT secret. Re-deploy web app with new `VITE_SUPABASE_ANON_KEY`. |
| **Supabase Service Role Key**| Bi-annually | Regenerate in Supabase Dashboard. Immediately update Supabase Edge Functions environment variables. |
| **Cloudflare Turnstile Secret**| Annually | Cloudflare Dashboard -> Turnstile -> Select Widget -> Rotate Secret Key. Update `TURNSTILE_SECRET_KEY` in Supabase Secrets. |
| **Payment Gateway Keys** | Quarterly | Razorpay/Stripe Dashboard -> API Keys -> Roll Key (allow 24h grace period). Update backend webhook and checkout secrets. |
| **Database Passwords** | Bi-annually | Supabase Database Settings -> Reset Database Password. Update connection pooler URI in Edge Functions. |

---

## 8. Backup & Disaster Recovery Strategy

### 8.1 Automated Cloud Backups
- Supabase performs **daily automated physical backups** retained for 7 to 30 days depending on compute tier.
- Point-in-Time Recovery (PITR) is enabled for production, allowing database restoration to any specific second in the preceding 7 days.

### 8.2 Manual Snapshot Export
To export a full schema and data snapshot locally:
```bash
# Dump complete database schema and data
pg_dump --clean --if-exists --no-owner --no-privileges \
  -h db.<project-ref>.supabase.co -U postgres -d postgres > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 8.3 Disaster Recovery Drill
1. Provision a standby Supabase staging instance.
2. Restore latest automated backup or run `supabase/all_migrations_combined.sql`.
3. Verify RLS policies are active:
   ```sql
   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
   ```
4. Perform smoke test for order submission via `create_order_atomic`.

---

## 9. Security Incident Response Checklist

In the event of a suspected security event (e.g. credential compromise, DDoS, unauthorized staff activity):

### Phase 1: Identification & Triage (0–15 Minutes)
- [ ] Determine the scope: is it database, authentication, DDoS, or frontend asset breach?
- [ ] Review recent entries in `public.audit_log` (`SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 100;`).
- [ ] Check Sentry error spike reports and Cloudflare Turnstile challenge failure rates.

### Phase 2: Containment (15–30 Minutes)
- [ ] **Revoke all active staff sessions:** Have an owner invoke "Sign Out Everywhere" or trigger global session revocation in Supabase Auth.
- [ ] **Lock compromised staff accounts:** Set `role = 'inactive'` in `staff_profiles` or delete the user in Supabase Auth.
- [ ] **Rotate exposed API keys:** If an API key or service-role secret is suspected of exposure, follow Section 7.2 immediately.
- [ ] **Enable Cloudflare Under Attack Mode:** If public endpoints are undergoing DDoS, toggle Under Attack mode in Cloudflare DNS.

### Phase 3: Investigation & Remediation (30–120 Minutes)
- [ ] Inspect PostgreSQL access logs via Supabase Log Explorer.
- [ ] Verify if any customer records were queried or modified.
- [ ] Patch any identified edge cases or update RLS policies.
- [ ] Run `npm run build` and run test suite `npm test` to verify clean builds.

### Phase 4: Post-Incident & Recovery
- [ ] Document the root cause, timeline, impact, and mitigation steps.
- [ ] Verify database integrity against backup snapshots.
- [ ] Notify affected stakeholders if PII was accessed in accordance with applicable data privacy regulations.

---

## 10. Dependency Vulnerability Management

- Production dependencies (`npm audit --omit=dev`) are continuously verified with **0 vulnerabilities**.
- Regular scans are run using `npm run audit` and `oxlint`.
- Any dev-dependency security notices (such as build-time AST/glob parsers) are audited against runtime exploitability and updated without compromising UI or configuration integrity.
