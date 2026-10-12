# New Client Onboarding & White-Label Customization Guide

This document provides the exact checklist of files, configuration keys, brand assets, and database seeds required to onboard a new restaurant client onto the platform.

---

## Quick Reference Checklist

| Step | Area | Target Files |
|---|---|---|
| **1** | Brand & Contact Details | `src/config/client.ts` |
| **2** | Visual Theme Preset | `src/config/themePresets.ts`, `src/config/restaurantPresets.ts` |
| **3** | Brand Media & Imagery | `public/logo.webp`, `public/images/hero-bar.webp`, `public/images/og-share.jpg` |
| **4** | Menu Catalog Seeding | `supabase/migrations/` SQL seed, `src/data/menuFallbacks.ts` |
| **5** | Currency & Localization | `src/config/restaurantPresets.ts` |
| **6** | Environment & Secrets | `.env`, Supabase Edge Function Secrets |
| **7** | Verification & Build | `npm test`, `npm run build` |

---

## 1. Brand & Contact Details: `src/config/client.ts`

Open `src/config/client.ts` and customize each property for the new client:

```typescript
export const clientDetails = {
  // Brand Names
  businessName: "The Velvet Roast",            // Full legal or flagship brand name
  shortName: "Velvet",                          // Short brand name for compact mobile badges
  displayLocation: "Downtown Arts District",   // City or neighborhood displayed in header/footer

  // Telephony & Instant Messaging
  phone: "+15551234567",                       // E.164 format for tel: links
  displayPhone: "(555) 123-4567",              // Human-readable formatted phone
  whatsapp: "+15551234567",                    // WhatsApp concierge number (with country code)
  email: "concierge@velvetroast.com",          // Public guest contact email

  // Address & Map
  address: "742 Evergreen Terrace, Sector 4",  // Street address
  googleMapsLink: "https://maps.google.com/?q=...", // Google Maps location URL

  // Social & Aggregator Channels
  instagramLink: "https://instagram.com/velvetroast",
  facebookLink: "https://facebook.com/velvetroast",
  zomatoLink: "#",

  // Editorial Copy
  tagline1: "Artisanal Roasts & Twilight Dining",
  tagline2: "An Unrivaled Sensory Gathering",
  description: "A refined culinary retreat blending wood-fired gastronomy, single-origin roasts, and candlelit ambiance.",

  // Third-Party Embeds (Optional)
  elfsightId: "YOUR_ELFSIGHT_WIDGET_ID",        // Set to real widget ID or leave placeholder
  googleReviewLink: "https://search.google.com/local/writereview?placeid=...",

  // Staff & Terminal Access
  staffDomain: "velvetroast.com",              // Domain used for staff login email placeholders
  location: {
    address: "742 Evergreen Terrace, Sector 4",
    city: "San Francisco",
  },
};
```

---

## 2. Visual Theme Preset: `src/config/themePresets.ts`

The application includes two enterprise-grade themes, and supports custom palettes:

1. **`nocturnal-gold`** (`FLAGSHIP_THEME_NOCTURNAL_GOLD`): Deep espresso canvas (`#0A0807`), obsidian surfaces, and warm champagne gold accents (`#D4AF37`).
2. **`editorial-cream`** (`THEME_EDITORIAL_CREAM`): Warm parchment canvas, espresso typography, and terracotta bronze accents (`#9E472A`).

### Selecting the Active Theme
In `src/config/restaurantPresets.ts`, set the active preset on `DEFAULT_RESTAURANT_CONFIG.theme`:
```typescript
import { FLAGSHIP_THEME_NOCTURNAL_GOLD, THEME_EDITORIAL_CREAM } from './themePresets';

export const DEFAULT_RESTAURANT_CONFIG: RestaurantLocalizationConfig = {
  // ...
  theme: 'nocturnal-gold', // or 'editorial-cream'
};
```

### Customizing Theme Colors
To customize the color palette for a client, edit or create a preset in `src/config/themePresets.ts`:
- `primary`: Space-separated RGB values for brand accent (e.g. `212 175 55`)
- `background`: Base canvas RGB (e.g. `10 8 7`)
- `surface`: Baseline card surface RGB
- `onSurface`: Text color on surface RGB (e.g. `227 218 205`)
- `typography.headingFont`: CSS font-family for display headings
- `typography.bodyFont`: CSS font-family for body copy

---

## 3. Brand Assets & Media Replacement

Replace the following static assets in the `public/` directory with the new client's branded media:

### Critical Files

| Asset Path | Recommended Dimensions | Format | Usage |
|---|---|---|---|
| `public/logo.webp` | 512 × 512 px (transparent) | WebP | Brand crest, header, staff terminal, table tent QR |
| `public/images/hero-bar.webp` | 1920 × 1080 px (< 350 KB) | WebP | Desktop flagship hero background |
| `public/images/hero-bar-mobile.webp` | 768 × 1024 px (< 180 KB) | WebP | Mobile responsive hero portrait crop |
| `public/images/og-share.jpg` | 1200 × 630 px (< 250 KB) | JPEG | OpenGraph & Twitter social preview banner |
| `public/favicon.ico` | 32 × 32 px | ICO | Browser tab icon |
| `public/icon.svg` | Scalable vector | SVG | PWA / mobile homescreen shortcut |

### Optional Editorial Media
- `public/images/story-pour.webp`: Heritage / Story section focal image.
- `public/images/gallery-*.webp`: High-resolution gallery bento cards.

---

## 4. Menu Catalog Seeding

The platform operates on a single-source-of-truth Postgres menu catalog (`public.menu`), with a synchronized fallback layer in `src/data/menuFallbacks.ts` for offline or demo resilience.

### A. Database Seed Migration (`supabase/migrations/`)
Create or edit a SQL migration (e.g., `017_seed_client_menu.sql`):

```sql
-- Clean existing items if re-seeding completely
TRUNCATE TABLE public.menu CASCADE;

-- Insert client menu catalog
INSERT INTO public.menu (id, name, price, category, diet, description, image, tag, is_available)
VALUES
    ('espresso-single', 'Single Origin Espresso', 4.50, 'beverages', 'all', 'Notes of dark cocoa, roasted hazelnut and citrus peel.', '/images/menu/espresso.webp', 'Signature', true),
    ('truffle-tagliatelle', 'Wild Truffle Tagliatelle', 24.00, 'mains', 'veg', 'Handmade pasta, shaved black truffle, cultured butter and aged parmigiano.', '/images/menu/pasta.webp', 'Chef Special', true),
    ('margherita-dop', 'Wood-Fired Margherita D.O.P.', 18.00, 'pizzas', 'veg', 'San Marzano tomatoes, buffalo mozzarella, fresh basil, extra virgin olive oil.', '/images/menu/pizza.webp', 'Popular', true);
```

### B. Offline & SSR Fallbacks (`src/data/menuFallbacks.ts`)
Update `MENU_CATEGORIES_FALLBACK` and `MENU_ITEMS_FALLBACK` in `src/data/menuFallbacks.ts` to match the initial categories and items so the client's pre-rendered SSR builds and initial page loads display immediately before network hydration.

---

## 5. Regional Localization & International Settings

In `src/config/restaurantPresets.ts`, configure the restaurant's operational parameters:

```typescript
export const DEFAULT_RESTAURANT_CONFIG: RestaurantLocalizationConfig = {
  restaurantId: 'velvet-roast-sf',
  businessName: 'The Velvet Roast',
  shortName: 'Velvet',
  country: 'US',                       // ISO 3166-1 alpha-2 code
  currency: 'USD',                      // ISO 4217 currency code
  currencySymbol: '$',                  // Currency glyph
  locale: 'en-US',                      // BCP 47 locale
  timezone: 'America/Los_Angeles',      // IANA timezone identifier

  // Dietary Classification System: 'us' | 'india' | 'eu' | 'me' | 'uk' | 'au'
  dietary: {
    system: 'us',
    labels: {
      veg: 'Vegetarian',
      vegan: 'Vegan',
      gluten_free: 'Gluten-Free',
      halal: 'Halal',
    },
  },

  // Tax Configuration
  tax: {
    rate: 0.08625,                      // 8.625% local sales tax
    label: 'Sales Tax',
    mode: 'exclusive',                  // 'exclusive' (US style) or 'inclusive' (GST/VAT)
  },

  // Service Operating Hours
  openingTime: '08:00 AM',
  closingTime: '11:00 PM',
};
```

---

## 6. Environment Variables & Supabase Secrets

### A. Client Environment (`.env`)
Create `.env` using `.env.example`:

```bash
# Supabase Project Connection
VITE_SUPABASE_URL=https://<client-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<client-anon-public-key>

# Cloudflare Turnstile Bot Defense
VITE_TURNSTILE_SITE_KEY=0x4AAAAAA...

# Authoritative Production Domain (Used for table QR generation & SEO)
VITE_SITE_URL=https://www.velvetroast.com
```

### B. Edge Function Secrets (Supabase CLI or Dashboard)
Set backend secrets directly via Supabase CLI:

```bash
# CORS & Authoritative Domain Boundaries
supabase secrets set ALLOWED_ORIGIN="https://www.velvetroast.com"
supabase secrets set PUBLIC_SITE_URL="https://www.velvetroast.com"

# Cloudflare Turnstile Verification Secret
supabase secrets set TURNSTILE_SECRET_KEY="0x4AAAAAA..."

# Automated Cron Maintenance Authorization
supabase secrets set CRON_SECRET="<generate-random-high-entropy-secret>"

# Payment Provider Secrets (Client's Own Merchant Account)
supabase secrets set STRIPE_SECRET_KEY="sk_live_..."
supabase secrets set STRIPE_WEBHOOK_SECRET="whsec_..."
# Or Razorpay for Indian clients:
# supabase secrets set RAZORPAY_KEY_ID="rzp_live_..."
# supabase secrets set RAZORPAY_KEY_SECRET="..."
# supabase secrets set RAZORPAY_WEBHOOK_SECRET="..."
```

---

## 7. Pre-Flight Verification & Deployment

Execute the full automated test suite and build verification:

```bash
# 1. Run all 26 verification suites
npm test

# 2. Run static pre-render and production build
npm run build
```

Ensure:
- Zero build errors.
- Pre-rendered HTML files (`dist/index.html`, etc.) contain the client's business name and SEO meta tags.
- Content Security Policy (CSP) headers in `public/_headers`, `render.yaml`, and `vercel.json` allow the client's Supabase instance and payment providers.
