import re
import os
import urllib.request
import io
from PIL import Image
import glob

os.makedirs('the-cafe-barrackpore/public/images/components', exist_ok=True)

tsx_files = glob.glob('the-cafe-barrackpore/src/components/**/*.tsx', recursive=True)

url_to_local = {}

for file in tsx_files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find google images
    urls = re.findall(r'https://lh3.googleusercontent.com/[^\'"]+', content)
    for src in set(urls):
        if src not in url_to_local:
            print(f"Downloading {src[:30]}...")
            try:
                req = urllib.request.Request(src, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req) as response:
                    img_data = response.read()
                
                img = Image.open(io.BytesIO(img_data))
                if img.mode in ('RGBA', 'P'):
                    img = img.convert('RGB')
                
                max_width = 1200
                if img.width > max_width:
                    ratio = max_width / img.width
                    new_size = (max_width, int(img.height * ratio))
                    img = img.resize(new_size, Image.Resampling.LANCZOS)
                
                idx = len(url_to_local)
                local_filename = f"comp_img_{idx}.webp"
                local_path = os.path.join('the-cafe-barrackpore/public/images/components', local_filename)
                
                img.save(local_path, 'WEBP', quality=80)
                url_to_local[src] = f"/images/components/{local_filename}"
                print(f"Saved {local_path}")
            except Exception as e:
                print(f"Error downloading {src}: {e}")

for file in tsx_files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    new_content = content
    # Replace URLs
    for src, local in url_to_local.items():
        new_content = new_content.replace(src, local)

    # Add loading="lazy" to all <img tags except inside Hero.tsx (already motion.img without lazy, which is good for LCP)
    if 'Hero.tsx' not in file:
        # replace <img ... with <img loading="lazy" ... if not present
        def add_lazy(match):
            tag = match.group(0)
            if 'loading=' not in tag:
                return tag.replace('<img', '<img loading="lazy"')
            return tag
        
        new_content = re.sub(r'<img\b[^>]*>', add_lazy, new_content)

    if new_content != content:
        with open(file, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {file}")

print("Done optimizing components!")
