import re
import os
import urllib.request
from urllib.parse import urlparse
from PIL import Image
import io

html_file = 'code.html'
with open(html_file, 'r', encoding='utf-8') as f:
    html = f.read()

os.makedirs('assets/images', exist_ok=True)

# Find all img tags
img_tags = re.findall(r'<img[^>]+>', html)

url_to_local = {}

for idx, tag in enumerate(img_tags):
    # extract src
    src_match = re.search(r'src=["\']([^"\']+)["\']', tag)
    if not src_match:
        continue
    
    src = src_match.group(1)
    
    if not src.startswith('http'):
        continue
        
    if src not in url_to_local:
        print(f"Downloading {idx}...")
        try:
            req = urllib.request.Request(src, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response:
                img_data = response.read()
                
            img = Image.open(io.BytesIO(img_data))
            
            # Convert to RGB if needed (for webp)
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')
                
            # Resize if too large
            max_width = 1200
            if img.width > max_width:
                ratio = max_width / img.width
                new_size = (max_width, int(img.height * ratio))
                img = img.resize(new_size, Image.Resampling.LANCZOS)
                
            local_filename = f"image_{idx}.webp"
            local_path = os.path.join('assets/images', local_filename)
            
            img.save(local_path, 'WEBP', quality=80)
            url_to_local[src] = f"assets/images/{local_filename}"
            print(f"Saved {local_path}")
        except Exception as e:
            print(f"Error downloading {src}: {e}")

# Now replace in html
new_html = html
for idx, tag in enumerate(img_tags):
    src_match = re.search(r'src=["\']([^"\']+)["\']', tag)
    if not src_match:
        continue
    src = src_match.group(1)
    if src in url_to_local:
        local_src = url_to_local[src]
        new_tag = tag.replace(src, local_src)
        
        # Add loading="lazy" if not present
        if 'loading=' not in new_tag:
            # Skip the first image (usually hero) for lazy loading to improve LCP
            if idx > 0:
                new_tag = new_tag.replace('<img ', '<img loading="lazy" ')
            else:
                new_tag = new_tag.replace('<img ', '<img loading="eager" ')
                
        new_html = new_html.replace(tag, new_tag)

with open(html_file, 'w', encoding='utf-8') as f:
    f.write(new_html)
    
print("Done optimizing images!")
