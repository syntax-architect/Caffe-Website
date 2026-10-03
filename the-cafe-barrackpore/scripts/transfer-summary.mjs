import fs from 'fs';
const report = JSON.parse(fs.readFileSync('lighthouse-report.json', 'utf8'));
const reqs = report.audits['network-requests']?.details?.items || [];
let totalBytes = 0;
const byType = {};
reqs.forEach(r => {
  totalBytes += r.transferSize;
  byType[r.resourceType] = (byType[r.resourceType] || 0) + r.transferSize;
});

console.log('Total transferred bytes:', Math.round(totalBytes / 1024), 'kB');
for (const [k, v] of Object.entries(byType)) {
  console.log(`- ${k.padEnd(15)}: ${Math.round(v / 1024)} kB`);
}
