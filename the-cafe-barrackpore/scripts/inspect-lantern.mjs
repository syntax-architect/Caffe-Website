import fs from 'fs';
const rep = JSON.parse(fs.readFileSync('lighthouse-report.json', 'utf8'));

// Check timings and simulation data
console.log('Timing:', JSON.stringify(rep.timing, null, 2));
console.log('Config settings:', JSON.stringify(rep.configSettings?.throttling, null, 2));

// Check critical-request-chains
const chains = rep.audits['critical-request-chains'];
console.log('Critical request chains:');
console.log(JSON.stringify(chains?.details, null, 2));
