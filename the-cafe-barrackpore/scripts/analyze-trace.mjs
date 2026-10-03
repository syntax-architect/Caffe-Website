import fs from 'fs';

const trace = JSON.parse(fs.readFileSync('lighthouse-report-0.trace.json', 'utf8'));
const events = trace.traceEvents || [];

// Find navigationStart
const navStart = events.find(e => e.name === 'navigationStart');
const navStartTs = navStart ? navStart.ts : 0;

// Filter candidate paint events
const paints = events.filter(e => 
  ['firstContentfulPaint', 'firstPaint', 'largestContentfulPaint::Candidate', 'LargestImagePaint::Candidate', 'LargestTextPaint::Candidate'].includes(e.name)
);

console.log('Paint events (relative to navStart in ms):');
for (const p of paints) {
  const relTime = ((p.ts - navStartTs) / 1000).toFixed(1);
  console.log(`- ${p.name}: ${relTime} ms`, JSON.stringify(p.args?.data || {}));
}
