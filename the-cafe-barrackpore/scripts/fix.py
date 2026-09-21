import re

with open('../code.html', 'r', encoding='utf-8') as f:
    html = f.read()

body_match = re.search(r'<body[^>]*>(.*?)</body>', html, re.DOTALL | re.IGNORECASE)
if not body_match:
    print('Could not find body')
    exit(1)

content = body_match.group(1)

content = content.replace('class="', 'className="')
content = content.replace('for="', 'htmlFor="')

# Remove any event handlers
content = re.sub(r'\bon[a-z]+="[^"]*"', '', content)
content = re.sub(r'\bon[a-z]+=\'[^\']*\'', '', content)

# Remove all inline styles to prevent JSX errors
content = re.sub(r'\bstyle="[^"]*"', '', content)
content = re.sub(r'\bstyle=\'[^\']*\'', '', content)

# Fix unclosed tags
content = re.sub(r'<img([^>]*?)(?<!/)>', r'<img\1 />', content)
content = re.sub(r'<input([^>]*?)(?<!/)>', r'<input\1 />', content)
content = re.sub(r'<br([^>]*?)(?<!/)>', r'<br\1 />', content)
content = re.sub(r'<hr([^>]*?)(?<!/)>', r'<hr\1 />', content)
content = re.sub(r'<source([^>]*?)(?<!/)>', r'<source\1 />', content)
content = re.sub(r'<meta([^>]*?)(?<!/)>', r'<meta\1 />', content)
content = re.sub(r'<link([^>]*?)(?<!/)>', r'<link\1 />', content)

# Escape unescaped special characters in text nodes, mostly { and } and < and >
# This is tricky with regex, let's remove HTML comments
content = re.sub(r'<!--(.*?)-->', r'{/* \1 */}', content, flags=re.DOTALL)

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
