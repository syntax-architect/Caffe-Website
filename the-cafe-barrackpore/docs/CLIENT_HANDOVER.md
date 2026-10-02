# Client Handover & Restaurant Operations Manual

## The Hospitality Operations Digital System — Client Handover Package (Phase 1K)

This manual guides the restaurant owner and agency through the delivery lifecycle from contract signing to daily operational handoff.

---

### 1. Delivery Lifecycle Workflow

The system is delivered through a repeatable 7-step sequence:

```text
[ 1. CLIENT SIGNS ]
        ↓
[ 2. RESTAURANT DETAILS INTAKE ]
        ↓
[ 3. ZERO-CODE CONFIGURATION ]
        ↓
[ 4. CONNECT SERVICES (Supabase, Sanity, Payment Gateway) ]
        ↓
[ 5. DEPLOY TO PRODUCTION DOMAIN ]
        ↓
[ 6. SMOKE TESTS & VERIFICATION ]
        ↓
[ 7. OWNER HANDOVER & STAFF ONBOARDING ]
```

---

### 2. Client Intake Questionnaire

Collect the following parameters from the restaurant owner before deployment:

| Category | Parameter | Example |
| :--- | :--- | :--- |
| **Brand** | Restaurant Full Name | *The Gilded Truffle* |
| | Short/Display Name | *Gilded Truffle* |
| | Tagline | *Artisanal Gastronomy & Roasts* |
| | Logo Asset | PNG / SVG / WebP (512×512px) |
| **Location** | Country Code | `US`, `GB`, `IN`, `AE`, `CA`, `AU`, `FR`, `DE`, `IT`, `ES`, `SG`, `JP`, `TH`, `NZ`, `SA`, `QA`, `MX`, `NL`, `TR`, `ZA` |
| | Physical Address | *14 Riverside Road, Cantonment* |
| | City / State / Postal Code | *Barrackpore, West Bengal, 700120* |
| **Localization** | Currency Code & Symbol | `USD` ($), `GBP` (£), `EUR` (€), `INR` (₹), `AED`, `SGD` (S$), `JPY` (¥), `THB` (฿) |
| | Locale & Timezone | `en-US` / `America/New_York` |
| | Phone Country Code | `+1`, `+44`, `+91`, `+971`, `+33`, `+49`, `+65`, `+81` |
| | UI Language | English, Arabic (RTL), French, German, Spanish, Portuguese, Japanese, Chinese, Korean, Hindi, Turkish, Thai |
| **Tax** | Tax Label | `Sales Tax`, `VAT`, `GST`, `TVA`, `MwSt.`, `IVA`, `KDV` |
| | Tax Mode | `exclusive` (added at checkout) or `inclusive` (in menu price) |
| | Tax Rate | `0.0825` (8.25%), `0.05` (5%), `0.20` (20%) |
| **Contact** | Primary Phone Number | `+1 (212) 555-0198` |
| | WhatsApp Concierge (if used) | `+91 98301 11222` |
| | Customer Service Email | `reservations@restaurant.com` |
| **Operations** | Opening & Closing Hours | `11:00 AM` to `11:00 PM` |
| | Online Ordering Enabled | `true` / `false` |
| | Table Reservations Enabled | `true` / `false` |
| **Payments** | Preferred Provider | `stripe`, `razorpay`, or `disabled` |
| | Payment Mode | `online` (mandatory), `optional` (counter or card), `disabled` |

---

### 3. Staff Role-Based Access Guide & Official Credentials

#### Official Portal Access
- **Portal URL**: `/staff/login` (or `/staff`)
- **Default Administrator Email**: `admin@gmail.com`
- **Default Administrator Password**: `admin123`
- **Auto-Fill**: The login terminal features an instant "Auto-Fill" pill and pre-populated values for zero-friction access.

The platform implements 3 distinct operational roles:

#### 1. Owner
- **Access Level**: Full administrative authority.
- **Capabilities**:
  - View real-time revenue, order counts, and ticket averages.
  - Modify restaurant localization, opening hours, contact details, tax rate, and payment modes.
  - Add, edit, or deactivate staff accounts.
  - Add, edit, or remove floor tables and generate printable QR code cards.
  - Manage live menu items and mark items 86'd (sold out).
  - Issue staff-authorized refunds.

#### 2. Manager
- **Access Level**: Operational management.
- **Capabilities**:
  - Full access to live Orders and Reservations.
  - Manage floor tables and generate QR codes.
  - Toggle 86'd menu availability.
  - Full Kitchen Display System (KDS) access.
  - *Restricted*: Cannot change restaurant tax/payment keys or manage owner accounts.

#### 3. Staff / Floor & Kitchen
- **Access Level**: Kitchen and dining operations.
- **Capabilities**:
  - Operate the real-time Kitchen Display System (KDS): move tickets through `Preparing` → `Ready` → `Completed`.
  - View incoming reservations and customer notes.
  - Toggle 86'd menu items when kitchen ingredients run out.

---

### 4. Daily Operational Guide for Restaurant Staff

#### A. Opening the Kitchen Display System (KDS)
1. Open a tablet, POS monitor, or kitchen screen and navigate to:
   `https://www.restaurant.com/staff/kitchen` (or via `/staff` → **Kitchen KDS**)
2. Log in with your staff account credentials.
3. Tap the screen once to unlock audio notifications.
4. Incoming orders will play a distinct kitchen chime and appear under the **Preparing** column.
5. Tickets display:
   - Order Reference (e.g. `#CB-2026-X7R9`)
   - Dine-In Table Number (e.g. `TABLE 07`) or `TAKEAWAY`
   - Operational Payment Status (`PAID` in emerald or `PAY AT COUNTER` in amber)
   - Ordered items, quantities, and customer special requests

#### B. 86'ing (Marking Items Sold Out)
When an ingredient or dish runs out during a shift:
1. In the Staff Dashboard, go to **Menu & Availability** (or in KDS top bar).
2. Find the item (e.g. `Wood-Fired Margherita Pizza`).
3. Toggle status to **Sold Out (86'd)**.
4. Customers browsing the website or scanning QR codes immediately see the item disabled with an "Unavailable" badge.
5. When restocked, toggle back to **Available**.

#### C. Printing Table QR Cards
1. In the Staff Dashboard, go to **Floor Tables**.
2. Click **View QR** on any table (e.g. Table 07).
3. Click **Print Table Card**.
4. The system opens a high-contrast, print-optimized card designed to stand on the table.
5. Diners can scan with their phone camera to instantly open `/qr?table=07`.

---

### 5. Data Privacy & Financial Separation

- **Customer Payments**: All payments made by diners go directly to the restaurant's merchant account (Stripe/Razorpay). The platform never routes customer money through agency accounts.
- **Customer Privacy**: Guest checkout requires only Name and Phone. No customer accounts, passwords, or marketing opt-ins are forced.
- **Payment Card Data**: No raw credit card or debit card numbers ever touch or reside on the restaurant's servers or database.
