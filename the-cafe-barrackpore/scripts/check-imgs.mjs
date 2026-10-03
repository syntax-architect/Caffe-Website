import fs from 'fs';
const html = fs.readFileSync('dist/index.html', 'utf8');
const imgs = html.match(/<img[^>]+>/g) || [];
console.log('Total imgs in HTML:', imgs.length);
imgs.forEach((img, i) => {
  const isLazy = img.includes('loading="lazy"');
  const src = (img.match(/src="([^"]+)"/) || [])[1];
  console.log(i, isLazy ? 'LAZY' : 'EAGER', src);
});
