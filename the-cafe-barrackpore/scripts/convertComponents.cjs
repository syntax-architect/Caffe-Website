const HTMLtoJSX = require('htmltojsx');
const fs = require('fs');
const converter = new HTMLtoJSX({ createClass: false });

const convertAndWrite = (inName, outName, componentName) => {
  if (fs.existsSync(inName)) {
    let html = fs.readFileSync(inName, 'utf8');
    
    // Some manual fixes before conversion
    html = html.replace(/class=/g, 'className=');
    html = html.replace(/for=/g, 'htmlFor=');
    html = html.replace(/onclick=/g, 'onClick=');
    
    let jsx = converter.convert(html);
    
    let tsx = `import React from 'react';\n\nexport const ${componentName}: React.FC = () => {\n  return (\n    <>\n      ${jsx}\n    </>\n  );\n};\n`;
    fs.writeFileSync(outName, tsx);
    console.log('Created ' + outName);
  }
}

convertAndWrite('about.html', 'src/components/AboutVibe.tsx', 'AboutVibe');
convertAndWrite('specials.html', 'src/components/SpecialsBanner.tsx', 'SpecialsBanner');
convertAndWrite('reserve.html', 'src/components/ReserveSection.tsx', 'ReserveSection');
convertAndWrite('footer.html', 'src/components/Footer.tsx', 'Footer');
