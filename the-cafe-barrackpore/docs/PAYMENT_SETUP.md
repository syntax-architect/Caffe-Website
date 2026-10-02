# Payment Gateway Setup & Operations Guide
**The Café Barrackpore — Provider-Agnostic Payment Architecture**

---

## 1. Architecture Overview

The payment system is built on a **provider-agnostic architecture** supporting **Razorpay** (India standard: UPI, RuPay, cards, net banking, wallets), **Stripe** (international cards, Apple Pay, Google Pay), and **Offline Counter Settlement**.

```
┌────────────────────────────────────────────────────────┐
│                   Customer Frontend                    │
│   (CartDrawer - opens Razorpay SDK / Stripe Checkout)   │
└───────────────┬────────────────────────▲───────────────┘
                │                        │
         1. create-payment       4. Realtime / Polling
                │                  (Paid confirmation)
                ▼                        │
┌───────────────────────────────┐        │
│    Supabase Edge Functions    │        │
│  - create-payment             │        │
│  - payment-webhook ───────────┼────────┘
│  - payment-health-check       │  3. Webhook (HMAC verified)
│  - process-refund             │        ▲
└───────────────┬───────────────┘        │
                │                        │
                ▼                        │
┌────────────────────────────────────────┴───────────────┐
│           Payment Provider (Razorpay / Stripe)         │
└────────────────────────────────────────────────────────┘
```

### Critical Security Principles
1. **Zero Secret Leakage:** Secret keys (`RAZORPAY_KEY_SECRET`, `STRIPE_SECRET_KEY`, `RAZORPAY_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET`) are **never** stored in the database and **never** embedded in client bundles.
2. **Authoritative Totals:** The frontend never submits the payable total to the payment gateway. The `create-payment` Edge Function calculates the exact order amount directly from the database menu records and active tax/service charge configuration.
3. **Webhook Verification:** The frontend never updates order payment status to `paid`. All settlements are verified server-side inside `payment-webhook` using constant-time cryptographic signatures before updating `payment_status = 'paid'`.
4. **Dev Code Stripping:** Demo and simulator adapters are wrapped in `import.meta.env.DEV` conditions and completely eliminated by Vite in production builds.

---

## 2. Prerequisites & Credentials Checklist

### Razorpay Setup (India UPI, Cards, Net Banking)
1. Sign up or log into [Razorpay Dashboard](https://dashboard.razorpay.com).
2. Complete KYC verification for Live mode, or activate **Test Mode** from the top-left toggle.
3. Go to **Settings > API Keys** and click **Generate Key**.
   - Note the **Key ID** (public, e.g. `rzp_test_...` or `rzp_live_...`).
   - Note the **Key Secret** (confidential, e.g. `abcdef123456...`).
4. Go to **Settings > Webhooks** and click **Add New Webhook**.

### Stripe Setup (International Cards, Apple Pay, Google Pay)
1. Sign up or log into [Stripe Dashboard](https://dashboard.stripe.com).
2. Go to **Developers > API keys**.
   - Note the **Publishable key** (public, e.g. `pk_test_...` or `pk_live_...`).
   - Note the **Secret key** (confidential, e.g. `sk_test_...` or `sk_live_...`).
3. Go to **Developers > Webhooks** and click **Add destination**.

---

## 3. Configuring Supabase Edge Function Secrets

All sensitive credentials must be set in your Supabase project using the Supabase CLI or the Supabase Management Dashboard (**Project Settings > Edge Functions > Secrets**).

Run the following commands using the Supabase CLI:

```bash
# Razorpay Credentials
supabase secrets set RAZORPAY_KEY_ID="rzp_test_your_key_id"
supabase secrets set RAZORPAY_KEY_SECRET="your_razorpay_key_secret"
supabase secrets set RAZORPAY_WEBHOOK_SECRET="your_razorpay_webhook_secret"

# Stripe Credentials
supabase secrets set STRIPE_SECRET_KEY="sk_test_your_stripe_secret_key"
supabase secrets set STRIPE_WEBHOOK_SECRET="whsec_your_stripe_webhook_secret"

# Frontend Public Site URL (for Stripe redirect success/cancel URLs)
supabase secrets set SITE_URL="https://thecafebarrackpore.com"
```

> **Note:** To verify your secrets without exposing their values, use the built-in Staff Settings page (`/staff` > **Settings** > **Payment Architecture**), which checks for the presence of these secrets via the `payment-health-check` Edge Function.

---

## 4. Deploying Edge Functions

Deploy the four serverless payment functions to your Supabase project:

```bash
# 1. Authoritative payment creation function
supabase functions deploy create-payment

# 2. Cryptographic webhook verification function
supabase functions deploy payment-webhook

# 3. Secure credential presence health check (booleans only)
supabase functions deploy payment-health-check

# 4. Owner-authorized refund processor
supabase functions deploy process-refund
```

---

## 5. Webhook Endpoints & Event Subscriptions

Webhooks notify the application when a payment succeeds, fails, or is refunded. Configure your endpoints as follows:

### Razorpay Webhook Configuration
- **Webhook URL:**
  ```
  https://<your-project-ref>.supabase.co/functions/v1/payment-webhook?provider=razorpay
  ```
- **Secret:** Enter the string you saved as `RAZORPAY_WEBHOOK_SECRET`.
- **Active Events to Select:**
  - `payment.captured` *(Payment successfully received)*
  - `payment.failed` *(Payment authorization or UPI failed)*
  - `refund.processed` *(Refund issued to customer)*

### Stripe Webhook Configuration
- **Endpoint URL:**
  ```
  https://<your-project-ref>.supabase.co/functions/v1/payment-webhook?provider=stripe
  ```
- **Events to Listen to:**
  - `checkout.session.completed` *(Checkout session paid)*
  - `payment_intent.succeeded` *(Direct card intent charged)*
  - `payment_intent.payment_failed` *(Card declined or failed)*
  - `charge.refunded` *(Charge refunded via dashboard or API)*
- **Signing Secret:** Copy the `whsec_...` key from the webhook details page and set it as `STRIPE_WEBHOOK_SECRET`.

---

## 6. Frontend Environment Configuration

In your frontend `.env` or deployment environment (Vercel, Netlify, Cloudflare Pages), only public client identifiers may be exposed:

```env
# Supabase Connectivity
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...

# Public Gateway Keys (Optional - loaded automatically if configured in settings)
VITE_RAZORPAY_KEY_ID=rzp_live_your_public_id
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your_publishable_key
```

---

## 7. Staff Portal Payment Management

Staff members with the **Owner** role manage payment policies directly in the Staff Portal (`/staff`):

1. **Active Provider Selection:**
   - Choose **Razorpay**, **Stripe**, or **None / Counter Only**.
   - In production builds, the local mock simulator is completely removed.
2. **Gateway Health Check:**
   - Click **Check Status** to query `payment-health-check`.
   - The badge displays `Connected` if all required Edge Function secrets are present.
3. **Send Test Payment:**
   - Click **Send Test Payment** to dispatch an automated test transaction to verify end-to-end communication with the gateway without placing a real order.
4. **Allow Pay at Counter:**
   - Toggle **Allow Pay at Counter** to allow customers to pay in person at the table/counter or fall back to counter settlement if their online payment is declined.
5. **Issuing Refunds:**
   - Navigate to `/staff` > **Orders**.
   - Click on any order with `payment_status = 'paid'`.
   - Authorized owners can click **Issue Full Refund** to trigger the `process-refund` Edge Function.

---

## 8. Switching from Test Mode to Production Live Mode

When ready to accept real customer funds:

1. **Activate Live Mode in Gateways:**
   - Razorpay: Switch toggle from "Test" to "Live", generate Live Key ID & Secret.
   - Stripe: Switch toggle from "Test mode" to "Live mode", copy Live Secret Key.
2. **Update Supabase Edge Function Secrets:**
   ```bash
   supabase secrets set RAZORPAY_KEY_ID="rzp_live_..."
   supabase secrets set RAZORPAY_KEY_SECRET="..."
   supabase secrets set RAZORPAY_WEBHOOK_SECRET="..."
   
   supabase secrets set STRIPE_SECRET_KEY="sk_live_..."
   supabase secrets set STRIPE_WEBHOOK_SECRET="whsec_..."
   ```
3. **Update Webhook Destinations:**
   - Ensure the Live mode webhooks point to your production Supabase Edge Function URLs.
4. **Verify in Staff Settings:**
   - Open `/staff` > **Settings** and ensure the Gateway Status reflects `Connected`.
   - Perform a ₹1 / $1 live test transaction with a personal card or UPI ID to confirm end-to-end settlement and realtime receipt display.
