import fs from 'fs';

const report = JSON.parse(fs.readFileSync('lighthouse-report.json', 'utf8'));

// Check if trace data exists
const audits = report.audits;
console.log('LCP Audit details:');
console.log(audits['largest-contentful-paint-element']?.details);

console.log('\nLCP Breakdown Insight items:');
console.log(JSON.stringify(audits['lcp-breakdown-insight']?.details?.items, null, 2));
