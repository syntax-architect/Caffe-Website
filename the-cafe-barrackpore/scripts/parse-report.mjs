import fs from 'fs';

const report = JSON.parse(fs.readFileSync('lighthouse-report.json', 'utf8'));
const audits = report.audits;

console.log('--- lcp-breakdown-insight ---');
console.log(JSON.stringify(audits['lcp-breakdown-insight'], null, 2));

console.log('\n--- lcp-discovery-insight ---');
console.log(JSON.stringify(audits['lcp-discovery-insight'], null, 2));

console.log('\n--- render-blocking-insight ---');
console.log(JSON.stringify(audits['render-blocking-insight'], null, 2));
