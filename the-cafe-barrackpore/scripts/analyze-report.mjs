import fs from 'fs';

const r = JSON.parse(fs.readFileSync('lighthouse-report.json', 'utf8'));

console.log('--- METRICS ---');
console.log('FCP:', r.audits['first-contentful-paint']?.displayValue, r.audits['first-contentful-paint']?.score);
console.log('LCP:', r.audits['largest-contentful-paint']?.displayValue, r.audits['largest-contentful-paint']?.score);
console.log('TBT:', r.audits['total-blocking-time']?.displayValue, r.audits['total-blocking-time']?.score);
console.log('CLS:', r.audits['cumulative-layout-shift']?.displayValue, r.audits['cumulative-layout-shift']?.score);
console.log('Speed Index:', r.audits['speed-index']?.displayValue, r.audits['speed-index']?.score);

console.log('\n--- AUDITS WITH SCORE < 0.9 ---');
for (const [k, v] of Object.entries(r.audits)) {
  if (v.score !== null && v.score < 0.9) {
    console.log(`[${k}] ${v.title} => ${v.displayValue || v.score}`);
    if (v.explanation) console.log(`  Explanation: ${v.explanation}`);
    if (v.details?.items?.length) {
      console.log(`  Items (${v.details.items.length}):`, JSON.stringify(v.details.items.slice(0, 3), null, 2));
    }
  }
}
