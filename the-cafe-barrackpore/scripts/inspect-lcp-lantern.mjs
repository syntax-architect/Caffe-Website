import fs from 'fs';
const rep = JSON.parse(fs.readFileSync('lighthouse-report.json', 'utf8'));

// Check Lantern diagnostics
const lcpAudit = rep.audits['largest-contentful-paint'];
console.log('LCP raw:', lcpAudit);

// Check if lantern diagnostics are present in audits or details
for (const [k, v] of Object.entries(rep.audits)) {
  if (k.includes('lcp') || k.includes('lantern') || k.includes('diagnostic')) {
    console.log(`Key: ${k}`, typeof v === 'object' ? Object.keys(v) : v);
  }
}
