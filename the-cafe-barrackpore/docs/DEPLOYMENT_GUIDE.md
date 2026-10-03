# Commercial Production Deployment Guide

## The Café Barrackpore — Hospitality Operations Digital System (Phase 1K)

This guide documents the safe, repeatable, and practical deployment procedure for delivering this digital restaurant operations system to a real paying restaurant client.

---

### 1. Environment Separation Architecture

The platform architecture enforces strict separation between three deployment tiers:

| Tier | Purpose | Database / Integrations | Payment Provider Mode |
| :--- | :--- | :--- | :--- |
| **Local Development** | Engineering, local tests, styling | Local / Dev Supabase instance | `demo` (Mock charges) |
| **Staging / Demonstration** | Client review, pre-flight verification | Isolated staging project | `demo` or Provider Test Mode |
| **Production** | Live restaurant operations & guest ordering | Restaurant's production Supabase | `stripe` / `razorpay` (Live credentials) |

> [!CAUTION]
> A production deployment must **never** connect to developer or staging databases. Ensure production environment variables point exclusively to client-owned production services.

---

### 2. Environment Variables & Secret Hygiene

The application uses an authoritative separation between **client-exposed** configuration and **server-side** secrets.

#### A. Public Client Variables (Vite Bundle)
Configured in `.env` or deployment platform (Vercel, Render, Cloudflare Pages, Netlify):

```bash
# Supabase Public Anonymous Client
VITE_SUPABASE_URL=https://<client-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1Ni...

# Sanity CMS Public Configuration
VITE_SANITY_PROJECT_ID=<client-sanity-id>
VITE_SANITY_DATASET=production

# Authoritative Domain Origin (Optional - overrides window.location.origin)
VITE_SITE_URL=https://www.restaurant.com

# Client-Safe Payment Identifiers (Optional)
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
VITE_RAZORPAY_KEY_ID=rzp_live_...
```

#### B. Privileged Server Secrets (NEVER Exposed to Browser)
Configured in Supabase Vault / Edge Functions (`supabase secrets set`):

```bash
# Supabase Service Role Key
SUPABASE_SERVICE_ROLE_KEY=ey...

# Sanity Write Token (Server mutation endpoint only)
SANITY_WRITE_TOKEN=sk...

# Stripe Secrets (Restaurant's Merchant Account)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Razorpay Secrets (Restaurant's Merchant Account)
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

---

### 3. Step-by-Step Production Supabase Setup

Follow these 10 steps to provision a new client's database:

1. **Create Supabase Project**:
   - Log into [Supabase Dashboard](https://supabase.com).
   - Create a new project in the region closest to the restaurant (e.g., `ap-south-1` for India, `us-east-1` for US).
   - Save the Database Password securely in the restaurant's vault.

2. **Execute Consolidated Migrations (Single Deployment File)**:
   - Open **SQL Editor** in the Supabase Dashboard.
   - Open `supabase/all_migrations_combined.sql` from the repository. Note: `supabase/all_migrations_combined.sql` is the **single deployment file** for all database migrations (legacy `consolidated_schema.sql` has been retired and deleted).
   - Paste the complete contents into the SQL Editor and click **Run**.
   - This atomically applies migrations 001 through 016 in exact dependency order:
     - `001_initial_orders.sql`: Orders, Order Items, and Initial Atomic RPC
     - `002_reservations.sql`: Reservations schema and validation
     - `003_staff_profiles.sql`: Staff profiles, RBAC, and `is_active_staff` functions
     - `004_restaurant_tables.sql`: Dining tables and seat capacities
     - `005_menu_availability.sql`: 86'd Menu availability tracking
     - `006_kitchen_realtime.sql`: Kitchen Realtime publication and state machine (`update_order_status_kitchen`)
     - `007_internationalization.sql`: International localization and currency safety
     - `008_payment_architecture.sql`: Payment architecture and audit ledger (`payments`)
     - `009_menu_and_secure_orders.sql`: Menu & secure orders RPC with atomic recalculation
     - `010_menu_and_site_content.sql`: Menu & site content key-value CMS
     - `011_multi_tenant_and_allergens.sql`: Multi-tenant restaurant_id isolation & allergen badges
     - `012_provider_agnostic_payments.sql`: Provider-agnostic payment architecture & ledger
     - `013_owner_features.sql`: Owner features (happy hours, discounts, stock alerts)
     - `014_order_caps_and_direct_insert_lockdown.sql`: Order caps & direct insert lockdown
     - `015_complete_image_sync.sql`: Complete image synchronization & storage assets
     - `016_security_hardening.sql`: Security hardening (verified single-use Turnstile tokens, double-UUID payment tokens with SHA-256 hash, rate limiting, discount code validation RPC, and revoked public writes)

3. **Verify Row Level Security (RLS)**:
   - Navigate to **Authentication → Policies**.
   - Confirm all tables (`orders`, `order_items`, `reservations`, `staff_profiles`, `restaurant_tables`, `menu_item_availability`, `restaurant_settings`, `site_content`, `discount_codes`, `payments`, `verified_tokens`, `rate_limits`, `happy_hour_schedules`) have RLS **ENABLED**.

4. **Deploy Edge Functions**:
   - Install Supabase CLI locally: `npm i -g supabase`.
   - Link project: `supabase link --project-ref <client-project-ref>`.
   - Deploy webhook handler:
     ```bash
     supabase functions deploy payment-webhook --no-verify-jwt
     ```

5. **Configure Edge Function Secrets**:
   ```bash
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
   supabase secrets set RAZORPAY_WEBHOOK_SECRET=...
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=ey...
   ```

6. **Create Initial Owner Account**:
   - In Supabase Dashboard, go to **Authentication → Users**.
   - Click **Add User → Create User** (enter owner email and strong password).
   - Copy the newly created `User UID`.
   - In **SQL Editor**, link the user as active owner:
     ```sql
     INSERT INTO public.staff_profiles (user_id, full_name, role, active)
     VALUES ('<COPIED_USER_UID>', 'Restaurant Owner', 'owner', true);
     ```

7. **Seed Restaurant Settings**:
   - Update `public.restaurant_settings` with the restaurant's details (or use the Staff Dashboard Settings tab after first login):
     ```sql
     UPDATE public.restaurant_settings
     SET 
       business_name = 'Client Restaurant Name',
       phone = '+12125550198',
       address = '123 Main St, New York, NY 10001',
       country = 'US',
       currency = 'USD',
       currency_symbol = '$',
       locale = 'en-US',
       timezone = 'America/New_York',
       tax_label = 'Sales Tax',
       tax_rate = 0.0825,
       tax_mode = 'exclusive',
       dietary_system = 'international',
       payment_provider = 'stripe',
       payment_mode = 'online',
       payment_enabled = true
     WHERE id = 'current';
     ```

8. **Seed Dining Tables**:
   - In **SQL Editor**, create the physical floor layout:
     ```sql
     INSERT INTO public.restaurant_tables (table_number, label, capacity, active)
     VALUES 
       ('01', 'Window Booth 1', 4, true),
       ('02', 'Window Booth 2', 4, true),
       ('03', 'Center Table', 2, true),
       ('04', 'Private Dining', 8, true);
     ```

9. **Verify Realtime Subscriptions**:
   - In **Database → Publications**, confirm `supabase_realtime` includes `orders` and `order_items`.

10. **Execute Smoke Tests**:
    - Run `npx tsx tests/productionReadiness.test.ts` to verify deployment baseline.

---

### 4. Custom Domain & DNS Configuration

When attaching a custom domain (e.g., `https://www.restaurant.com`):

1. **DNS Records**:
   - `CNAME` for `www.restaurant.com` pointing to the hosting platform.
   - `A` / `ALIAS` for apex `restaurant.com` with automatic HTTP-to-HTTPS redirect.
2. **Environment Variable**:
   - Set `VITE_SITE_URL=https://www.restaurant.com` in hosting environment variables.
   - This ensures all generated table QR codes point to the authoritative domain.
3. **Canonical Domain**:
   - Configure hosting to redirect `restaurant.com` → `www.restaurant.com` (or vice-versa).
   - `MetaTags.tsx` automatically maintains clean `<link rel="canonical">` tags.

---

### 5. Payment Provider Production Verification

> [!IMPORTANT]
> The restaurant client **must connect their own merchant account** (Stripe or Razorpay). The agency never collects customer payments through platform-owned accounts.

#### Verifying Stripe:
1. In Stripe Dashboard, configure webhook destination:
   `https://<project-ref>.supabase.co/functions/v1/payment-webhook?provider=stripe`
2. Select events: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`.
3. Copy Signing Secret into Supabase secrets: `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...`.
4. Perform 1 live end-to-end charge with a test card or real ₹10 / $1 card charge, and verify order enters KDS with `PAID` badge.

#### Verifying Razorpay:
1. In Razorpay Dashboard, navigate to **Settings → Webhooks**.
2. Add Webhook URL:
   `https://<project-ref>.supabase.co/functions/v1/payment-webhook?provider=razorpay`
3. Select events: `payment.captured`, `order.paid`, `payment.failed`.
4. Set secret and configure in Supabase: `supabase secrets set RAZORPAY_WEBHOOK_SECRET=...`.

---

### 6. Rollback Procedure

If a critical issue occurs post-deployment:
1. **Frontend Rollback**:
   - In the hosting dashboard (Vercel/Render/Cloudflare), click **Instant Rollback** to redeploy the previous stable build commit.
2. **Database Rollback**:
   - Each migration in `supabase/migrations/` is modular and backward-compatible.
   - Schema modifications strictly add nullable columns or defaults (`ADD COLUMN IF NOT EXISTS`), ensuring older frontend builds run safely against newer database versions without breaking.
