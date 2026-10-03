import fs from 'fs';
const report = JSON.parse(fs.readFileSync('lighthouse-report.json', 'utf8'));
const refs = report.categories.performance.auditRefs;
refs.forEach(r => {
  const audit = report.audits[r.id];
  if (audit && audit.score !== null && r.weight > 0) {
    console.log(`${r.id.padEnd(28)} weight: ${r.weight} | score: ${Math.round(audit.score * 100)} | ${audit.displayValue || ''}`);
  }
});
