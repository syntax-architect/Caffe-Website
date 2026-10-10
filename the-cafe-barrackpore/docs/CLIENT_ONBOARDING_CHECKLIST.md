# Client Onboarding Checklist: Fury Studios Hospitality Platform

Complete and sign off this checklist per restaurant. Keep the Café Barrackpore preset as the source demo; do not copy its private credentials or accidentally reuse its database, CMS dataset, domain, legal copy, or payment account.

---

## 1. Scope, Governance, and Legal Ownership
- [ ] Confirm legal business name, operating entities, principal contacts, and decision-maker.
- [ ] Record selected platform modules:
  - [ ] Premium brand-led marketing site & story
  - [ ] Dynamic digital menu with dietary/allergen tagging
  - [ ] Smart QR code table ordering
  - [ ] Online takeout/delivery ordering
  - [ ] Table reservations engine
  - [ ] Owner operations dashboard & real-time analytics
  - [ ] Kitchen Display System (KDS)
  - [ ] Payment gateway integration (Stripe / Razorpay)
  - [ ] Multi-language translation support
  - [ ] Sanity CMS editorial management
- [ ] Agree deliverables, acceptance criteria, implementation cost, recurring service cost, support window, data ownership, retention, and change process in writing.
- [ ] Identify the restaurant’s data controller, privacy contact, and legal adviser for jurisdiction-specific terms.

---

## 2. Brand Identity, Visual Assets, and Menu Content
- [ ] Collect high-resolution vector logos (SVG / PNG transparent), brand guidelines, primary and secondary brand palette colors, and typography preferences.
- [ ] Approve restaurant name, tagline, description, physical street address, phone, email, Google Maps pin, and primary contact method (Phone / WhatsApp).
- [ ] Collect opening hours, holiday closures, reservation capacity, seat turnover limits, and booking instructions.
- [ ] Obtain complete menu inventory: item names, descriptions, categories, authoritative prices, currency, allergens, dietary flags (Veg, Vegan, Gluten-Free), and approved food photography.
- [ ] Review terms of service, privacy policy, cookie consent, and local consumer disclosures with the client’s legal counsel.
- [ ] Confirm SEO page titles, meta descriptions, canonical domain, social sharing preview images (OG 1200x630), sitemap structure, robots.txt policy, and Google Search Console property ownership.

---

## 3. Restaurant Technical Configuration
- [ ] Assign a unique `restaurant_id` (UUID) and document its owner.
- [ ] Configure locale, timezone, currency, and tax rules with the client’s financial accountant:
  - [ ] Inclusive vs exclusive tax calculation
  - [ ] Tax labels (e.g., Sales Tax, VAT, GST, MwSt.) and applicable rates
  - [ ] Optional service charge percentage and rounding rules
- [ ] Configure ordering and reservation availability windows and offline contact behavior.
- [ ] Configure table layout, floor plan, and table numbers (01–99). Generate table QR codes only after the production domain is finalized.
- [ ] Configure a dedicated Sanity CMS project and dataset; verify schema assumptions and remove rupee-specific or demo-specific field defaults.
- [ ] Confirm no client setting falls back to Café Barrackpore content, phone numbers, or another tenant’s private configuration.

---

## 4. Services, Gateways, and Secret Management
- [ ] Create isolated staging and production Supabase projects (never share production database across multiple independent clients).
- [ ] Apply database migrations in staging; review migration effects and verify RLS policies before applying to production.
- [ ] Configure public Vite environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PUBLIC_SITE_URL`, `VITE_SANITY_PROJECT_ID`).
- [ ] Store server-side credentials strictly in provider secret vaults (Supabase Secrets / Hosting Environment Secrets):
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`
  - [ ] `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`
  - [ ] `TURNSTILE_SECRET_KEY`
  - [ ] `CRON_SECRET`
- [ ] Link the restaurant’s own registered merchant account. Verify provider country eligibility and direct bank payout ownership.
- [ ] Verify automated database backup schedules, retention periods, and disaster recovery procedures.

---

## 5. Staging Acceptance & Verification
- [ ] Test anonymous access and cross-restaurant data isolation with test accounts and simulated unauthorized requests.
- [ ] Verify staff roles (Owner, Manager, Chef, Waiter) and ensure unauthorized RPC calls and pages are rejected server-side.
- [ ] Test the full order lifecycle: item availability, 86'd item rejections, cart validation, QR table flow, kitchen status transitions, and receipt generation.
- [ ] Test payment gateway sandbox: successful payment, customer cancellation, card failure, webhook signature verification, replay idempotency, and refund processing.
- [ ] Review responsive rendering across Desktop (1440p), Tablet (iPad 768px), and Mobile (390px).
- [ ] Audit keyboard accessibility, focus rings, reduced-motion preferences, contrast ratios, and loading/empty states.
- [ ] Record actual browser performance metrics (LCP, CLS, INP) on mobile network conditions.
- [ ] Obtain client formal sign-off on content, branding, and staging functionality.

---

## 6. Production Launch & Handover
- [ ] Complete the [Production Deployment Checklist](PRODUCTION_DEPLOYMENT_CHECKLIST.md).
- [ ] Confirm the general manager can log in to the Owner Dashboard and kitchen tablets can run the KDS.
- [ ] Deliver a secure credentials handoff via password manager (Bitwarden / 1Password), staff training videos, operator runbooks, and recovery guides.
- [ ] Establish post-launch monitoring, incident escalation paths, support SLA, and the 30-day review date.
