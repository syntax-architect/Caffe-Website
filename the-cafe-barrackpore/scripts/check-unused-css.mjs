import fs from 'fs';
import path from 'path';

const html = fs.readFileSync('dist/index.html', 'utf8');
const assetsDir = 'dist/assets';
const cssFile = fs.readdirSync(assetsDir).find(f => f.startsWith('index-') && f.endsWith('.css'));
const css = fs.readFileSync(path.join(assetsDir, cssFile), 'utf8');

// Match class names in CSS
const classMatches = [...css.matchAll(/\.([a-zA-Z0-9_\-\\\:\/\[\]\%]+)(?=[^a-zA-Z0-9_\-\\\:\/\[\]\%])/g)].map(m => m[1]);
const uniqueClasses = [...new Set(classMatches)];

console.log('Total unique classes in CSS:', uniqueClasses.length);

let usedCount = 0;
let unusedCount = 0;
for (const cls of uniqueClasses) {
  // unescape class name for html lookup
  const unescaped = cls.replace(/\\/g, '');
  if (html.includes(unescaped)) {
    usedCount++;
  } else {
    unusedCount++;
  }
}

console.log(`Used classes in dist/index.html: ${usedCount} (${Math.round((usedCount / uniqueClasses.length) * 100)}%)`);
console.log(`Unused classes in dist/index.html: ${unusedCount} (${Math.round((unusedCount / uniqueClasses.length) * 100)}%)`);
