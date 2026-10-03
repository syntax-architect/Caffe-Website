import { supabase, isSupabaseConfigured } from '../lib/supabase';

const BUCKET_NAME = 'site-images';
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB limit
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const ALLOWED_FOLDERS = ['menu', 'content', 'gallery', 'general'] as const;

type AllowedFolder = typeof ALLOWED_FOLDERS[number];

// Malicious SVG script patterns (XSS prevention)
const SVG_MALICIOUS_PATTERN = /<\s*script\b|on\w+\s*=|javascript\s*:|<\s*foreignObject\b|<\s*iframe\b|<\s*embed\b|<\s*object\b/i;

/**
 * Validates an image file before upload:
 * - Checks mime type
 * - Enforces 5MB size limit
 * - Deep-inspects SVG files for malicious scripts, inline events, or javascript: payloads
 */
export async function validateImageFile(file: File): Promise<{ valid: boolean; error?: string }> {
  if (!file) {
    return { valid: false, error: 'No image file provided.' };
  }

  // 1. File size check
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds the 5 MB limit (file is ${(file.size / (1024 * 1024)).toFixed(2)} MB).`,
    };
  }

  // 2. MIME type check
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Supported formats: JPG, PNG, WebP, GIF, SVG.',
    };
  }

  // 3. SVG active content check (anti-XSS)
  const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
  if (isSvg) {
    try {
      const text = await file.text();
      if (SVG_MALICIOUS_PATTERN.test(text)) {
        return {
          valid: false,
          error: 'Security rejection: SVG file contains embedded scripts or active event handlers, which are strictly prohibited.',
        };
      }
    } catch {
      return {
        valid: false,
        error: 'Unable to safely inspect SVG content. Upload rejected.',
      };
    }
  }

  return { valid: true };
}

/**
 * Uploads a verified image file to Supabase Storage in a restricted bucket path.
 * Enforces staff role authorization and path traversal prevention.
 */
export async function uploadSiteImage(
  file: File,
  folder: AllowedFolder = 'general',
  restaurantId = 'the-cafe-barrackpore'
): Promise<{ success: boolean; url?: string; error?: string }> {
  // 1. Strict File Validation
  const validation = await validateImageFile(file);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // 2. Folder / Path Traversal Guard
  const safeFolder = ALLOWED_FOLDERS.includes(folder) ? folder : 'general';
  const safeRestaurantId = restaurantId.replace(/[^a-zA-Z0-9_\-]/g, '_') || 'the-cafe-barrackpore';

  if (!isSupabaseConfigured || !supabase) {
    // DEV fallback: create temporary object URL
    const isDev = typeof import.meta !== 'undefined' && import.meta.env
      ? Boolean(import.meta.env.DEV)
      : false;

    if (isDev && typeof URL !== 'undefined') {
      const devUrl = URL.createObjectURL(file);
      return { success: true, url: devUrl };
    }

    return { success: false, error: 'Storage service is not configured.' };
  }

  try {
    const rawExtension = file.name.split('.').pop()?.toLowerCase() || 'webp';
    const safeExtension = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(rawExtension)
      ? rawExtension
      : 'webp';

    const baseName = file.name
      .substring(0, file.name.lastIndexOf('.'))
      .replace(/[^a-zA-Z0-9_\-]/g, '_')
      .toLowerCase()
      .substring(0, 40) || 'asset';

    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);

    // Restricted bucket path: staff-uploads/{tenant}/{folder}/{timestamp}_{hash}_{name}.{ext}
    const filePath = `staff-uploads/${safeRestaurantId}/${safeFolder}/${timestamp}_${randomSuffix}_${baseName}.${safeExtension}`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('[storageService] Upload failed:', error.message);
      if (error.message.toLowerCase().includes('row-level security') || error.message.toLowerCase().includes('policy')) {
        return {
          success: false,
          error: 'Access denied: Only active restaurant owners and managers can upload images.',
        };
      }
      return { success: false, error: error.message };
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);

    return { success: true, url: publicUrlData.publicUrl };
  } catch (err: any) {
    console.error('[storageService] Unexpected error uploading image:', err);
    return { success: false, error: err.message || 'Unexpected upload error.' };
  }
}
