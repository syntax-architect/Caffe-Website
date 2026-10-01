# International Sales & Deployment Guide

## Global Restaurant Platform — White-Label SaaS Delivery Manual

This document is the complete operational guide for selling, deploying, and supporting this restaurant platform for international clients. It covers the sales pitch, deployment workflow, supported markets, and customization playbook.

---

## 1. Platform Value Proposition

### What You're Selling

A **turnkey digital operations platform** for restaurants, cafés, and hospitality businesses worldwide. One codebase, zero custom development per client.

### Core Capabilities

| Feature | Description |
| :--- | :--- |
| **Customer Website** | Premium, mobile-first restaurant website with hero, gallery, story, and menu sections |
| **QR Table Ordering** | Diners scan QR codes → browse menu → place orders from their phone |
| **Online Ordering** | Full cart flow with guest checkout (no account required) |
| **Kitchen Display System (KDS)** | Real-time ticket management for kitchen staff with audio chimes |
| **Staff Portal** | Role-based dashboard (Owner / Manager / Staff) |
| **Table Reservations** | Date, time, guest count, special occasion booking |
| **International Localization** | 20 country presets, multi-language UI, RTL support, local tax regimes |
| **Payment Integration** | Stripe (global) + Razorpay (India) with online/counter/disabled modes |
| **Content Management** | Edit hero images, gallery, story text, and menu items from the admin panel |
| **WhatsApp Concierge** | One-tap order confirmation via WhatsApp |

### Revenue Model Options

1. **Fixed-Price Delivery**: $2,000–$8,000 per restaurant setup
2. **Monthly SaaS**: $99–$299/month subscription
3. **Hybrid**: Setup fee + monthly maintenance
4. **White-Label Reseller**: Agency licenses the platform, rebrands, resells at margin

---

## 2. Supported Markets (20 Countries)

### Asia-Pacific
| Country | Currency | Tax | Payment | Dietary |
| :--- | :--- | :--- | :--- | :--- |
| 🇮🇳 India | INR (₹) | GST 5% inclusive | Razorpay | Veg/Non-Veg badges |
| 🇦🇺 Australia | AUD (A$) | GST 10% inclusive | Stripe | International |
| 🇳🇿 New Zealand | NZD (NZ$) | GST 15% inclusive | Stripe | International |
| 🇸🇬 Singapore | SGD (S$) | GST 9% inclusive | Stripe | International |
| 🇯🇵 Japan | JPY (¥) | 消費税 10% inclusive | Stripe | International |
| 🇹🇭 Thailand | THB (฿) | VAT 7% inclusive | Stripe | International |

### North America
| Country | Currency | Tax | Payment | Dietary |
| :--- | :--- | :--- | :--- | :--- |
| 🇺🇸 United States | USD ($) | Sales Tax 8.25% exclusive | Stripe | International |
| 🇨🇦 Canada | CAD (CA$) | HST 13% exclusive | Stripe | International |
| 🇲🇽 Mexico | MXN (MX$) | IVA 16% inclusive | Stripe | International |

### Europe
| Country | Currency | Tax | Payment | Dietary |
| :--- | :--- | :--- | :--- | :--- |
| 🇬🇧 United Kingdom | GBP (£) | VAT 20% inclusive | Stripe | International |
| 🇩🇪 Germany | EUR (€) | MwSt. 19% inclusive | Stripe | International |
| 🇫🇷 France | EUR (€) | TVA 10% inclusive | Stripe | International |
| 🇮🇹 Italy | EUR (€) | IVA 10% inclusive | Stripe | International |
| 🇪🇸 Spain | EUR (€) | IVA 10% inclusive | Stripe | International |
| 🇳🇱 Netherlands | EUR (€) | BTW 9% inclusive | Stripe | International |
| 🇹🇷 Turkey | TRY (₺) | KDV 8% inclusive | Stripe | International |

### Middle East & Africa
| Country | Currency | Tax | Payment | Dietary |
| :--- | :--- | :--- | :--- | :--- |
| 🇦🇪 UAE | AED | VAT 5% inclusive | Stripe | International |
| 🇸🇦 Saudi Arabia | SAR | VAT 15% inclusive | Stripe | International |
| 🇶🇦 Qatar | QAR | No Tax | Stripe | International |
| 🇿🇦 South Africa | ZAR (R) | VAT 15% inclusive | Stripe | International |

---

## 3. Client Deployment Workflow

### Step-by-Step (Estimated: 2–4 Hours Per Client)

```
┌─────────────────────────────────────────┐
│  1. CLIENT SIGNS CONTRACT               │
│     └─ Collect payment & intake form    │
├─────────────────────────────────────────┤
│  2. GATHER RESTAURANT DETAILS           │
│     └─ Use Client Intake Questionnaire  │
├─────────────────────────────────────────┤
│  3. CREATE SUPABASE PROJECT             │
│     └─ Run SQL migrations               │
│     └─ Configure auth, RLS policies     │
├─────────────────────────────────────────┤
│  4. CREATE SANITY CMS PROJECT           │
│     └─ Deploy studio schema             │
│     └─ Upload initial content           │
├─────────────────────────────────────────┤
│  5. CONFIGURE ENVIRONMENT               │
│     └─ Copy .env.example → .env         │
│     └─ Set Supabase + Sanity keys       │
│     └─ Set payment gateway keys          │
├─────────────────────────────────────────┤
│  6. APPLY COUNTRY PRESET                │
│     └─ Staff Portal → Settings →        │
│        Country Preset → Select Country  │
│     └─ Verify currency, tax, timezone   │
├─────────────────────────────────────────┤
│  7. CUSTOMIZE BRANDING                  │
│     └─ Upload logo, hero image, gallery │
│     └─ Set business name, address       │
│     └─ Add menu items with prices       │
├─────────────────────────────────────────┤
│  8. DEPLOY TO PRODUCTION                │
│     └─ npm run build                    │
│     └─ Deploy to Vercel / Netlify /     │
│        Cloudflare Pages                  │
│     └─ Connect custom domain            │
├─────────────────────────────────────────┤
│  9. SMOKE TEST & HANDOVER               │
│     └─ Test customer ordering flow      │
│     └─ Test KDS ticket flow             │
│     └─ Test QR table scanning           │
│     └─ Hand over staff credentials      │
└─────────────────────────────────────────┘
```

### Client Intake Questionnaire

| Category | Parameter | Example |
| :--- | :--- | :--- |
| **Brand** | Restaurant Full Name | *The Gilded Truffle* |
| | Short/Display Name | *Gilded Truffle* |
| | Tagline | *Artisanal Gastronomy & Roasts* |
| | Logo Asset | PNG / SVG / WebP (512×512px) |
| **Location** | Country Code | `US`, `GB`, `IN`, `AE`, `CA`, `AU`, `FR`, `DE` |
| | Physical Address | *123 Main Street, Suite 4* |
| | City / State / Postal Code | *New York, NY, 10001* |
| **Localization** | Currency Code & Symbol | `USD` ($), `GBP` (£), `EUR` (€) |
| | Locale & Timezone | `en-US` / `America/New_York` |
| | Phone Country Code | `+1`, `+44`, `+91`, `+971`, `+33` |
| | UI Language | English, Arabic, French |
| **Tax** | Tax Label | `Sales Tax`, `VAT`, `GST`, `TVA`, `MwSt.` |
| | Tax Mode | `exclusive` or `inclusive` |
| | Tax Rate | `8.25%`, `5%`, `20%`, `10%` |
| **Contact** | Primary Phone | `+1 (212) 555-0198` |
| | WhatsApp (if used) | `+971 50 123 4567` |
| | Email | `hello@restaurant.com` |
| **Operations** | Opening/Closing Hours | `11:00 AM` – `11:00 PM` |
| | Online Ordering | `Enabled` / `Disabled` |
| | Table Reservations | `Enabled` / `Disabled` |
| **Menu** | Menu Items (CSV/Excel) | Name, Price, Category, Description, Veg/Non-Veg |
| **Payments** | Provider | `stripe`, `razorpay`, or `disabled` |
| | Mode | `online`, `optional`, `disabled` |
| | Stripe Publishable Key | `pk_live_...` |

---

## 4. Internationalization Architecture

### How It Works (Zero Code Changes)

```
┌────────────────────────────────────────────────────┐
│  Restaurant Owner                                   │
│    └─ Staff Portal → Settings → Country Preset     │
│       └─ Selects "United States" (US)              │
│       └─ Auto-fills: USD, $, en-US, Sales Tax,     │
│          8.25% exclusive, Stripe, +1               │
│       └─ Clicks "Save Changes"                     │
├────────────────────────────────────────────────────┤
│  System Auto-Configures:                            │
│    ├─ Menu prices display in $                     │
│    ├─ Tax calculated exclusive (added at checkout) │
│    ├─ Phone validation: 10-digit US format         │
│    ├─ Dates formatted: May 24, 2026               │
│    ├─ Times formatted: 7:30 PM (12-hour)          │
│    ├─ Stripe payment gateway active                │
│    └─ All order receipts & references use USD      │
└────────────────────────────────────────────────────┘
```

### Language System (i18n)

The platform includes a complete **i18n translation system** with:

- **12 supported languages**: English, Arabic (RTL), French, German, Spanish, Portuguese, Japanese, Chinese, Korean, Hindi, Turkish, Thai
- **Lazy-loaded language packs**: Only English ships in the initial bundle; other languages load on demand
- **RTL support**: Full right-to-left layout for Arabic-speaking markets (UAE, Saudi Arabia, Qatar)
- **Persistent preferences**: Language choice saved to localStorage
- **Dot-path translation function**: `t('cart.placeOrder')` → "Place Order" / "تأكيد الطلب" / "Passer la commande"

### White-Label Branding

All brand references are **dynamically derived** from the restaurant configuration:

- Business name flows from Settings → everywhere (header, footer, receipts, SEO)
- Order reference prefixes auto-generated from business name initials
- No hardcoded "The Café Barrackpore" in production output
- Logo, hero image, gallery, and content all configurable via CMS

### International Tax Engine & Service Charge System

The platform includes a dedicated, production-grade financial tax engine (`src/utils/taxEngine.ts` and `src/config/taxProfiles.ts`) designed for international compliance:

- **20 Country Tax Profiles**: Built-in tax rates, labels, and modes researched against national tax authorities (OECD/PwC 2025–2026):
  - **Inclusive Tax Regimes**: UK (VAT 20%), Germany (MwSt 19%), France (TVA 10%), Australia (GST 10%), New Zealand (GST 15%), Singapore (GST 9%), Japan (10%), UAE (VAT 5%), Saudi Arabia (VAT 15%), etc.
  - **Exclusive Tax Regimes**: United States (State + Local Sales Tax, e.g., 8.25%), Canada (HST/GST 13%).
  - **Zero-Tax Regimes**: Qatar (0% VAT).
- **Split Tax Calculations**: Full support for split tax reporting, such as India's CGST (2.5%) + SGST (2.5%), ensuring individual line items and net base subtotals balance to the exact cent without rounding drift.
- **Service Charge & Hospitality Fees**:
  - Configurable percentage (e.g., Singapore 10%, UAE 10%, France 15% service compris, Thailand 10%).
  - Toggleable taxability (tax on service charge vs tax on subtotal only).
  - Optional vs mandatory flags (complying with consumer protection rules such as India CCPA guidelines).
- **Tax ID & Invoice Compliance**:
  - Country-specific tax identification labels (`GSTIN` for India, `ABN` for Australia, `VAT No.` for UK/EU, `TRN` for UAE).
  - Format guidelines and legal advisory notes surfaced directly to owners in the dashboard.
- **Anti-Tampering Financial Consistency**:
  - The exact same calculation engine is shared across Cart UI, QR checkout, and server-side payment validation (`orderService.ts` / `paymentService.ts`).
  - Strict banker's rounding eliminates floating-point penny discrepancies.

---

## 5. Technical Stack Summary (For Technical Buyers)

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 18 + TypeScript + Vite |
| **Styling** | Tailwind CSS + custom design system |
| **Backend / Auth** | Supabase (PostgreSQL + Auth + Edge Functions) |
| **CMS** | Sanity.io (headless) |
| **Payments** | Stripe (global) + Razorpay (India) |
| **Hosting** | Vercel / Netlify / Cloudflare Pages (SSG) |
| **i18n** | Custom React context + lazy-loaded language packs |
| **Smooth Scroll** | Lenis (desktop only, battery-safe on mobile) |
| **Kitchen Audio** | Web Audio API (synthesized chimes, no file downloads) |

### Performance Characteristics

- **Lighthouse Score**: 90+ on mobile
- **First Contentful Paint**: < 1.5s
- **Total Transfer Size**: < 300KB (gzipped)
- **Language Pack Size**: ~3KB per language (lazy loaded)
- **Zero external runtime dependencies** for audio (Web Audio API synthesis)

---

## 6. Pricing Strategy Guidance

### Tier 1: Basic Setup ($2,000–$3,000)
- Website + Menu display
- QR table ordering
- Basic KDS
- 1 country preset
- English only
- No payment integration

### Tier 2: Professional ($4,000–$6,000)
- Everything in Basic
- Online payment integration (Stripe)
- Multi-language support
- Custom branding package
- Staff training session
- 30-day support

### Tier 3: Enterprise ($7,000–$12,000)
- Everything in Professional
- Custom domain + SSL setup
- RTL/Arabic support
- Multiple location support
- Priority support (90 days)
- Custom integrations

### Recurring Revenue
- **Hosting & Maintenance**: $49–$149/month
- **Menu Updates**: $29/update or included in plan
- **Feature Add-ons**: Custom pricing

---

## 7. Competitive Advantages

| Feature | This Platform | Toast POS | Square Online | ChowNow |
| :--- | :--- | :--- | :--- | :--- |
| QR Table Ordering | ✅ Built-in | ❌ Add-on | ❌ Not available | ❌ Not available |
| Kitchen Display System | ✅ Built-in | ✅ $50/mo add-on | ❌ Not available | ❌ Not available |
| International Markets | ✅ 20 countries | ❌ US only | ❌ US, CA, AU, UK | ❌ US only |
| Multi-Language UI | ✅ 12 languages | ❌ English only | ❌ English only | ❌ English only |
| RTL Arabic Support | ✅ Yes | ❌ No | ❌ No | ❌ No |
| Commission Fees | ✅ 0% | 2.49% per order | 2.6% + $0.10 | 2%–15% |
| White-Label | ✅ Full | ❌ Toast branding | ❌ Square branding | ❌ ChowNow branding |
| Monthly Platform Fee | $49–$149 | $69–$399 | $29–$79 | $149–$399 |
| Setup Cost | One-time | Monthly recurring | Monthly | Monthly |

---

## 8. Demo & Sales Assets

### Live Demo URLs
After deployment, provide these routes to prospects:

| Route | Purpose |
| :--- | :--- |
| `/` | Customer website homepage |
| `/qr?table=07` | QR ordering experience (as if at Table 7) |
| `/staff/login` | Staff portal login |
| `/staff` | Full staff dashboard (after login) |
| `/kitchen` | Kitchen display system |

### Demo Credentials
- **Email**: `admin@gmail.com`
- **Password**: `admin123`

---

## 9. Support & Maintenance Playbook

### Common Client Requests

| Request | Resolution |
| :--- | :--- |
| "Change our menu prices" | Staff Portal → Menu & Availability → Edit item → Save |
| "Add a new dish" | Staff Portal → Menu & Availability → Add Item |
| "Change our tax rate" | Staff Portal → Settings → Tax Configuration → Save |
| "Switch to a different country" | Staff Portal → Settings → Country Preset → Apply → Save |
| "Change our opening hours" | Staff Portal → Settings → Operations → Opening/Closing Time |
| "Add a new staff member" | Staff Portal → Staff → Add Staff Member |
| "Update our hero image" | Staff Portal → Content → Hero Section → Upload |
| "Mark a dish as sold out" | Staff Portal → Menu & Availability → Toggle "86'd" |
| "Generate QR codes for tables" | Staff Portal → Floor Tables → View QR → Print |
| "Enable online payments" | Staff Portal → Settings → Payments → Enable + Configure keys |

---

*Last Updated: October 2026*
*Platform Version: 2.0 (International Edition)*
