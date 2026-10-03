import fs from 'fs';
const report = JSON.parse(fs.readFileSync('lighthouse-report.json', 'utf8'));
const audits = report.audits;
console.log('FCP audit:');
console.log('numericValue:', audits['first-contentful-paint']?.numericValue);
console.log('details:', audits['first-contentful-paint']?.details);
console.log('render-blocking:', audits['render-blocking-insight']?.details?.items);
console.log('critical-request-chains:', audits['critical-request-chains']?.details);
