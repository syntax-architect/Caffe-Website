# The Café Barrackpore — Hospitality Operations Digital System

A full-stack, enterprise-grade digital dining and hospitality platform built for **The Café Barrackpore**.

The platform provides:
- **Interactive Customer Dining Experience**: Storytelling hero with interactive scroll sequence, culinary menu, specials showcase, and reservation booking.
- **Smart QR Dine-In Ordering**: Contactless table ordering with automatic table parameter recognition (`/qr?table=07`) and live cart tracking.
- **Staff Operations & Kitchen Display System (KDS)**: Real-time ticket management, order statuses (`Preparing` → `Ready` → `Completed`), audio chimes, and 86'd menu availability toggling.
- **Owner & Manager Administrative Suite**: Multi-role RBAC (`owner`, `manager`, `staff`), revenue/KPI analytics, table management, print-ready QR codes, and site configuration.
- **Multi-Tenant Foundation & Sovereign Security**: Authoritative server-side pricing, atomic database transactions (`create_order_atomic`), provider-agnostic payments (Stripe/Razorpay), and strict Row Level Security (RLS).

---

## Initial Restaurant Owner Setup (Supabase Auth & Database)

For production security, default credentials and auto-fill mechanisms are strictly disallowed. The initial restaurant owner must be provisioned directly via Supabase Auth and the `staff_profiles` database table:

### 1. Create the Owner User in Supabase Auth
1. In the [Supabase Dashboard](https://supabase.com/dashboard), navigate to **Authentication** → **Users**.
2. Click **Add User** → **Create User**.
3. Enter the owner's official email address and a strong, secure password.
4. Ensure **Auto Confirm User?** is checked so the account is active immediately without email confirmation delay.
5. Click **Create User**.

### 2. Copy the Generated User UID
In the Users list, locate the newly created user and copy their **User UID** (a UUID like `a1b2c3d4-e5f6-7890-abcd-ef1234567890`).

### 3. Insert the Owner Row into `staff_profiles`
Open the **SQL Editor** in your Supabase Dashboard and run:

```sql
INSERT INTO public.staff_profiles (user_id, full_name, role, active, restaurant_id)
VALUES (
  '<COPIED_USER_UID>',
  'Restaurant Owner',
  'owner',
  true,
  'the-cafe-barrackpore'
);
```

### 4. Authenticate at Staff Portal
1. Navigate to `/staff/login` (or `/staff`).
2. Enter the owner's email and password created in step 1 to access the full Owner Dashboard.
3. Subsequent managers and floor staff accounts can be invited and managed directly from the **Staff Management** panel inside the dashboard.

---

## Tech Stack & Architecture

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Framer Motion, Lenis smooth scrolling.
- **Database & Auth**: Supabase (PostgreSQL 15+) with Row Level Security (RLS) and atomic `SECURITY DEFINER` stored procedures.
- **Edge Functions**: Deno Edge Functions for server-side payment intent creation, webhook processing, refund authorization, and health checks.
- **Content Management**: Sanity Clean Content Studio with fallback resilience.
- **Payments**: Provider-agnostic engine supporting Stripe and Razorpay with webhook HMAC-SHA256 signature verification.

---

## Local Development & Setup

### Prerequisites
- Node.js 20+
- npm or pnpm

### Installation
```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Configure your Supabase and Sanity keys in .env
```

### Running Locally
```bash
# Start Vite development server
npm run dev

# Run test suite
npm test

# Run production build
npm run build

# Run linter
npm run lint
```

---

## Security Policies & Database Enforcement

- **Strict Stored Procedure Execution**: Direct table `INSERT` operations on `orders`, `order_items`, and `reservations` are revoked from `anon` and `authenticated` roles. All orders must be transacted through `create_order_atomic(JSONB, JSONB)`, and reservations through `create_reservation_atomic(JSONB)`.
- **Order Quantity Caps**: Quantities per line item are capped to 1–50, and distinct items per order are capped at 40 in `create_order_atomic`.
- **CORS Restricted Edge Functions**: Supabase Edge Functions enforce `ALLOWED_ORIGIN` matching the production domain, while incoming webhooks require zero CORS.
