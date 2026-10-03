import fs from 'fs';

const report = JSON.parse(fs.readFileSync('lighthouse-report.json', 'utf8'));

console.log('Unused JS:');
console.log(report.audits['unused-javascript']?.details?.items);

console.log('\nMain thread breakdown:');
console.log(report.audits['mainthread-work-breakdown']?.details?.items);
