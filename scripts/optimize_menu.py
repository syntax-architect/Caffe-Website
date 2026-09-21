import re
import os
import urllib.request
from urllib.parse import urlparse
from PIL import Image
import io

os.makedirs('the-cafe-barrackpore/public/images/menu', exist_ok=True)

with open('the-cafe-barrackpore/src/data/menu.ts', 'r', encoding='utf-8') as f:
    content = f.read()

urls = re.findall(r'https://lh3.googleusercontent.com/[^\'"]+', content)
url_to_local = {}

for idx, src in enumerate(set(urls)):
    print(f"Downloading {idx}...")
    try:
        req = urllib.request.Request(src, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            img_data = response.read()
            
        img = Image.open(io.BytesIO(img_data))
        
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
            
        max_width = 800
        if img.width > max_width:
            ratio = max_width / img.width
            new_size = (max_width, int(img.height * ratio))
            img = img.resize(new_size, Image.Resampling.LANCZOS)
            
        local_filename = f"menu_img_{idx}.webp"
        local_path = os.path.join('the-cafe-barrackpore/public/images/menu', local_filename)
        
        img.save(local_path, 'WEBP', quality=80)
        url_to_local[src] = f"/images/menu/{local_filename}"
        print(f"Saved {local_path}")
    except Exception as e:
        print(f"Error downloading {src}: {e}")

new_content = content
for src, local in url_to_local.items():
    new_content = new_content.replace(src, local)

with open('the-cafe-barrackpore/src/data/menu.ts', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Done optimizing menu images!")
