import fs from 'fs';
const trace = JSON.parse(fs.readFileSync('lighthouse-report-0.trace.json', 'utf8'));
const events = trace.traceEvents || [];
const navStart = events.find(e => e.name === 'navigationStart');
const navStartTs = navStart ? navStart.ts : 0;

// Filter major tasks
const major = events.filter(e => {
  const relTime = (e.ts - navStartTs) / 1000;
  return relTime >= 0 && relTime < 1043 && (e.dur || 0) > 5000; // > 5ms
});

console.log(`Found ${major.length} major tasks (> 5ms) before first paint:`);
for (const e of major) {
  const relTime = ((e.ts - navStartTs) / 1000).toFixed(2);
  console.log(`[${relTime} ms] ${e.name} (${e.cat}) dur=${((e.dur||0)/1000).toFixed(2)}ms`, e.args?.data || '');
}
