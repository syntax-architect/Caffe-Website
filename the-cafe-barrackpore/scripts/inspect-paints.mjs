import fs from 'fs';

const report = JSON.parse(fs.readFileSync('lighthouse-report.json', 'utf8'));
console.log('Keys in report:', Object.keys(report));

// Check if artifacts or lantern data exists
if (report.audits['metrics']?.details?.items) {
  console.log('\nMetrics item:');
  console.log(report.audits['metrics'].details.items[0]);
}
