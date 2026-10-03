const fs = require('fs');
const report = JSON.parse(fs.readFileSync('lighthouse-report.json', 'utf8'));
const audits = report.audits;

console.log('--- LCP Details ---');
console.log('LCP displayValue:', audits['largest-contentful-paint']?.displayValue);
console.log('LCP score:', audits['largest-contentful-paint']?.score);
console.log('LCP element insight:');
console.log(JSON.stringify(audits['lcp-breakdown-insight']?.details, null, 2));

console.log('\n--- Network timeline for first 15 requests ---');
if (audits['network-requests']?.details?.items) {
  audits['network-requests'].details.items.slice(0, 15).forEach(item => {
    console.log(`${item.statusCode} ${item.resourceType} ${Math.round(item.transferSize/1024)}kB [${Math.round(item.networkRequestTime)}-${Math.round(item.networkEndTime)}ms]: ${item.url.split('/').pop()}`);
  });
}
