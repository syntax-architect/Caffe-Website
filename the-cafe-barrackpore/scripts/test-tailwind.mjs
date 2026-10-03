import tailwind from 'tailwindcss';
import fs from 'fs';

const pkg = JSON.parse(fs.readFileSync('node_modules/tailwindcss/package.json', 'utf8'));
console.log('Tailwind version:', pkg.version);
