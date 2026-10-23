/**
 * Image Asset & Format Utilities
 * Resolves optimized modern formats (AVIF/WebP) with safe fallback guards for custom uploaded media.
 */

/**
 * Resolves an optional .avif alternative for local bundled assets.
 * If the image is a custom-uploaded URL (e.g. from Supabase Storage, blob, or external CDN),
 * returns null to avoid generating 404 network requests for non-existent .avif files.
 */
export function getAvifSource(src?: string | null): string | null {
  if (!src || typeof src !== 'string') return null;
  // If it's a remote URL (Supabase storage, Cloudinary, http/https) or data URL, no .avif sibling exists
  if (
    src.startsWith('http://') ||
    src.startsWith('https://') ||
    src.startsWith('data:') ||
    src.startsWith('blob:')
  ) {
    return null;
  }
  // Only local bundled images under /images/ or /assets/ have pre-generated .avif counterparts
  if (/\.(webp|jpg|jpeg)$/i.test(src)) {
    return src.replace(/\.(webp|jpg|jpeg)$/i, '.avif');
  }
  return null;
}

/**
 * Returns a responsive srcset string with mobile (480w), tablet (800w), and desktop (1200w) breakpoints.
 */
export function getResponsiveSrcSet(
  src?: string | null,
  format: 'avif' | 'webp' = 'avif'
): string | null {
  if (!src || typeof src !== 'string') return null;
  if (
    src.startsWith('http://') ||
    src.startsWith('https://') ||
    src.startsWith('data:') ||
    src.startsWith('blob:')
  ) {
    return null;
  }

  const match = src.match(/(?:^|\/)(hero-cinematic|hero-bar|hero-bar-mobile|platter-tandoori|platter-chinese|platter-bowl)\.(?:jpe?g|webp|avif)$/i);
  if (!match) {
    const extMatch = src.match(/\.(webp|jpg|jpeg)$/i);
    if (extMatch && format === 'avif') {
      return src.replace(/\.(webp|jpg|jpeg)$/i, '.avif');
    }
    return null;
  }

  const baseName = match[1];
  const dir = src.substring(0, src.lastIndexOf('/'));

  if (baseName === 'hero-bar-mobile') {
    return `${dir}/${baseName}-360w.${format} 360w, ${dir}/${baseName}-480w.${format} 480w, ${dir}/${baseName}.${format} 768w`;
  }

  return `${dir}/${baseName}-480w.${format} 480w, ${dir}/${baseName}-800w.${format} 800w, ${dir}/${baseName}.${format} 1200w`;
}
