const HTMLtoJSX = require('htmltojsx');
const fs = require('fs');
const converter = new HTMLtoJSX({ createClass: false });

let html = fs.readFileSync('src/code-legacy.html', 'utf8');
const match = html.match(/<!-- Scroll Animation Section -->([\s\S]*?)<!-- About \/ The Vibe Section -->/);
if (match) {
  let scrollHtml = match[1];
  scrollHtml = scrollHtml.replace(/class=/g, 'className=');
  scrollHtml = scrollHtml.replace(/for=/g, 'htmlFor=');
  scrollHtml = scrollHtml.replace(/onclick=/g, 'onClick=');
  let jsx = converter.convert(scrollHtml);
  let tsx = `import React from 'react';\n\nexport const ScrollSequence: React.FC = () => {\n  return (\n    <>\n      ${jsx}\n    </>\n  );\n};\n`;
  fs.writeFileSync('src/components/ScrollSequence.tsx', tsx);
  console.log('ScrollSequence created.');
}
