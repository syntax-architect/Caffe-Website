import os
import re
import sys
import subprocess
import shutil
from fontTools.ttLib import TTFont

REPO_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PUBLIC_FONTS_DIR = os.path.join(REPO_DIR, 'public', 'fonts')
ORIGINAL_FONT = os.path.join(PUBLIC_FONTS_DIR, 'material-symbols-outlined.woff2')
BACKUP_FONT = os.path.join(PUBLIC_FONTS_DIR, 'material-symbols-outlined.original.woff2')
SUBSET_FONT = os.path.join(PUBLIC_FONTS_DIR, 'material-symbols-outlined.woff2')
DIST_FONT = os.path.join(REPO_DIR, 'dist', 'fonts', 'material-symbols-outlined.woff2')

FOUNDATIONAL_ICONS = {
    'add', 'remove', 'close', 'menu', 'search', 'check', 'check_circle', 'cancel',
    'delete', 'edit', 'save', 'refresh', 'sync', 'sync_alt', 'home', 'arrow_back',
    'arrow_forward', 'arrow_upward', 'arrow_downward', 'chevron_left', 'chevron_right',
    'chevron_down', 'chevron_up', 'expand_more', 'expand_less', 'shopping_bag',
    'shopping_cart', 'restaurant', 'restaurant_menu', 'local_cafe', 'coffee', 'local_bar',
    'local_drink', 'wine_bar', 'liquor', 'room_service', 'room_service_sharp', 'fastfood',
    'lunch_dining', 'dinner_dining', 'cake', 'bakery_dining', 'table_restaurant', 'table_bar',
    'countertops', 'kitchen', 'skillet', 'soup_kitchen', 'point_of_sale', 'credit_card',
    'payments', 'receipt', 'receipt_long', 'print', 'qr_code', 'qr_code_scanner',
    'timer', 'schedule', 'hourglass_empty', 'hourglass_top', 'hourglass_bottom',
    'notifications', 'notifications_active', 'notifications_off', 'call', 'chat', 'mail',
    'event', 'event_available', 'event_busy', 'calendar_today', 'groups', 'people', 'person',
    'person_add', 'person_outline', 'verified', 'verified_user', 'shield', 'shield_locked',
    'lock', 'lock_open', 'key', 'warning', 'error', 'error_outline', 'info', 'info_outline',
    'help', 'help_outline', 'support_agent', 'security', 'visibility', 'visibility_off',
    'star', 'star_border', 'star_half', 'stars', 'favorite', 'favorite_border',
    'local_fire_department', 'sparkles', 'swipe', 'pan_tool', 'touch_app', 'filter_alt',
    'sort', 'history', 'badge', 'badge_sharp', 'login', 'logout', 'download', 'upload',
    'cloud_off', 'cloud_done', 'wifi', 'wifi_off', 'pause', 'play_arrow', 'pause_circle',
    'play_circle', 'content_copy', 'fullscreen', 'fullscreen_exit', 'more_vert', 'more_horiz',
    'tune', 'settings', 'insights', 'analytics', 'trending_up', 'inventory', 'inventory_2',
    'progress_activity', 'currency_rupee', 'attach_money', 'explore', 'map', 'near_me',
    'location_on', 'place', 'done', 'done_all', 'thumb_up', 'thumb_down', 'share',
    'open_in_new', 'launch', 'dark_mode', 'light_mode', 'wb_sunny', 'nightlight'
}

def scan_codebase_icons():
    found = set()
    span_regex = re.compile(r'material-symbols[^\"]*\"[^>]*>([a-z0-9_]+)<', re.IGNORECASE)
    prop_regex = re.compile(r'\b(?:icon|iconName)\s*:\s*[\'\"]([a-z0-9_]+)[\'\"]')
    quote_regex = re.compile(r'[\'\"]([a-z0-9_]{3,30})[\'\"]')

    for root, dirs, files in os.walk(os.path.join(REPO_DIR, 'src')):
        for f in files:
            if f.endswith(('.tsx', '.ts', '.jsx', '.js', '.html')):
                path = os.path.join(root, f)
                with open(path, 'r', encoding='utf-8', errors='ignore') as fp:
                    content = fp.read()
                    for m in span_regex.finditer(content):
                        name = m.group(1).strip()
                        if name:
                            found.add(name.lower())
                    for m in prop_regex.finditer(content):
                        name = m.group(1).strip()
                        if name:
                            found.add(name.lower())
                    if 'material-symbols' in content:
                        for m in quote_regex.finditer(content):
                            w = m.group(1).strip().lower()
                            if w in FOUNDATIONAL_ICONS:
                                found.add(w)
    return found

def main():
    print('=== MATERIAL SYMBOLS PRECISION SUBSETTING PIPELINE ===\n')

    # Backup original font if not already present
    if not os.path.exists(BACKUP_FONT):
        if os.path.exists(ORIGINAL_FONT) and os.path.getsize(ORIGINAL_FONT) > 1_000_000:
            print(f'Backing up original 3.9MB font to {BACKUP_FONT}...')
            shutil.copy2(ORIGINAL_FONT, BACKUP_FONT)
        else:
            print('Error: Original font backup not found and current font is not full size.')
            sys.exit(1)

    source_font_path = BACKUP_FONT
    orig_size = os.path.getsize(source_font_path)
    print(f'Original Full Font Size: {orig_size / (1024*1024):.2f} MB ({orig_size:,} bytes)')

    # Scan icons
    scanned_icons = scan_codebase_icons()
    all_target_icons = set(FOUNDATIONAL_ICONS).union(scanned_icons)
    print(f'Targeting {len(all_target_icons)} icon ligatures ({len(scanned_icons)} scanned + {len(FOUNDATIONAL_ICONS)} foundational).')

    # Load original font
    font = TTFont(source_font_path)
    cmap = font.getBestCmap()
    rev_cmap = {g: chr(cp) for cp, g in cmap.items()}

    # Extract all ligatures from GSUB
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
                    # Check if word matches our icons or if LigGlyph matches
                    if word in all_target_icons or lig.LigGlyph in all_target_icons:
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

    print(f'Retained {kept_ligatures} active ligatures mapping to {len(target_lig_glyphs)} unique icon glyphs.')

    # Drop variable font tables (eliminating the ~9.3 MB uncompressed / ~3 MB compressed gvar bloat)
    for tag in ['gvar', 'fvar', 'avar', 'HVAR', 'STAT']:
        if tag in font:
            del font[tag]

    temp_pruned_ttf = os.path.join(PUBLIC_FONTS_DIR, 'material-symbols-pruned.tmp.ttf')
    font.save(temp_pruned_ttf)

    # Base ASCII glyphs (space, letters, digits, punctuation)
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

    print('Running fontTools.subset with optimized glyph set...')
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print('fontTools.subset failed:')
        print(res.stderr)
        if os.path.exists(temp_pruned_ttf):
            os.remove(temp_pruned_ttf)
        sys.exit(res.returncode)

    # Clean up temp ttf
    if os.path.exists(temp_pruned_ttf):
        os.remove(temp_pruned_ttf)

    new_size = os.path.getsize(temp_output_woff2)
    pct_reduction = (1 - (new_size / orig_size)) * 100

    print('\n[OK] Material Symbols Font Successfully Subsetted!')
    print(f'Before: {orig_size / (1024*1024):.2f} MB ({orig_size:,} bytes)')
    print(f'After:  {new_size / 1024:.2f} KB ({new_size:,} bytes)')
    print(f'Savings: {orig_size - new_size:,} bytes ({pct_reduction:.1f}% reduction!)')

    # Install to public/fonts/
    shutil.move(temp_output_woff2, SUBSET_FONT)
    print(f'Saved optimized font to {SUBSET_FONT}')

    # Also sync to dist/fonts if dist exists
    dist_fonts_dir = os.path.dirname(DIST_FONT)
    if os.path.exists(dist_fonts_dir):
        shutil.copy2(SUBSET_FONT, DIST_FONT)
        print(f'Synced to {DIST_FONT}')

    # Clean up any test artifacts
    for cleanup_f in ['pruned-temp.ttf', 'test-subset.woff2', 'test-static-subset.woff2', 'test-instantiated.woff2', 'pruned-subset.woff2']:
        p = os.path.join(PUBLIC_FONTS_DIR, cleanup_f)
        if os.path.exists(p):
            os.remove(p)

if __name__ == '__main__':
    main()
