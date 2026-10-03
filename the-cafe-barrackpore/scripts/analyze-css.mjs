import fs from 'fs';
import path from 'path';

const assetsDir = 'dist/assets';
const cssFile = fs.readdirSync(assetsDir).find(f => f.startsWith('index-') && f.endsWith('.css'));
const css = fs.readFileSync(path.join(assetsDir, cssFile), 'utf8');

console.log('CSS file:', cssFile);
console.log('CSS length:', css.length);

const rules = css.split('}');
console.log('Total rules count:', rules.length);

// What selectors exist?
const selectors = [];
for (const r of rules) {
  const parts = r.split('{');
  if (parts.length > 1) {
    selectors.push(parts[0].trim());
  }
}

// Sample selectors from end
console.log('Sample end selectors:');
console.log(selectors.slice(-30));
