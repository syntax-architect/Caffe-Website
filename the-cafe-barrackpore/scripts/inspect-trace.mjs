import fs from 'fs';
const report = JSON.parse(fs.readFileSync('lighthouse-report.json', 'utf8'));
const traceEvents = report.audits['user-timings']?.details?.items || [];
console.log('user-timings:', traceEvents);
console.log('diagnostics:', report.audits['diagnostics']?.details?.items?.[0]);
