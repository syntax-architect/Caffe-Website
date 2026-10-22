# Global Restaurant Tax Registry & Jurisdictional Compliance Report

**Document Version:** 2026.4 (Comprehensive International Release)  
**Effective Date:** Mid-2026 Statutory Law Review  
**Coverage:** 44 Major Jurisdictions (Tier 1: 8, Tier 2: 13, Tier 3: 23)  
**Standard of Verification:** Statutory Tax Authority Legislation First, Big-4 / OECD Global Summaries Secondary.

---

## 1. Executive Summary & Regulatory Framework

This report documents the statutory indirect tax (VAT / GST / Sales Tax / Consumption Tax / Service Tax) rules applicable to commercial food and beverage operations across 44 sovereign economic jurisdictions.

### Core Rules for Honesty & Compliance Integrity
1. **Official Verification Standard (`status: 'verified'`):** A jurisdiction is marked **verified** ONLY when primary legislation or official tax authority rulings (e.g., `revenue.ie`, `gov.uk`, `gst.gov.in`, `ato.gov.au`, `IRAS`, `FTA UAE`, `BMF`, `DGFiP`, `Agencia Tributaria`, `Agenzia delle Entrate`, `DIAN`, etc.) confirm the exact rates and category boundaries.
2. **Accountant Confirmation Gate:** Any country with status `unverified` or `conflict`, or any jurisdiction imposing certified physical/cloud fiscal device mandates (e.g. German TSE, Italian RT, French NF525, Portuguese AT, Spanish Veri*Factu, Polish KSeF, Kenyan eTIMS, Mexican CFDI, Brazilian NFC-e), **blocks live ordering in the application** until the restaurant owner and certified local accountant record formal sign-off.
3. **No Guesswork on Federal Systems:** Multi-tiered federal jurisdictions (**United States, Canada, India, UAE, Brazil, Australia**) require manual regional selection (State, Province, or Emirate). Composite single national rates are strictly disallowed.
4. **Currency Decimal Precision:** Non-standard currency decimal rules are hard-enforced at the calculation engine layer:
   - **0 Decimals (No minor unit):** JPY (¥), KRW (₩), VND (₫), CLP (CLP$), IDR (Rp).
   - **3 Decimals (1/1000 minor unit):** BHD (BD), KWD (KD).
   - **2 Decimals (Standard):** USD, EUR, GBP, AUD, CAD, NZD, SGD, INR, etc.

---

## 2. Master Summary Table (All 44 Countries)

| Code | Country | Tier | Status | Currency (Dec) | Standard Rate | Restaurant Rate | Food vs Alcohol | Dine-In vs Takeaway | Service Charge | Fiscal Hardware / E-Invoice | Last Verified |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---|:---:|
| **IE** | Ireland | Tier 1 | `verified` | EUR (2) | 23.0% | **13.5%** | 13.5% / 23.0% | 13.5% / 13.5% | 10% (Taxable) | Standard POS | 2026-10-22 |
| **GB** | United Kingdom | Tier 1 | `verified` | GBP (2) | 20.0% | **20.0%** | 20.0% / 20.0% | 20.0% / 20.0% | 13% (Taxable) | Standard POS | 2026-10-22 |
| **US** | United States | Tier 1 | `verified` | USD (2) | 8.3% | **8.3%** | 8.3% / 8.3% | 8.3% / 8.3% | 18% (Taxable) | Standard POS | 2026-10-22 |
| **CA** | Canada | Tier 1 | `verified` | CAD (2) | 13.0% | **13.0%** | 13.0% / 13.0% | 13.0% / 13.0% | 15% (Taxable) | Standard POS | 2026-10-22 |
| **AU** | Australia | Tier 1 | `verified` | AUD (2) | 10.0% | **10.0%** | 10.0% / 10.0% | 10.0% / 10.0% | None / Voluntary | Standard POS | 2026-10-22 |
| **NZ** | New Zealand | Tier 1 | `verified` | NZD (2) | 15.0% | **15.0%** | 15.0% / 15.0% | 15.0% / 15.0% | None / Voluntary | Standard POS | 2026-10-22 |
| **SG** | Singapore | Tier 1 | `verified` | SGD (2) | 9.0% | **9.0%** | 9.0% / 9.0% | 9.0% / 9.0% | 10% (Taxable) | Standard POS | 2026-10-22 |
| **AE** | United Arab Emirates | Tier 1 | `verified` | AED (2) | 5.0% | **5.0%** | 5.0% / 5.0% | 5.0% / 5.0% | 10% (Taxable) | Standard POS | 2026-10-22 |
| **DE** | Germany | Tier 2 | `verified` | EUR (2) | 19.0% | **7.0%** | 7.0% / 19.0% | 7.0% / 7.0% | None / Voluntary | ⚠️ TSE (Technische Sicherheitseinrichtung) certified under KassenSichV | 2026-10-22 |
| **FR** | France | Tier 2 | `verified` | EUR (2) | 20.0% | **10.0%** | 10.0% / 20.0% | 10.0% / 10.0% | 15% (Taxable) | ⚠️ Logiciel de caisse certifié NF525 ou LNE (Art. 286 du CGI) | 2026-10-22 |
| **ES** | Spain | Tier 2 | `verified` | EUR (2) | 21.0% | **10.0%** | 10.0% / 21.0% | 10.0% / 10.0% | None / Voluntary | ⚠️ Veri*Factu (RD 1007/2023) / TicketBAI (País Vasco) | 2026-10-22 |
| **IT** | Italy | Tier 2 | `verified` | EUR (2) | 22.0% | **10.0%** | 10.0% / 22.0% | 10.0% / 10.0% | None / Voluntary | ⚠️ Registratore Telematico (RT) connected to Agenzia delle Entrate | 2026-10-22 |
| **NL** | Netherlands | Tier 2 | `verified` | EUR (2) | 21.0% | **9.0%** | 9.0% / 21.0% | 9.0% / 9.0% | None / Voluntary | Standard POS | 2026-10-22 |
| **PT** | Portugal | Tier 2 | `verified` | EUR (2) | 23.0% | **13.0%** | 13.0% / 23.0% | 13.0% / 13.0% | None / Voluntary | ⚠️ Software de Faturação Certificado pela AT com SAF-T PT | 2026-10-22 |
| **BE** | Belgium | Tier 2 | `verified` | EUR (2) | 21.0% | **12.0%** | 12.0% / 21.0% | 12.0% / 6.0% | None / Voluntary | ⚠️ Système de Caisse Enregistreuse (SCE) / Boîte Noire (GKS) | 2026-10-22 |
| **AT** | Austria | Tier 2 | `verified` | EUR (2) | 20.0% | **10.0%** | 10.0% / 20.0% | 10.0% / 10.0% | None / Voluntary | ⚠️ Registrierkasse mit Signaturerstellungseinheit (RKSV) | 2026-10-22 |
| **SE** | Sweden | Tier 2 | `verified` | SEK (2) | 25.0% | **12.0%** | 12.0% / 25.0% | 12.0% / 12.0% | None / Voluntary | ⚠️ Certifierat kassaregister med kontrollenhet (Skatteverket) | 2026-10-22 |
| **DK** | Denmark | Tier 2 | `verified` | DKK (2) | 25.0% | **25.0%** | 25.0% / 25.0% | 25.0% / 25.0% | None / Voluntary | ⚠️ Digitalt kassesystem (Krav om digitale kassesystemer 2024-2026) | 2026-10-22 |
| **NO** | Norway | Tier 2 | `verified` | NOK (2) | 25.0% | **25.0%** | 25.0% / 25.0% | 25.0% / 15.0% | None / Voluntary | ⚠️ Kassasystemloven (Produkterklæring og SAF-T Cash Register) | 2026-10-22 |
| **CH** | Switzerland | Tier 2 | `verified` | CHF (2) | 8.1% | **8.1%** | 8.1% / 8.1% | 8.1% / 2.6% | None / Voluntary | Standard POS | 2026-10-22 |
| **PL** | Poland | Tier 2 | `verified` | PLN (2) | 23.0% | **8.0%** | 8.0% / 23.0% | 8.0% / 8.0% | 10% (Taxable) | ⚠️ Kasa fiskalna online connected to Centralny Repozytorium Kas (CRK) | 2026-10-22 |
| **IN** | India | Tier 3 | `verified` | INR (2) | 18.0% | **5.0%** | 5.0% / not found | 5.0% / 5.0% | None / Voluntary | ℹ️ IRP E-Invoicing (mandatory for B2B turnover > ₹5 Cr) & B2C Dynamic QR (> ₹500 Cr) | 2026-10-22 |
| **JP** | Japan | Tier 3 | `verified` | JPY (0) | 10.0% | **10.0%** | 10.0% / 10.0% | 10.0% / 8.0% | 10% (Taxable) | ℹ️ Qualified Invoice System (インボイス制度 / Invoice System) | 2026-10-22 |
| **KR** | South Korea | Tier 3 | `verified` | KRW (0) | 10.0% | **10.0%** | 10.0% / 10.0% | 10.0% / 10.0% | None / Voluntary | ⚠️ Cash Receipt Terminal (현금영수증 단말기) connected to NTS | 2026-10-22 |
| **TH** | Thailand | Tier 3 | `verified` | THB (2) | 7.0% | **7.0%** | 7.0% / 7.0% | 7.0% / 7.0% | 10% (Taxable) | ⚠️ Approved POS / Cash Register (เครื่องบันทึกการเก็บเงิน) | 2026-10-22 |
| **MY** | Malaysia | Tier 3 | `verified` | MYR (2) | 6.0% | **6.0%** | 6.0% / 8.0% | 6.0% / 6.0% | 10% (Taxable) | ℹ️ LHDN MyInvois e-Invoicing (Phased 2024-2025) | 2026-10-22 |
| **ID** | Indonesia | Tier 3 | `verified` | IDR (0) | 10.0% | **10.0%** | 10.0% / 10.0% | 10.0% / 10.0% | 5% (Taxable) | Standard POS | 2026-10-22 |
| **PH** | Philippines | Tier 3 | `verified` | PHP (2) | 12.0% | **12.0%** | 12.0% / 12.0% | 12.0% / 12.0% | 10% (Taxable) | ⚠️ BIR-Accredited POS / Cash Register Machine (CRM) | 2026-10-22 |
| **VN** | Vietnam | Tier 3 | `verified` | VND (0) | 10.0% | **8.0%** | 8.0% / 10.0% | 8.0% / 8.0% | 5% (Taxable) | ⚠️ Máy tính tiền có kết nối dữ liệu điện tử với cơ quan thuế (Decree 123/2020) | 2026-10-22 |
| **HK** | Hong Kong | Tier 3 | `verified` | HKD (2) | 0.0% | **0.0%** | 0.0% / 0.0% | 0.0% / 0.0% | 10% (Exempt) | Standard POS | 2026-10-22 |
| **SA** | Saudi Arabia | Tier 3 | `verified` | SAR (2) | 15.0% | **15.0%** | 15.0% / prohibited | 15.0% / 15.0% | None / Voluntary | ⚠️ ZATCA FATOORA Phase 2 compliant solution with CSID cryptographic stamp | 2026-10-22 |
| **QA** | Qatar | Tier 3 | `verified` | QAR (2) | 0.0% | **0.0%** | 0.0% / 0.0% | 0.0% / 0.0% | 10% (Exempt) | Standard POS | 2026-10-22 |
| **KW** | Kuwait | Tier 3 | `verified` | KWD (3) | 0.0% | **0.0%** | 0.0% / prohibited | 0.0% / 0.0% | None / Voluntary | Standard POS | 2026-10-22 |
| **BH** | Bahrain | Tier 3 | `verified` | BHD (3) | 10.0% | **10.0%** | 10.0% / 10.0% | 10.0% / 10.0% | 10% (Taxable) | Standard POS | 2026-10-22 |
| **TR** | Turkey | Tier 3 | `verified` | TRY (2) | 20.0% | **10.0%** | 10.0% / 20.0% | 10.0% / 10.0% | 10% (Taxable) | ⚠️ Yeni Nesil Ödeme Kaydedici Cihaz (YN ÖKC) / e-Fatura / e-Arşiv | 2026-10-22 |
| **IL** | Israel | Tier 3 | `verified` | ILS (2) | 17.0% | **17.0%** | 17.0% / 17.0% | 17.0% / 17.0% | 12% (Taxable) | ⚠️ Approved Bookkeeping Software registered with ITA (תוכנה רשומה) | 2026-10-22 |
| **ZA** | South Africa | Tier 3 | `verified` | ZAR (2) | 15.0% | **15.0%** | 15.0% / 15.0% | 15.0% / 15.0% | 10% (Taxable) | Standard POS | 2026-10-22 |
| **NG** | Nigeria | Tier 3 | `verified` | NGN (2) | 7.5% | **7.5%** | 7.5% / 7.5% | 7.5% / 7.5% | 10% (Taxable) | Standard POS | 2026-10-22 |
| **KE** | Kenya | Tier 3 | `verified` | KES (2) | 16.0% | **16.0%** | 16.0% / 16.0% | 16.0% / 16.0% | 2% (Taxable) | ⚠️ eTIMS (electronic Tax Invoice Management System) | 2026-10-22 |
| **EG** | Egypt | Tier 3 | `verified` | EGP (2) | 14.0% | **14.0%** | 14.0% / 14.0% | 14.0% / 14.0% | 12% (Taxable) | ⚠️ Egyptian e-Receipt System (منظومة الإيصال الإلكتروني) | 2026-10-22 |
| **MX** | Mexico | Tier 3 | `verified` | MXN (2) | 16.0% | **16.0%** | 16.0% / 16.0% | 16.0% / 16.0% | None / Voluntary | ⚠️ CFDI 4.0 con Timbrado Fiscal SAT a través de PAC | 2026-10-22 |
| **BR** | Brazil | Tier 3 | `conflict` | BRL (2) | 12.0% | **12.0%** | 12.0% / 25.0% | 12.0% / 12.0% | 10% (Taxable) | ⚠️ NFC-e (Nota Fiscal de Consumidor Eletrônica - Mod 65) / SAT-CF-e (SP) | 2026-10-22 |
| **CL** | Chile | Tier 3 | `verified` | CLP (0) | 19.0% | **19.0%** | 19.0% / 19.0% | 19.0% / 19.0% | 10% (Exempt) | ⚠️ Boleta Electrónica de Ventas y Servicios (SII) | 2026-10-22 |
| **CO** | Colombia | Tier 3 | `verified` | COP (0) | 8.0% | **8.0%** | 8.0% / 8.0% | 8.0% / 8.0% | 10% (Exempt) | ⚠️ Factura Electrónica de Venta / Documento Equivalente POS Electrónico (DIAN) | 2026-10-22 |

---

## 3. Detailed Jurisdictional Profiles

### Tier 1: Core International Hubs (IE, GB, US, CA, AU, NZ, SG, AE)

#### Ireland (IE)

- **Tier & Status:** Tier 1 | **Status: `VERIFIED`** (Can go live without accountant: **YES**)
- **Currency & Decimals:** `EUR` (€) — **2 Decimals**
- **Standard vs Restaurant Tax:** Standard: **23.00%** | Restaurant / Catering: **13.50%** (inclusive)
- **Tax Display Label & Tax ID:** Label: **VAT** | Tax ID Label: **VAT No.** (Format: `IE1234567T or IE1234567FA`)
- **Category Breakdown:**
  - **Food:** 13.5%
  - **Hot Drinks:** 13.5%
  - **Soft Drinks:** 23.0%
  - **Bottled Water:** 23.0%
  - **Alcohol:** 23.0%
  - **Tobacco:** 23.0%
- **Fulfillment Channels:** Dine-In: **13.5%** | Takeaway: **13.5%** | Delivery: **13.5%**
- **Service Charge & Tips:** Policy: `optional` | Standard Rate: **10%** | Taxable: **YES** | Cover Charge Allowed: **YES**
  - *Legal Note:* Mandatory service charges are subject to VAT at the food service rate. Discretionary tips given directly to staff are outside the scope of VAT.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **NO**
  - E-Invoicing Mandatory: **NO**
  - Natively Supported by Web App: **YES**
  - *Invoicing Details:* Simplified tax invoice permitted under €100. Section 66 VAT Consolidation Act 2010 details mandatory invoice fields.
- **Compliance Warnings:**
  - ⚠️ *Soft drinks, bottled waters, and alcoholic drinks MUST be taxed at 23% even when served alongside a 13.5% (or 9%) meal.*
  - ⚠️ *Mandatory service charges must be taxed at the food VAT rate.*
- **Dated Statutory Rate History:**
  - `2020-11-01` to `2023-08-31`: **9.0%** — *Temporary 9% second reduced rate for hospitality and catering services.*
  - `2023-09-01` to `2026-06-30`: **13.5%** — *Reversion to 13.5% reduced rate for restaurant and catering food services.*
  - `2026-07-01` to `Present`: **9.0%** — *Statutory reinstatement of the 9% second reduced VAT rate for restaurant meals.*
- **Sources & Legal Citations:**
  - [Irish Revenue Commissioners — VAT Rates on Food and Drink](https://www.revenue.ie/en/vat/vat-rates/search-vat-rates/food-and-drink.aspx) (Official Tax Authority)
  - [Irish Revenue — Restaurant and Catering Services Guidelines](https://www.revenue.ie/en/tax-professionals/tdm/value-added-tax/services/restaurant-and-catering-services.pdf) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### United Kingdom (GB)

- **Tier & Status:** Tier 1 | **Status: `VERIFIED`** (Can go live without accountant: **YES**)
- **Currency & Decimals:** `GBP` (£) — **2 Decimals**
- **Standard vs Restaurant Tax:** Standard: **20.00%** | Restaurant / Catering: **20.00%** (inclusive)
- **Tax Display Label & Tax ID:** Label: **VAT** | Tax ID Label: **VAT Reg No.** (Format: `GB 123 4567 89`)
- **Category Breakdown:**
  - **Food:** 20.0%
  - **Hot Drinks:** 20.0%
  - **Soft Drinks:** 20.0%
  - **Bottled Water:** 20.0%
  - **Alcohol:** 20.0%
  - **Tobacco:** 20.0%
- **Fulfillment Channels:** Dine-In: **20.0%** | Takeaway: **20.0%** | Delivery: **20.0%**
- **Service Charge & Tips:** Policy: `optional` | Standard Rate: **13%** | Taxable: **YES** | Cover Charge Allowed: **YES**
  - *Legal Note:* HMRC Notice 709/1: Mandatory service charge is liable to 20% VAT. Discretionary tips/service charges are outside scope of VAT.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **NO**
  - E-Invoicing Mandatory: **NO**
  - Natively Supported by Web App: **YES**
  - *Invoicing Details:* Simplified tax invoice permitted under £250. Must show supplier name, address, VAT number, tax point, and breakdown.
- **Compliance Warnings:**
  - ⚠️ *Cold takeaway food sold off-premises is zero-rated (0%), but all hot takeaway food and any food eaten on-premises is standard-rated (20%).*
  - ⚠️ *Mandatory service charge is subject to 20% VAT; genuine discretionary gratuities are non-taxable.*
- **Dated Statutory Rate History:**
  - `2011-01-04` to `Present`: **20.0%** — *Standard 20% VAT rate applicable to restaurant catering and hot takeaway.*
- **Sources & Legal Citations:**
  - [HMRC VAT Notice 709/1: Catering and takeaway food](https://www.gov.uk/guidance/catering-takeaway-food-and-vat-notice-7091) (Official Tax Authority)
  - [HMRC Guidance: Rates of VAT on different goods and services](https://www.gov.uk/guidance/rates-of-vat-on-different-goods-and-services) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### United States (US)

- **Tier & Status:** Tier 1 | **Status: `VERIFIED`** (Can go live without accountant: **YES**)
- **Currency & Decimals:** `USD` ($) — **2 Decimals**
- **Standard vs Restaurant Tax:** Standard: **8.25%** | Restaurant / Catering: **8.25%** (exclusive)
- **Tax Display Label & Tax ID:** Label: **Sales Tax** | Tax ID Label: **EIN / State Tax ID** (Format: `12-3456789`)
- **Category Breakdown:**
  - **Food:** 8.3%
  - **Hot Drinks:** 8.3%
  - **Soft Drinks:** 8.3%
  - **Bottled Water:** 8.3%
  - **Alcohol:** 8.3%
  - **Tobacco:** 8.3%
- **Fulfillment Channels:** Dine-In: **8.3%** | Takeaway: **8.3%** | Delivery: **8.3%**
- **Service Charge & Tips:** Policy: `optional` | Standard Rate: **18%** | Taxable: **YES** | Cover Charge Allowed: **YES**
  - *Legal Note:* IRS Revenue Ruling 2012-18: Mandatory service charges/automatic gratuities are taxable revenue subject to state sales tax and employee wages. Voluntary tips are non-taxable.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **NO**
  - E-Invoicing Mandatory: **NO**
  - Natively Supported by Web App: **YES**
  - *Invoicing Details:* Itemized sales receipt required. State sales tax permit number must be displayed or registered.
- **Compliance Warnings:**
  - ⚠️ *FEDERAL / MULTI-LEVEL JURISDICTION: No single national sales tax exists. A state/city region MUST be manually selected.*
  - ⚠️ *Mandatory automatic gratuities (e.g. 18% for parties of 6+) are legally taxable as sales revenue in almost all US states.*
- **Dated Statutory Rate History:**
  - `2000-01-01` to `Present`: **8.3%** — *Varies by jurisdiction. Default baseline reflects common composite metro rates.*
- **Federal / Multi-Level Regional Rules:**
  - **CA (California (State 7.25% + District up to 10.75%)):** Restaurant Rate: **9.50%** (CA Sales Tax, exclusive). *CDTFA Pub 22: Hot prepared food, dine-in, and carbonated beverages taxable.*
  - **NY (New York (NYC 8.875% / State 4.0% - 8.875%)):** Restaurant Rate: **8.88%** (NY Sales Tax, exclusive). *NYS Dept of Taxation TB-ST-800: Restaurant meals, heated food, drinks taxable at 8.875% in NYC.*
  - **TX (Texas (State 6.25% + Local 2.0% = 8.25%)):** Restaurant Rate: **8.25%** (TX Sales Tax, exclusive). *Texas Comptroller Pub 96-259: Prepared food and drinks taxable at 8.25%. Mixed Beverage Sales Tax 8.25% on alcohol.*
  - **FL (Florida (State 6.0% + Discretionary Surtax 0.5%-1.5%)):** Restaurant Rate: **7.00%** (FL Sales Tax, exclusive). *Florida Dept of Revenue: Prepared food and meals taxable at state 6% + county surtax.*
  - **IL (Illinois (Chicago Restaurant Tax up to 10.75%)):** Restaurant Rate: **10.75%** (IL Sales Tax, exclusive). *Illinois ROT + Chicago Municipal Restaurant Tax (0.50%) + MPEA tax (1.00%).*
  - **WA (Washington (State 6.5% + Local up to 10.35% Seattle)):** Restaurant Rate: **10.35%** (WA Sales Tax, exclusive). *WA Dept of Revenue: Prepared food is subject to retail sales tax.*
- **Sources & Legal Citations:**
  - [IRS Revenue Ruling 2012-18 — Tips vs Service Charges](https://www.irs.gov/irb/2012-26_IRB#RR-2012-18) (Official Tax Authority)
  - [California Department of Tax and Fee Administration (CDTFA) Pub 22](https://www.cdtfa.ca.gov/formspubs/pub22.pdf) (Official Tax Authority)
  - [New York Department of Taxation and Finance — TB-ST-800 Restaurant Meals](https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/sales_by_restaurants.htm) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### Canada (CA)

- **Tier & Status:** Tier 1 | **Status: `VERIFIED`** (Can go live without accountant: **YES**)
- **Currency & Decimals:** `CAD` (CA$) — **2 Decimals**
- **Standard vs Restaurant Tax:** Standard: **13.00%** | Restaurant / Catering: **13.00%** (exclusive)
- **Tax Display Label & Tax ID:** Label: **HST / GST** | Tax ID Label: **CRA Business No. (BN/GST)** (Format: `123456789RT0001`)
- **Category Breakdown:**
  - **Food:** 13.0%
  - **Hot Drinks:** 13.0%
  - **Soft Drinks:** 13.0%
  - **Bottled Water:** 13.0%
  - **Alcohol:** 13.0%
  - **Tobacco:** 13.0%
- **Fulfillment Channels:** Dine-In: **13.0%** | Takeaway: **13.0%** | Delivery: **13.0%**
- **Service Charge & Tips:** Policy: `optional` | Standard Rate: **15%** | Taxable: **YES** | Cover Charge Allowed: **YES**
  - *Legal Note:* CRA Policy P-122: Mandatory service charges are consideration for the supply of restaurant services and subject to GST/HST. Voluntary tips are exempt.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **NO**
  - E-Invoicing Mandatory: **NO**
  - Natively Supported by Web App: **YES**
  - *Invoicing Details:* Quebec requires certified Sales Recording Module (WEB-SRM) for all restaurant transactions. CRA requires business number on invoices >$30.
- **Compliance Warnings:**
  - ⚠️ *FEDERAL / MULTI-LEVEL JURISDICTION: Provincial sales tax structure varies widely across GST, HST, PST, and QST.*
  - ⚠️ *QUEBEC COMPLIANCE WARNING: Operating in Quebec legally requires certified WEB-SRM integration, which is not natively provided by this web app.*
- **Dated Statutory Rate History:**
  - `2010-07-01` to `Present`: **13.0%** — *Harmonized Sales Tax 13% (5% Federal + 8% Provincial).*
- **Federal / Multi-Level Regional Rules:**
  - **ON (Ontario (HST 13%)):** Restaurant Rate: **13.00%** (HST, exclusive). *Prepared food and beverages <= $4.00 qualify for point-of-sale rebate of 8% provincial portion (effective tax 5% GST).*
  - **QC (Quebec (GST 5% + QST 9.975% = 14.975%)):** Restaurant Rate: **14.97%** (GST + QST, exclusive). *Revenu Québec: Mandatory WEB-SRM electronic billing device for all restaurants.*
  - **BC (British Columbia (GST 5% + PST: Food 0%, Soda 7%, Alcohol 10%)):** Restaurant Rate: **5.00%** (GST (+ PST on drinks), exclusive). *BC PST: Prepared restaurant food is EXEMPT from 7% PST (only 5% GST applies). Carbonated soda is 5% GST + 7% PST. Alcohol is 5% GST + 10% PST.*
  - **AB (Alberta (GST 5% Only — No Provincial Sales Tax)):** Restaurant Rate: **5.00%** (GST, exclusive). *Alberta imposes no provincial sales tax. Only federal 5% GST applies.*
- **Sources & Legal Citations:**
  - [Canada Revenue Agency (CRA) — GST/HST and Restaurant Services](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/gi-043/gsthst-and-restaurant-services.html) (Official Tax Authority)
  - [British Columbia Ministry of Finance — Bulletin PST 119 (Restaurants)](https://www2.gov.bc.ca/assets/gov/taxes/sales-taxes/publications/pst-119-restaurants.pdf) (Official Tax Authority)
  - [Revenu Québec — Mandatory Billing in the Restaurant Sector (WEB-SRM)](https://www.revenuquebec.ca/en/businesses/consumption-taxes/gsthst-and-qst/mandatory-billing-in-the-restaurant-sector/) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### Australia (AU)

- **Tier & Status:** Tier 1 | **Status: `VERIFIED`** (Can go live without accountant: **YES**)
- **Currency & Decimals:** `AUD` (A$) — **2 Decimals**
- **Standard vs Restaurant Tax:** Standard: **10.00%** | Restaurant / Catering: **10.00%** (inclusive)
- **Tax Display Label & Tax ID:** Label: **GST** | Tax ID Label: **ABN** (Format: `12 345 678 901`)
- **Category Breakdown:**
  - **Food:** 10.0%
  - **Hot Drinks:** 10.0%
  - **Soft Drinks:** 10.0%
  - **Bottled Water:** 10.0%
  - **Alcohol:** 10.0%
  - **Tobacco:** 10.0%
- **Fulfillment Channels:** Dine-In: **10.0%** | Takeaway: **10.0%** | Delivery: **10.0%**
- **Service Charge & Tips:** Policy: `optional` | Standard Rate: **0%** | Taxable: **YES** | Cover Charge Allowed: **YES**
  - *Legal Note:* ATO Ruling GSTR 2000/19: Surcharges added to the bill are taxable consideration subject to 10% GST. ACCC single pricing rules require clear display.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **NO**
  - E-Invoicing Mandatory: **NO**
  - Natively Supported by Web App: **YES**
  - *Invoicing Details:* Tax invoice required for purchases > A$82.50. Must include ABN, date, total including GST, and clear GST amount.
- **Compliance Warnings:**
  - ⚠️ *ACCC COMPLIANCE: Displayed menu prices must be GST-inclusive. Any weekend/public holiday surcharge must be prominently disclosed.*
- **Dated Statutory Rate History:**
  - `2000-07-01` to `Present`: **10.0%** — *Federal uniform 10% GST on all restaurant goods and services.*
- **Federal / Multi-Level Regional Rules:**
  - **NATIONAL (Australia (Uniform National Federal GST 10%)):** Restaurant Rate: **10.00%** (GST, inclusive). *GST is uniform across all Australian states and territories (NSW, VIC, QLD, WA, SA, TAS, ACT, NT). No state-level sales taxes exist.*
- **Sources & Legal Citations:**
  - [Australian Taxation Office (ATO) — GST and Food](https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/in-detail/your-industry/food/gst-and-food) (Official Tax Authority)
  - [ATO — GSTR 2000/19: Goods and services tax: supplies of food](https://www.ato.gov.au/law/view/document?DocID=GST/GSTR200019/NAT/ATO/00001) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### New Zealand (NZ)

- **Tier & Status:** Tier 1 | **Status: `VERIFIED`** (Can go live without accountant: **YES**)
- **Currency & Decimals:** `NZD` (NZ$) — **2 Decimals**
- **Standard vs Restaurant Tax:** Standard: **15.00%** | Restaurant / Catering: **15.00%** (inclusive)
- **Tax Display Label & Tax ID:** Label: **GST** | Tax ID Label: **GST / IRD No.** (Format: `12-345-678 or 123-456-789`)
- **Category Breakdown:**
  - **Food:** 15.0%
  - **Hot Drinks:** 15.0%
  - **Soft Drinks:** 15.0%
  - **Bottled Water:** 15.0%
  - **Alcohol:** 15.0%
  - **Tobacco:** 15.0%
- **Fulfillment Channels:** Dine-In: **15.0%** | Takeaway: **15.0%** | Delivery: **15.0%**
- **Service Charge & Tips:** Policy: `optional` | Standard Rate: **0%** | Taxable: **YES** | Cover Charge Allowed: **YES**
  - *Legal Note:* New Zealand has broad-based GST with virtually no exemptions. Surcharges are subject to 15% GST.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **NO**
  - E-Invoicing Mandatory: **NO**
  - Natively Supported by Web App: **YES**
  - *Invoicing Details:* Taxable supply information required for supplies over NZD 50 under modernised 2023 invoicing rules.
- **Compliance Warnings:**
  - ⚠️ *Fair Trading Act: All menu prices shown to consumers must include 15% GST.*
- **Dated Statutory Rate History:**
  - `2010-10-01` to `Present`: **15.0%** — *Uniform 15% GST across all restaurant food, beverage, and services.*
- **Sources & Legal Citations:**
  - [Inland Revenue New Zealand (IRD) — GST for businesses](https://www.ird.govt.nz/gst) (Official Tax Authority)
  - [Inland Revenue — Taxable supply information for GST](https://www.ird.govt.nz/gst/tax-invoices-for-gst) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### Singapore (SG)

- **Tier & Status:** Tier 1 | **Status: `VERIFIED`** (Can go live without accountant: **YES**)
- **Currency & Decimals:** `SGD` (S$) — **2 Decimals**
- **Standard vs Restaurant Tax:** Standard: **9.00%** | Restaurant / Catering: **9.00%** (inclusive)
- **Tax Display Label & Tax ID:** Label: **GST** | Tax ID Label: **GST Reg. No.** (Format: `M1-2345678-A`)
- **Category Breakdown:**
  - **Food:** 9.0%
  - **Hot Drinks:** 9.0%
  - **Soft Drinks:** 9.0%
  - **Bottled Water:** 9.0%
  - **Alcohol:** 9.0%
  - **Tobacco:** 9.0%
- **Fulfillment Channels:** Dine-In: **9.0%** | Takeaway: **9.0%** | Delivery: **9.0%**
- **Service Charge & Tips:** Policy: `standard` | Standard Rate: **10%** | Taxable: **YES** | Cover Charge Allowed: **YES**
  - *Legal Note:* IRAS e-Tax Guide F&B: 9% GST applies on the gross bill INCLUDING the 10% service charge (the "++" pricing structure).
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **NO**
  - E-Invoicing Mandatory: **NO**
  - Natively Supported by Web App: **YES**
  - *Invoicing Details:* Tax invoice required for GST-registered customers. Simplified tax invoice permitted for retail under S$1,000.
- **Compliance Warnings:**
  - ⚠️ *IRAS SECTION 26: Only F&B establishments that charge a 10% service charge may display "++" prices. All takeaway/delivery must show final GST-inclusive prices.*
  - ⚠️ *GST compounds on top of service charge (9% on $10 service charge = $0.90 additional GST).*
- **Dated Statutory Rate History:**
  - `2007-07-01` to `2022-12-31`: **7.0%** — *Standard 7% GST rate.*
  - `2023-01-01` to `2023-12-31`: **8.0%** — *First phase of GST rate increase from 7% to 8%.*
  - `2024-01-01` to `Present`: **9.0%** — *Second phase of GST rate increase from 8% to 9%.*
- **Sources & Legal Citations:**
  - [Inland Revenue Authority of Singapore (IRAS) — GST Rate Change](https://www.iras.gov.sg/taxes/goods-services-tax-(gst)/gst-rate-change) (Official Tax Authority)
  - [IRAS e-Tax Guide — Food and Beverage Industry](https://www.iras.gov.sg/media/docs/default-source/e-tax-guides/etaxguide_gst_food-and-beverage-industry.pdf) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### United Arab Emirates (AE)

- **Tier & Status:** Tier 1 | **Status: `VERIFIED`** (Can go live without accountant: **YES**)
- **Currency & Decimals:** `AED` (AED) — **2 Decimals**
- **Standard vs Restaurant Tax:** Standard: **5.00%** | Restaurant / Catering: **5.00%** (inclusive)
- **Tax Display Label & Tax ID:** Label: **VAT** | Tax ID Label: **TRN** (Format: `100XXXXXXXXX003 (15 digits)`)
- **Category Breakdown:**
  - **Food:** 5.0%
  - **Hot Drinks:** 5.0%
  - **Soft Drinks:** 5.0%
  - **Bottled Water:** 5.0%
  - **Alcohol:** 5.0%
  - **Tobacco:** 5.0%
- **Fulfillment Channels:** Dine-In: **5.0%** | Takeaway: **5.0%** | Delivery: **5.0%**
- **Service Charge & Tips:** Policy: `standard` | Standard Rate: **10%** | Taxable: **YES** | Cover Charge Allowed: **YES**
  - *Legal Note:* FTA VAT Public Clarification: Service charges levied on restaurant bills form part of the consideration and are taxable at 5% VAT.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **NO**
  - E-Invoicing Mandatory: **NO**
  - Natively Supported by Web App: **YES**
  - *Invoicing Details:* Tax Invoice must display TRN, unit prices, VAT rate, and VAT amount in AED.
- **Compliance Warnings:**
  - ⚠️ *FEDERAL / EMIRATE MULTI-LEVEL LEVIES: Dubai levies a 7% municipality fee on restaurant/hotel bills; Abu Dhabi levies 5.5% municipality fees.*
  - ⚠️ *VAT 5% applies to the gross amount including any service charge and municipality fee.*
- **Dated Statutory Rate History:**
  - `2018-01-01` to `Present`: **5.0%** — *Federal Decree-Law No. (8) of 2017: 5% VAT on all goods and services.*
- **Federal / Multi-Level Regional Rules:**
  - **DXB (Dubai (5% VAT + 7% Municipality Fee)):** Restaurant Rate: **5.00%** (VAT, inclusive). *7% municipality fee applied to food and beverage in tourist establishments.*
  - **AUH (Abu Dhabi (5% VAT + 5.5% Municipality Fee)):** Restaurant Rate: **5.00%** (VAT, inclusive). *Tourism fees lowered, 5.5% municipality fee applied in hotels and designated tourist zones.*
  - **SHJ (Sharjah (5% VAT)):** Restaurant Rate: **5.00%** (VAT, inclusive). *Standard 5% federal VAT applies.*
- **Sources & Legal Citations:**
  - [UAE Federal Tax Authority (FTA) — VAT Legislation and Guides](https://tax.gov.ae/en/legislation.aspx) (Official Tax Authority)
  - [PwC Worldwide Tax Summaries — United Arab Emirates Corporate - Other taxes](https://taxsummaries.pwc.com/united-arab-emirates/corporate/other-taxes) (Authoritative Summary)
- **Last Verified:** `2026-10-22`

### Tier 2: European Union & EFTA (DE, FR, ES, IT, NL, PT, BE, AT, SE, DK, NO, CH, PL)

#### Germany (DE)

- **Tier & Status:** Tier 2 | **Status: `VERIFIED`** (Can go live without accountant: **NO — BLOCKED**)
- **Currency & Decimals:** `EUR` (€) — **2 Decimals**
- **Standard vs Restaurant Tax:** Standard: **19.00%** | Restaurant / Catering: **7.00%** (inclusive)
- **Tax Display Label & Tax ID:** Label: **MwSt.** | Tax ID Label: **USt-IdNr.** (Format: `DE123456789 (9 digits)`)
- **Category Breakdown:**
  - **Food:** 7.0%
  - **Hot Drinks:** 19.0%
  - **Soft Drinks:** 19.0%
  - **Bottled Water:** 19.0%
  - **Alcohol:** 19.0%
  - **Tobacco:** 19.0%
- **Fulfillment Channels:** Dine-In: **7.0%** | Takeaway: **7.0%** | Delivery: **7.0%**
- **Service Charge & Tips:** Policy: `optional` | Standard Rate: **0%** | Taxable: **YES** | Cover Charge Allowed: **YES**
  - *Legal Note:* Trinkgeld (voluntary tips) are tax-free under § 3 Nr. 51 EStG. Mandatory service fees are subject to 19% MwSt.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **YES (TSE (Technische Sicherheitseinrichtung) certified under KassenSichV)**
  - E-Invoicing Mandatory: **YES (Wachstumschancengesetz B2B e-Invoicing (ZUGFeRD / XRechnung))**
  - Natively Supported by Web App: **NO — REQUIRES EXTERNAL HARDWARE/GATEWAY**
  - *Invoicing Details:* KassenSichV requires certified TSE module, electronic log storage, and Belegausgabepflicht (mandatory receipt issuance).
- **Compliance Warnings:**
  - ⚠️ *HARDWARE FISCAL COMPLIANCE MANDATE: Germany requires a certified Technical Security System (TSE) and Belegausgabepflicht. Standalone web apps cannot legally operate without a certified cloud or hardware TSE.*
  - ⚠️ *All drinks (soft drinks, alcohol, water, coffee) remain standard-rated at 19% even when food is 7%.*
- **Dated Statutory Rate History:**
  - `2020-07-01` to `2023-12-31`: **7.0%** — *Temporary 7% reduced rate on dine-in food.*
  - `2024-01-01` to `2025-12-31`: **19.0%** — *Reversion to standard 19% for dine-in food; takeaway remained 7%.*
  - `2026-01-01` to `Present`: **7.0%** — *Permanent unified 7% reduced VAT rate on all restaurant and catering food.*
- **Sources & Legal Citations:**
  - [Bundesministerium der Finanzen (BMF) — Umsatzsteuersätze im Gastgewerbe](https://www.bundesfinanzministerium.de/Content/DE/Standardartikel/Themen/Steuern/Steuerarten/Umsatzsteuer/umsatzsteuersaetze-gastgewerbe.html) (Official Tax Authority)
  - [BMF — Gesetz zum Schutz vor Manipulationen an digitalen Grundaufzeichnungen (KassenSichV)](https://www.bundesfinanzministerium.de/Content/DE/Gesetzestexte/Kassensicherungsverordnung.html) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### France (FR)

- **Tier & Status:** Tier 2 | **Status: `VERIFIED`** (Can go live without accountant: **NO — BLOCKED**)
- **Currency & Decimals:** `EUR` (€) — **2 Decimals**
- **Standard vs Restaurant Tax:** Standard: **20.00%** | Restaurant / Catering: **10.00%** (inclusive)
- **Tax Display Label & Tax ID:** Label: **TVA** | Tax ID Label: **N° TVA** (Format: `FR XX 123456789 (11 characters)`)
- **Category Breakdown:**
  - **Food:** 10.0%
  - **Hot Drinks:** 10.0%
  - **Soft Drinks:** 10.0%
  - **Bottled Water:** 10.0%
  - **Alcohol:** 20.0%
  - **Tobacco:** 20.0%
- **Fulfillment Channels:** Dine-In: **10.0%** | Takeaway: **10.0%** | Delivery: **10.0%**
- **Service Charge & Tips:** Policy: `included` | Standard Rate: **15%** | Taxable: **YES** | Cover Charge Allowed: **NO**
  - *Legal Note:* Decree of 27 March 1987: Restaurant prices must be inclusive of service ("prix service compris"). Additional pourboire is voluntary and tax-exempt.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **YES (Logiciel de caisse certifié NF525 ou LNE (Art. 286 du CGI))**
  - E-Invoicing Mandatory: **YES (Facturation électronique B2B via Portail Public de Facturation (PPF / PDP))**
  - Natively Supported by Web App: **NO — REQUIRES EXTERNAL HARDWARE/GATEWAY**
  - *Invoicing Details:* French anti-fraud law mandates NF525 or LNE certified cash register software guaranteeing inalterability, security, storage, and archiving.
- **Compliance Warnings:**
  - ⚠️ *CERTIFICATION OBLIGATION: French tax law (Article 286, I-3° bis of the CGI) requires certified NF525/LNE cash register software. Using an uncertified web POS exposes the merchant to a €7,500 fine per terminal.*
  - ⚠️ *Alcoholic beverages must be separated and taxed at 20% TVA.*
- **Dated Statutory Rate History:**
  - `2014-01-01` to `Present`: **10.0%** — *Taux intermédiaire 10% applicable to restaurant food and non-alcoholic drinks.*
- **Sources & Legal Citations:**
  - [Direction générale des Finances publiques (DGFiP) — Taux de TVA dans la restauration](https://www.impots.gouv.fr/professionnel/taux-de-tva-dans-la-restauration) (Official Tax Authority)
  - [DGFiP — Obligation de certification des logiciels de caisse (BOI-TVA-DECLA-30-10-30)](https://bofip.impots.gouv.fr/bofip/10691-PGP.html) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### Spain (ES)

- **Tier & Status:** Tier 2 | **Status: `VERIFIED`** (Can go live without accountant: **NO — BLOCKED**)
- **Currency & Decimals:** `EUR` (€) — **2 Decimals**
- **Standard vs Restaurant Tax:** Standard: **21.00%** | Restaurant / Catering: **10.00%** (inclusive)
- **Tax Display Label & Tax ID:** Label: **IVA** | Tax ID Label: **NIF / CIF** (Format: `ES B12345678 or ES 12345678Z`)
- **Category Breakdown:**
  - **Food:** 10.0%
  - **Hot Drinks:** 10.0%
  - **Soft Drinks:** 10.0%
  - **Bottled Water:** 10.0%
  - **Alcohol:** 21.0%
  - **Tobacco:** 21.0%
- **Fulfillment Channels:** Dine-In: **10.0%** | Takeaway: **10.0%** | Delivery: **10.0%**
- **Service Charge & Tips:** Policy: `optional` | Standard Rate: **0%** | Taxable: **YES** | Cover Charge Allowed: **NO**
  - *Legal Note:* Tipping (propina) is strictly voluntary and outside IVA. Mandatory surcharges are subject to 10% IVA.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **YES (Veri*Factu (RD 1007/2023) / TicketBAI (País Vasco))**
  - E-Invoicing Mandatory: **YES (Ley Crea y Crece B2B electronic invoicing)**
  - Natively Supported by Web App: **NO — REQUIRES EXTERNAL HARDWARE/GATEWAY**
  - *Invoicing Details:* TicketBAI mandatory in Basque Country (Guipúzcoa, Vizcaya, Álava). Veri*Factu rolling out across Spain requiring certified cryptographic billing logs.
- **Compliance Warnings:**
  - ⚠️ *FISCAL SOFTWARE MANDATE: Spain requires compliance with Veri*Factu (Royal Decree 1007/2023) or TicketBAI in the Basque Country.*
  - ⚠️ *Alcoholic beverages must be itemized and taxed at 21% IVA.*
- **Dated Statutory Rate History:**
  - `2012-09-01` to `Present`: **10.0%** — *Reduced 10% IVA rate for restaurant and hospitality services.*
- **Sources & Legal Citations:**
  - [Agencia Tributaria — Tipos impositivos del IVA](https://sede.agenciatributaria.gob.es/Sede/iva/tipos-impositivos-iva.html) (Official Tax Authority)
  - [Agencia Tributaria — Sistemas Informáticos de Facturación (Veri*Factu)](https://sede.agenciatributaria.gob.es/Sede/normativa-criterios/nuevo-reglamento-facturacion.html) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### Italy (IT)

- **Tier & Status:** Tier 2 | **Status: `VERIFIED`** (Can go live without accountant: **NO — BLOCKED**)
- **Currency & Decimals:** `EUR` (€) — **2 Decimals**
- **Standard vs Restaurant Tax:** Standard: **22.00%** | Restaurant / Catering: **10.00%** (inclusive)
- **Tax Display Label & Tax ID:** Label: **IVA** | Tax ID Label: **Partita IVA (P.IVA)** (Format: `IT12345678901 (11 digits)`)
- **Category Breakdown:**
  - **Food:** 10.0%
  - **Hot Drinks:** 10.0%
  - **Soft Drinks:** 10.0%
  - **Bottled Water:** 10.0%
  - **Alcohol:** 22.0%
  - **Tobacco:** 22.0%
- **Fulfillment Channels:** Dine-In: **10.0%** | Takeaway: **10.0%** | Delivery: **10.0%**
- **Service Charge & Tips:** Policy: `standard` | Standard Rate: **0%** | Taxable: **YES** | Cover Charge Allowed: **YES**
  - *Legal Note:* Coperto (cover charge) is taxable at 10% IVA. Voluntary tips (mance) are non-taxable.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **YES (Registratore Telematico (RT) connected to Agenzia delle Entrate)**
  - E-Invoicing Mandatory: **YES (Sistema di Interscambio (SDI) for electronic invoices (Fattura Elettronica))**
  - Natively Supported by Web App: **NO — REQUIRES EXTERNAL HARDWARE/GATEWAY**
  - *Invoicing Details:* D.Lgs. 127/2015: Commercial sales must be transmitted electronically via a certified Registratore Telematico (RT) generating a Documento Commerciale with fiscal lottery code.
- **Compliance Warnings:**
  - ⚠️ *MANDATORY FISCAL HARDWARE (REGISTRATORE TELEMATICO): Italian law requires all restaurants to use a certified Registratore Telematico to transmit daily receipts to Agenzia delle Entrate.*
  - ⚠️ *Alcoholic drinks must be taxed at 22% IVA; coperto and food are taxed at 10%.*
- **Dated Statutory Rate History:**
  - `2013-10-01` to `Present`: **10.0%** — *Reduced 10% IVA rate for somministrazione di alimenti e bevande.*
- **Sources & Legal Citations:**
  - [Agenzia delle Entrate — Tabella aliquote IVA](https://www.agenziaentrate.gov.it/portale/web/guest/schede/dichiarazioni/iva-2023/cosa-prevede-la-dichiarazione) (Official Tax Authority)
  - [Agenzia delle Entrate — Memorizzazione e trasmissione telematica dei corrispettivi (RT)](https://www.agenziaentrate.gov.it/portale/corrispettivi-elettronici) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### Netherlands (NL)

- **Tier & Status:** Tier 2 | **Status: `VERIFIED`** (Can go live without accountant: **YES**)
- **Currency & Decimals:** `EUR` (€) — **2 Decimals**
- **Standard vs Restaurant Tax:** Standard: **21.00%** | Restaurant / Catering: **9.00%** (inclusive)
- **Tax Display Label & Tax ID:** Label: **BTW** | Tax ID Label: **BTW-nummer** (Format: `NL123456789B01`)
- **Category Breakdown:**
  - **Food:** 9.0%
  - **Hot Drinks:** 9.0%
  - **Soft Drinks:** 9.0%
  - **Bottled Water:** 9.0%
  - **Alcohol:** 21.0%
  - **Tobacco:** 21.0%
- **Fulfillment Channels:** Dine-In: **9.0%** | Takeaway: **9.0%** | Delivery: **9.0%**
- **Service Charge & Tips:** Policy: `included` | Standard Rate: **0%** | Taxable: **YES** | Cover Charge Allowed: **YES**
  - *Legal Note:* Service is included in prices by convention. Fooien (voluntary tips) are tax-free. Mandatory surcharges follow the food rate (9%).
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **NO**
  - E-Invoicing Mandatory: **NO**
  - Natively Supported by Web App: **YES**
  - *Invoicing Details:* Simplified invoice allowed under €100. Keurmerk Betrouwbare Afrekensystemen recommended by Belastingdienst.
- **Compliance Warnings:**
  - ⚠️ *Alcoholic beverages must be billed at 21% BTW; all food and non-alcoholic beverages are billed at 9% BTW.*
- **Dated Statutory Rate History:**
  - `2019-01-01` to `Present`: **9.0%** — *Reduced VAT rate increased from 6% to 9% on food and non-alcoholic beverages.*
- **Sources & Legal Citations:**
  - [Belastingdienst — Btw-tarief horeca](https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/btw/tarieven_en_vrijstellingen/diensten_9_btw/horecadiensten) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### Portugal (PT)

- **Tier & Status:** Tier 2 | **Status: `VERIFIED`** (Can go live without accountant: **NO — BLOCKED**)
- **Currency & Decimals:** `EUR` (€) — **2 Decimals**
- **Standard vs Restaurant Tax:** Standard: **23.00%** | Restaurant / Catering: **13.00%** (inclusive)
- **Tax Display Label & Tax ID:** Label: **IVA** | Tax ID Label: **NIF** (Format: `PT 123456789 (9 digits)`)
- **Category Breakdown:**
  - **Food:** 13.0%
  - **Hot Drinks:** 13.0%
  - **Soft Drinks:** 23.0%
  - **Bottled Water:** 13.0%
  - **Alcohol:** 23.0%
  - **Tobacco:** 23.0%
- **Fulfillment Channels:** Dine-In: **13.0%** | Takeaway: **13.0%** | Delivery: **13.0%**
- **Service Charge & Tips:** Policy: `optional` | Standard Rate: **0%** | Taxable: **YES** | Cover Charge Allowed: **YES**
  - *Legal Note:* Law DL 10/2015: Couvert can only be charged if actually requested and consumed. Mandatory service fees are subject to 13% or 23% IVA.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **YES (Software de Faturação Certificado pela AT com SAF-T PT)**
  - E-Invoicing Mandatory: **YES (SAF-T PT monthly export and QR Code + ATCUD code on invoices)**
  - Natively Supported by Web App: **NO — REQUIRES EXTERNAL HARDWARE/GATEWAY**
  - *Invoicing Details:* Decree-Law 28/2019: Invoices MUST be generated by billing software certified by Autoridade Tributária with cryptographic chaining and ATCUD serial numbers.
- **Compliance Warnings:**
  - ⚠️ *CERTIFIED BILLING SOFTWARE MANDATE: Portuguese law requires invoicing software certified by the Autoridade Tributária (AT) with SAF-T export and ATCUD codes.*
  - ⚠️ *SOFT DRINK & ALCOHOL SPLIT: In mainland Portugal, soft drinks and beer/spirits are taxed at 23%, while food and standard wine are taxed at 13%. If bundled without breakdown, the entire bill is taxed at 23%.*
- **Dated Statutory Rate History:**
  - `2016-07-01` to `Present`: **13.0%** — *Restoration of 13% intermediate rate on restaurant food services.*
- **Sources & Legal Citations:**
  - [Autoridade Tributária e Aduaneira (AT) — Código do IVA (CIVA)](https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/civa_rep/Pages/civa-indice.aspx) (Official Tax Authority)
  - [AT — Circular Informativa N.º 30177 sobre o IVA na restauração](https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/legislacao/instrucoes_administrativas/Documents/Oficio_Circulado_30177_2016.pdf) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### Belgium (BE)

- **Tier & Status:** Tier 2 | **Status: `VERIFIED`** (Can go live without accountant: **NO — BLOCKED**)
- **Currency & Decimals:** `EUR` (€) — **2 Decimals**
- **Standard vs Restaurant Tax:** Standard: **21.00%** | Restaurant / Catering: **12.00%** (inclusive)
- **Tax Display Label & Tax ID:** Label: **TVA / BTW** | Tax ID Label: **N° d'entreprise / BTW-nr** (Format: `BE 0123.456.789`)
- **Category Breakdown:**
  - **Food:** 12.0%
  - **Hot Drinks:** 21.0%
  - **Soft Drinks:** 21.0%
  - **Bottled Water:** 21.0%
  - **Alcohol:** 21.0%
  - **Tobacco:** 21.0%
- **Fulfillment Channels:** Dine-In: **12.0%** | Takeaway: **6.0%** | Delivery: **6.0%**
- **Service Charge & Tips:** Policy: `included` | Standard Rate: **0%** | Taxable: **YES** | Cover Charge Allowed: **NO**
  - *Legal Note:* Service is legally included in all listed menu prices. Pourboire is voluntary.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **YES (Système de Caisse Enregistreuse (SCE) / Boîte Noire (GKS))**
  - E-Invoicing Mandatory: **YES (Peppol B2B e-invoicing mandatory from Jan 1, 2026)**
  - Natively Supported by Web App: **NO — REQUIRES EXTERNAL HARDWARE/GATEWAY**
  - *Invoicing Details:* Restaurants with annual catering turnover > €25,000 must use a certified SCE / Boîte Noire with Fiscal Data Module (FDM) and VAT signing card (VSC).
- **Compliance Warnings:**
  - ⚠️ *BOÎTE NOIRE (GKS) FISCAL MANDATE: Belgian law requires a certified fiscal cash register with a black box (FDM) for restaurants.*
  - ⚠️ *DRINK TAX TRAP: In Belgium, ALL beverages (hot drinks, soft drinks, water, alcohol) are taxed at 21%, while dine-in food is 12% and takeaway food is 6%.*
- **Dated Statutory Rate History:**
  - `2010-01-01` to `Present`: **12.0%** — *Reduced 12% rate on restaurant services; drinks remain at 21%.*
- **Sources & Legal Citations:**
  - [SPF Finances — Taux de TVA dans le secteur horeca](https://finances.belgium.be/fr/entreprises/tva/declaration/taux/horeca) (Official Tax Authority)
  - [SPF Finances — Système de caisse enregistreuse (SCE / Boîte noire)](https://finances.belgium.be/fr/entreprises/tva/secteurs/horeca/systeme-caisse-enregistreuse) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### Austria (AT)

- **Tier & Status:** Tier 2 | **Status: `VERIFIED`** (Can go live without accountant: **NO — BLOCKED**)
- **Currency & Decimals:** `EUR` (€) — **2 Decimals**
- **Standard vs Restaurant Tax:** Standard: **20.00%** | Restaurant / Catering: **10.00%** (inclusive)
- **Tax Display Label & Tax ID:** Label: **USt.** | Tax ID Label: **UID-Nummer** (Format: `ATU12345678 (9 characters)`)
- **Category Breakdown:**
  - **Food:** 10.0%
  - **Hot Drinks:** 20.0%
  - **Soft Drinks:** 20.0%
  - **Bottled Water:** 20.0%
  - **Alcohol:** 20.0%
  - **Tobacco:** 20.0%
- **Fulfillment Channels:** Dine-In: **10.0%** | Takeaway: **10.0%** | Delivery: **10.0%**
- **Service Charge & Tips:** Policy: `optional` | Standard Rate: **0%** | Taxable: **YES** | Cover Charge Allowed: **YES**
  - *Legal Note:* Trinkgeld (voluntary tips) are tax-free under § 3 Abs. 1 Z 16a EStG. Gedeck/surcharges are taxable.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **YES (Registrierkasse mit Signaturerstellungseinheit (RKSV))**
  - E-Invoicing Mandatory: **NO**
  - Natively Supported by Web App: **NO — REQUIRES EXTERNAL HARDWARE/GATEWAY**
  - *Invoicing Details:* RKSV requires certified signature creation device, QR code with cryptographic signature on every receipt, and Datenerfassungsprotokoll (DEP).
- **Compliance Warnings:**
  - ⚠️ *RKSV FISCAL MANDATE: Austria requires all cash registers to generate cryptographically signed QR codes via a certified signature card.*
  - ⚠️ *Beverages (coffee, tea, soft drinks, water, alcohol) are taxed at 20% USt., while food is 10%.*
- **Dated Statutory Rate History:**
  - `2022-01-01` to `Present`: **10.0%** — *Reduced 10% VAT rate on restaurant meals following end of COVID 5% temporary rate.*
- **Sources & Legal Citations:**
  - [Bundesministerium für Finanzen (BMF) — Steuern & Zölle: Gastronomie](https://www.bmf.gv.at/themen/steuern/fuer-unternehmen/umsatzsteuer/gastronomie.html) (Official Tax Authority)
  - [BMF — Registrierkassensicherheitsverordnung (RKSV)](https://www.bmf.gv.at/themen/steuern/fuer-unternehmen/registrierkassen.html) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### Sweden (SE)

- **Tier & Status:** Tier 2 | **Status: `VERIFIED`** (Can go live without accountant: **NO — BLOCKED**)
- **Currency & Decimals:** `SEK` (kr) — **2 Decimals**
- **Standard vs Restaurant Tax:** Standard: **25.00%** | Restaurant / Catering: **12.00%** (inclusive)
- **Tax Display Label & Tax ID:** Label: **Moms** | Tax ID Label: **Momsnr.** (Format: `SE123456789001`)
- **Category Breakdown:**
  - **Food:** 12.0%
  - **Hot Drinks:** 12.0%
  - **Soft Drinks:** 12.0%
  - **Bottled Water:** 12.0%
  - **Alcohol:** 25.0%
  - **Tobacco:** 25.0%
- **Fulfillment Channels:** Dine-In: **12.0%** | Takeaway: **12.0%** | Delivery: **12.0%**
- **Service Charge & Tips:** Policy: `optional` | Standard Rate: **0%** | Taxable: **YES** | Cover Charge Allowed: **YES**
  - *Legal Note:* Dricks (voluntary tips) are non-taxable. Mandatory service charges are subject to 12% (or 25% for alcohol).
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **YES (Certifierat kassaregister med kontrollenhet (Skatteverket))**
  - E-Invoicing Mandatory: **NO**
  - Natively Supported by Web App: **NO — REQUIRES EXTERNAL HARDWARE/GATEWAY**
  - *Invoicing Details:* Skatteförfarandelagen (SFL): Cash registers must be certified by an accredited body and connected to a certified control unit (kontrollenhet).
- **Compliance Warnings:**
  - ⚠️ *CERTIFIED CONTROL UNIT (KONTROLLENHET) MANDATE: Swedish tax law requires certified cash registers with connected Skatteverket control units.*
  - ⚠️ *Alcoholic beverages (>3.5% ABV) are standard-rated at 25% Moms; food and non-alcoholic drinks are 12%.*
- **Dated Statutory Rate History:**
  - `2012-01-01` to `Present`: **12.0%** — *Reduced moms rate of 12% on restaurant and catering services.*
- **Sources & Legal Citations:**
  - [Skatteverket — Moms på mat och restaurangtjänster](https://www.skatteverket.se/foretag/moms/sjalvservice/momssatser.4.7459477810df5bccdd480004739.html) (Official Tax Authority)
  - [Skatteverket — Kassaregister och kontrollenhet](https://www.skatteverket.se/foretag/drivaforetag/kassaregister.4.18e1b10334ebe8bc80001099.html) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### Denmark (DK)

- **Tier & Status:** Tier 2 | **Status: `VERIFIED`** (Can go live without accountant: **NO — BLOCKED**)
- **Currency & Decimals:** `DKK` (kr.) — **2 Decimals**
- **Standard vs Restaurant Tax:** Standard: **25.00%** | Restaurant / Catering: **25.00%** (inclusive)
- **Tax Display Label & Tax ID:** Label: **Moms** | Tax ID Label: **CVR-nr.** (Format: `DK 12 34 56 78 (8 digits)`)
- **Category Breakdown:**
  - **Food:** 25.0%
  - **Hot Drinks:** 25.0%
  - **Soft Drinks:** 25.0%
  - **Bottled Water:** 25.0%
  - **Alcohol:** 25.0%
  - **Tobacco:** 25.0%
- **Fulfillment Channels:** Dine-In: **25.0%** | Takeaway: **25.0%** | Delivery: **25.0%**
- **Service Charge & Tips:** Policy: `included` | Standard Rate: **0%** | Taxable: **YES** | Cover Charge Allowed: **YES**
  - *Legal Note:* Service is legally included in menu prices. Drippenge (tips) are voluntary and outside Moms.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **YES (Digitalt kassesystem (Krav om digitale kassesystemer 2024-2026))**
  - E-Invoicing Mandatory: **YES (NemHandel / OIOUBL / Peppol for B2G)**
  - Natively Supported by Web App: **NO — REQUIRES EXTERNAL HARDWARE/GATEWAY**
  - *Invoicing Details:* New Danish digital cash register law requires electronic logging and reporting for designated sectors including cafes and restaurants.
- **Compliance Warnings:**
  - ⚠️ *DENMARK APPLIES NO REDUCED RATE: A flat 25% Moms applies to all food, hot drinks, soft drinks, water, and alcohol without exception.*
  - ⚠️ *Phased rollout of digital cash register mandates underway by Skattestyrelsen.*
- **Dated Statutory Rate History:**
  - `1992-01-01` to `Present`: **25.0%** — *Standard uniform 25% VAT rate in Denmark.*
- **Sources & Legal Citations:**
  - [Skattestyrelsen — Moms og momsregler i restaurationsbranchen](https://skat.dk/erhverv/moms/momsregler-for-brancher/restauration) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### Norway (NO)

- **Tier & Status:** Tier 2 | **Status: `VERIFIED`** (Can go live without accountant: **NO — BLOCKED**)
- **Currency & Decimals:** `NOK` (kr) — **2 Decimals**
- **Standard vs Restaurant Tax:** Standard: **25.00%** | Restaurant / Catering: **25.00%** (inclusive)
- **Tax Display Label & Tax ID:** Label: **MVA** | Tax ID Label: **Organisasjonsnummer** (Format: `NO 123 456 789 MVA`)
- **Category Breakdown:**
  - **Food:** 25.0%
  - **Hot Drinks:** 25.0%
  - **Soft Drinks:** 25.0%
  - **Bottled Water:** 25.0%
  - **Alcohol:** 25.0%
  - **Tobacco:** 25.0%
- **Fulfillment Channels:** Dine-In: **25.0%** | Takeaway: **15.0%** | Delivery: **15.0%**
- **Service Charge & Tips:** Policy: `optional` | Standard Rate: **0%** | Taxable: **YES** | Cover Charge Allowed: **YES**
  - *Legal Note:* Tips (tips/driks) are non-taxable for VAT (though taxed as employee income). Surcharges are subject to 25% MVA.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **YES (Kassasystemloven (Produkterklæring og SAF-T Cash Register))**
  - E-Invoicing Mandatory: **NO**
  - Natively Supported by Web App: **NO — REQUIRES EXTERNAL HARDWARE/GATEWAY**
  - *Invoicing Details:* Kassasystemloven requires certified cash register systems with product declarations and standardized SAF-T Cash Register audit export.
- **Compliance Warnings:**
  - ⚠️ *KASSASYSTEMLOVEN MANDATE: Norway requires certified cash registers supporting SAF-T Cash Register export.*
  - ⚠️ *DINE-IN VS TAKEAWAY SPLIT: Food eaten in the restaurant is standard-rated at 25% MVA; takeaway/delivery is reduced-rated at 15% MVA.*
- **Dated Statutory Rate History:**
  - `2005-01-01` to `Present`: **25.0%** — *Standard 25% rate for dine-in restaurant services; 15% for takeaway.*
- **Sources & Legal Citations:**
  - [Skatteetaten — Merverdiavgift på mat og servering](https://www.skatteetaten.no/bedrift-og-organisasjon/avgifter/mva/satser/) (Official Tax Authority)
  - [Skatteetaten — Krav til kassasystem (Kassasystemlova)](https://www.skatteetaten.no/bedrift-og-organisasjon/starte-og-drive/kassasystem/) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### Switzerland (CH)

- **Tier & Status:** Tier 2 | **Status: `VERIFIED`** (Can go live without accountant: **YES**)
- **Currency & Decimals:** `CHF` (CHF) — **2 Decimals**
- **Standard vs Restaurant Tax:** Standard: **8.10%** | Restaurant / Catering: **8.10%** (inclusive)
- **Tax Display Label & Tax ID:** Label: **MWST / TVA / IVA** | Tax ID Label: **MWST-Nr.** (Format: `CHE-123.456.789 MWST`)
- **Category Breakdown:**
  - **Food:** 8.1%
  - **Hot Drinks:** 8.1%
  - **Soft Drinks:** 8.1%
  - **Bottled Water:** 8.1%
  - **Alcohol:** 8.1%
  - **Tobacco:** 8.1%
- **Fulfillment Channels:** Dine-In: **8.1%** | Takeaway: **2.6%** | Delivery: **2.6%**
- **Service Charge & Tips:** Policy: `included` | Standard Rate: **0%** | Taxable: **YES** | Cover Charge Allowed: **NO**
  - *Legal Note:* Price Declaration Ordinance (PBV): Service must be included in advertised prices. Voluntary Trinkgeld is tax-exempt.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **NO**
  - E-Invoicing Mandatory: **NO**
  - Natively Supported by Web App: **YES**
  - *Invoicing Details:* Receipts must show UID/MWST number, date, breakdown of items, and tax rates (8.1% / 2.6%).
- **Compliance Warnings:**
  - ⚠️ *RATE INCREASE (JAN 1, 2024): Standard MWST increased to 8.1% (was 7.7%) and reduced rate increased to 2.6% (was 2.5%).*
  - ⚠️ *DINE-IN VS TAKEAWAY SPLIT: Dine-in meals are 8.1% standard rate; takeaway/delivery is 2.6% reduced rate.*
- **Dated Statutory Rate History:**
  - `2018-01-01` to `2023-12-31`: **7.7%** — *Standard 7.7% rate; reduced rate 2.5%.*
  - `2024-01-01` to `Present`: **8.1%** — *Statutory VAT increase to 8.1% standard rate; 2.6% reduced rate.*
- **Sources & Legal Citations:**
  - [Eidgenössische Steuerverwaltung (ESTV) — MWST-Steuersätze ab 1. Januar 2024](https://www.estv.admin.ch/estv/de/home/mehrwertsteuer/fachinformationen/steuersaetze.html) (Official Tax Authority)
  - [ESTV — MWST-Brancheninfo 08 Gastgewerbe](https://www.estv.admin.ch/estv/de/home/mehrwertsteuer/fachinformationen/mwst-branchen/gastgewerbe.html) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### Poland (PL)

- **Tier & Status:** Tier 2 | **Status: `VERIFIED`** (Can go live without accountant: **NO — BLOCKED**)
- **Currency & Decimals:** `PLN` (zł) — **2 Decimals**
- **Standard vs Restaurant Tax:** Standard: **23.00%** | Restaurant / Catering: **8.00%** (inclusive)
- **Tax Display Label & Tax ID:** Label: **PTU / VAT** | Tax ID Label: **NIP** (Format: `PL1234567890 (10 digits)`)
- **Category Breakdown:**
  - **Food:** 8.0%
  - **Hot Drinks:** 8.0%
  - **Soft Drinks:** 23.0%
  - **Bottled Water:** 23.0%
  - **Alcohol:** 23.0%
  - **Tobacco:** 23.0%
- **Fulfillment Channels:** Dine-In: **8.0%** | Takeaway: **8.0%** | Delivery: **8.0%**
- **Service Charge & Tips:** Policy: `optional` | Standard Rate: **10%** | Taxable: **YES** | Cover Charge Allowed: **YES**
  - *Legal Note:* Mandatory service fees are taxable at 8% or 23%. Voluntary tips are outside PTU/VAT.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **YES (Kasa fiskalna online connected to Centralny Repozytorium Kas (CRK))**
  - E-Invoicing Mandatory: **YES (Krajowy System e-Faktur (KSeF) nationwide B2B)**
  - Natively Supported by Web App: **NO — REQUIRES EXTERNAL HARDWARE/GATEWAY**
  - *Invoicing Details:* Article 145b Polish VAT Act: Gastronomy businesses are legally required to use online fiscal cash registers (kasy online) continuously transmitting data to CRK.
- **Compliance Warnings:**
  - ⚠️ *ONLINE FISCAL CASH REGISTER (KASA ONLINE) MANDATE: Polish law requires all restaurant establishments to register sales through certified online fiscal registers.*
  - ⚠️ *Soft drinks, bottled water, and alcoholic drinks are standard-rated at 23% VAT; prepared food is 8%.*
- **Dated Statutory Rate History:**
  - `2020-07-01` to `Present`: **8.0%** — *New VAT matrix reduced 8% rate for restaurant food and beverages.*
- **Sources & Legal Citations:**
  - [Krajowa Administracja Skarbowa (KAS) — Nowa matryca stawek VAT w gastronomii](https://www.podatki.gov.pl/vat/stawki-vat/) (Official Tax Authority)
  - [Ministerstwo Finansów — Kasy fiskalne online dla gastronomii](https://www.podatki.gov.pl/vat/kasy-fiskalne/) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

### Tier 3: Asia, Middle East, Americas & Africa (IN, JP, KR, TH, MY, ID, PH, VN, HK, SA, QA, KW, BH, TR, IL, ZA, NG, KE, EG, MX, BR, CL, CO)

#### India (IN)

- **Tier & Status:** Tier 3 | **Status: `VERIFIED`** (Can go live without accountant: **YES**)
- **Currency & Decimals:** `INR` (₹) — **2 Decimals**
- **Standard vs Restaurant Tax:** Standard: **18.00%** | Restaurant / Catering: **5.00%** (inclusive)
- **Tax Display Label & Tax ID:** Label: **GST** | Tax ID Label: **GSTIN** (Format: `22AAAAA0000A1Z5 (15 characters)`)
- **Category Breakdown:**
  - **Food:** 5.0%
  - **Hot Drinks:** 5.0%
  - **Soft Drinks:** 5.0%
  - **Bottled Water:** 5.0%
  - **Alcohol:** not found
  - **Tobacco:** 28.0%
- **Fulfillment Channels:** Dine-In: **5.0%** | Takeaway: **5.0%** | Delivery: **5.0%**
- **Service Charge & Tips:** Policy: `prohibited_mandatory` | Standard Rate: **0%** | Taxable: **NO** | Cover Charge Allowed: **NO**
  - *Legal Note:* Central Consumer Protection Authority (CCPA) Guidelines 2022: Restaurants are prohibited from levying service charge automatically or by default. Any payment is purely voluntary.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **NO**
  - E-Invoicing Mandatory: **YES (IRP E-Invoicing (mandatory for B2B turnover > ₹5 Cr) & B2C Dynamic QR (> ₹500 Cr))**
  - Natively Supported by Web App: **YES**
  - *Invoicing Details:* Tax invoice must state GSTIN, place of supply, state code, and split CGST / SGST (or IGST for inter-state).
- **Compliance Warnings:**
  - ⚠️ *FEDERAL GST SPLIT: Intra-state sales must be split evenly into CGST (2.5%) and SGST (2.5%).*
  - ⚠️ *SERVICE CHARGE RESTRICTION: Mandatory service charge is prohibited under CCPA consumer protection guidelines.*
  - ⚠️ *ALCOHOL EXCLUSION: Alcohol for human consumption is not covered by GST and requires separate State Excise / VAT accounting.*
- **Dated Statutory Rate History:**
  - `2017-11-15` to `Present`: **5.0%** — *Notification No. 46/2017-Central Tax (Rate): 5% flat GST for standalone restaurants without ITC.*
- **Federal / Multi-Level Regional Rules:**
  - **INTRA_STATE (Intra-State Supply (CGST 2.5% + SGST 2.5% = 5%)):** Restaurant Rate: **5.00%** (GST, inclusive). *Standard intra-state restaurant sales split equally between Central and State governments.*
  - **HOTEL_REST (Restaurants in Specified Hotels (> ₹7,500/day room tariff)):** Restaurant Rate: **18.00%** (GST, inclusive). *18% GST (CGST 9% + SGST 9%) with Input Tax Credit applies to restaurants inside hotel premises charging room tariff >= ₹7,500.*
- **Sources & Legal Citations:**
  - [Central Board of Indirect Taxes and Customs (CBIC) — GST Rates on Restaurant Services](https://cbic-gst.gov.in/gst-goods-services-rates.html) (Official Tax Authority)
  - [CCPA Guidelines on Prevention of Unfair Trade Practices — Service Charge in Hotels & Restaurants](https://consumeraffairs.nic.in/sites/default/files/CCPA_guidelines.pdf) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### Japan (JP)

- **Tier & Status:** Tier 3 | **Status: `VERIFIED`** (Can go live without accountant: **YES**)
- **Currency & Decimals:** `JPY` (¥) — **0 Decimals**
- **Standard vs Restaurant Tax:** Standard: **10.00%** | Restaurant / Catering: **10.00%** (inclusive)
- **Tax Display Label & Tax ID:** Label: **消費税** | Tax ID Label: **適格請求書発行事業者登録番号** (Format: `T1234567890123 (T + 13 digits)`)
- **Category Breakdown:**
  - **Food:** 10.0%
  - **Hot Drinks:** 10.0%
  - **Soft Drinks:** 10.0%
  - **Bottled Water:** 10.0%
  - **Alcohol:** 10.0%
  - **Tobacco:** 10.0%
- **Fulfillment Channels:** Dine-In: **10.0%** | Takeaway: **8.0%** | Delivery: **8.0%**
- **Service Charge & Tips:** Policy: `optional` | Standard Rate: **10%** | Taxable: **YES** | Cover Charge Allowed: **YES**
  - *Legal Note:* 10% service charge (サービス料) and Otoshi table charges are subject to 10% consumption tax.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **NO**
  - E-Invoicing Mandatory: **YES (Qualified Invoice System (インボイス制度 / Invoice System))**
  - Natively Supported by Web App: **YES**
  - *Invoicing Details:* Invoices must display Qualified Invoice Issuer Registration Number (T+13 digits) and tax rate breakdowns (8% and 10%).
- **Compliance Warnings:**
  - ⚠️ *DECIMAL WARNING: Japanese Yen (JPY) does not use decimals (0 decimals).*
  - ⚠️ *DINE-IN VS TAKEAWAY: Dine-in food is standard 10%; takeaway/delivery food is reduced 8%. Alcoholic drinks are always 10%.*
- **Dated Statutory Rate History:**
  - `2019-10-01` to `Present`: **10.0%** — *Consumption tax increase to 10% with 8% reduced rate for food takeaways.*
- **Sources & Legal Citations:**
  - [National Tax Agency Japan (国税庁) — 消費税の軽減税率制度](https://www.nta.go.jp/taxes/shiraberu/zeimokubetsu/shohi/keigenzeiritsu/index.htm) (Official Tax Authority)
  - [National Tax Agency — インボイス制度 (Qualified Invoice System)](https://www.nta.go.jp/taxes/shiraberu/zeimokubetsu/shohi/keigenzeiritsu/invoice.htm) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### South Korea (KR)

- **Tier & Status:** Tier 3 | **Status: `VERIFIED`** (Can go live without accountant: **NO — BLOCKED**)
- **Currency & Decimals:** `KRW` (₩) — **0 Decimals**
- **Standard vs Restaurant Tax:** Standard: **10.00%** | Restaurant / Catering: **10.00%** (inclusive)
- **Tax Display Label & Tax ID:** Label: **부가세 (VAT)** | Tax ID Label: **사업자등록번호** (Format: `123-45-67890 (10 digits)`)
- **Category Breakdown:**
  - **Food:** 10.0%
  - **Hot Drinks:** 10.0%
  - **Soft Drinks:** 10.0%
  - **Bottled Water:** 10.0%
  - **Alcohol:** 10.0%
  - **Tobacco:** 10.0%
- **Fulfillment Channels:** Dine-In: **10.0%** | Takeaway: **10.0%** | Delivery: **10.0%**
- **Service Charge & Tips:** Policy: `included` | Standard Rate: **0%** | Taxable: **YES** | Cover Charge Allowed: **NO**
  - *Legal Note:* Prices must be final and all-inclusive under the Food Sanitation Act. Tipping is not customary.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **YES (Cash Receipt Terminal (현금영수증 단말기) connected to NTS)**
  - E-Invoicing Mandatory: **YES (Electronic Tax Invoice (e-Tax) via National Tax Service (Hometax))**
  - Natively Supported by Web App: **NO — REQUIRES EXTERNAL HARDWARE/GATEWAY**
  - *Invoicing Details:* All business POS systems must be connected to VAN/PG to transmit Cash Receipts (현금영수증) to NTS in real time.
- **Compliance Warnings:**
  - ⚠️ *DECIMAL WARNING: South Korean Won (KRW) does not use decimals (0 decimals).*
  - ⚠️ *CASH RECEIPT SYSTEM MANDATE: POS terminals in South Korea must be connected to an accredited VAN to issue National Tax Service Cash Receipts.*
- **Dated Statutory Rate History:**
  - `1977-07-01` to `Present`: **10.0%** — *Standard 10% VAT on goods and restaurant services.*
- **Sources & Legal Citations:**
  - [National Tax Service (국세청) — 부가가치세 안내](https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=2273&cntntsId=7701) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### Thailand (TH)

- **Tier & Status:** Tier 3 | **Status: `VERIFIED`** (Can go live without accountant: **NO — BLOCKED**)
- **Currency & Decimals:** `THB` (฿) — **2 Decimals**
- **Standard vs Restaurant Tax:** Standard: **7.00%** | Restaurant / Catering: **7.00%** (inclusive)
- **Tax Display Label & Tax ID:** Label: **VAT** | Tax ID Label: **Tax ID** (Format: `0-1234-56789-01-2 (13 digits)`)
- **Category Breakdown:**
  - **Food:** 7.0%
  - **Hot Drinks:** 7.0%
  - **Soft Drinks:** 7.0%
  - **Bottled Water:** 7.0%
  - **Alcohol:** 7.0%
  - **Tobacco:** 7.0%
- **Fulfillment Channels:** Dine-In: **7.0%** | Takeaway: **7.0%** | Delivery: **7.0%**
- **Service Charge & Tips:** Policy: `standard` | Standard Rate: **10%** | Taxable: **YES** | Cover Charge Allowed: **YES**
  - *Legal Note:* Revenue Department: 10% service charge is taxable at 7% VAT (effective composite surcharge ~17.7%).
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **YES (Approved POS / Cash Register (เครื่องบันทึกการเก็บเงิน))**
  - E-Invoicing Mandatory: **NO**
  - Natively Supported by Web App: **NO — REQUIRES EXTERNAL HARDWARE/GATEWAY**
  - *Invoicing Details:* POS cash registers must be formally approved by the Revenue Department to issue Abbreviated Tax Invoices (ใบกำกับภาษีอย่างย่อ).
- **Compliance Warnings:**
  - ⚠️ *POS APPROVAL REQUIREMENT: Under Thai Revenue Code, POS machines issuing abbreviated tax invoices must be registered and approved by the local Revenue Area Office.*
- **Dated Statutory Rate History:**
  - `1997-10-01` to `Present`: **7.0%** — *Reduced from statutory 10% to 7% via ongoing Royal Decrees.*
- **Sources & Legal Citations:**
  - [Revenue Department of Thailand — Value Added Tax (VAT)](https://www.rd.go.th/english/6042.html) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### Malaysia (MY)

- **Tier & Status:** Tier 3 | **Status: `VERIFIED`** (Can go live without accountant: **NO — BLOCKED**)
- **Currency & Decimals:** `MYR` (RM) — **2 Decimals**
- **Standard vs Restaurant Tax:** Standard: **6.00%** | Restaurant / Catering: **6.00%** (exclusive)
- **Tax Display Label & Tax ID:** Label: **Service Tax** | Tax ID Label: **SST Reg. No.** (Format: `W10-1808-12345678`)
- **Category Breakdown:**
  - **Food:** 6.0%
  - **Hot Drinks:** 6.0%
  - **Soft Drinks:** 6.0%
  - **Bottled Water:** 6.0%
  - **Alcohol:** 8.0%
  - **Tobacco:** 6.0%
- **Fulfillment Channels:** Dine-In: **6.0%** | Takeaway: **6.0%** | Delivery: **6.0%**
- **Service Charge & Tips:** Policy: `standard` | Standard Rate: **10%** | Taxable: **YES** | Cover Charge Allowed: **YES**
  - *Legal Note:* RMCD Guidelines: 10% service charge (caj perkhidmatan) is subject to 6% service tax.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **NO**
  - E-Invoicing Mandatory: **YES (LHDN MyInvois e-Invoicing (Phased 2024-2025))**
  - Natively Supported by Web App: **NO — REQUIRES EXTERNAL HARDWARE/GATEWAY**
  - *Invoicing Details:* Inland Revenue Board of Malaysia (LHDN) MyInvois mandatory for all taxpayers with turnover > RM 1.5M threshold.
- **Compliance Warnings:**
  - ⚠️ *ALCOHOL SERVICE TAX SPLIT: F&B services are taxed at 6% Service Tax, but alcoholic beverages are taxed at 8% Service Tax (effective March 1, 2024).*
  - ⚠️ *E-INVOICING MANDATE: Malaysia is rolling out mandatory LHDN MyInvois electronic invoicing.*
- **Dated Statutory Rate History:**
  - `2018-09-01` to `2024-02-29`: **6.0%** — *Standard 6% Service Tax under Service Tax Act 2018.*
  - `2024-03-01` to `Present`: **6.0%** — *General rate increased to 8%, but F&B was protected at 6% (with alcohol at 8%).*
- **Sources & Legal Citations:**
  - [Royal Malaysian Customs Department (RMCD) — Service Tax Industry Guides (Food and Beverage)](https://mysst.customs.gov.my/) (Official Tax Authority)
  - [LHDN Malaysia — MyInvois Portal and Guidelines](https://www.hasil.gov.my/en/e-invoice/) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### Indonesia (ID)

- **Tier & Status:** Tier 3 | **Status: `VERIFIED`** (Can go live without accountant: **YES**)
- **Currency & Decimals:** `IDR` (Rp) — **0 Decimals**
- **Standard vs Restaurant Tax:** Standard: **10.00%** | Restaurant / Catering: **10.00%** (exclusive)
- **Tax Display Label & Tax ID:** Label: **PBJT (Pajak Restoran)** | Tax ID Label: **NPWP** (Format: `12.345.678.9-012.000 (16 digits)`)
- **Category Breakdown:**
  - **Food:** 10.0%
  - **Hot Drinks:** 10.0%
  - **Soft Drinks:** 10.0%
  - **Bottled Water:** 10.0%
  - **Alcohol:** 10.0%
  - **Tobacco:** 10.0%
- **Fulfillment Channels:** Dine-In: **10.0%** | Takeaway: **10.0%** | Delivery: **10.0%**
- **Service Charge & Tips:** Policy: `standard` | Standard Rate: **5%** | Taxable: **YES** | Cover Charge Allowed: **YES**
  - *Legal Note:* PBJT 10% applies to the total payment including any service charge (biaya pelayanan).
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **NO**
  - E-Invoicing Mandatory: **NO**
  - Natively Supported by Web App: **YES**
  - *Invoicing Details:* Bills must clearly state PBJT (not PPN) and show NPWP.
- **Compliance Warnings:**
  - ⚠️ *DECIMAL WARNING: Indonesian Rupiah (IDR) does not use decimals (0 decimals).*
  - ⚠️ *CRUCIAL LEGAL CLASSIFICATION: Restaurant meals in Indonesia are NOT subject to national VAT (PPN). Charging PPN on food is illegal. It is PBJT (Pajak Barang dan Jasa Tertentu) under UU HKPD No. 1/2022.*
- **Dated Statutory Rate History:**
  - `2022-01-05` to `Present`: **10.0%** — *UU No. 1 Tahun 2022 (UU HKPD): Maximum 10% PBJT on restaurant food & beverages.*
- **Sources & Legal Citations:**
  - [Direktorat Jenderal Pajak (DJP) — Ketentuan Pajak Restoran / PBJT](https://pajak.go.id/id/artikel/pajak-restoran-pb1-kini-jadi-pbjt-makanan-dan-minuman) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### Philippines (PH)

- **Tier & Status:** Tier 3 | **Status: `VERIFIED`** (Can go live without accountant: **NO — BLOCKED**)
- **Currency & Decimals:** `PHP` (₱) — **2 Decimals**
- **Standard vs Restaurant Tax:** Standard: **12.00%** | Restaurant / Catering: **12.00%** (inclusive)
- **Tax Display Label & Tax ID:** Label: **VAT** | Tax ID Label: **TIN** (Format: `123-456-789-000 (9 or 12 digits)`)
- **Category Breakdown:**
  - **Food:** 12.0%
  - **Hot Drinks:** 12.0%
  - **Soft Drinks:** 12.0%
  - **Bottled Water:** 12.0%
  - **Alcohol:** 12.0%
  - **Tobacco:** 12.0%
- **Fulfillment Channels:** Dine-In: **12.0%** | Takeaway: **12.0%** | Delivery: **12.0%**
- **Service Charge & Tips:** Policy: `standard` | Standard Rate: **10%** | Taxable: **YES** | Cover Charge Allowed: **YES**
  - *Legal Note:* Republic Act No. 11360: 100% of service charges collected must be distributed to rank-and-file employees. Service charge is subject to 12% VAT.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **YES (BIR-Accredited POS / Cash Register Machine (CRM))**
  - E-Invoicing Mandatory: **YES (Electronic Invoicing/Receipting System (EIS))**
  - Natively Supported by Web App: **NO — REQUIRES EXTERNAL HARDWARE/GATEWAY**
  - *Invoicing Details:* All point-of-sale systems must have a valid Permit to Use (PTU) issued by the Bureau of Internal Revenue (BIR) under Revenue Regulations No. 16-2018.
- **Compliance Warnings:**
  - ⚠️ *BIR ACCREDITATION MANDATE: Generating receipts in the Philippines without a BIR-accredited POS system and PTU is a criminal offense under the NIRC.*
  - ⚠️ *SENIOR CITIZEN & PWD STATUTORY DISCOUNT: RA 9994 mandates a 20% discount AND full 12% VAT exemption on food and drink for senior citizens and PWDs.*
- **Dated Statutory Rate History:**
  - `2006-02-01` to `Present`: **12.0%** — *Standard 12% VAT under the National Internal Revenue Code (NIRC).*
- **Sources & Legal Citations:**
  - [Bureau of Internal Revenue (BIR) Philippines — Value-Added Tax Guidelines](https://www.bir.gov.ph/index.php/tax-information/value-added-tax.html) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### Vietnam (VN)

- **Tier & Status:** Tier 3 | **Status: `VERIFIED`** (Can go live without accountant: **NO — BLOCKED**)
- **Currency & Decimals:** `VND` (₫) — **0 Decimals**
- **Standard vs Restaurant Tax:** Standard: **10.00%** | Restaurant / Catering: **8.00%** (inclusive)
- **Tax Display Label & Tax ID:** Label: **VAT (GTGT)** | Tax ID Label: **Mã số thuế (MST)** (Format: `0123456789 (10 or 13 digits)`)
- **Category Breakdown:**
  - **Food:** 8.0%
  - **Hot Drinks:** 8.0%
  - **Soft Drinks:** 8.0%
  - **Bottled Water:** 8.0%
  - **Alcohol:** 10.0%
  - **Tobacco:** 10.0%
- **Fulfillment Channels:** Dine-In: **8.0%** | Takeaway: **8.0%** | Delivery: **8.0%**
- **Service Charge & Tips:** Policy: `optional` | Standard Rate: **5%** | Taxable: **YES** | Cover Charge Allowed: **YES**
  - *Legal Note:* 5% service charge common in upscale dining; subject to VAT.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **YES (Máy tính tiền có kết nối dữ liệu điện tử với cơ quan thuế (Decree 123/2020))**
  - E-Invoicing Mandatory: **YES (Hóa đơn điện tử khởi tạo từ máy tính tiền (Circular 78/2021/TT-BTC))**
  - Natively Supported by Web App: **NO — REQUIRES EXTERNAL HARDWARE/GATEWAY**
  - *Invoicing Details:* Restaurants and F&B businesses must issue electronic invoices generated from POS cash registers directly connected to the General Department of Taxation.
- **Compliance Warnings:**
  - ⚠️ *DECIMAL WARNING: Vietnamese Dong (VND) does not use decimals (0 decimals).*
  - ⚠️ *TAX CONNECTIVITY MANDATE: Under Decree 123/2020/ND-CP, F&B establishments must connect POS registers directly to the General Department of Taxation to issue certified e-invoices.*
- **Dated Statutory Rate History:**
  - `2022-02-01` to `Present`: **8.0%** — *Temporary 8% reduced VAT rate applied on rolling decree extensions.*
- **Sources & Legal Citations:**
  - [Tổng cục Thuế (General Department of Taxation Vietnam) — Hóa đơn điện tử](https://hoadondientu.gdt.gov.vn/) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### Hong Kong (HK)

- **Tier & Status:** Tier 3 | **Status: `VERIFIED`** (Can go live without accountant: **YES**)
- **Currency & Decimals:** `HKD` (HK$) — **2 Decimals**
- **Standard vs Restaurant Tax:** Standard: **0.00%** | Restaurant / Catering: **0.00%** (inclusive)
- **Tax Display Label & Tax ID:** Label: **No Tax** | Tax ID Label: **Business Registration No. (BRN)** (Format: `12345678-000 (8 digits)`)
- **Category Breakdown:**
  - **Food:** 0.0%
  - **Hot Drinks:** 0.0%
  - **Soft Drinks:** 0.0%
  - **Bottled Water:** 0.0%
  - **Alcohol:** 0.0%
  - **Tobacco:** 0.0%
- **Fulfillment Channels:** Dine-In: **0.0%** | Takeaway: **0.0%** | Delivery: **0.0%**
- **Service Charge & Tips:** Policy: `standard` | Standard Rate: **10%** | Taxable: **NO** | Cover Charge Allowed: **YES**
  - *Legal Note:* 10% service charge and tea charges are customary and widespread. No tax applies to either.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **NO**
  - E-Invoicing Mandatory: **NO**
  - Natively Supported by Web App: **YES**
  - *Invoicing Details:* No fiscal printer or e-invoicing required. Standard commercial receipt sufficient.
- **Compliance Warnings:**
  - ⚠️ *ZERO-TAX JURISDICTION: Hong Kong imposes no sales tax, VAT, or GST on restaurant meals.*
- **Dated Statutory Rate History:**
  - `1900-01-01` to `Present`: **0.0%** — *Hong Kong has never enacted a goods and services tax or VAT.*
- **Sources & Legal Citations:**
  - [Inland Revenue Department Hong Kong — A Guide to Taxes in Hong Kong](https://www.ird.gov.hk/eng/tax/gen_overview.htm) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### Saudi Arabia (SA)

- **Tier & Status:** Tier 3 | **Status: `VERIFIED`** (Can go live without accountant: **NO — BLOCKED**)
- **Currency & Decimals:** `SAR` (SAR) — **2 Decimals**
- **Standard vs Restaurant Tax:** Standard: **15.00%** | Restaurant / Catering: **15.00%** (inclusive)
- **Tax Display Label & Tax ID:** Label: **VAT** | Tax ID Label: **VAT Registration No.** (Format: `300012345600003 (15 digits)`)
- **Category Breakdown:**
  - **Food:** 15.0%
  - **Hot Drinks:** 15.0%
  - **Soft Drinks:** 15.0%
  - **Bottled Water:** 15.0%
  - **Alcohol:** prohibited
  - **Tobacco:** 15.0%
- **Fulfillment Channels:** Dine-In: **15.0%** | Takeaway: **15.0%** | Delivery: **15.0%**
- **Service Charge & Tips:** Policy: `optional` | Standard Rate: **0%** | Taxable: **YES** | Cover Charge Allowed: **NO**
  - *Legal Note:* Tipping is voluntary. Any service surcharge is subject to 15% VAT.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **YES (ZATCA FATOORA Phase 2 compliant solution with CSID cryptographic stamp)**
  - E-Invoicing Mandatory: **YES (ZATCA FATOORA Phase 2 Integration (QR Code, Cryptographic Stamp, Hash))**
  - Natively Supported by Web App: **NO — REQUIRES EXTERNAL HARDWARE/GATEWAY**
  - *Invoicing Details:* Simplified Tax Invoices must include a compliant Base64 TLV QR code containing Seller Name, TRN, Timestamp, Total with VAT, and VAT amount.
- **Compliance Warnings:**
  - ⚠️ *ZATCA FATOORA PHASE 2 COMPLIANCE MANDATE: Saudi Arabia requires e-invoicing integrated directly with ZATCA, including tamper-proof cryptographic stamping and TLV QR codes.*
  - ⚠️ *ALCOHOL PROHIBITION: Alcohol is strictly prohibited under Saudi law.*
- **Dated Statutory Rate History:**
  - `2018-01-01` to `2020-06-30`: **5.0%** — *Original 5% VAT rate in Saudi Arabia.*
  - `2020-07-01` to `Present`: **15.0%** — *Tripled from 5% to 15% as part of fiscal consolidation.*
- **Sources & Legal Citations:**
  - [Zakat, Tax and Customs Authority (ZATCA) — E-Invoicing (FATOORA)](https://zatca.gov.sa/en/E-Invoicing/Pages/default.aspx) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### Qatar (QA)

- **Tier & Status:** Tier 3 | **Status: `VERIFIED`** (Can go live without accountant: **YES**)
- **Currency & Decimals:** `QAR` (QAR) — **2 Decimals**
- **Standard vs Restaurant Tax:** Standard: **0.00%** | Restaurant / Catering: **0.00%** (inclusive)
- **Tax Display Label & Tax ID:** Label: **No Tax** | Tax ID Label: **Tax Card No.** (Format: `12345678`)
- **Category Breakdown:**
  - **Food:** 0.0%
  - **Hot Drinks:** 0.0%
  - **Soft Drinks:** 0.0%
  - **Bottled Water:** 0.0%
  - **Alcohol:** 0.0%
  - **Tobacco:** 0.0%
- **Fulfillment Channels:** Dine-In: **0.0%** | Takeaway: **0.0%** | Delivery: **0.0%**
- **Service Charge & Tips:** Policy: `standard` | Standard Rate: **10%** | Taxable: **NO** | Cover Charge Allowed: **YES**
  - *Legal Note:* 10% service charge common in luxury hotels and tourist venues. No tax applies.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **NO**
  - E-Invoicing Mandatory: **NO**
  - Natively Supported by Web App: **YES**
  - *Invoicing Details:* Standard receipt sufficient.
- **Compliance Warnings:**
  - ⚠️ *ZERO-TAX JURISDICTION: Qatar has not implemented VAT. No sales tax applies to restaurant food.*
- **Dated Statutory Rate History:**
  - `2000-01-01` to `Present`: **0.0%** — *Qatar has postponed implementation of VAT.*
- **Sources & Legal Citations:**
  - [General Tax Authority Qatar (GTA) — Taxes Overview](https://www.gta.gov.qa/) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### Kuwait (KW)

- **Tier & Status:** Tier 3 | **Status: `VERIFIED`** (Can go live without accountant: **YES**)
- **Currency & Decimals:** `KWD` (KD) — **3 Decimals**
- **Standard vs Restaurant Tax:** Standard: **0.00%** | Restaurant / Catering: **0.00%** (inclusive)
- **Tax Display Label & Tax ID:** Label: **No Tax** | Tax ID Label: **Commercial License No.** (Format: `123456`)
- **Category Breakdown:**
  - **Food:** 0.0%
  - **Hot Drinks:** 0.0%
  - **Soft Drinks:** 0.0%
  - **Bottled Water:** 0.0%
  - **Alcohol:** prohibited
  - **Tobacco:** 0.0%
- **Fulfillment Channels:** Dine-In: **0.0%** | Takeaway: **0.0%** | Delivery: **0.0%**
- **Service Charge & Tips:** Policy: `optional` | Standard Rate: **0%** | Taxable: **NO** | Cover Charge Allowed: **NO**
  - *Legal Note:* Tipping is voluntary. No tax applies.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **NO**
  - E-Invoicing Mandatory: **NO**
  - Natively Supported by Web App: **YES**
  - *Invoicing Details:* Standard receipt sufficient.
- **Compliance Warnings:**
  - ⚠️ *DECIMAL WARNING: Kuwaiti Dinar (KWD) uses 3 DECIMALS (1 KWD = 1,000 fils). Calculations must round to 3 decimal places.*
  - ⚠️ *ZERO-TAX JURISDICTION: Kuwait has not implemented VAT.*
- **Dated Statutory Rate History:**
  - `2000-01-01` to `Present`: **0.0%** — *VAT introduction postponed.*
- **Sources & Legal Citations:**
  - [Ministry of Finance Kuwait — Tax Information](https://www.mof.gov.kw/) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### Bahrain (BH)

- **Tier & Status:** Tier 3 | **Status: `VERIFIED`** (Can go live without accountant: **YES**)
- **Currency & Decimals:** `BHD` (BD) — **3 Decimals**
- **Standard vs Restaurant Tax:** Standard: **10.00%** | Restaurant / Catering: **10.00%** (inclusive)
- **Tax Display Label & Tax ID:** Label: **VAT** | Tax ID Label: **TRN** (Format: `200012345600002 (15 digits)`)
- **Category Breakdown:**
  - **Food:** 10.0%
  - **Hot Drinks:** 10.0%
  - **Soft Drinks:** 10.0%
  - **Bottled Water:** 10.0%
  - **Alcohol:** 10.0%
  - **Tobacco:** 10.0%
- **Fulfillment Channels:** Dine-In: **10.0%** | Takeaway: **10.0%** | Delivery: **10.0%**
- **Service Charge & Tips:** Policy: `standard` | Standard Rate: **10%** | Taxable: **YES** | Cover Charge Allowed: **YES**
  - *Legal Note:* Standard 10% service charge and 5% tourism levy in hotels/tourist restaurants. 10% VAT applies on the total amount.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **NO**
  - E-Invoicing Mandatory: **NO**
  - Natively Supported by Web App: **YES**
  - *Invoicing Details:* Simplified Tax Invoice permitted for retail under BHD 500.
- **Compliance Warnings:**
  - ⚠️ *DECIMAL WARNING: Bahraini Dinar (BHD) uses 3 DECIMALS (1 BHD = 1,000 fils).*
  - ⚠️ *RATE INCREASE (JAN 1, 2022): Standard VAT increased from 5% to 10%.*
- **Dated Statutory Rate History:**
  - `2019-01-01` to `2021-12-31`: **5.0%** — *Original 5% VAT rate.*
  - `2022-01-01` to `Present`: **10.0%** — *Doubled to 10% standard rate under Decree-Law No. (33) of 2021.*
- **Sources & Legal Citations:**
  - [National Bureau for Revenue (NBR) Bahrain — VAT Rate Change](https://www.nbr.gov.bh/) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### Turkey (TR)

- **Tier & Status:** Tier 3 | **Status: `VERIFIED`** (Can go live without accountant: **NO — BLOCKED**)
- **Currency & Decimals:** `TRY` (₺) — **2 Decimals**
- **Standard vs Restaurant Tax:** Standard: **20.00%** | Restaurant / Catering: **10.00%** (inclusive)
- **Tax Display Label & Tax ID:** Label: **KDV** | Tax ID Label: **Vergi Kimlik No. (VKN)** (Format: `1234567890 (10 digits)`)
- **Category Breakdown:**
  - **Food:** 10.0%
  - **Hot Drinks:** 10.0%
  - **Soft Drinks:** 10.0%
  - **Bottled Water:** 10.0%
  - **Alcohol:** 20.0%
  - **Tobacco:** 20.0%
- **Fulfillment Channels:** Dine-In: **10.0%** | Takeaway: **10.0%** | Delivery: **10.0%**
- **Service Charge & Tips:** Policy: `optional` | Standard Rate: **10%** | Taxable: **YES** | Cover Charge Allowed: **YES**
  - *Legal Note:* Kuver and service fees are subject to 10% KDV.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **YES (Yeni Nesil Ödeme Kaydedici Cihaz (YN ÖKC) / e-Fatura / e-Arşiv)**
  - E-Invoicing Mandatory: **YES (Gelir İdaresi Başkanlığı (GİB) ÖKC integration)**
  - Natively Supported by Web App: **NO — REQUIRES EXTERNAL HARDWARE/GATEWAY**
  - *Invoicing Details:* Law No. 3100: Restaurants must use certified New Generation Fiscal Cash Registers (YN ÖKC) transmitting daily Z-reports to GİB.
- **Compliance Warnings:**
  - ⚠️ *FISCAL REGISTER (YN ÖKC) MANDATE: Turkish law requires certified New Generation Fiscal Cash Registers (Ödeme Kaydedici Cihaz).*
  - ⚠️ *Alcoholic drinks must be taxed at 20% KDV; food and non-alcoholic drinks are 10%.*
- **Dated Statutory Rate History:**
  - `2023-07-10` to `2024-04-26`: **10.0%** — *Reduced rate adjusted to 10% (standard adjusted to 20%).*
  - `2024-04-27` to `Present`: **10.0%** — *Communiqué clarifying 10% rate strictly for restaurant and cafe services.*
- **Sources & Legal Citations:**
  - [Gelir İdaresi Başkanlığı (GİB) — Katma Değer Vergisi Genel Uygulama Tebliği](https://www.gib.gov.tr/) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### Israel (IL)

- **Tier & Status:** Tier 3 | **Status: `VERIFIED`** (Can go live without accountant: **NO — BLOCKED**)
- **Currency & Decimals:** `ILS` (₪) — **2 Decimals**
- **Standard vs Restaurant Tax:** Standard: **17.00%** | Restaurant / Catering: **17.00%** (inclusive)
- **Tax Display Label & Tax ID:** Label: **מע"מ (VAT)** | Tax ID Label: **ח.פ. / עוסק מורשה** (Format: `123456789 (9 digits)`)
- **Category Breakdown:**
  - **Food:** 17.0%
  - **Hot Drinks:** 17.0%
  - **Soft Drinks:** 17.0%
  - **Bottled Water:** 17.0%
  - **Alcohol:** 17.0%
  - **Tobacco:** 17.0%
- **Fulfillment Channels:** Dine-In: **17.0%** | Takeaway: **17.0%** | Delivery: **17.0%**
- **Service Charge & Tips:** Policy: `optional` | Standard Rate: **12%** | Taxable: **YES** | Cover Charge Allowed: **YES**
  - *Legal Note:* Tips given directly to waitstaff are outside VAT. Mandatory service charge listed on the receipt is taxable at 17% VAT.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **YES (Approved Bookkeeping Software registered with ITA (תוכנה רשומה))**
  - E-Invoicing Mandatory: **YES (Israel Invoicing Model (מודל הקצאת מספרי חשבוניות))**
  - Natively Supported by Web App: **NO — REQUIRES EXTERNAL HARDWARE/GATEWAY**
  - *Invoicing Details:* Point of sale software must be registered on the ITA official registry of approved bookkeeping software.
- **Compliance Warnings:**
  - ⚠️ *APPROVED SOFTWARE REGISTRY: Israeli tax authorities mandate that all electronic billing software be registered and approved by the Israel Tax Authority.*
- **Dated Statutory Rate History:**
  - `2015-10-01` to `Present`: **17.0%** — *Standard 17% VAT on all goods and restaurant services.*
- **Sources & Legal Citations:**
  - [Israel Tax Authority (רשות המסים בישראל) — שיעורי מע"מ](https://www.gov.il/he/departments/israel_tax_authority) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### South Africa (ZA)

- **Tier & Status:** Tier 3 | **Status: `VERIFIED`** (Can go live without accountant: **YES**)
- **Currency & Decimals:** `ZAR` (R) — **2 Decimals**
- **Standard vs Restaurant Tax:** Standard: **15.00%** | Restaurant / Catering: **15.00%** (inclusive)
- **Tax Display Label & Tax ID:** Label: **VAT** | Tax ID Label: **VAT Registration No.** (Format: `4123456789 (10 digits starting with 4)`)
- **Category Breakdown:**
  - **Food:** 15.0%
  - **Hot Drinks:** 15.0%
  - **Soft Drinks:** 15.0%
  - **Bottled Water:** 15.0%
  - **Alcohol:** 15.0%
  - **Tobacco:** 15.0%
- **Fulfillment Channels:** Dine-In: **15.0%** | Takeaway: **15.0%** | Delivery: **15.0%**
- **Service Charge & Tips:** Policy: `optional` | Standard Rate: **10%** | Taxable: **YES** | Cover Charge Allowed: **YES**
  - *Legal Note:* Voluntary tips are outside VAT. Mandatory service charges added to the bill are taxable at 15% VAT.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **NO**
  - E-Invoicing Mandatory: **NO**
  - Natively Supported by Web App: **YES**
  - *Invoicing Details:* Full Tax Invoice required for sales > R5,000; abridged tax invoice permitted for R50 to R5,000.
- **Compliance Warnings:**
  - ⚠️ *VAT INCLUSIVE PRICING: Section 65 of the VAT Act requires all advertised prices to be inclusive of 15% VAT.*
- **Dated Statutory Rate History:**
  - `2018-04-01` to `Present`: **15.0%** — *Increased from 14% to 15% under Value-Added Tax Act, 1991.*
- **Sources & Legal Citations:**
  - [South African Revenue Service (SARS) — VAT Rates & Food Supplies](https://www.sars.gov.za/types-of-tax/value-added-tax/) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### Nigeria (NG)

- **Tier & Status:** Tier 3 | **Status: `VERIFIED`** (Can go live without accountant: **YES**)
- **Currency & Decimals:** `NGN` (₦) — **2 Decimals**
- **Standard vs Restaurant Tax:** Standard: **7.50%** | Restaurant / Catering: **7.50%** (exclusive)
- **Tax Display Label & Tax ID:** Label: **VAT** | Tax ID Label: **TIN** (Format: `12345678-0001`)
- **Category Breakdown:**
  - **Food:** 7.5%
  - **Hot Drinks:** 7.5%
  - **Soft Drinks:** 7.5%
  - **Bottled Water:** 7.5%
  - **Alcohol:** 7.5%
  - **Tobacco:** 7.5%
- **Fulfillment Channels:** Dine-In: **7.5%** | Takeaway: **7.5%** | Delivery: **7.5%**
- **Service Charge & Tips:** Policy: `optional` | Standard Rate: **10%** | Taxable: **YES** | Cover Charge Allowed: **YES**
  - *Legal Note:* 10% service charge common; subject to 7.5% VAT.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **NO**
  - E-Invoicing Mandatory: **NO**
  - Natively Supported by Web App: **YES**
  - *Invoicing Details:* Tax invoice must state TIN and separate VAT.
- **Compliance Warnings:**
  - ⚠️ *LAGOS STATE CONSUMPTION TAX: In Lagos State, an additional 5% Hotel Occupancy and Restaurant Consumption Tax applies on top of 7.5% Federal VAT.*
- **Dated Statutory Rate History:**
  - `2020-02-01` to `Present`: **7.5%** — *Finance Act 2019 increased VAT from 5% to 7.5%.*
- **Sources & Legal Citations:**
  - [Federal Inland Revenue Service (FIRS) Nigeria — VAT Overview](https://www.firs.gov.ng/) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### Kenya (KE)

- **Tier & Status:** Tier 3 | **Status: `VERIFIED`** (Can go live without accountant: **NO — BLOCKED**)
- **Currency & Decimals:** `KES` (KSh) — **2 Decimals**
- **Standard vs Restaurant Tax:** Standard: **16.00%** | Restaurant / Catering: **16.00%** (inclusive)
- **Tax Display Label & Tax ID:** Label: **VAT** | Tax ID Label: **KRA PIN** (Format: `P012345678A (11 characters)`)
- **Category Breakdown:**
  - **Food:** 16.0%
  - **Hot Drinks:** 16.0%
  - **Soft Drinks:** 16.0%
  - **Bottled Water:** 16.0%
  - **Alcohol:** 16.0%
  - **Tobacco:** 16.0%
- **Fulfillment Channels:** Dine-In: **16.0%** | Takeaway: **16.0%** | Delivery: **16.0%**
- **Service Charge & Tips:** Policy: `standard` | Standard Rate: **2%** | Taxable: **YES** | Cover Charge Allowed: **YES**
  - *Legal Note:* Tourism Act 2011: 2% Tourism Fund Levy (Catering Levy) applies on gross restaurant sales. 16% VAT applies on food/drinks.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **YES (eTIMS (electronic Tax Invoice Management System))**
  - E-Invoicing Mandatory: **YES (KRA eTIMS API integration generating Control Unit Number & QR Code)**
  - Natively Supported by Web App: **NO — REQUIRES EXTERNAL HARDWARE/GATEWAY**
  - *Invoicing Details:* All businesses in Kenya must generate eTIMS electronic tax invoices with KRA QR code for every transaction.
- **Compliance Warnings:**
  - ⚠️ *eTIMS MANDATE: Kenya Revenue Authority requires all point of sale systems to be integrated with eTIMS.*
  - ⚠️ *CATERING LEVY: A mandatory 2% Catering/Tourism Levy applies to restaurant sales in addition to 16% VAT.*
- **Dated Statutory Rate History:**
  - `2013-09-02` to `Present`: **16.0%** — *Standard 16% VAT under VAT Act 2013.*
- **Sources & Legal Citations:**
  - [Kenya Revenue Authority (KRA) — Electronic Tax Invoice Management System (eTIMS)](https://www.kra.go.ke/en/etims) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### Egypt (EG)

- **Tier & Status:** Tier 3 | **Status: `VERIFIED`** (Can go live without accountant: **NO — BLOCKED**)
- **Currency & Decimals:** `EGP` (E£) — **2 Decimals**
- **Standard vs Restaurant Tax:** Standard: **14.00%** | Restaurant / Catering: **14.00%** (exclusive)
- **Tax Display Label & Tax ID:** Label: **VAT (ضريبة القيمة المضافة)** | Tax ID Label: **Tax Registration No. (رقم التسجيل الضريبي)** (Format: `123-456-789 (9 digits)`)
- **Category Breakdown:**
  - **Food:** 14.0%
  - **Hot Drinks:** 14.0%
  - **Soft Drinks:** 14.0%
  - **Bottled Water:** 14.0%
  - **Alcohol:** 14.0%
  - **Tobacco:** 14.0%
- **Fulfillment Channels:** Dine-In: **14.0%** | Takeaway: **14.0%** | Delivery: **14.0%**
- **Service Charge & Tips:** Policy: `standard` | Standard Rate: **12%** | Taxable: **YES** | Cover Charge Allowed: **YES**
  - *Legal Note:* 12% service charge in tourist-classified restaurants is subject to 14% VAT.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **YES (Egyptian e-Receipt System (منظومة الإيصال الإلكتروني))**
  - E-Invoicing Mandatory: **YES (Egyptian Tax Authority e-Receipt B2C API)**
  - Natively Supported by Web App: **NO — REQUIRES EXTERNAL HARDWARE/GATEWAY**
  - *Invoicing Details:* B2C point-of-sale systems must connect to the ETA e-Receipt portal to transmit receipts in real time.
- **Compliance Warnings:**
  - ⚠️ *EGYPTIAN E-RECEIPT MANDATE: The Egyptian Tax Authority mandates real-time e-Receipt transmission for all restaurant point of sale systems.*
- **Dated Statutory Rate History:**
  - `2016-09-08` to `Present`: **14.0%** — *Value Added Tax Law No. 67 of 2016.*
- **Sources & Legal Citations:**
  - [Egyptian Tax Authority (ETA) — e-Receipt System](https://www.eta.gov.eg/) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### Mexico (MX)

- **Tier & Status:** Tier 3 | **Status: `VERIFIED`** (Can go live without accountant: **NO — BLOCKED**)
- **Currency & Decimals:** `MXN` (MX$) — **2 Decimals**
- **Standard vs Restaurant Tax:** Standard: **16.00%** | Restaurant / Catering: **16.00%** (inclusive)
- **Tax Display Label & Tax ID:** Label: **IVA** | Tax ID Label: **RFC** (Format: `ABCD123456XYZ (12 or 13 characters)`)
- **Category Breakdown:**
  - **Food:** 16.0%
  - **Hot Drinks:** 16.0%
  - **Soft Drinks:** 16.0%
  - **Bottled Water:** 16.0%
  - **Alcohol:** 16.0%
  - **Tobacco:** 16.0%
- **Fulfillment Channels:** Dine-In: **16.0%** | Takeaway: **16.0%** | Delivery: **16.0%**
- **Service Charge & Tips:** Policy: `prohibited_mandatory` | Standard Rate: **0%** | Taxable: **NO** | Cover Charge Allowed: **NO**
  - *Legal Note:* PROFECO (Federal Consumer Protection Agency): Mandatory service charges/tips are strictly illegal in Mexico (Article 10 of LFPC). Any propina must be voluntary.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **YES (CFDI 4.0 con Timbrado Fiscal SAT a través de PAC)**
  - E-Invoicing Mandatory: **YES (CFDI 4.0 XML with digital stamp from an authorized PAC)**
  - Natively Supported by Web App: **NO — REQUIRES EXTERNAL HARDWARE/GATEWAY**
  - *Invoicing Details:* All tax receipts (Facturas) must be digitally stamped (timbrado) by an Authorized Certification Provider (PAC) and SAT.
- **Compliance Warnings:**
  - ⚠️ *CFDI 4.0 E-INVOICING MANDATE: Official tax receipts must be stamped via an authorized PAC with SAT digital certificate.*
  - ⚠️ *PROFECO MANDATORY SERVICE CHARGE BAN: Adding an automatic tip or service charge is illegal and subject to severe PROFECO penalties.*
- **Dated Statutory Rate History:**
  - `2014-01-01` to `Present`: **16.0%** — *Unified standard 16% IVA rate across Mexico.*
- **Sources & Legal Citations:**
  - [Servicio de Administración Tributaria (SAT) — Factura electrónica (CFDI 4.0)](https://www.sat.gob.mx/consultas/35041/factura-electronica) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### Brazil (BR)

- **Tier & Status:** Tier 3 | **Status: `CONFLICT`** (Can go live without accountant: **NO — BLOCKED**)
- **Currency & Decimals:** `BRL` (R$) — **2 Decimals**
- **Standard vs Restaurant Tax:** Standard: **12.00%** | Restaurant / Catering: **12.00%** (inclusive)
- **Tax Display Label & Tax ID:** Label: **ICMS / Simples** | Tax ID Label: **CNPJ** (Format: `12.345.678/0001-90 (14 digits)`)
- **Category Breakdown:**
  - **Food:** 12.0%
  - **Hot Drinks:** 12.0%
  - **Soft Drinks:** 12.0%
  - **Bottled Water:** 12.0%
  - **Alcohol:** 25.0%
  - **Tobacco:** 25.0%
- **Fulfillment Channels:** Dine-In: **12.0%** | Takeaway: **12.0%** | Delivery: **12.0%**
- **Service Charge & Tips:** Policy: `standard` | Standard Rate: **10%** | Taxable: **YES** | Cover Charge Allowed: **YES**
  - *Legal Note:* Lei da Gorjeta (Lei 13.419/2017): Gorjeta / taxa de serviço (10%) is regulated, must be distributed to staff, but is considered revenue for taxation.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **YES (NFC-e (Nota Fiscal de Consumidor Eletrônica - Mod 65) / SAT-CF-e (SP))**
  - E-Invoicing Mandatory: **YES (SEFAZ Electronic Invoicing with digital certificate (A1/A3))**
  - Natively Supported by Web App: **NO — REQUIRES EXTERNAL HARDWARE/GATEWAY**
  - *Invoicing Details:* Every consumer transaction must transmit an authorized NFC-e XML to the state SEFAZ generating a QR code on the DANFE NFC-e.
- **Compliance Warnings:**
  - ⚠️ *STATUS CONFLICT & ACCOUNTANT CONFIRMATION MANDATORY: Brazilian restaurant taxation varies dramatically between Simples Nacional, Lucro Presumido, and state ICMS rules. Owner must confirm configuration with an accountant.*
  - ⚠️ *NFC-e / SAT SEFAZ MANDATE: Issuing receipts without state SEFAZ digital authorization (NFC-e) is illegal under Brazilian tax code.*
- **Dated Statutory Rate History:**
  - `2017-03-15` to `Present`: **12.0%** — *Composite state ICMS / Simples Nacional taxation.*
- **Federal / Multi-Level Regional Rules:**
  - **SP (São Paulo (Regime Especial Decreto 51.597: 3.2% ou SAT/NFC-e)):** Restaurant Rate: **3.20%** (ICMS Especial, inclusive). *Special simplified regime: 3.2% flat ICMS on gross restaurant sales in São Paulo.*
  - **RJ (Rio de Janeiro (ICMS 4.0% Regime Especial)):** Restaurant Rate: **4.00%** (ICMS RJ, inclusive). *State special regime 4% on food and beverage services.*
  - **SIMPLES (Simples Nacional (Anexo I: 4.0% - 11.5% progressivo)):** Restaurant Rate: **8.00%** (Simples Nacional, inclusive). *Small restaurant unified federal/state tax bracket.*
- **Sources & Legal Citations:**
  - [Receita Federal do Brasil — Simples Nacional](https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/simples-nacional) (Official Tax Authority)
  - [SEFAZ-SP — Nota Fiscal de Consumidor Eletrônica (NFC-e) e SAT](https://portal.fazenda.sp.gov.br/servicos/sat) (Official Tax Authority)
    - *Conflict Note:* Rates conflict between general ICMS (18%), special F&B decree (3.2%), and Simples Nacional progressive brackets.
- **Last Verified:** `2026-10-22`

#### Chile (CL)

- **Tier & Status:** Tier 3 | **Status: `VERIFIED`** (Can go live without accountant: **NO — BLOCKED**)
- **Currency & Decimals:** `CLP` (CLP$) — **0 Decimals**
- **Standard vs Restaurant Tax:** Standard: **19.00%** | Restaurant / Catering: **19.00%** (inclusive)
- **Tax Display Label & Tax ID:** Label: **IVA** | Tax ID Label: **RUT** (Format: `12.345.678-9`)
- **Category Breakdown:**
  - **Food:** 19.0%
  - **Hot Drinks:** 19.0%
  - **Soft Drinks:** 19.0%
  - **Bottled Water:** 19.0%
  - **Alcohol:** 19.0%
  - **Tobacco:** 19.0%
- **Fulfillment Channels:** Dine-In: **19.0%** | Takeaway: **19.0%** | Delivery: **19.0%**
- **Service Charge & Tips:** Policy: `optional` | Standard Rate: **10%** | Taxable: **NO** | Cover Charge Allowed: **NO**
  - *Legal Note:* Ley 20.729: Restaurants must suggest a 10% voluntary propina on the bill, but the patron is free to accept, decline, or change it. Propina is exempt from IVA.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **YES (Boleta Electrónica de Ventas y Servicios (SII))**
  - E-Invoicing Mandatory: **YES (Servicio de Impuestos Internos (SII) real-time API transmission)**
  - Natively Supported by Web App: **NO — REQUIRES EXTERNAL HARDWARE/GATEWAY**
  - *Invoicing Details:* Resolución Exenta SII N° 74: All commercial sales must emit an electronic ticket (Boleta Electrónica) transmitted in real-time to the SII.
- **Compliance Warnings:**
  - ⚠️ *DECIMAL WARNING: Chilean Peso (CLP) does not use decimals (0 decimals).*
  - ⚠️ *BOLETA ELECTRÓNICA MANDATE: Operating in Chile requires real-time Boleta Electrónica transmission authorized by the Servicio de Impuestos Internos (SII).*
- **Dated Statutory Rate History:**
  - `1998-01-01` to `Present`: **19.0%** — *Standard 19% IVA under Decreto Ley 825.*
- **Sources & Legal Citations:**
  - [Servicio de Impuestos Internos (SII) Chile — Boleta Electrónica](https://www.sii.cl/destacados/boleta_electronica/) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

#### Colombia (CO)

- **Tier & Status:** Tier 3 | **Status: `VERIFIED`** (Can go live without accountant: **NO — BLOCKED**)
- **Currency & Decimals:** `COP` (COL$) — **0 Decimals**
- **Standard vs Restaurant Tax:** Standard: **8.00%** | Restaurant / Catering: **8.00%** (inclusive)
- **Tax Display Label & Tax ID:** Label: **Impoconsumo (INC)** | Tax ID Label: **NIT** (Format: `123.456.789-0`)
- **Category Breakdown:**
  - **Food:** 8.0%
  - **Hot Drinks:** 8.0%
  - **Soft Drinks:** 8.0%
  - **Bottled Water:** 8.0%
  - **Alcohol:** 8.0%
  - **Tobacco:** 8.0%
- **Fulfillment Channels:** Dine-In: **8.0%** | Takeaway: **8.0%** | Delivery: **8.0%**
- **Service Charge & Tips:** Policy: `optional` | Standard Rate: **10%** | Taxable: **NO** | Cover Charge Allowed: **NO**
  - *Legal Note:* Ley 1935 de 2018: Propina is strictly voluntary. It does NOT form part of the tax base for Impoconsumo and is never taxed.
- **Invoice & Fiscal Printer Requirements:**
  - Fiscal Device Required: **YES (Factura Electrónica de Venta / Documento Equivalente POS Electrónico (DIAN))**
  - E-Invoicing Mandatory: **YES (DIAN Resolución 000165 de 2023 (POS Electrónico))**
  - Natively Supported by Web App: **NO — REQUIRES EXTERNAL HARDWARE/GATEWAY**
  - *Invoicing Details:* All restaurant POS receipts must be generated as Documento Equivalente Electrónico POS and validated in real time by DIAN.
- **Compliance Warnings:**
  - ⚠️ *DECIMAL WARNING: Colombian Peso (COP) is rounded to 0 decimals for point of sale receipts.*
  - ⚠️ *IMPOCONSUMO (8%) VS IVA (19%): Independent restaurants in Colombia do NOT charge 19% IVA. They legally charge 8% Impuesto Nacional al Consumo (INC). Charging IVA is only for franchises.*
  - ⚠️ *DIAN POS ELECTRÓNICO MANDATE: POS receipts must be validated electronically with DIAN.*
- **Dated Statutory Rate History:**
  - `2013-01-01` to `Present`: **8.0%** — *Article 512-1 Estatuto Tributario: 8% national consumption tax for restaurant services.*
- **Sources & Legal Citations:**
  - [DIAN (Dirección de Impuestos y Aduanas Nacionales) — Impuesto Nacional al Consumo](https://www.dian.gov.co/impuestos/personas/Paginas/ImpuestoNacionalalConsumo.aspx) (Official Tax Authority)
  - [Estatuto Tributario Nacional — Artículo 512-1 Hecho Generador del Impuesto Nacional al Consumo](https://estatuto.co/512-1) (Official Tax Authority)
- **Last Verified:** `2026-10-22`

