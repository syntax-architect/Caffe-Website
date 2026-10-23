import os
import sys
from PIL import Image
try:
    import pillow_heif
    pillow_heif.register_heif_opener()
except ImportError:
    pass

REPO_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PUBLIC_IMAGES = os.path.join(REPO_DIR, 'public', 'images')

TARGET_SETS = [
    # Hero images
    {
        'base': os.path.join(PUBLIC_IMAGES, 'hero-cinematic.jpg'),
        'out_dir': PUBLIC_IMAGES,
        'out_prefix': 'hero-cinematic',
        'widths': [480, 800, 1200],
        'max_master_w': 1440,
    },
    {
        'base': os.path.join(PUBLIC_IMAGES, 'hero-bar.webp'),
        'out_dir': PUBLIC_IMAGES,
        'out_prefix': 'hero-bar',
        'widths': [480, 800, 1200],
        'max_master_w': 1440,
    },
    {
        'base': os.path.join(PUBLIC_IMAGES, 'hero-bar-mobile.webp'),
        'out_dir': PUBLIC_IMAGES,
        'out_prefix': 'hero-bar-mobile',
        'widths': [360, 480, 720],
        'max_master_w': 768,
    },
    # Platter images
    {
        'base': os.path.join(PUBLIC_IMAGES, 'platters', 'platter-tandoori.jpg'),
        'out_dir': os.path.join(PUBLIC_IMAGES, 'platters'),
        'out_prefix': 'platter-tandoori',
        'widths': [480, 800],
        'max_master_w': 960,
    },
    {
        'base': os.path.join(PUBLIC_IMAGES, 'platters', 'platter-chinese.webp'),
        'out_dir': os.path.join(PUBLIC_IMAGES, 'platters'),
        'out_prefix': 'platter-chinese',
        'widths': [480, 800],
        'max_master_w': 960,
    },
    {
        'base': os.path.join(PUBLIC_IMAGES, 'platters', 'platter-bowl.jpg'),
        'out_dir': os.path.join(PUBLIC_IMAGES, 'platters'),
        'out_prefix': 'platter-bowl',
        'widths': [480, 800],
        'max_master_w': 960,
    },
]

def optimize_and_generate_responsive():
    print('=== OPTIMIZING LARGE HERO & PLATTER IMAGES (AVIF/WebP) ===\n')

    total_orig_bytes = 0
    total_opt_bytes = 0

    for item in TARGET_SETS:
        src = item['base']
        if not os.path.exists(src):
            print(f'Skipping missing: {src}')
            continue

        orig_sz = os.path.getsize(src)
        total_orig_bytes += orig_sz
        out_dir = item['out_dir']
        prefix = item['out_prefix']

        with Image.open(src) as img:
            img = img.convert('RGB')
            orig_w, orig_h = img.size
            aspect = orig_h / orig_w

            print(f'Processing {prefix}: Original {orig_w}x{orig_h} ({orig_sz / 1024:.1f} KB)')

            # 1. Compress master if oversized
            master_w = min(orig_w, item['max_master_w'])
            master_h = int(master_w * aspect)
            master_img = img.resize((master_w, master_h), Image.Resampling.LANCZOS) if master_w < orig_w else img

            # Master AVIF & WebP
            master_avif = os.path.join(out_dir, f'{prefix}.avif')
            master_webp = os.path.join(out_dir, f'{prefix}.webp')
            master_jpg = os.path.join(out_dir, f'{prefix}.jpg')

            master_img.save(master_avif, format='AVIF', quality=65)
            master_img.save(master_webp, format='WEBP', quality=78)
            if src.endswith('.jpg'):
                master_img.save(master_jpg, format='JPEG', quality=82, optimize=True)

            print(f'  -> Master AVIF: {os.path.getsize(master_avif) / 1024:.1f} KB')
            print(f'  -> Master WebP: {os.path.getsize(master_webp) / 1024:.1f} KB')

            # 2. Generate responsive sizes
            for w in item['widths']:
                if w >= orig_w and w >= master_w:
                    continue
                h = int(w * aspect)
                resized = img.resize((w, h), Image.Resampling.LANCZOS)

                resp_avif = os.path.join(out_dir, f'{prefix}-{w}w.avif')
                resp_webp = os.path.join(out_dir, f'{prefix}-{w}w.webp')

                resized.save(resp_avif, format='AVIF', quality=65)
                resized.save(resp_webp, format='WEBP', quality=75)

                avif_sz = os.path.getsize(resp_avif)
                webp_sz = os.path.getsize(resp_webp)
                print(f'  -> Responsive {w}w: AVIF={avif_sz/1024:.1f} KB, WebP={webp_sz/1024:.1f} KB')

        print()

    print('[OK] Responsive Image Generation & Compression Complete!\n')

if __name__ == '__main__':
    optimize_and_generate_responsive()
