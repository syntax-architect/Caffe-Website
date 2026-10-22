import * as fs from 'fs';
import * as path from 'path';
import { MASTER_TAX_REGISTRY } from '../src/config/taxRegistry';

console.log('Generating COUNTRY_REPORT.md for all 44 countries...');

const entries = Object.values(MASTER_TAX_REGISTRY);
console.log(`Found ${entries.length} entries in MASTER_TAX_REGISTRY.`);

let md = `# Global Restaurant Tax Registry & Jurisdictional Compliance Report

**Document Version:** 2026.4 (Comprehensive International Release)  
**Effective Date:** Mid-2026 Statutory Law Review  
**Coverage:** 44 Major Jurisdictions (Tier 1: 8, Tier 2: 13, Tier 3: 23)  
**Standard of Verification:** Statutory Tax Authority Legislation First, Big-4 / OECD Global Summaries Secondary.

---

## 1. Executive Summary & Regulatory Framework

This report documents the statutory indirect tax (VAT / GST / Sales Tax / Consumption Tax / Service Tax) rules applicable to commercial food and beverage operations across 44 sovereign economic jurisdictions.

### Core Rules for Honesty & Compliance Integrity
1. **Official Verification Standard (\`status: 'verified'\`):** A jurisdiction is marked **verified** ONLY when primary legislation or official tax authority rulings (e.g., \`revenue.ie\`, \`gov.uk\`, \`gst.gov.in\`, \`ato.gov.au\`, \`IRAS\`, \`FTA UAE\`, \`BMF\`, \`DGFiP\`, \`Agencia Tributaria\`, \`Agenzia delle Entrate\`, \`DIAN\`, etc.) confirm the exact rates and category boundaries.
2. **Accountant Confirmation Gate:** Any country with status \`unverified\` or \`conflict\`, or any jurisdiction imposing certified physical/cloud fiscal device mandates (e.g. German TSE, Italian RT, French NF525, Portuguese AT, Spanish Veri*Factu, Polish KSeF, Kenyan eTIMS, Mexican CFDI, Brazilian NFC-e), **blocks live ordering in the application** until the restaurant owner and certified local accountant record formal sign-off.
3. **No Guesswork on Federal Systems:** Multi-tiered federal jurisdictions (**United States, Canada, India, UAE, Brazil, Australia**) require manual regional selection (State, Province, or Emirate). Composite single national rates are strictly disallowed.
4. **Currency Decimal Precision:** Non-standard currency decimal rules are hard-enforced at the calculation engine layer:
   - **0 Decimals (No minor unit):** JPY (¥), KRW (₩), VND (₫), CLP (CLP$), IDR (Rp).
   - **3 Decimals (1/1000 minor unit):** BHD (BD), KWD (KD).
   - **2 Decimals (Standard):** USD, EUR, GBP, AUD, CAD, NZD, SGD, INR, etc.

---

## 2. Master Summary Table (All 44 Countries)

| Code | Country | Tier | Status | Currency (Dec) | Standard Rate | Restaurant Rate | Food vs Alcohol | Dine-In vs Takeaway | Service Charge | Fiscal Hardware / E-Invoice | Last Verified |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---|:---:|
`;

for (const e of entries) {
  const foodRate = typeof e.categoryRates.food === 'number' ? `${(e.categoryRates.food * 100).toFixed(1)}%` : String(e.categoryRates.food);
  const alcRate = typeof e.categoryRates.alcohol === 'number' ? `${(e.categoryRates.alcohol * 100).toFixed(1)}%` : String(e.categoryRates.alcohol);
  const dineRate = typeof e.fulfillmentRates.dineIn === 'number' ? `${(e.fulfillmentRates.dineIn * 100).toFixed(1)}%` : String(e.fulfillmentRates.dineIn);
  const takeRate = typeof e.fulfillmentRates.takeaway === 'number' ? `${(e.fulfillmentRates.takeaway * 100).toFixed(1)}%` : String(e.fulfillmentRates.takeaway);
  const scRate = e.serviceChargeRules.standardRate > 0 ? `${(e.serviceChargeRules.standardRate * 100).toFixed(0)}% (${e.serviceChargeRules.isTaxable ? 'Taxable' : 'Exempt'})` : 'None / Voluntary';
  const fiscal = e.invoiceRequirements.fiscalDeviceRequired
    ? `⚠️ ${e.invoiceRequirements.fiscalDeviceType || 'Fiscal Device'}`
    : e.invoiceRequirements.eInvoiceMandatory
    ? `ℹ️ ${e.invoiceRequirements.eInvoiceFramework || 'E-Invoice'}`
    : 'Standard POS';

  md += `| **${e.countryCode}** | ${e.countryName} | Tier ${e.tier} | \`${e.status}\` | ${e.currency} (${e.currencyDecimals}) | ${(e.standardRate * 100).toFixed(1)}% | **${(e.restaurantRate * 100).toFixed(1)}%** | ${foodRate} / ${alcRate} | ${dineRate} / ${takeRate} | ${scRate} | ${fiscal} | ${e.lastVerified} |\n`;
}

md += `\n---\n\n## 3. Detailed Jurisdictional Profiles\n\n`;

// Tier groupings
const tiers = [
  { tier: 1, title: 'Tier 1: Core International Hubs (IE, GB, US, CA, AU, NZ, SG, AE)' },
  { tier: 2, title: 'Tier 2: European Union & EFTA (DE, FR, ES, IT, NL, PT, BE, AT, SE, DK, NO, CH, PL)' },
  { tier: 3, title: 'Tier 3: Asia, Middle East, Americas & Africa (IN, JP, KR, TH, MY, ID, PH, VN, HK, SA, QA, KW, BH, TR, IL, ZA, NG, KE, EG, MX, BR, CL, CO)' },
];

for (const t of tiers) {
  md += `### ${t.title}\n\n`;
  const tierEntries = entries.filter((e) => e.tier === t.tier);

  for (const e of tierEntries) {
    md += `#### ${e.countryName} (${e.countryCode})\n\n`;
    md += `- **Tier & Status:** Tier ${e.tier} | **Status: \`${e.status.toUpperCase()}\`** (Can go live without accountant: **${e.canGoLiveWithoutAccountantConfirmation ? 'YES' : 'NO — BLOCKED'}**)\n`;
    md += `- **Currency & Decimals:** \`${e.currency}\` (${e.currencySymbol}) — **${e.currencyDecimals} Decimals**\n`;
    md += `- **Standard vs Restaurant Tax:** Standard: **${(e.standardRate * 100).toFixed(2)}%** | Restaurant / Catering: **${(e.restaurantRate * 100).toFixed(2)}%** (${e.taxMode})\n`;
    md += `- **Tax Display Label & Tax ID:** Label: **${e.taxLabel}** | Tax ID Label: **${e.taxIdLabel}** (Format: \`${e.taxIdFormat}\`)\n`;
    md += `- **Category Breakdown:**\n`;
    md += `  - **Food:** ${typeof e.categoryRates.food === 'number' ? (e.categoryRates.food * 100).toFixed(1) + '%' : e.categoryRates.food}\n`;
    md += `  - **Hot Drinks:** ${typeof e.categoryRates.hotDrink === 'number' ? (e.categoryRates.hotDrink * 100).toFixed(1) + '%' : e.categoryRates.hotDrink}\n`;
    md += `  - **Soft Drinks:** ${typeof e.categoryRates.softDrink === 'number' ? (e.categoryRates.softDrink * 100).toFixed(1) + '%' : e.categoryRates.softDrink}\n`;
    md += `  - **Bottled Water:** ${typeof e.categoryRates.bottledWater === 'number' ? (e.categoryRates.bottledWater * 100).toFixed(1) + '%' : e.categoryRates.bottledWater}\n`;
    md += `  - **Alcohol:** ${typeof e.categoryRates.alcohol === 'number' ? (e.categoryRates.alcohol * 100).toFixed(1) + '%' : e.categoryRates.alcohol}\n`;
    md += `  - **Tobacco:** ${typeof e.categoryRates.tobacco === 'number' ? (e.categoryRates.tobacco * 100).toFixed(1) + '%' : e.categoryRates.tobacco}\n`;
    md += `- **Fulfillment Channels:** Dine-In: **${typeof e.fulfillmentRates.dineIn === 'number' ? (e.fulfillmentRates.dineIn * 100).toFixed(1) + '%' : e.fulfillmentRates.dineIn}** | Takeaway: **${typeof e.fulfillmentRates.takeaway === 'number' ? (e.fulfillmentRates.takeaway * 100).toFixed(1) + '%' : e.fulfillmentRates.takeaway}** | Delivery: **${typeof e.fulfillmentRates.delivery === 'number' ? (e.fulfillmentRates.delivery * 100).toFixed(1) + '%' : e.fulfillmentRates.delivery}**\n`;
    md += `- **Service Charge & Tips:** Policy: \`${e.serviceChargeRules.policy}\` | Standard Rate: **${(e.serviceChargeRules.standardRate * 100).toFixed(0)}%** | Taxable: **${e.serviceChargeRules.isTaxable ? 'YES' : 'NO'}** | Cover Charge Allowed: **${e.serviceChargeRules.coverChargeAllowed ? 'YES' : 'NO'}**\n`;
    md += `  - *Legal Note:* ${e.serviceChargeRules.notes}\n`;
    md += `- **Invoice & Fiscal Printer Requirements:**\n`;
    md += `  - Fiscal Device Required: **${e.invoiceRequirements.fiscalDeviceRequired ? 'YES (' + e.invoiceRequirements.fiscalDeviceType + ')' : 'NO'}**\n`;
    md += `  - E-Invoicing Mandatory: **${e.invoiceRequirements.eInvoiceMandatory ? 'YES (' + (e.invoiceRequirements.eInvoiceFramework || 'Mandatory') + ')' : 'NO'}**\n`;
    md += `  - Natively Supported by Web App: **${e.invoiceRequirements.supportedByApp ? 'YES' : 'NO — REQUIRES EXTERNAL HARDWARE/GATEWAY'}**\n`;
    md += `  - *Invoicing Details:* ${e.invoiceRequirements.notes}\n`;

    if (e.complianceWarnings.length > 0) {
      md += `- **Compliance Warnings:**\n`;
      for (const w of e.complianceWarnings) {
        md += `  - ⚠️ *${w}*\n`;
      }
    }

    if (e.datedRules.length > 0) {
      md += `- **Dated Statutory Rate History:**\n`;
      for (const d of e.datedRules) {
        md += `  - \`${d.effectiveFrom}\` to \`${d.effectiveTo || 'Present'}\`: **${(d.rate * 100).toFixed(1)}%** — *${d.description}*\n`;
      }
    }

    if (e.regions && e.regions.length > 0) {
      md += `- **Federal / Multi-Level Regional Rules:**\n`;
      for (const r of e.regions) {
        md += `  - **${r.code} (${r.name}):** Restaurant Rate: **${(r.restaurantRate * 100).toFixed(2)}%** (${r.taxLabel}, ${r.taxMode}). *${r.notes || ''}*\n`;
      }
    }

    md += `- **Sources & Legal Citations:**\n`;
    for (const s of e.sources) {
      md += `  - [${s.title}](${s.url}) (${s.official ? 'Official Tax Authority' : 'Authoritative Summary'})\n`;
      if (s.conflictNotes) {
        md += `    - *Conflict Note:* ${s.conflictNotes}\n`;
      }
    }
    md += `- **Last Verified:** \`${e.lastVerified}\`\n\n`;
  }
}

const outputPath = path.resolve(process.cwd(), '../COUNTRY_REPORT.md');
fs.writeFileSync(outputPath, md, 'utf-8');
// Also write one inside the-cafe-barrackpore for direct access
fs.writeFileSync(path.resolve(process.cwd(), 'COUNTRY_REPORT.md'), md, 'utf-8');
console.log(`Successfully generated COUNTRY_REPORT.md at: ${outputPath} and ${path.resolve(process.cwd(), 'COUNTRY_REPORT.md')}`);
