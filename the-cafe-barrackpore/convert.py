import re

with open('../code.html', 'r', encoding='utf-8') as f:
    html = f.read()

body_match = re.search(r'<body[^>]*>(.*?)</body>', html, re.DOTALL | re.IGNORECASE)
if not body_match:
    print('Could not find body')
    exit(1)

content = body_match.group(1)

content = content.replace('class="', 'className="')
content = content.replace('onclick="', 'onClick="')
content = content.replace('for="', 'htmlFor="')
content = content.replace('<!--', '{/*')
content = content.replace('-->', '*/}')

# JSX inline onclick with string replacement is tricky because it has JS code inside strings
# Let's just remove the raw onclick since it's a React app, or we can replace it with a dummy
content = re.sub(r'onClick="[^"]+"', 'onClick={() => {}}', content)

content = re.sub(r'<img([^>]*?)(?<!/)>', r'<img\1 />', content)
content = re.sub(r'<input([^>]*?)(?<!/)>', r'<input\1 />', content)
content = re.sub(r'<br([^>]*?)(?<!/)>', r'<br\1 />', content)
content = re.sub(r'<hr([^>]*?)(?<!/)>', r'<hr\1 />', content)

content = content.replace('style="font-variation-settings: \'FILL\' 1;"', 'style={{ fontVariationSettings: "\'FILL\' 1" }}')
content = content.replace('style="opacity: 0;"', 'style={{ opacity: 0 }}')

app_tsx = f"""import React from 'react';

function App() {{
  return (
    <div className="bg-background font-body-md text-on-surface antialiased selection:bg-primary-container selection:text-on-primary-container">
      {content}
    </div>
  );
}}

export default App;
"""

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(app_tsx)

print('App.tsx created')
