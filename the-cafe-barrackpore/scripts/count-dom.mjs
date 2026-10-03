import fs from 'fs';

const html = fs.readFileSync('dist/index.html', 'utf8');
console.log('HTML length:', html.length);
const tagCount = (html.match(/<[a-z0-9]+/gi) || []).length;
console.log('DOM tags count:', tagCount);
