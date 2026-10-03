import fs from 'fs';

const html = fs.readFileSync('dist/index.html', 'utf8');
const matches = [...html.matchAll(/class="[^"]*font-serif[^"]*"/g)].slice(0, 10);
for (const m of matches) console.log(m[0]);
