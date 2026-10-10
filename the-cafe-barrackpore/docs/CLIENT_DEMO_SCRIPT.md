# Five-Minute Client Demonstration Script: Fury Studios Premium Restaurant Experience

**Format:** High-impact, 5-minute interactive walkthrough for restaurant owners, general managers, and hospitality directors.  
**Mode:** Local development fallback (`npm run dev`) or dedicated staging deployment.  
**Philosophy:** Premium visual immersion paired with total operational honesty. All unconfigured services show clear demo badges; no fake payments or fabricated bookings.

---

## Pre-Demonstration Checklist (T-minus 5 minutes)
- [ ] Run `npm run dev` from the repository root; open the local URL (`http://localhost:5173`).
- [ ] Ensure the browser starts at full-screen desktop resolution (1440p / 1080p).
- [ ] Have DevTools Device Emulation or a secondary mobile viewport ready to toggle.
- [ ] Keep a separate tab open at `/qr?table=07`.
- [ ] Keep a separate tab open at `/staff/login`.
- [ ] Ensure local audio is unmuted if showcasing the ambient audio player in AboutVibe.

---

## Chronological 5-Minute Run of Show

### 1. The Visual Experience (0:00 – 0:30)
- **Action:** Load the homepage. Allow the cinematic espresso-and-gold aesthetic, Playfair Display typography, and high-contrast hero photography to paint immediately. Scroll smoothly through the initial fold.
- **Key Observation:** Point out the ambient lighting mesh, zero-latency font loading, and the interactive scroll sequence showing beverage craft.
- **Talk Track:** *"Most restaurant websites look like generic templates. Our platform is built from the ground up to reflect the atmosphere of your dining room: deep espresso tones, warm amber highlights, and cinematic imagery that immediately elevates your brand."*

### 2. The Mobile Experience (0:30 – 1:00)
- **Action:** Toggle browser responsive mode to iPhone 15 Pro / mobile viewport (390px). Scroll down to demonstrate the tactile mobile action dock, bottom sheets, drag handles, and thumb-friendly touch targets.
- **Key Observation:** Show that drawers slide up from the bottom with native inertia feel.
- **Talk Track:** *"Over 75% of your guests discover your restaurant on their phones. Notice how the navigation seamlessly transforms into an app-native dock with quick access to the menu, table booking, and one-tap calling."*

### 3. The Digital Menu (1:00 – 1:30)
- **Action:** Scroll to "The Culinary Collection". Demonstrate the category pills, the "Pure Veg Only" toggle, the dynamic dish hover images, and dietary tag indicators.
- **Key Observation:** Filter by category (e.g., Sips & Desserts, Burgers & Pizzas) and toggle the veg switch.
- **Talk Track:** *"The menu is designed for appetite appeal and fast scanning. Guests can filter instantly by dietary preferences, view descriptions, and explore signature pairings without clunky PDF downloads."*

### 4. QR Code Table Ordering (1:30 – 2:00)
- **Action:** Switch to the tab with `/qr?table=07`. Highlight the banner showing "Dine-In • Table 07".
- **Key Observation:** Show that the table identifier is validated and locked so orders are attributed to the exact physical table.
- **Talk Track:** *"When guests sit at Table 7 and scan your physical QR stand, the platform instantly recognizes their table. Guests can browse and order without waiting for staff, speeding up table turns during peak hours."*

### 5. Online Ordering & Cart Workflow (2:00 – 2:30)
- **Action:** Add 2 dishes to the cart. Open the Cart Drawer. Show line items, happy hour discounts, promotional code entry, and authoritative tax calculations. Click submit order in demo mode.
- **Key Observation:** The confirmation screen displays the unique reference number and a clear **"Demo Order Only"** badge explaining that no live payment was charged.
- **Talk Track:** *"Our ordering engine authoritatively calculates subtotals, taxes, and service charges. In demo mode, it safely simulates the transaction without charging credit cards or polluting your live kitchen tickets."*

### 6. Table Reservations (2:30 – 3:00)
- **Action:** Click "Reserve a Table" to launch the Reservation Drawer. Select date, time slot, party size (e.g., 4 guests), and enter demo contact details. Submit the booking.
- **Key Observation:** Instant visual confirmation with reference code `RS-2026-XXXX` and honest demo status.
- **Talk Track:** *"Guests receive an instantaneous confirmation reference with party size and time slot details. Duplicate-submission guards prevent accidental double clicks."*

### 7. The Owner Operations Dashboard (3:00 – 3:30)
- **Action:** Navigate to `/staff/login` and open the Owner Dashboard.
- **Key Observation:** Walk through real-time sales overview, average order values, live order tracking, reservation calendar, and floor plan management.
- **Talk Track:** *"Your general manager gets an executive cockpit: live sales summaries, booking schedules, table statuses, and staff oversight in a unified, password-protected dashboard."*

### 8. Kitchen Display System (KDS) (3:30 – 4:00)
- **Action:** Open the Kitchen Display System (`/staff/kitchen`).
- **Key Observation:** Show active tickets color-coded by urgency. Click to transition an order from 'Received' to 'Preparing' to 'Ready'. Note the audio chime and visual alert on new tickets.
- **Talk Track:** *"Your kitchen line replaces lost paper tickets with an interactive touch screen. Orders advance from prep to pass with single-tap transitions, keeping front-of-house and kitchen in sync."*

### 9. Brand Customization & Localization (4:00 – 4:30)
- **Action:** Open Dashboard Settings → Localization & Presets. Demonstrate switching between regional presets (e.g., US Dollar with exclusive sales tax, UK Pound with inclusive VAT, UAE Dirham, or India GST).
- **Key Observation:** The currency symbol, tax regime, phone formatting, and timezone update across the entire system.
- **Talk Track:** *"Whether you operate in London, New York, Dubai, or Mumbai, the system adapts out of the box with currency formatting, local tax engines, and multilingual menus."*

### 10. Onboarding & Deployment Process (4:30 – 5:00)
- **Action:** Present the 6-step Client Onboarding Checklist and deployment timeline.
- **Key Observation:** Outline delivery milestones: brand intake, menu digitisation, domain mapping, payment gateway sandbox testing, staff training, and launch.
- **Talk Track:** *"From signed agreement to launch takes as little as two weeks. We handle the technical infrastructure, menu setup, staff training, and launch support so you can focus on hospitality."*

---

## Demonstration FAQs & Reassurance Notes
- **Q: Can we use our existing payment gateway?**  
  *A: Yes. We support Stripe for international credit cards, Apple Pay, and Google Pay, as well as Razorpay for UPI and domestic cards in India.*
- **Q: Can our staff update menu prices and mark 86'd items sold out on the fly?**  
  *A: Yes. The dashboard includes instantaneous stock toggling that updates the customer menu in real time.*
- **Q: What happens if our WiFi goes down?**  
  *A: The customer menu continues to render cached items and offline status alerts inform guests gracefully.*
