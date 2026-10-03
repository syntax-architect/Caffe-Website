import fs from 'fs';

const report = JSON.parse(fs.readFileSync('lighthouse-report.json', 'utf8'));
const network = report.audits['network-requests']?.details?.items || [];

console.log('=== NETWORK ITEMS ===');
for (const n of network) {
  console.log(`${n.url.slice(0, 60)} | priority: ${n.priority} | transfer: ${n.transferSize} | start: ${n.rendererStartTime} | end: ${n.networkEndTime}`);
}
