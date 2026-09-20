const fs = require('fs');
const path = require('path');
const files = ['AboutVibe.tsx', 'Footer.tsx', 'ScrollSequence.tsx'];
files.forEach(f => {
  const p = path.join('src', 'components', f);
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    content = content.replace(/classname=/g, 'className=');
    content = content.replace(/classname\b/g, 'className=\"\"');
    content = content.replace(/onClick=\"this\.dataset\.playing[\s\S]*?\"/g, '');
    fs.writeFileSync(p, content);
  }
});
console.log("Fixed classnames.");
