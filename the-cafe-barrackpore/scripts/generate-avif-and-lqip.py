#!/usr/bin/env python3
"""
Automated Build-Time AVIF & BlurHash / LQIP Pipeline
The Café Barrackpore — 100% Pure Code, $0.00 Running Cost
Generates next-gen .avif image variants and micro-blur base64 LQIPs for zero-CLS instantaneous loads.
"""

import os
import io
import sys
import json
import base64
from PIL import Image, ImageFilter

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC_IMAGES_DIR = os.path.join(BASE_DIR, 'public', 'images')
OUTPUT_MANIFEST = os.path.join(BASE_DIR, 'public', 'lqip-manifest.json')

SUPPORTED_EXTS = ('.jpg', '.jpeg', '.png', '.webp')
AVIF_QUALITY = 65
LQIP_WIDTH = 24

def generate_lqip_base64(img: Image.Image) -> str:
    """Generates an ultra-small base64 WebP data URI placeholder."""
    thumb = img.copy()
    thumb.thumbnail((LQIP_WIDTH, LQIP_WIDTH), Image.Resampling.BOX)
    thumb = thumb.filter(ImageFilter.GaussianBlur(radius=1.5))
    
    buffer = io.BytesIO()
    thumb.save(buffer, format='WEBP', quality=25)
    raw_bytes = buffer.getvalue()
    b64_str = base64.b64encode(raw_bytes).decode('utf-8')
    return f"data:image/webp;base64,{b64_str}"

def process_all_images():
    print("=" * 60)
    print("[START] AUTOMATED BUILD-TIME AVIF & LQIP PIPELINE")
    print("=" * 60)

    manifest = {}
    total_images_processed = 0
    total_avif_created = 0
    total_original_bytes = 0
    total_avif_bytes = 0

    for root, _, files in os.walk(PUBLIC_IMAGES_DIR):
        for file in sorted(files):
            ext = os.path.splitext(file)[1].lower()
            if ext not in SUPPORTED_EXTS:
                continue

            # Don't re-process if it's already an AVIF or highres source we already have a webp for
            base_name = os.path.splitext(file)[0]
            src_path = os.path.join(root, file)
            rel_path = os.path.relpath(src_path, os.path.join(BASE_DIR, 'public')).replace('\\', '/')

            # Target avif path
            avif_filename = f"{base_name}.avif"
            avif_path = os.path.join(root, avif_filename)
            rel_avif_path = os.path.relpath(avif_path, os.path.join(BASE_DIR, 'public')).replace('\\', '/')

            try:
                with Image.open(src_path) as img:
                    img_rgb = img.convert('RGB')
                    orig_w, orig_h = img.size
                    orig_size = os.path.getsize(src_path)
                    total_original_bytes += orig_size

                    # Generate AVIF if not already newer than source
                    needs_avif = not os.path.exists(avif_path) or os.path.getmtime(src_path) > os.path.getmtime(avif_path)
                    if needs_avif:
                        img_rgb.save(avif_path, format='AVIF', quality=AVIF_QUALITY)
                        total_avif_created += 1

                    avif_size = os.path.getsize(avif_path)
                    total_avif_bytes += avif_size

                    # Generate LQIP micro-placeholder
                    lqip_str = generate_lqip_base64(img_rgb)

                    manifest[f"/{rel_path}"] = {
                        "avif": f"/{rel_avif_path}",
                        "webp": f"/{rel_path}" if ext == '.webp' else None,
                        "width": orig_w,
                        "height": orig_h,
                        "lqip": lqip_str
                    }

                    total_images_processed += 1
                    savings_pct = ((orig_size - avif_size) / orig_size) * 100 if orig_size > avif_size else 0
                    print(f"[OK] [{total_images_processed}] {rel_path} -> {rel_avif_path} ({orig_size // 1024}KB -> {avif_size // 1024}KB, -{savings_pct:.0f}%)")

            except Exception as e:
                print(f"[WARN] Skipping {file}: {e}")

    # Write manifest
    with open(OUTPUT_MANIFEST, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)

    total_saved = max(0, total_original_bytes - total_avif_bytes)
    print("\n" + "=" * 60)
    print(f"[DONE] PIPELINE COMPLETE!")
    print(f"* Images Processed: {total_images_processed}")
    print(f"* AVIF Files Created / Verified: {total_avif_created}")
    print(f"* Total Original Payload: {total_original_bytes // 1024} KB")
    print(f"* Total AVIF Payload: {total_avif_bytes // 1024} KB")
    print(f"* Bandwidth Reduction: {total_saved // 1024} KB ({(total_saved / total_original_bytes * 100) if total_original_bytes else 0:.1f}% savings)")
    print(f"* Output Manifest: {OUTPUT_MANIFEST}")
    print("=" * 60 + "\n")

if __name__ == '__main__':
    process_all_images()
