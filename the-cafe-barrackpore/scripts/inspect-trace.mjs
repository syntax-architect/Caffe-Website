import fs from 'fs';

const report = JSON.parse(fs.readFileSync('lighthouse-report.json', 'utf8'));

console.log('FCP:', report.audits['first-contentful-paint']);
console.log('LCP:', report.audits['largest-contentful-paint']);
