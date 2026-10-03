import fs from 'fs';

const report = JSON.parse(fs.readFileSync('lighthouse-report.json', 'utf8'));
const networkItems = report.audits['network-requests']?.details?.items || [];

console.log('=== NETWORK REQUESTS TIMELINE ===');
networkItems.forEach(item => {
  const url = item.url.replace('http://127.0.0.1:4173', '');
  console.log(
    `${item.statusCode} | ${item.resourceType.padEnd(10)} | ${url.slice(0, 45).padEnd(45)} | ` +
    `start: ${Math.round(item.rendererStartTime)}ms | end: ${Math.round(item.networkEndTime)}ms | ` +
    `size: ${Math.round(item.transferSize / 1024)}kB | priority: ${item.priority}`
  );
});
