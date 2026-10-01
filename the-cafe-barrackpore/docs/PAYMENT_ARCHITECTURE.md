# Phase 1J: Payment Architecture & Checkout Readiness Documentation

## The Café Barrackpore — Hospitality Operations Digital System

---

### 1. Executive Summary & Design Principle

Phase 1J adds the authoritative, multi-provider payment layer to the platform while strictly maintaining the core hospitality design principle:

> **CUSTOMER EXPERIENCE = SIMPLE** (`Browse → Order → Pay → Done` or `Browse → Order → Confirm`)
> **RESTAURANT OPERATIONS = POWERFUL** (`Order → Payment → Kitchen → Completion`)

The payment architecture guarantees:
- Complete decoupling of **operational order lifecycle** (`pending`, `preparing`, `ready`, `completed`) from **payment state** (`not_required`, `pending`, `processing`, `paid`, `failed`, `cancelled`, `refunded`, `partially_refunded`).
- **Kitchen Safety (KDS Protection)**: Unpaid orders (`payment_status === 'pending'` or `'failed'`) are strictly withheld from the Kitchen Display System until payment is authoritatively verified.
- **Server-Side Price Integrity**: All prices and taxes are re-calculated and validated server-side against canonical menu definitions and live 86'd availability. Client-supplied totals and line prices are never trusted.
- **Zero Client Credential Leakage**: No private provider secrets (e.g. Stripe secret keys, Razorpay key secrets) ever touch client bundles, browser localStorage, or public configuration.
- **Strict Business Separation**: Restaurant guest payment flows are fully isolated; guest payments go directly to the restaurant's merchant account, never through personal or platform accounts.

---

### 2. Payment Provider Abstraction Layer

The platform uses a pluggable, provider-agnostic interface (`PaymentProviderAdapter`) located in `src/services/payments/types.ts`:

```typescript
export interface PaymentProviderAdapter {
  readonly provider: PaymentProvider;
  readonly isConfigured: boolean;

  createCheckoutSession(params: CreatePaymentParams): Promise<PaymentCheckoutResult>;
  verifyPayment(params: VerifyPaymentParams): Promise<PaymentVerificationResult>;
  handleWebhook(rawPayload: unknown, signatureHeader?: string, idempotencyKey?: string): Promise<WebhookEventResult>;
  refundPayment?(params: RefundPaymentParams): Promise<RefundResult>;
}
```

#### Implemented Adapters:
1. **StripeAdapter (`src/services/payments/stripeAdapter.ts`)**:
   - Generates hosted Stripe Checkout sessions via server-side endpoints.
   - Verifies Stripe payment intents and checkout sessions.
   - Validates HMAC signatures on incoming Stripe webhooks (`checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`).
2. **RazorpayAdapter (`src/services/payments/razorpayAdapter.ts`)**:
   - Generates server-side Razorpay order IDs with exact paise calculation.
   - Verifies SHA256 payment signatures (`razorpay_order_id|razorpay_payment_id`).
   - Validates webhook payloads (`payment.captured`, `order.paid`, `payment.failed`).
3. **DemoAdapter (`src/services/payments/demoAdapter.ts`)**:
   - Authorizes zero-cost simulation transactions for demonstration and staging without real currency charges.
   - Supports failure simulation (`demo_fail_card_declined`) to test recovery workflows.

---

### 3. Payment States & Operational Order Lifecycle

Payment state and kitchen order state are managed independently:

| Payment Status | Description | KDS Visibility |
| :--- | :--- | :--- |
| `not_required` | Pay-at-counter or online payments disabled | **Eligible** (Enters Kitchen) |
| `pending` | Payment session initiated; awaiting customer completion | **Withheld** (Excluded from KDS) |
| `processing` | Payment gateway is processing transaction | **Withheld** (Excluded from KDS) |
| `paid` | Authoritatively verified successful charge | **Eligible** (Enters Kitchen) |
| `failed` | Payment declined or cancelled by customer | **Withheld** (Excluded from KDS) |
| `cancelled` | Payment session expired or aborted | **Withheld** (Excluded from KDS) |
| `refunded` | Staff-authorized full refund executed | Handled by Staff Dashboard |
| `partially_refunded`| Staff-authorized partial refund executed | Handled by Staff Dashboard |

---

### 4. Authoritative Server-Side Pricing & Integrity Check

The client cart communicates with `paymentService.validateAndCalculateOrderPayment()`:
1. Every cart item is matched against canonical `menuData` by `id` or name.
2. Canonical price is extracted; client-passed prices are disregarded.
3. Item 86'd status is queried from `menuAvailabilityService`. If sold out, checkout is halted with an explicit error.
4. Line totals and subtotals are rounded using standard financial rounding.
5. Configured taxes (`inclusive` or `exclusive`) are calculated according to active restaurant configuration.
6. If the client supplies a total that differs from the server calculation by more than 0.05 units, the transaction is rejected as tampered.

---

### 5. Webhook Handling & Idempotency

- **Webhook Endpoint**: `supabase/functions/payment-webhook/index.ts`
- **Signature Verification**: Every incoming webhook is cryptographically checked against the provider webhook secret before any database mutation occurs.
- **Idempotency Protection**: Every payment session and webhook event uses an idempotency key logged in the `payments` table. Replayed webhooks return HTTP 200 without creating duplicate financial records.
- **Payment Retry Idempotency**: If a customer's payment fails or is declined, clicking "Try Payment Again" reuses the same `orderRef` and updates the existing order row rather than generating duplicate pending kitchen tickets.

---

### 6. Restaurant Setup & Configuration

Restaurant owners configure payment options in **Staff Dashboard → Settings → Payment Architecture & Checkout**:
- **Payment Enabled**: Toggle online payments active or disabled.
- **Provider**: Select `Stripe`, `Razorpay`, or `Demo`.
- **Payment Mode**:
  - `disabled`: All orders operate in pay-at-counter mode (`payment_status = 'not_required'`).
  - `online`: Customer must pay online before order is dispatched to kitchen.
  - `optional`: Customer chooses between "Pay Online" and "Pay at Counter" during checkout.

#### Environment Variables (Server-Side Only):
```bash
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Razorpay
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

---

### 7. International Deployment Compatibility

Payment methods and currency align with Phase 1I localization presets:
- **India (IN)**: `INR` (₹), Razorpay default, GST inclusive tax.
- **United States (US)**: `USD` ($), Stripe default, state sales tax exclusive.
- **United Kingdom (GB)**: `GBP` (£), Stripe default, VAT inclusive.
- **UAE (AE)**: `AED`, Stripe default, VAT inclusive.
- **Canada (CA)**: `CAD` (CA$), Stripe default, HST/GST exclusive.
- **Australia (AU)**: `AUD` (A$), Stripe default, GST inclusive.

Provider eligibility, account requirements, and supported payment methods depend on the restaurant's country and merchant agreement.
