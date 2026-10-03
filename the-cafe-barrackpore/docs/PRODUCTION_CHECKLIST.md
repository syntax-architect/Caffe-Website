# Pre-Flight Production Deployment Checklist

## The Café Barrackpore — Commercial Deployment Handover Checklist (Phase 1K)

Perform this verification before handing over the digital platform to a paying restaurant client.

---

### Phase 1: Environment & Credential Hygiene
- [ ] No `.env` file committed to version control (`.gitignore` verified).
- [ ] `.env.example` verified with clear public vs. server-side secret separation.
- [ ] `VITE_SUPABASE_URL` points to client's dedicated Supabase production project.
- [ ] `VITE_SUPABASE_ANON_KEY` is the public anon key (NOT the service-role key).
- [ ] Server secrets (`SUPABASE_SERVICE_ROLE_KEY`, `SANITY_WRITE_TOKEN`, `STRIPE_SECRET_KEY`, `RAZORPAY_KEY_SECRET`) are configured exclusively in Supabase Vault / Edge Function secrets.
- [ ] Verified zero private secrets exist in the compiled `dist/` bundle.

---

### Phase 2: Database & Security Integrity
- [ ] All 16 SQL migrations (001–016) applied via the single deployment file `supabase/all_migrations_combined.sql`.
- [ ] Row Level Security (RLS) is enabled on all application tables.
- [ ] `public.staff_profiles` contains at least one active `owner` user profile.
- [ ] `public.is_active_staff` helper is configured with `SECURITY DEFINER` and safe `search_path`.
- [ ] `orders` and `order_items` tables have Realtime publication enabled (`supabase_realtime`).
- [ ] `orders` table has `REPLICA IDENTITY FULL` enabled.
- [ ] `restaurant_settings` is seeded with client's business name, phone, address, currency, and tax parameters.
- [ ] `restaurant_tables` seeded with the client's dining tables (01, 02, ...).

---

### Phase 3: Custom Domain, SEO & Social Metadata
- [ ] Custom domain DNS (A/CNAME) connected and SSL certificate active (HTTPS).
- [ ] `VITE_SITE_URL` set in hosting environment variables to client's authoritative URL.
- [ ] `MetaTags.tsx` dynamically populates `<title>`, `<meta name="description">`, `og:title`, and `og:site_name` from restaurant configuration.
- [ ] Schema.org JSON-LD structured data dynamically reflects restaurant name, telephone, and address.
- [ ] Favicon, webmanifest, and Apple touch icon load cleanly without 404s.

---

### Phase 4: QR Table Ordering System
- [ ] Verified table QR URLs format properly: `https://www.restaurant.com/qr?table=07`.
- [ ] Table parameter normalization enforces two-digit format (01-99).
- [ ] Invalid table parameters (`/qr?table=abc` or `/qr?table=999`) safely show fallback selection without crashing.
- [ ] Diners cannot change table number once locked via QR link.
- [ ] Printed QR cards render high-contrast, optical-grade QR codes with client branding.

---

### Phase 5: Kitchen Display System (KDS) & Operational Safety
- [ ] Kitchen tickets enter `Preparing` column upon payment completion (or immediately if pay-at-counter).
- [ ] Unpaid pending or failed orders are strictly withheld from kitchen columns.
- [ ] Operational payment badges display accurately:
  - `PAID` (emerald) for completed online payments.
  - `PAY AT COUNTER` (amber) for counter orders.
- [ ] Status transitions advance strictly forward: `Preparing` → `Ready` → `Completed`.
- [ ] Realtime order alerts play kitchen chime and update ticket lists without full page reload.

---

### Phase 6: Payment Gateway Integration
- [ ] Restaurant's own merchant account (Stripe or Razorpay) connected.
- [ ] Edge function `payment-webhook` deployed and active.
- [ ] Webhook URL registered in provider dashboard with signing secret.
- [ ] At least one end-to-end test payment completed and reconciled in `payments` ledger.
- [ ] Payment failure/decline recovery verified: "Try Payment Again" reuses order reference without duplicate ticket rows.
- [ ] If payment mode is `disabled`, checkout completes cleanly with "Pay at Counter" confirmation.

---

### Phase 7: Automated Test & Build Verification
Run the complete automated verification suite before client sign-off:

```bash
# 1. Complete Test Suite (All 12 suites)
npx tsx tests/productionReadiness.test.ts
npx tsx tests/paymentFoundation.test.ts
npx tsx tests/internationalization.test.ts
npx tsx tests/kitchenDisplay.test.ts
npx tsx tests/orderFoundation.test.ts
npx tsx tests/authFoundation.test.ts
npx tsx tests/dashboardFoundation.test.ts
npx tsx tests/persistenceAndAvailability.test.ts
npx tsx tests/qrOrderingFoundation.test.ts
npx tsx tests/reservationFoundation.test.ts
npx tsx tests/translationCompleteness.test.ts
npx tsx tests/databaseSecurityHardening.test.ts

# 2. Strict Linting Check
npm run lint

# 3. TypeScript Typecheck & Production Bundle
npm run build
```

**Required Sign-Off**:
- [ ] 0 lint warnings, 0 lint errors
- [ ] 0 TypeScript errors
- [ ] 12/12 test suites passed
- [ ] Production build completed successfully
