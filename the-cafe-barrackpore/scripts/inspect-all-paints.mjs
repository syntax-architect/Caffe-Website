import fs from 'fs';
const trace = JSON.parse(fs.readFileSync('lighthouse-report-0.trace.json', 'utf8'));
const events = trace.traceEvents || [];
const navStart = events.find(e => e.name === 'navigationStart');
const navStartTs = navStart ? navStart.ts : 0;

const paints = events.filter(e => 
  ['firstContentfulPaint', 'firstPaint', 'largestContentfulPaint::Candidate', 'LargestImagePaint::Candidate', 'LargestTextPaint::Candidate'].includes(e.name)
);

for (const p of paints) {
  const relTime = ((p.ts - navStartTs) / 1000).toFixed(2);
  console.log(`[${relTime} ms] ${p.name}`, JSON.stringify(p.args?.data || {}));
}
