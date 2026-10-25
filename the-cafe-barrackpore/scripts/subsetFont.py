import os
import re
import sys
import subprocess
import shutil

try:
    from fontTools.ttLib import TTFont
    HAS_FONTTOOLS = True
except ImportError:
    HAS_FONTTOOLS = False

REPO_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PUBLIC_FONTS_DIR = os.path.join(REPO_DIR, 'public', 'fonts')
ORIGINAL_FONT = os.path.join(REPO_DIR, 'scripts', 'material-symbols-original.woff2')
SUBSET_FONT = os.path.join(PUBLIC_FONTS_DIR, 'material-symbols-outlined.woff2')
DIST_FONT = os.path.join(REPO_DIR, 'dist', 'fonts', 'material-symbols-outlined.woff2')

# Mandatory fixed category picker list for DB & dynamic category selection
CATEGORY_PICKER_ICONS = {
    'restaurant_menu', 'restaurant', 'local_pizza', 'ramen_dining', 'skillet',
    'local_cafe', 'soup_kitchen', 'bakery_dining', 'fastfood', 'lunch_dining',
    'dinner_dining', 'cake', 'icecream', 'local_bar', 'wine_bar', 'liquor',
    'local_drink', 'emoji_food_beverage', 'set_meal', 'takeout_dining',
    'kebab_dining', 'bento', 'tapas', 'egg', 'breakfast_dining', 'brunch_dining',
    'flatware', 'table_restaurant', 'sports_bar', 'coffee'
}

# Explicitly verified known broken / required icons
KNOWN_CRITICAL_ICONS = {
    'south', 'local_pizza', 'ramen_dining', 'speed', 'volume_off',
    'view_compact', 'arrow_drop_down', 'unsubscribe', 'expand_more',
    'expand_less', 'calendar_today', 'calendar_month', 'event', 'event_seat'
}

def ensure_original_font():
    """Ensure the full 3.9MB unpruned master font is available as subsetting source."""
    if os.path.exists(ORIGINAL_FONT) and os.path.getsize(ORIGINAL_FONT) > 3_000_000:
        return ORIGINAL_FONT

    # Check public or dist original font
    candidates = [
        os.path.join(PUBLIC_FONTS_DIR, 'material-symbols-outlined.original.woff2'),
        os.path.join(REPO_DIR, 'dist', 'fonts', 'material-symbols-outlined.original.woff2')
    ]
    for cand in candidates:
        if os.path.exists(cand) and os.path.getsize(cand) > 3_000_000:
            shutil.copy2(cand, ORIGINAL_FONT)
            return ORIGINAL_FONT

    print(f"Extracting pristine original master font into {ORIGINAL_FONT}...")
    cmd = ['git', 'cat-file', '-p', '4f2084c:the-cafe-barrackpore/public/fonts/material-symbols-outlined.woff2']
    try:
        res = subprocess.run(cmd, cwd=REPO_DIR, capture_output=True)
        if res.returncode == 0 and len(res.stdout) > 3_000_000:
            with open(ORIGINAL_FONT, 'wb') as f:
                f.write(res.stdout)
            print(f"Master font ready ({len(res.stdout):,} bytes).")
            return ORIGINAL_FONT
    except Exception as e:
        print(f"Git extraction failed: {e}")

    # Fallback to checking public/fonts if it happens to be > 3MB
    if os.path.exists(SUBSET_FONT) and os.path.getsize(SUBSET_FONT) > 3_000_000:
        shutil.copy2(SUBSET_FONT, ORIGINAL_FONT)
        return ORIGINAL_FONT

    raise RuntimeError("Cannot locate or extract master 3.9MB font for subsetting.")

def extract_original_ligatures(font_path):
    """Parse GSUB table to map all ligature words to their components and glyphs."""
    font = TTFont(font_path)
    cmap = font.getBestCmap()
    rev_cmap = {g: chr(cp) for cp, g in cmap.items()}
    gsub = font['GSUB'].table

    all_ligatures = {}
    for st in gsub.LookupList.Lookup[0].SubTable:
        sub = st.ExtSubTable if hasattr(st, 'ExtSubTable') else st
        if hasattr(sub, 'ligatures'):
            for first_g, l_list in sub.ligatures.items():
                first_char = rev_cmap.get(first_g, first_g).lower()
                for lig in l_list:
                    comp_chars = [rev_cmap.get(c, c).lower() for c in lig.Component]
                    word = (first_char + ''.join(comp_chars)).strip()
                    all_ligatures[word] = lig
    return font, cmap, rev_cmap, all_ligatures

def scan_all_tokens_in_codebase(available_ligatures):
    """
    Exhaustively scans EVERY quoted token, ternary result, object value, array element,
    seed data, and JSX element across src/, supabase/, and public/.
    Keeps any token that exists as a glyph/ligature name in the original font.
    """
    matched = set()

    # Regex capturing single/double/backtick strings, object property values, and JSX content
    token_pattern = re.compile(
        r"""(?:['"`])([a-zA-Z0-9_-]+)(?:['"`])|"""
        r"""(?:icon|iconName)\s*:\s*['"`]([a-zA-Z0-9_-]+)['"`]|"""
        r""">\s*([a-zA-Z0-9_-]+)\s*<"""
    )

    scan_roots = [
        os.path.join(REPO_DIR, 'src'),
        os.path.join(REPO_DIR, 'supabase'),
        os.path.join(REPO_DIR, 'public'),
    ]

    total_scanned_files = 0
    for root_dir in scan_roots:
        for dirpath, _, filenames in os.walk(root_dir):
            for filename in filenames:
                if filename.endswith(('.tsx', '.ts', '.jsx', '.js', '.sql', '.json', '.html')):
                    filepath = os.path.join(dirpath, filename)
                    total_scanned_files += 1
                    try:
                        with open(filepath, 'r', encoding='utf-8', errors='ignore') as fp:
                            content = fp.read()
                            for match in token_pattern.finditer(content):
                                for group_val in match.groups():
                                    if group_val:
                                        token = group_val.strip().lower()
                                        if token in available_ligatures:
                                            matched.add(token)
                    except Exception:
                        pass

    print(f"Scanned {total_scanned_files} files across src, supabase, public.")
    return matched

def main():
    print("=== HIGH-PRECISION MATERIAL SYMBOLS FONT SUBSET PIPELINE ===\n")

    global HAS_FONTTOOLS
    if not HAS_FONTTOOLS:
        if os.path.exists(SUBSET_FONT) and 10_000 < os.path.getsize(SUBSET_FONT) < 500_000:
            print("[INFO] fontTools is not installed in this environment (e.g. Render/CI).")
            print(f"[OK] Using pre-compiled high-performance Material Symbols subset font ({os.path.getsize(SUBSET_FONT):,} bytes).")
            dist_fonts_dir = os.path.dirname(DIST_FONT)
            if os.path.exists(dist_fonts_dir):
                shutil.copy2(SUBSET_FONT, DIST_FONT)
                print(f"Synced subset font to {DIST_FONT}")
            sys.exit(0)
        else:
            print("[WARN] fontTools not found and no valid pre-compiled subset font found. Attempting pip install...")
            try:
                res = subprocess.run([sys.executable, '-m', 'pip', 'install', '--quiet', 'fonttools', 'brotli'], capture_output=True)
                if res.returncode == 0:
                    from fontTools.ttLib import TTFont
                    HAS_FONTTOOLS = True
            except Exception:
                pass
            if not HAS_FONTTOOLS:
                print("ERROR: fontTools is required to build font from scratch but could not be installed.")
                sys.exit(1)

    master_font_path = ensure_original_font()
    orig_size = os.path.getsize(master_font_path)
    print(f"Source Font Size: {orig_size / (1024*1024):.2f} MB ({orig_size:,} bytes)")

    font, cmap, rev_cmap, all_ligatures = extract_original_ligatures(master_font_path)
    print(f"Original Master Font contains {len(all_ligatures):,} ligatures.")

    # 1. Scan codebase for all tokens that match ligatures
    scanned_tokens = scan_all_tokens_in_codebase(all_ligatures)

    # 2. Add category picker list & known required icons
    target_icons = scanned_tokens.union(CATEGORY_PICKER_ICONS).union(KNOWN_CRITICAL_ICONS)
    print(f"Targeting {len(target_icons)} icon ligatures ({len(scanned_tokens)} discovered + category picker + critical).")

    # Verify known broken icons are present
    for critical_icon in KNOWN_CRITICAL_ICONS:
        if critical_icon not in target_icons:
            print(f"WARNING: Critical icon '{critical_icon}' not detected! Adding explicitly.")
            target_icons.add(critical_icon)

    # 3. Filter GSUB subtable ligatures
    gsub = font['GSUB'].table
    kept_ligatures = 0
    target_lig_glyphs = set()

    for st in gsub.LookupList.Lookup[0].SubTable:
        sub = st.ExtSubTable if hasattr(st, 'ExtSubTable') else st
        if hasattr(sub, 'ligatures'):
            new_ligs = {}
            for first_g, l_list in sub.ligatures.items():
                first_char = rev_cmap.get(first_g, first_g).lower()
                filtered = []
                for lig in l_list:
                    comp_chars = [rev_cmap.get(c, c).lower() for c in lig.Component]
                    word = (first_char + ''.join(comp_chars)).strip()
                    if word in target_icons or lig.LigGlyph in target_icons:
                        filtered.append(lig)
                        target_lig_glyphs.add(lig.LigGlyph)
                        kept_ligatures += 1
                if filtered:
                    new_ligs[first_g] = filtered
            sub.ligatures = new_ligs

    # Keep only subtables with ligatures
    gsub.LookupList.Lookup[0].SubTable = [
        st for st in gsub.LookupList.Lookup[0].SubTable
        if (hasattr(st, 'ExtSubTable') and getattr(st.ExtSubTable, 'ligatures', None))
        or (hasattr(st, 'ligatures') and st.ligatures)
    ]

    print(f"Retained {kept_ligatures} active ligatures mapping to {len(target_lig_glyphs)} unique icon glyphs.")

    # 4. Drop variable font tables (gvar is ~9.3 MB uncompressed / ~3 MB compressed bloat)
    for tag in ['gvar', 'fvar', 'avar', 'HVAR', 'STAT']:
        if tag in font:
            del font[tag]

    temp_pruned_ttf = os.path.join(PUBLIC_FONTS_DIR, 'material-symbols-pruned.tmp.ttf')
    font.save(temp_pruned_ttf)

    # Base ASCII glyphs (space, letters, digits, punctuation for ligature typing)
    ascii_glyphs = {gname for cp, gname in cmap.items() if 32 <= cp <= 126}
    ascii_glyphs.add('.notdef')

    all_glyphs_to_keep = sorted(list(ascii_glyphs.union(target_lig_glyphs)))
    glyphs_arg = ','.join(all_glyphs_to_keep)

    temp_output_woff2 = os.path.join(PUBLIC_FONTS_DIR, 'material-symbols-subset.tmp.woff2')

    cmd = [
        sys.executable,
        '-m', 'fontTools.subset',
        temp_pruned_ttf,
        f'--glyphs={glyphs_arg}',
        '--layout-features=*',
        '--flavor=woff2',
        f'--output-file={temp_output_woff2}',
        '--name-IDs=*',
        '--glyph-names'
    ]

    print("Executing fontTools.subset optimization...")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print("fontTools.subset failed:")
        print(res.stderr)
        if os.path.exists(temp_pruned_ttf):
            os.remove(temp_pruned_ttf)
        sys.exit(res.returncode)

    if os.path.exists(temp_pruned_ttf):
        os.remove(temp_pruned_ttf)

    new_size = os.path.getsize(temp_output_woff2)
    pct_reduction = (1 - (new_size / orig_size)) * 100

    # Safety check: NEVER ship full 3.9 MB font
    if new_size > 500_000:
        print(f"ERROR: Subset font size ({new_size:,} bytes) exceeds 500 KB limit!")
        sys.exit(1)

    print("\n[OK] Material Symbols Font Subsetting Complete!")
    print(f"Master Size:   {orig_size / (1024*1024):.2f} MB ({orig_size:,} bytes)")
    print(f"Subset Size:   {new_size / 1024:.2f} KB ({new_size:,} bytes)")
    print(f"Payload Saved: {orig_size - new_size:,} bytes ({pct_reduction:.1f}% reduction)")

    os.makedirs(PUBLIC_FONTS_DIR, exist_ok=True)
    # On Windows, os.rename/shutil.move can fail with WinError 1224 if Vite dev server holds a mapped section.
    # Reading bytes and writing directly safely overwrites in-place.
    with open(temp_output_woff2, 'rb') as f_src:
        font_bytes = f_src.read()
    with open(SUBSET_FONT, 'wb') as f_dst:
        f_dst.write(font_bytes)
    if os.path.exists(temp_output_woff2):
        os.remove(temp_output_woff2)
    print(f"Installed subset font to {SUBSET_FONT}")

    # Also sync to dist/fonts if dist exists
    dist_fonts_dir = os.path.dirname(DIST_FONT)
    if os.path.exists(dist_fonts_dir):
        shutil.copy2(SUBSET_FONT, DIST_FONT)
        print(f"Synced subset font to {DIST_FONT}")

    # Clean up testSubsetScan.py
    test_scan = os.path.join(REPO_DIR, 'scripts', 'testSubsetScan.py')
    if os.path.exists(test_scan):
        os.remove(test_scan)

if __name__ == '__main__':
    main()
