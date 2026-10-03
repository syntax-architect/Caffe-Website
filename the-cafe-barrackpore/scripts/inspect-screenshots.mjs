import fs from 'fs';

const report = JSON.parse(fs.readFileSync('lighthouse-report.json', 'utf8'));

console.log('Screenshots:');
const screenshots = report.audits['screenshot-thumbnails']?.details?.items || [];
for (const s of screenshots) {
  console.log(`timing: ${s.timing} ms | timestamp: ${s.timestamp}`);
}
