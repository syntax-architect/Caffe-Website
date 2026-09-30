import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const env = (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {}) as Record<
  string,
  string | boolean | undefined
>;
const supabaseUrl = (env.VITE_SUPABASE_URL || '') as string;
const supabaseAnonKey = (env.VITE_SUPABASE_ANON_KEY || '') as string;

/**
 * Checks whether Supabase environment variables are provided and non-empty.
 * Prevents the application from crashing if credentials are missing or placeholders.
 */
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.trim() !== '' &&
  supabaseAnonKey.trim() !== '' &&
  !supabaseUrl.includes('your-project') &&
  !supabaseUrl.includes('placeholder')
);

/**
 * Public Supabase client instance.
 * Returns null if Supabase is unconfigured, allowing the frontend to run safely in demo/offline mode.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

if (!isSupabaseConfigured && env.DEV) {
  console.info(
    '[Supabase] Environment variables VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY are missing. Running in local demo mode with WhatsApp dispatch.'
  );
}
