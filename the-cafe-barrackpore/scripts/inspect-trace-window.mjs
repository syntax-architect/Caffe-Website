import fs from 'fs';
const trace = JSON.parse(fs.readFileSync('lighthouse-report-0.trace.json', 'utf8'));
const events = trace.traceEvents || [];
const navStart = events.find(e => e.name === 'navigationStart');
const navStartTs = navStart ? navStart.ts : 0;

const interestingNames = ['Layout', 'Paint', 'Commit', 'v8.compile', 'EvaluateScript', 'FunctionCall', 'UpdateLayoutTree', 'FireAnimationFrame'];
const interesting = events.filter(e => {
  const relTime = (e.ts - navStartTs) / 1000;
  return relTime >= 1000 && relTime <= 1060 && interestingNames.includes(e.name);
});

for (const e of interesting) {
  const relTime = ((e.ts - navStartTs) / 1000).toFixed(2);
  console.log(`[${relTime} ms] ${e.name} dur=${((e.dur || 0)/1000).toFixed(2)}ms`, e.args?.data || '');
}
