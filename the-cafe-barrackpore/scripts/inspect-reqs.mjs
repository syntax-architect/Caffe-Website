import fs from 'fs';
const report = JSON.parse(fs.readFileSync('lighthouse-report.json', 'utf8'));
const reqs = report.audits['network-requests']?.details?.items || [];
console.log('Total reqs:', reqs.length);
reqs.forEach((r, i) => {
  console.log(`${i}. [${r.resourceType}] ${r.statusCode} ${r.url.slice(0, 80)} (${Math.round(r.transferSize / 1024)} kB)`);
});
