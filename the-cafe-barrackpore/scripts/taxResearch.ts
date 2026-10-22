/**
 * Admin Tax Research & Rule Verification Tool
 * 
 * STRICT COMPLIANCE & ARCHITECTURAL INVARIANTS:
 * 1. Admin/CLI out-of-band script ONLY. NEVER import into the client bundle or customer path.
 * 2. Official sources FIRST: National tax authority legislation/portals (Revenue IE, HMRC, CBIC, IRAS, etc.).
 * 3. Secondary sources: Big-4 Global Indirect Tax Summaries (PwC, KPMG, EY, Deloitte).
 * 4. Staged proposals are ALWAYS written with status = 'unverified' until human review.
 * 5. Rules older than 90 days trigger mandatory stale alerts.
 * 6. Visual unified diffs show exact additions/deletions before and after rule proposals.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { DATED_TAX_RULES, MASTER_TAX_REGISTRY, isRuleStale } from '../src/config/taxRegistry';
import type { DatedTaxRule, TaxCategory, TaxMode } from '../src/types/tax';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROPOSALS_FILE = path.resolve(__dirname, '../src/config/pendingTaxRules.json');

// 14 Core Jurisdictions
export const CORE_JURISDICTIONS = [
  'IE', 'GB', 'US', 'CA', 'AU', 'NZ', 'AE', 'SG', 'IN', 'DE', 'FR', 'ES', 'IT', 'NL'
] as const;

export interface AuthoritySourceReference {
  countryCode: string;
  countryName: string;
  primaryAuthority: string;
  officialPortalUrl: string;
  officialVatGstRatesUrl: string;
  big4PwcUrl: string;
  big4KpmgUrl: string;
}

export const OFFICIAL_AUTHORITY_SOURCES: Record<string, AuthoritySourceReference> = {
  IE: {
    countryCode: 'IE',
    countryName: 'Ireland',
    primaryAuthority: 'Office of the Revenue Commissioners (Revenue Ireland)',
    officialPortalUrl: 'https://www.revenue.ie',
    officialVatGstRatesUrl: 'https://www.revenue.ie/en/vat/vat-rates/search-vat-rates/food-and-drink-in-restaurants.aspx',
    big4PwcUrl: 'https://taxsummaries.pwc.com/ireland/corporate/other-taxes',
    big4KpmgUrl: 'https://kpmg.com/ie/en/home/insights/2023/09/vat-rate-changes-hospitality-sector.html',
  },
  GB: {
    countryCode: 'GB',
    countryName: 'United Kingdom',
    primaryAuthority: 'HM Revenue and Customs (HMRC)',
    officialPortalUrl: 'https://www.gov.uk',
    officialVatGstRatesUrl: 'https://www.gov.uk/guidance/catering-takeaway-food-and-vat-notice-709-1',
    big4PwcUrl: 'https://taxsummaries.pwc.com/united-kingdom/corporate/other-taxes',
    big4KpmgUrl: 'https://kpmg.com/uk/en/home/insights.html',
  },
  US: {
    countryCode: 'US',
    countryName: 'United States',
    primaryAuthority: 'State Departments of Revenue (NYS DTF, CDTFA, TX Comptroller, FL DOR)',
    officialPortalUrl: 'https://www.tax.ny.gov',
    officialVatGstRatesUrl: 'https://www.tax.ny.gov/bus/st/rates.htm',
    big4PwcUrl: 'https://taxsummaries.pwc.com/united-states/corporate/other-taxes',
    big4KpmgUrl: 'https://kpmg.com/us/en/home/services/tax.html',
  },
  CA: {
    countryCode: 'CA',
    countryName: 'Canada',
    primaryAuthority: 'Canada Revenue Agency (CRA) / Agence du revenu du Canada',
    officialPortalUrl: 'https://www.canada.ca/en/revenue-agency.html',
    officialVatGstRatesUrl: 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-specific-situations/food-beverages.html',
    big4PwcUrl: 'https://taxsummaries.pwc.com/canada/corporate/other-taxes',
    big4KpmgUrl: 'https://kpmg.com/ca/en/home/services/tax.html',
  },
  AU: {
    countryCode: 'AU',
    countryName: 'Australia',
    primaryAuthority: 'Australian Taxation Office (ATO)',
    officialPortalUrl: 'https://www.ato.gov.au',
    officialVatGstRatesUrl: 'https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/in-detail/your-industry/restaurant-and-catering',
    big4PwcUrl: 'https://taxsummaries.pwc.com/australia/corporate/other-taxes',
    big4KpmgUrl: 'https://kpmg.com/au/en/home/services/tax.html',
  },
  NZ: {
    countryCode: 'NZ',
    countryName: 'New Zealand',
    primaryAuthority: 'Inland Revenue Department (Te Tari Taake / IRD)',
    officialPortalUrl: 'https://www.ird.govt.nz',
    officialVatGstRatesUrl: 'https://www.ird.govt.nz/gst',
    big4PwcUrl: 'https://taxsummaries.pwc.com/new-zealand/corporate/other-taxes',
    big4KpmgUrl: 'https://kpmg.com/nz/en/home/services/tax.html',
  },
  AE: {
    countryCode: 'AE',
    countryName: 'United Arab Emirates',
    primaryAuthority: 'Federal Tax Authority (FTA UAE)',
    officialPortalUrl: 'https://tax.gov.ae',
    officialVatGstRatesUrl: 'https://tax.gov.ae/en/legislation/vat-legislation.aspx',
    big4PwcUrl: 'https://taxsummaries.pwc.com/united-arab-emirates/corporate/other-taxes',
    big4KpmgUrl: 'https://kpmg.com/ae/en/home/services/tax.html',
  },
  SG: {
    countryCode: 'SG',
    countryName: 'Singapore',
    primaryAuthority: 'Inland Revenue Authority of Singapore (IRAS)',
    officialPortalUrl: 'https://www.iras.gov.sg',
    officialVatGstRatesUrl: 'https://www.iras.gov.sg/taxes/goods-services-tax-(gst)/gst-rate-change',
    big4PwcUrl: 'https://taxsummaries.pwc.com/singapore/corporate/other-taxes',
    big4KpmgUrl: 'https://kpmg.com/sg/en/home/services/tax.html',
  },
  IN: {
    countryCode: 'IN',
    countryName: 'India',
    primaryAuthority: 'Central Board of Indirect Taxes and Customs (CBIC) / GST Council',
    officialPortalUrl: 'https://cbic-gst.gov.in',
    officialVatGstRatesUrl: 'https://cbic-gst.gov.in/gst-goods-services-rates.html',
    big4PwcUrl: 'https://taxsummaries.pwc.com/india/corporate/other-taxes',
    big4KpmgUrl: 'https://kpmg.com/in/en/home/services/tax.html',
  },
  DE: {
    countryCode: 'DE',
    countryName: 'Germany',
    primaryAuthority: 'Bundesministerium der Finanzen (BMF)',
    officialPortalUrl: 'https://www.bundesfinanzministerium.de',
    officialVatGstRatesUrl: 'https://www.bundesfinanzministerium.de/Content/DE/Standardartikel/Themen/Steuern/Weitere_Steuerthemen/Umsatzsteuer/Ermaessigter_Umsatzsteuersatz/ermaessigter-umsatzsteuersatz.html',
    big4PwcUrl: 'https://taxsummaries.pwc.com/germany/corporate/other-taxes',
    big4KpmgUrl: 'https://kpmg.com/de/de/home/themen/steuern.html',
  },
  FR: {
    countryCode: 'FR',
    countryName: 'France',
    primaryAuthority: 'Direction Générale des Finances Publiques (DGFiP)',
    officialPortalUrl: 'https://www.impots.gouv.fr',
    officialVatGstRatesUrl: 'https://www.impots.gouv.fr/professionnel/les-taux-de-tva',
    big4PwcUrl: 'https://taxsummaries.pwc.com/france/corporate/other-taxes',
    big4KpmgUrl: 'https://kpmg.com/fr/fr/home/services/tax.html',
  },
  ES: {
    countryCode: 'ES',
    countryName: 'Spain',
    primaryAuthority: 'Agencia Estatal de Administración Tributaria (AEAT)',
    officialPortalUrl: 'https://sede.agenciatributaria.gob.es',
    officialVatGstRatesUrl: 'https://sede.agenciatributaria.gob.es/Sede/iva.html',
    big4PwcUrl: 'https://taxsummaries.pwc.com/spain/corporate/other-taxes',
    big4KpmgUrl: 'https://kpmg.com/es/es/home/servicios/fiscalidad.html',
  },
  IT: {
    countryCode: 'IT',
    countryName: 'Italy',
    primaryAuthority: 'Agenzia delle Entrate (AdE)',
    officialPortalUrl: 'https://www.agenziaentrate.gov.it',
    officialVatGstRatesUrl: 'https://www.agenziaentrate.gov.it/portale/aliquote-iva',
    big4PwcUrl: 'https://taxsummaries.pwc.com/italy/corporate/other-taxes',
    big4KpmgUrl: 'https://kpmg.com/it/it/home/servizi/tax.html',
  },
  NL: {
    countryCode: 'NL',
    countryName: 'Netherlands',
    primaryAuthority: 'Belastingdienst (Dutch Tax and Customs Administration)',
    officialPortalUrl: 'https://www.belastingdienst.nl',
    officialVatGstRatesUrl: 'https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/btw/tarieven_en_vrijstellingen/diensten_9_btw/eten_en_drinken_in_de_horeca',
    big4PwcUrl: 'https://taxsummaries.pwc.com/netherlands/corporate/other-taxes',
    big4KpmgUrl: 'https://kpmg.com/nl/nl/home/services/tax.html',
  },
};

export interface TaxRuleProposal extends DatedTaxRule {
  proposal_id: string;
  proposed_at: string;
  proposed_by: string;
  reason: string;
}

/**
 * Loads pending proposals from JSON staging file
 */
export function loadPendingProposals(): TaxRuleProposal[] {
  if (!fs.existsSync(PROPOSALS_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(PROPOSALS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Saves pending proposals to JSON staging file
 */
export function savePendingProposals(proposals: TaxRuleProposal[]): void {
  fs.writeFileSync(PROPOSALS_FILE, JSON.stringify(proposals, null, 2), 'utf-8');
}

/**
 * Formats unified diff for proposed changes
 */
export function formatRuleDiff(current: DatedTaxRule | undefined, proposed: DatedTaxRule): string {
  const lines: string[] = [];
  lines.push(`@@ Rule Diff for [${proposed.country}-${proposed.region}] "${proposed.rule_label}" @@`);
  if (!current) {
    lines.push(`+ [NEW RULE ADDITION]`);
    lines.push(`+ Country:       ${proposed.country}`);
    lines.push(`+ Region:        ${proposed.region}`);
    lines.push(`+ Rule Label:    ${proposed.rule_label}`);
    lines.push(`+ Rate:          ${(proposed.rate * 100).toFixed(2)}% (${proposed.rate})`);
    lines.push(`+ Mode:          ${proposed.mode}`);
    lines.push(`+ Categories:    ${proposed.applies_to.join(', ')}`);
    lines.push(`+ Order Type:    ${proposed.order_type}`);
    lines.push(`+ Effective From:${proposed.effective_from}`);
    lines.push(`+ Effective To:  ${proposed.effective_to || 'ongoing'}`);
    lines.push(`+ Status:        ${proposed.status} (MUST BE unverified until approved)`);
    lines.push(`+ Source URL:    ${proposed.source_url}`);
  } else {
    lines.push(`  Country:       ${proposed.country}`);
    lines.push(`  Region:        ${proposed.region}`);
    if (current.rule_label !== proposed.rule_label) {
      lines.push(`- Rule Label:    ${current.rule_label}`);
      lines.push(`+ Rule Label:    ${proposed.rule_label}`);
    } else {
      lines.push(`  Rule Label:    ${proposed.rule_label}`);
    }
    if (current.rate !== proposed.rate) {
      lines.push(`- Rate:          ${(current.rate * 100).toFixed(2)}% (${current.rate})`);
      lines.push(`+ Rate:          ${(proposed.rate * 100).toFixed(2)}% (${proposed.rate})`);
    } else {
      lines.push(`  Rate:          ${(proposed.rate * 100).toFixed(2)}%`);
    }
    if (current.effective_from !== proposed.effective_from || current.effective_to !== proposed.effective_to) {
      lines.push(`- Validity:      ${current.effective_from} -> ${current.effective_to || 'ongoing'}`);
      lines.push(`+ Validity:      ${proposed.effective_from} -> ${proposed.effective_to || 'ongoing'}`);
    }
    if (current.source_url !== proposed.source_url) {
      lines.push(`- Source URL:    ${current.source_url}`);
      lines.push(`+ Source URL:    ${proposed.source_url}`);
    }
    lines.push(`- Status:        ${current.status}`);
    lines.push(`+ Status:        ${proposed.status} (forced unverified)`);
  }
  return lines.join('\n');
}

/**
 * Runs rule staleness & 90-day alert audit
 */
export function runStalenessAudit(maxAgeDays: number = 90): {
  totalChecked: number;
  staleCount: number;
  staleRules: Array<{ rule: DatedTaxRule; ageDays: number }>;
} {
  const staleRules: Array<{ rule: DatedTaxRule; ageDays: number }> = [];
  const now = Date.now();

  for (const rule of DATED_TAX_RULES) {
    if (!rule.last_verified_at) {
      staleRules.push({ rule, ageDays: 999 });
      continue;
    }
    const verifiedTime = new Date(rule.last_verified_at).getTime();
    const ageDays = Math.floor((now - verifiedTime) / (1000 * 60 * 60 * 24));
    if (ageDays > maxAgeDays) {
      staleRules.push({ rule, ageDays });
    }
  }

  return {
    totalChecked: DATED_TAX_RULES.length,
    staleCount: staleRules.length,
    staleRules,
  };
}

/**
 * Proposes a new or updated rule, forcing status to 'unverified'
 */
export function proposeRuleUpdate(
  ruleInput: Omit<DatedTaxRule, 'status'>,
  reason: string,
  proposedBy: string = 'admin-cli'
): { proposal: TaxRuleProposal; diff: string } {
  // STRICT RULE: proposals are ALWAYS unverified
  const proposal: TaxRuleProposal = {
    ...ruleInput,
    status: 'unverified',
    proposal_id: `prop-${ruleInput.country}-${Date.now().toString(36)}`,
    proposed_at: new Date().toISOString(),
    proposed_by: proposedBy,
    reason,
  };

  // Find existing match
  const current = DATED_TAX_RULES.find(
    (r) =>
      r.country.toUpperCase() === proposal.country.toUpperCase() &&
      r.region.toUpperCase() === proposal.region.toUpperCase() &&
      r.rule_label.toLowerCase() === proposal.rule_label.toLowerCase() &&
      r.order_type === proposal.order_type
  );

  const diff = formatRuleDiff(current, proposal);

  const pending = loadPendingProposals();
  pending.push(proposal);
  savePendingProposals(pending);

  return { proposal, diff };
}

// ----------------------------------------------------------------------------
// CLI MAIN RUNNER
// ----------------------------------------------------------------------------
function main() {
  const args = process.argv.slice(2);
  console.log('╔═════════════════════════════════════════════════════════════════════════════╗');
  console.log('║       ADMIN OUT-OF-BAND TAX RESEARCH & AUDIT CLI REGISTRY TOOL             ║');
  console.log('║       Strict Compliance: Official Tax Authority Sources & Diff Staging      ║');
  console.log('╚═════════════════════════════════════════════════════════════════════════════╝\n');

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage:
  npx tsx scripts/taxResearch.ts [options]

Options:
  --audit             Run staleness audit (>90 days) across all 14 core jurisdictions.
  --sources           List all official tax authority portals and Big-4 references.
  --proposals         List all pending unverified rule proposals staged for accountant review.
  --stale-only        Output only rules that exceed the 90-day staleness threshold.
  --propose           Create a test proposal for review (dry run or interactive).
`);
    return;
  }

  // 1. Audit Staleness
  console.log('🔍 Executing Statutory Verification Staleness Audit (Threshold: 90 Days)...');
  const audit = runStalenessAudit(90);
  console.log(`   Total Active Dated Rules Checked: ${audit.totalChecked}`);
  console.log(`   Rules Verified within 90 Days:     ${audit.totalChecked - audit.staleCount}`);
  console.log(`   Rules Exceeding 90 Days (Stale):   ${audit.staleCount}\n`);

  if (audit.staleCount > 0) {
    console.log('⚠️  [STALENESS ALERTS (>90 DAYS OLD)]');
    for (const { rule, ageDays } of audit.staleRules) {
      console.log(`   - 🚨 [ALERT: ${ageDays} DAYS OLD] Country: ${rule.country} (${rule.region}) | "${rule.rule_label}"`);
      console.log(`        Rate: ${(rule.rate * 100).toFixed(2)}% | Mode: ${rule.mode} | Valid: ${rule.effective_from} -> ${rule.effective_to || 'ongoing'}`);
      console.log(`        Last Verified: ${rule.last_verified_at || 'NEVER'} | Source: ${rule.source_url}\n`);
    }
  } else {
    console.log('✅ All active dated rules are fresh and verified within the last 90 days!\n');
  }

  // 2. Official Authority Citations
  console.log('🏛️  Official Primary Tax Authority Sources for 14 Core Jurisdictions:');
  for (const cc of CORE_JURISDICTIONS) {
    const src = OFFICIAL_AUTHORITY_SOURCES[cc];
    if (src) {
      console.log(`   [${src.countryCode}] ${src.countryName.padEnd(16)} Authority: ${src.primaryAuthority}`);
      console.log(`        Official URL: ${src.officialVatGstRatesUrl}`);
      console.log(`        Big-4 Ref:    ${src.big4PwcUrl}`);
    }
  }
  console.log('');

  // 3. Pending Proposals
  const proposals = loadPendingProposals();
  console.log(`📋 Staged Unverified Rule Proposals: ${proposals.length}`);
  if (proposals.length > 0) {
    for (const prop of proposals) {
      console.log(`   - ID: ${prop.proposal_id} | ${prop.country}-${prop.region} | "${prop.rule_label}"`);
      console.log(`     Proposed Rate: ${(prop.rate * 100).toFixed(2)}% | Status: [${prop.status.toUpperCase()}]`);
      console.log(`     Reason: ${prop.reason} (by ${prop.proposed_by} at ${prop.proposed_at})`);
    }
    console.log('');
  }

  console.log('✨ Tax Research & Audit CLI run completed successfully.\n');
}

// Execute CLI when run directly
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
