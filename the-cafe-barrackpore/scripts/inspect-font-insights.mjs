import fs from 'fs';
const rep = JSON.parse(fs.readFileSync('lighthouse-report.json', 'utf8'));

// Check font-display-insight audit
console.log('font-display-insight:', JSON.stringify(rep.audits['font-display-insight'], null, 2));

// Check render-blocking-insight audit
console.log('render-blocking-insight:', JSON.stringify(rep.audits['render-blocking-insight'], null, 2));
