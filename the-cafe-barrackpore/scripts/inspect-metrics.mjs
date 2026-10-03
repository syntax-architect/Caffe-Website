import fs from 'fs';

const report = JSON.parse(fs.readFileSync('lighthouse-report.json', 'utf8'));

console.log('--- network-dependency-tree-insight ---');
console.log(JSON.stringify(report.audits['network-dependency-tree-insight']?.details, null, 2));

console.log('\n--- critical-request-chains ---');
console.log(JSON.stringify(report.audits['critical-request-chains']?.details, null, 2));
