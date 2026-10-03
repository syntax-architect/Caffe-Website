import os
from PIL import Image

image_configs = [
    # Hero & Story
    ('public/images/hero-cinematic.jpg', 'public/images/hero-bar.webp', (1100, 700), 75),
    ('public/images/story-luxury-pour.jpg', 'public/images/story-pour.webp', (1100, 700), 75),
    
    # Gallery
    ('public/images/gallery-beans-highres.jpg', 'public/images/gallery-beans.webp', (800, 600), 75),
    ('public/images/gallery-couple-highres.jpg', 'public/images/gallery-couple.webp', (800, 600), 75),
    ('public/images/gallery-guitar-highres.jpg', 'public/images/gallery-guitar.webp', (800, 600), 75),
    ('public/images/gallery-pizza-highres.jpg', 'public/images/gallery-pizza.webp', (800, 600), 75),
    
    # Components / About Vibe
    ('public/images/components/comp_img_0_highres.jpg', 'public/images/components/comp_img_0.webp', (800, 600), 75),
    ('public/images/components/comp_img_1_highres.jpg', 'public/images/components/comp_img_1.webp', (800, 600), 75),
    ('public/images/components/comp_img_2_highres.jpg', 'public/images/components/comp_img_2.webp', (800, 600), 75),
    ('public/images/components/comp_img_3_highres.jpg', 'public/images/components/comp_img_3.webp', (800, 600), 75),
    
    # Platters / Chef Specials
    ('public/images/platters/platter-chinese-highres.jpg', 'public/images/platters/platter-chinese.webp', (640, 480), 75),
    ('public/images/platters/platter-tandoori-highres.jpg', 'public/images/platters/platter-tandoori.webp', (640, 480), 75),
    ('public/images/platters/platter-bowl-highres.jpg', 'public/images/platters/platter-bowl.webp', (640, 480), 75),
]

print("Starting true WebP image compression...")
total_saved = 0

for src_rel, dst_rel, max_size, quality in image_configs:
    if not os.path.exists(src_rel):
        print(f"Skipping missing: {src_rel}")
        continue
    
    old_size = os.path.getsize(dst_rel) if os.path.exists(dst_rel) else os.path.getsize(src_rel)
    
    with Image.open(src_rel) as img:
        img = img.convert("RGB")
        img.thumbnail(max_size, Image.Resampling.LANCZOS)
        img.save(dst_rel, "WEBP", quality=quality, method=6)
        
    new_size = os.path.getsize(dst_rel)
    saved = old_size - new_size
    total_saved += saved
    print(f"[OK] {dst_rel}: {old_size // 1024} KB -> {new_size // 1024} KB (Saved {saved // 1024} KB)")

print(f"\n[DONE] Total bandwidth saved: {total_saved // 1024} KB ({total_saved / (1024*1024):.2f} MB)!")
