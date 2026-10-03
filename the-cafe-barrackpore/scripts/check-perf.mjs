import fs from 'fs';
const rep = JSON.parse(fs.readFileSync('lighthouse-report.json', 'utf8'));
const perfRefs = rep.categories.performance.auditRefs || [];
for (const ref of perfRefs) {
  const audit = rep.audits[ref.id];
  if (audit && audit.score !== null && audit.score < 1) {
    console.log(`[${ref.id}] (weight: ${ref.weight}) score: ${audit.score} displayValue: ${audit.displayValue}`);
    if (audit.details?.items) {
      console.log('Details:', JSON.stringify(audit.details.items.slice(0, 3), null, 2));
    }
  }
}
