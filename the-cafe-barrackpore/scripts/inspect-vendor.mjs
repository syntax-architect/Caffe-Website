import fs from 'fs';

const content = fs.readFileSync('dist/assets/vendor-CH2Do3IT.js', 'utf8');
console.log('Size:', content.length);
// Find package names or clues
const patterns = [/node_modules\/([^\/]+)/g, /@([^\/]+\/[^\/]+)/g];
const found = new Set();
for (const p of patterns) {
  let m;
  while ((m = p.exec(content)) !== null) {
    found.add(m[1]);
  }
}
console.log('Found packages in vendor bundle:', [...found]);
if (found.size === 0) {
  // Let's inspect variable names or export headers
  console.log('Beginning of file:');
  console.log(content.slice(0, 1000));
}
