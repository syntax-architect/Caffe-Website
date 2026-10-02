import { supabase, isSupabaseConfigured } from '../lib/supabase';

const BUCKET_NAME = 'site-images';

/**
 * Uploads an image file to Supabase Storage bucket 'site-images'.
 * Enforces authenticated staff role (owner/manager) at database/storage RLS level.
 * Returns the public URL of the uploaded image.
 */
export async function uploadSiteImage(
  file: File,
  folder: 'menu' | 'content' | 'gallery' | 'general' = 'general'
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!file) {
    return { success: false, error: 'No file provided for upload.' };
  }

  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    return { success: false, error: 'Image file size exceeds the 5 MB limit.' };
  }

  // Validate mime type
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
  if (!validTypes.includes(file.type)) {
    return { success: false, error: 'Invalid file type. Supported formats: JPG, PNG, WebP, GIF, SVG.' };
  }

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
    const extension = file.name.split('.').pop()?.toLowerCase() || 'webp';
    const baseName = file.name.substring(0, file.name.lastIndexOf('.')).replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase() || 'asset';
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const filePath = `${folder}/${timestamp}_${randomSuffix}_${baseName}.${extension}`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
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
