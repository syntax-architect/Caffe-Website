# Supabase Database Setup & Architecture Guide

This guide walks you through setting up Supabase as the backend foundation for **The Café Barrackpore** order pipeline.

---

## 1. Why Supabase Instead of Sanity for Orders?

* **Sanity CMS** is designed for editorial, marketing, and read-heavy visual content (menu items, cafe vibe, gallery, stories). It is **not** a relational transactional database. Mutating Sanity documents directly from a client browser requires a secret write-token that cannot be safely exposed to anonymous visitors, and it lacks SQL constraints, ACID transactions, and Row Level Security.
* **Supabase (PostgreSQL)** provides ACID transactions, Row Level Security (RLS), relational integrity between orders and line items, performant indexes, and real-time support for future kitchen/admin dashboard updates.

---

## 2. Creating a Supabase Project

1. Go to [supabase.com](https://supabase.com) and log in or create an account.
2. Click **New Project**.
3. Choose your Organization.
4. Enter a name (e.g. `the-cafe-barrackpore`).
5. Choose a secure database password (save this securely).
6. Select the region closest to your café (e.g., `Central India (Mumbai)` / `ap-south-1` for optimal latency).
7. Choose the Free tier and click **Create new project**.
8. Wait 1–2 minutes for the database instance to provision.

---

## 3. Finding Your API Credentials

1. In the Supabase project dashboard, navigate to **Project Settings** (gear icon in the left sidebar).
2. Click on **API** under the Configuration section.
3. Locate:
   * **Project URL**: Found under `Project URL`. Example: `https://xyzcompany.supabase.co`.
   * **anon public Key**: Found under `Project API keys` labeled `anon` `public`.
     > **SECURITY NOTE**: Only ever use the `anon` `public` key in the frontend. **NEVER** use or paste the `service_role` key into client-side code or `.env`.

---

## 4. Running the Database Migration

1. In the Supabase dashboard sidebar, click on **SQL Editor**.
2. Click **New Query**.
3. Open the migration file in this repository:
   `supabase/migrations/001_initial_orders.sql`
4. Copy the entire contents of `001_initial_orders.sql` and paste it into the SQL Editor.
5. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`).
6. You should see `Success. No rows returned`.

### What This Migration Creates
* **`orders` table**: Stores order reference (`order_ref`), customer name, phone number, order type (`dine_in` / `takeaway`), optional table number, special requests, subtotal, total, status, and timestamps.
* **`order_items` table**: Stores historical snapshot of each menu item purchased (name, quantity, unit price, line total) linked by `order_id` with cascading deletes.
* **Integrity Constraints**: Enforces positive quantities, non-negative amounts, phone format, and required table numbers for dine-in orders.
* **Row Level Security (RLS)**: Enforces privacy policies so public users can only INSERT orders, but cannot read or alter existing customer records.
* **`create_order_atomic` RPC**: An atomic transactional stored procedure that ensures the order header and its items are recorded together in a single operation.

---

## 5. Adding Local Environment Variables

1. In the project directory (`the-cafe-barrackpore`), create a file named `.env`:
   ```bash
   cp .env.example .env
   ```
2. Populate the keys:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
3. Restart the Vite development server so the environment variables take effect:
   ```bash
   npm run dev
   ```

---

## 6. How Row Level Security (RLS) Protects Customer Data

Row Level Security is enabled on both `orders` and `order_items`:
* **Public Anonymous Access (`anon`)**:
  * ✅ `INSERT`: Anonymous customers can submit new orders.
  * ❌ `SELECT`: Anonymous customers **cannot** view or list orders. Scrapers or malicious users cannot query past orders, phone numbers, or table numbers.
  * ❌ `UPDATE`: Anonymous customers cannot modify orders.
  * ❌ `DELETE`: Anonymous customers cannot delete orders.
* **Authenticated / Staff Access (Future Phase)**:
  * Staff authenticated with café admin credentials will have full SELECT and UPDATE permissions to manage order lifecycles (`pending` → `confirmed` → `preparing` → `ready` → `completed`).

---

## 7. Local Demo Mode (Graceful Fallback)

If `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` are not configured (or if network connectivity is interrupted):
1. **The application never crashes**: [`src/lib/supabase.ts`](file:///c:/Users/Pc/OneDrive/Desktop/Caffe%20BKP/the-cafe-barrackpore/src/lib/supabase.ts) exports `isSupabaseConfigured = false`.
2. **Cart & Checkout remain fully functional**:
   * The client-side order reference (`CB-YYYY-XXXX`) is dynamically generated.
   * Review step displays all calculations.
   * Confirming the order dispatches directly to WhatsApp with the structured ticket.
   * If an online backend attempt fails, a clear inline notice informs the user and allows immediate completion via WhatsApp without losing their cart.

---

## 8. Verifying a Test Order

1. Run `npm run dev` and open the website in your browser.
2. Add one or two items to your cart (e.g. 1 × Cappuccino, 1 × Margherita Pizza).
3. Open the Cart Drawer and click **Proceed to Checkout**.
4. Enter test details:
   * **Name**: `Ayan Roy`
   * **Phone**: `9876543210`
   * **Order Type**: `Dine-in`
   * **Table**: `Table 5`
5. Click **Review Order**.
6. Note the generated temporary reference (e.g. `CB-2026-A1B2`).
7. Click **Send Order via WhatsApp**.
8. Verify in your Supabase dashboard:
   * Go to **Table Editor** > `orders`. You should see the new row with `order_ref`, `customer_name: Ayan Roy`, `order_type: dine_in`, and status `'pending'`.
   * Go to **Table Editor** > `order_items`. You should see the corresponding item rows with prices and quantities correctly linked to the order ID.

---

## 9. Running Migration 002 (Reservations Foundation)

1. In your Supabase Dashboard, open **SQL Editor**.
2. Click **New Query**.
3. Copy the contents of [`supabase/migrations/002_reservations.sql`](file:///c:/Users/Pc/OneDrive/Desktop/Caffe%20BKP/the-cafe-barrackpore/supabase/migrations/002_reservations.sql) and paste it into the editor.
4. Click **Run**.

### What Migration 002 Creates:
* **`reservations` table**:
  * `id`: UUID primary key.
  * `reservation_ref`: Unique human-friendly reference format `RS-YYYY-XXXX` (e.g. `RS-2026-7K2P`).
  * `customer_name`, `customer_phone`: Validated contact details.
  * `reservation_date`, `reservation_time`: Booking schedule.
  * `party_size`: Validated between 1 and 20 guests for online booking.
  * `special_requests`: Dietary preferences, anniversary/birthday seat requests.
  * `status`: Restricted via constraint to: `pending`, `confirmed`, `seated`, `completed`, `cancelled`, `no_show`.
  * `source`: Defaults to `'website'`.
  * `created_at`, `updated_at`: Automatically tracked timestamps.
* **Row Level Security (RLS)**:
  * Anonymous customers have `INSERT` permissions only.
  * `SELECT`, `UPDATE`, and `DELETE` are denied to anonymous visitors so customer phone numbers and dining schedules remain strictly confidential.
* **`create_reservation_atomic` RPC**:
  * Secure PostgreSQL function defined with `SECURITY DEFINER` and locked-down `SET search_path = public`.
  * Public execution granted exclusively to `anon, authenticated`.

---

## 10. Verifying a Test Reservation

1. Open the website and click **Reserve Table** (in header, hero, or footer).
2. Enter reservation details:
   * **Full Name**: `Ananya Bose`
   * **Phone Number**: `9830123456`
   * **Number of Guests**: `4`
   * **Date**: Pick a future date
   * **Time**: `7:30 PM` (19:30)
   * **Special Requests**: `Window table for anniversary`
3. Click **Confirm on WhatsApp**.
4. WhatsApp opens with the generated reservation ticket:
   ```text
   🌟 *THE CAFÉ BARRACKPORE* 🌟
   *RESERVATION REQUEST: RS-2026-4X9B*

   *Name:* Ananya Bose
   *Phone:* 9830123456
   *Guests:* 4
   *Date:* 2026-10-15
   *Time:* 19:30
   *Special Requests:* Window table for anniversary

   Please confirm table availability.
   ```
5. Check your Supabase Dashboard:
   * Go to **Table Editor** > `reservations`.
   * Confirm the row exists with `reservation_ref: RS-2026-4X9B`, `party_size: 4`, and `status: pending`.

---

## 11. Staff Authentication Setup (Phase 1F)

The Café Barrackpore utilizes Supabase Authentication for restaurant staff, managers, and owners. No passwords or tokens are stored on client devices, and public self-registration is strictly disabled.

### 11.1 Running Migration 003 (Staff Profiles & Roles)

1. In your Supabase Dashboard, open **SQL Editor**.
2. Click **New Query**.
3. Copy the contents of [`supabase/migrations/003_staff_profiles.sql`](file:///c:/Users/Pc/OneDrive/Desktop/Caffe%20BKP/the-cafe-barrackpore/supabase/migrations/003_staff_profiles.sql) and paste it into the editor.
4. Click **Run**.

### What Migration 003 Creates:
* **`staff_profiles` table**:
  * `id`: UUID primary key.
  * `user_id`: Foreign key linked directly to `auth.users(id)` with cascading delete.
  * `full_name`: Staff member's name.
  * `role`: Enforced by database constraint: `'owner'`, `'manager'`, or `'staff'`.
  * `active`: Boolean flag (default `true`) allowing instant deactivation of staff access without deleting historical logs.
* **Security Definer Database Functions**:
  * `is_active_staff(uid)`: Returns `true` if the user ID maps to an active profile.
  * `get_staff_role(uid)`: Securely returns the active staff role.
* **Row Level Security (RLS)**:
  * Staff can only view their own profile unless granted management/owner privileges.
  * Active staff members are granted SELECT and UPDATE access on `orders` and `reservations`.
  * Anonymous public users remain completely locked out from reading staff, order, or reservation records.

### 11.2 How to Create the First Staff User Manually

Since there is no public registration (`/staff/register` does not exist), staff accounts are provisioned via Supabase:

1. In your Supabase Dashboard, go to **Authentication** > **Users**.
2. Click **Add user** > **Create user**.
3. Enter the staff member's email (e.g. `owner@thecafebarrackpore.com`) and a temporary strong password.
4. Check **Auto Confirm User?** so the user can immediately log in without email confirmation delays.
5. Click **Create user**.
6. Copy the generated **User UID** (e.g. `a1b2c3d4-e5f6-7890-abcd-ef1234567890`).

### 11.3 Linking the Staff Profile

In the Supabase **SQL Editor**, run an insert linking the Auth UID to a staff role:

```sql
INSERT INTO public.staff_profiles (user_id, full_name, role, active)
VALUES (
    'PASTE-YOUR-USER-UID-HERE',
    'Cafe Owner',
    'owner',
    true
);
```

### 11.4 Available Roles & Permissions Hierarchy

| Role | Description | Initial Access |
| :--- | :--- | :--- |
| `owner` | Café owners & proprietors | Full access to staff profiles, future settings, analytics, orders, and reservations. |
| `manager` | Shift / Floor managers | View staff profiles, operational order/reservation management. |
| `staff` | Kitchen staff & floor servers | View and update orders and reservations. |

### 11.5 Active / Inactive Behavior

* If an account has `active = false` in `staff_profiles`:
  * Supabase RLS automatically denies SELECT on `orders`, `reservations`, and `staff_profiles`.
  * Attempting to log in will display: *"Your staff account is currently deactivated. Please contact the administrator."*
  * The session is immediately revoked.

### 11.6 Accessing the Staff Portal

1. Visit `/staff/login` in your browser.
2. Enter your authorized staff email and password.
3. Upon successful validation, you are redirected to `/staff/dashboard`.
4. Any attempt by an anonymous user to visit `/staff/*` directly redirects immediately to `/staff/login`.
5. To end a staff session, click **Sign Out** from the staff header.

---

## 12. Security Guidelines

* **Never place `SUPABASE_SERVICE_ROLE_KEY` in frontend `.env` or client code.** Service-role keys bypass all Row Level Security.
* Only use `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in client environments.
* RLS is enforced at the database kernel level in PostgreSQL, ensuring client modifications cannot bypass access restrictions.

---

## 13. Phase 1G — Restaurant Tables & Operational Settings (Migration 004)

Phase 1G introduces the restaurant command center with floor management, optical QR codes, and operational toggles.

### 13.1 Running Migration 004

1. In the Supabase SQL Editor, open `supabase/migrations/004_restaurant_tables.sql`.
2. Paste the SQL script and click **Run**.

### 13.2 What Migration 004 Creates

* **`restaurant_tables` table**:
  * Tracks floor table numbers (`01`, `02`, ..., `12`), guest capacity, location label (e.g. *Riverside Alcove*, *Espresso Bar*), and active status.
  * Seeded with Tables 01 to 12.
  * Public read access enabled for QR menu validation.
  * Staff/Manager/Owner update and creation rights governed by RLS.
* **`restaurant_settings` table**:
  * Manages live operational controls (`is_ordering_enabled`, `is_table_booking_enabled`, `opening_time`, `closing_time`, `announcement_banner`).
  * Seeded with default restaurant operating hours (11:00 AM – 10:30 PM).
  * Read access for all active staff and public clients.
  * Owner-only UPDATE permission enforced via `is_active_owner()` RLS policy.

### 13.3 Staff Dashboard Sub-Routes

| Route | Minimum Role | Features |
| :--- | :--- | :--- |
| `/staff/dashboard` | `staff` | Live operational KPIs, recent live orders, today's reservations, quick actions. |
| `/staff/orders` | `staff` | Filterable order management, search by reference/phone, slide-over order inspector, status transition controls. |
| `/staff/reservations` | `staff` | Filter by Today/Upcoming/All, guest party size, status flow (confirmed, seated, completed, cancelled). |
| `/staff/tables` | `staff` | Interactive floor table grid, optical QR code modal with 1-click browser printing (`/qr?table=XX`). |
| `/staff/menu` | `staff` | Menu catalog browser, category tabs, diet filters, instant 86'd (out-of-stock) toggle, item editor. |
| `/staff/content` | `manager` | Website hero, about, specials, and gallery content controls with friendly labels. |
| `/staff/staff` | `owner` | In-app staff roster, role adjustments, account deactivation/reactivation, staff provisioning. |
| `/staff/settings` | `owner` | Emergency ordering/booking switches, café operating hours, announcement banners. |

---

## 14. Phase 1G.1 — Production Persistence & 86'd State Layer (Migration 005)

Phase 1G.1 eliminates the two known operational limitations: permanent Sanity content mutations and persistent cross-device 86'd menu availability.

### 14.1 Running Migration 005

1. In the Supabase SQL Editor, open `supabase/migrations/005_menu_availability.sql`.
2. Paste the SQL script and click **Run**.

### 14.2 What Migration 005 Creates

* **`menu_item_availability` table**:
  * Fields: `item_id VARCHAR(100) PRIMARY KEY`, `is_available BOOLEAN`, `reason VARCHAR(255)`, `updated_by UUID`, `updated_at TIMESTAMPTZ`.
  * RLS Policies:
    * `public_read_menu_availability`: Public customers and QR menu readers can SELECT current stock availability.
    * `staff_manage_menu_availability`: Only active staff members (`is_active_staff()`) can insert, update, or toggle items.
* **`toggle_menu_item_availability` RPC**:
  * Atomically toggles or updates an item's in-stock/sold-out state while checking `is_active_staff()`.

### 14.3 Secure Sanity Edge Function Deployment

To deploy the secure server-side mutation function to Supabase:

```bash
# 1. Set Sanity write credentials in Supabase project secrets (never in client!)
supabase secrets set SANITY_WRITE_TOKEN="your-sanity-write-token-here"
supabase secrets set SANITY_PROJECT_ID="vob0hoxy"
supabase secrets set SANITY_DATASET="production"

# 2. Deploy the Edge Function
supabase functions deploy sanity-content-mutate
```

The function authenticates the Supabase session, checks `staff_profiles` for `owner` or `manager` role, and mutates Sanity documents server-side.

---

## 15. Phase 1I — International Restaurant Deployment & Configuration (Migration 007)

Phase 1I makes the platform globally deployable for restaurants in **India (IN), United States (US), United Kingdom (GB), United Arab Emirates (AE), Canada (CA), Australia (AU)**, and beyond without rewriting code or introducing customer friction.

### 15.1 Running Migration 007

1. In the Supabase SQL Editor, open `supabase/migrations/007_internationalization.sql`.
2. Run the migration to add international columns to `restaurant_settings` and `orders`:
   ```sql
   ALTER TABLE restaurant_settings 
     ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'IN',
     ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR',
     ADD COLUMN IF NOT EXISTS currency_symbol TEXT NOT NULL DEFAULT '₹',
     ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'en-IN',
     ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
     ADD COLUMN IF NOT EXISTS phone_country_code TEXT NOT NULL DEFAULT '+91',
     ADD COLUMN IF NOT EXISTS tax_enabled BOOLEAN NOT NULL DEFAULT true,
     ADD COLUMN IF NOT EXISTS tax_mode TEXT NOT NULL DEFAULT 'inclusive',
     ADD COLUMN IF NOT EXISTS tax_label TEXT NOT NULL DEFAULT 'GST',
     ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(6,4) NOT NULL DEFAULT 0.05,
     ADD COLUMN IF NOT EXISTS dietary_system TEXT NOT NULL DEFAULT 'india',
     ADD COLUMN IF NOT EXISTS primary_contact_method TEXT NOT NULL DEFAULT 'whatsapp',
     ADD COLUMN IF NOT EXISTS email TEXT,
     ADD COLUMN IF NOT EXISTS city TEXT,
     ADD COLUMN IF NOT EXISTS state_region TEXT,
     ADD COLUMN IF NOT EXISTS postal_code TEXT;

   ALTER TABLE orders 
     ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR';
   ```

### 15.2 Configuring Localization Settings in Staff Dashboard

Restaurant owners can configure localization at `/staff/settings` with 1-click Country Presets or individual parameter controls:

1. **Country & Currency**: Select ISO 3166-1 alpha-2 code (`IN`, `US`, `GB`, `AE`, `CA`, `AU`) and ISO 4217 currency (`INR`, `USD`, `GBP`, `AED`, `CAD`, `AUD`).
2. **Display Locale**: Configures `Intl.NumberFormat` and date display (`en-IN`, `en-US`, `en-GB`, `en-AE`).
3. **Timezone**: All hours, orders, reservations, and KDS clocks format to the restaurant's local IANA timezone (`Asia/Kolkata`, `America/New_York`, `Europe/London`, `Asia/Dubai`).
4. **Phone Validation**: International E.164 normalization supporting formats like `+1 212 555 0198`, `+44 20 7946 0958`, `+971 50 123 4567`, and `+91 98301 11222`.
5. **Tax Architecture**:
   - `inclusive` mode (GST / VAT): tax included in menu prices.
   - `exclusive` mode (US / Canada Sales Tax): tax dynamically computed and added at checkout.
   - Configurable tax label (e.g., `GST`, `Sales Tax`, `VAT`, `HST`) and percentage rate.
6. **Dietary Presentation**:
   - `india`: Indian FSSAI Veg / Non-Veg dot symbols.
   - `international`: Modern badges for Vegetarian, Vegan, Gluten-Free, Nut-Free, etc.
7. **Customer Concierge Channels**: Configurable primary channel (`whatsapp`, `phone`, `email`).

### 15.3 Deployment Presets Reference

#### 🇮🇳 India (Default)
```json
{
  "country": "IN",
  "currency": "INR",
  "currencySymbol": "₹",
  "locale": "en-IN",
  "timezone": "Asia/Kolkata",
  "phoneCountryCode": "+91",
  "taxMode": "inclusive",
  "taxLabel": "GST",
  "taxRate": 0.05,
  "dietarySystem": "india",
  "primaryContactMethod": "whatsapp"
}
```

#### 🇺🇸 United States
```json
{
  "country": "US",
  "currency": "USD",
  "currencySymbol": "$",
  "locale": "en-US",
  "timezone": "America/New_York",
  "phoneCountryCode": "+1",
  "taxMode": "exclusive",
  "taxLabel": "Sales Tax",
  "taxRate": 0.0825,
  "dietarySystem": "international",
  "primaryContactMethod": "phone"
}
```

#### 🇬🇧 United Kingdom
```json
{
  "country": "GB",
  "currency": "GBP",
  "currencySymbol": "£",
  "locale": "en-GB",
  "timezone": "Europe/London",
  "phoneCountryCode": "+44",
  "taxMode": "inclusive",
  "taxLabel": "VAT",
  "taxRate": 0.20,
  "dietarySystem": "international",
  "primaryContactMethod": "phone"
}
```

#### 🇦🇪 United Arab Emirates
```json
{
  "country": "AE",
  "currency": "AED",
  "currencySymbol": "AED",
  "locale": "en-AE",
  "timezone": "Asia/Dubai",
  "phoneCountryCode": "+971",
  "taxMode": "inclusive",
  "taxLabel": "VAT",
  "taxRate": 0.05,
  "dietarySystem": "international",
  "primaryContactMethod": "whatsapp"
}
```

### 15.4 Historical Order Currency Safety
Orders store their originating `currency` (e.g. `'INR'`). Changing the restaurant configuration currency in the future does **NOT** alter the currency code or value of historical orders. The dashboard inspects `order.currency || config.currency` for presentation.

### 15.5 Scope Boundaries & Limitations
* **Payment Architecture**: Built in Phase 1J via provider-agnostic adapters (`StripeAdapter`, `RazorpayAdapter`, `DemoAdapter`).
* **Customer Accounts**: No customer sign-up or login walls. Guest checkout remains the primary journey.

---

## 16. Phase 1J: Payment Architecture & Ledger Integration

### 16.1 Migration `008_payment_architecture.sql`
Phase 1J adds the authoritative payment layer to support restaurant customer payments while keeping kitchen operations protected:

1. **`orders` Table Extensions**:
   - `payment_required` (`boolean DEFAULT false`)
   - `payment_status` (`text DEFAULT 'not_required'`)
   - `payment_provider` (`text DEFAULT NULL`)
   - `payment_reference` (`text DEFAULT NULL`)
   - `payment_amount` (`numeric(10,2) DEFAULT NULL`)
   - `paid_at` (`timestamptz DEFAULT NULL`)

2. **Authoritative `payments` Ledger Table**:
   - Stores payment transactions, provider payment IDs, idempotency keys, and payment status updates.
   - Enforces unique index on `(order_ref, provider_payment_id)`.

3. **`restaurant_settings` Extensions**:
   - `payment_enabled` (`boolean DEFAULT false`)
   - `payment_provider` (`text DEFAULT 'razorpay'`)
   - `payment_mode` (`text DEFAULT 'disabled'`)

4. **KDS Payment Eligibility**:
   - Active kitchen columns strictly query orders where `payment_status` is `'paid'` or `'not_required'`.
   - Orders with `payment_status` of `'pending'` or `'failed'` are withheld until payment confirmation.

5. **Edge Function Webhook Dispatcher**:
   - `supabase/functions/payment-webhook/index.ts` validates provider webhook signatures, enforces idempotency, and mutates `orders` and `payments` tables atomically.



