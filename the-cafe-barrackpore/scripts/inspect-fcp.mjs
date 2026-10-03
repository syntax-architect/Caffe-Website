import fs from 'fs';
const report = JSON.parse(fs.readFileSync('lighthouse-report.json', 'utf8'));
const reqs = report.audits['network-requests']?.details?.items || [];
console.log(reqs[0]);
console.log(reqs[1]);
console.log(reqs[2]);
