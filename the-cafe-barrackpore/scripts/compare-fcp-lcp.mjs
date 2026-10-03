import fs from 'fs';
const rep = JSON.parse(fs.readFileSync('lighthouse-report.json', 'utf8'));

// Check metric timings in rep.audits
const fcp = rep.audits['first-contentful-paint'];
const lcp = rep.audits['largest-contentful-paint'];
const si = rep.audits['speed-index'];
const tbt = rep.audits['total-blocking-time'];

console.log('FCP:', fcp.numericValue, 'display:', fcp.displayValue);
console.log('LCP:', lcp.numericValue, 'display:', lcp.displayValue);
console.log('SI:', si.numericValue, 'display:', si.displayValue);
console.log('TBT:', tbt.numericValue, 'display:', tbt.displayValue);

// Let's check lcp-breakdown-insight again carefully
console.log('Breakdown items:');
console.log(JSON.stringify(rep.audits['lcp-breakdown-insight']?.details?.items, null, 2));
