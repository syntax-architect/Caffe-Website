# Commercial Offer & Services Specification: Fury Studios Hospitality Platform

**Entity:** Fury Studios  
**Offering:** Bespoke Hospitality Digital Experience & Real-Time Restaurant Operations Architecture  
**Target Market:** Independent luxury restaurants, boutique hotel dining rooms, artisanal bistros, and multi-location culinary lounges.

---

## 1. Executive Summary
Fury Studios delivers an end-to-end digital operations system that replaces generic third-party marketplace dependencies with an owned, high-conversion guest experience. The platform combines a cinematic, brand-first customer website with real-time table QR ordering, an integrated reservation engine, kitchen display systems, and multi-currency international commerce.

---

## 2. Core Modules & Tiered Implementation Options

### Tier 1: Digital Presence & Brand Immersion (Essential)
- **Cinematic Web Experience:** Tailored espresso/gold/cream visual identity, custom typography (Playfair Display / Outfit), responsive layout across all device viewports.
- **Appetite-Driven Digital Menu:** High-resolution dish showcase, categorized layout, dietary filters (vegetarian, vegan, allergens), search, and availability states.
- **Atmospheric Brand Storytelling:** Ambient photography galleries, cocktail & culinary craft scroll sequences, and brand manifesto chapters.
- **Search Engine Optimization & Social Sharing:** SSR prerendered static pages, Open Graph previews, JSON-LD Schema.org structured data, and high-speed core web vitals.

### Tier 2: Real-Time Hospitality Operations (Professional)
- *Everything in Tier 1, plus:*
- **Smart QR Code Table Ordering:** Direct table-side ordering (`/qr?table=XX`) with physical table validation, eliminating paper menus and expediting peak-hour service.
- **Reservation Engine:** Frictionless table booking flow with party size constraints, time-slot management, guest notes, and duplicate booking prevention.
- **Kitchen Display System (KDS):** Full-screen tablet application with real-time ticket queues, status lifecycle management (`Received` -> `Preparing` -> `Ready`), and audible order alerts.
- **Owner Operations Cockpit:** Secure administrative dashboard with daily gross sales, average ticket size, order mix analytics, table floor plans, and 86'd inventory controls.

### Tier 3: Autonomous Digital Commerce & Expansion (Enterprise)
- *Everything in Tier 2, plus:*
- **Direct Online Takeout & Delivery:** Online cart with server-side authoritative pricing, automated discounts, promotional coupon validation, and delivery instructions.
- **Integrated Payment Gateways:** Direct client merchant integration with Stripe (credit cards, Apple Pay, Google Pay) and Razorpay (UPI, NetBanking, card tokens).
- **International Localization & Tax Regime:** Out-of-the-box support for 20 country presets, inclusive/exclusive tax engines (VAT, GST, Sales Tax), multi-language menu translations, and local currency formatting.
- **Automated Alerts & Operations Messaging:** Webhook-driven order notifications, SMS/WhatsApp receipts, daily automated sales summaries, and low-inventory alerts.

---

## 3. Capability Status: Verified vs Optional Setup

| Platform Capability | Implementation Status | Client Configuration Required |
|---|---|---|
| **Branded Customer Website** | **Verified** (Build & Prerender tested) | Client logo, photography, color tokens, copy |
| **Interactive Digital Menu** | **Verified** (Offline fallback tested) | Menu item inventory, descriptions, pricing |
| **Smart QR Table Ordering** | **Verified** (URL parsing & table lock tested) | Physical table numbers & printed QR cards |
| **Table Reservations** | **Verified** (Form validation & demo guards tested)| Operational booking rules & capacity limits |
| **Kitchen Display System** | **Verified** (Lifecycle state transitions tested) | Tablet hardware setup in kitchen line |
| **Owner Dashboard** | **Verified** (Roster, tables, stock tested) | Manager & chef staff user accounts |
| **Stripe / Razorpay Payments** | **Implemented** (Signatures & hashes tested) | Client merchant gateway accounts & API keys |
| **Sanity CMS Integration** | **Implemented** (Studio build tested) | Client Sanity project ID & write token |
| **Cloudflare Turnstile** | **Implemented** (Client & RPC tested) | Client Cloudflare account site key |

---

## 4. Scope-Based Pricing Framework

Pricing is structured transparently based on implementation scope, integration requirements, and ongoing operational support:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Initial Implementation & Customization (One-Time)                       │
│    • Discovery & Brand Asset Intake                                         │
│    • Visual Styling & Design System Alignment                               │
│    • Digital Menu Ingestion & Dietary Classification                        │
│    • Table QR Code Map & Print Ready Generation                             │
│    • Payment Gateway Sandbox Setup & Webhook Reconciliation                 │
│    • Staging Quality Assurance & Staff Tablet Provisioning                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. Platform Infrastructure & Cloud Services (Client-Direct / Pass-Through)  │
│    • Database & Realtime Hosting (Supabase Pro)                             │
│    • Web Application Edge Hosting (Vercel / Cloudflare)                     │
│    • Content Management System (Sanity CMS)                                 │
│    • Payment Gateway Transaction Fees (Direct merchant rate)                │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. Managed Hospitality Care & SLA Support (Monthly Recurring)               │
│    • 99.9% Uptime Guarantee & 24/7 Monitoring                               │
│    • Daily Automated Database Backups                                       │
│    • Priority Technical Support & Menu Price Updates                        │
│    • Security Patching & Dependency Updates                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

*Note: Formal quotes are calculated following an initial discovery audit and tailored to the client's single-location or multi-location operational footprint.*

---

## 5. Commercial Guardrails & Ethical Transparency
- **No Fabricated Performance Claims:** Fury Studios does not guarantee arbitrary search rankings or specific revenue multiples; financial projections are calculated collaboratively using the client's historical dining volumes.
- **Zero Merchant Intermediation:** Payments flow directly from the guest into the restaurant’s own merchant bank account. Fury Studios never touches customer transaction funds.
- **Client Data Sovereignty:** The restaurant maintains complete ownership of all customer data, order histories, guest contact lists, and brand assets.
