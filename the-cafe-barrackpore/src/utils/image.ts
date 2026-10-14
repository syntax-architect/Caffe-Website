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
