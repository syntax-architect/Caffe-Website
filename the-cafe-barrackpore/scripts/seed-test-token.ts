/**
 * Test Token Seeding Script (Service Role Key)
 * Replaces dropped create_verified_token_for_test SQL helper.
 *
 * Usage:
 *   npx tsx scripts/seed-test-token.ts [token] [action]
 *
 * Example:
 *   npx tsx scripts/seed-test-token.ts token_test_123 contact
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

function resolveEnvVar(key: string): string {
  if (process.env[key]) return process.env[key] as string;

  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
        const [k, ...v] = trimmed.split('=');
        if (k.trim() === key) {
          return v.join('=').trim().replace(/^['"](.*)['"]$/, '$1');
        }
      }
    }
  } catch {
    // Ignore error reading .env
  }

  return '';
}

export async function seedVerifiedToken(
  token: string,
  action: string = 'order',
  expiresInMinutes: number = 15
) {
  const supabaseUrl = resolveEnvVar('SUPABASE_URL') || resolveEnvVar('VITE_SUPABASE_URL');
  const serviceRoleKey = resolveEnvVar('SUPABASE_SERVICE_ROLE_KEY') || resolveEnvVar('VITE_SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl) {
    throw new Error('Missing SUPABASE_URL / VITE_SUPABASE_URL in environment');
  }

  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in environment to seed verified tokens');
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();

  const { data, error } = await adminClient
    .from('verified_tokens')
    .upsert(
      {
        token: token.trim(),
        action: action.trim(),
        expires_at: expiresAt,
      },
      { onConflict: 'token' }
    )
    .select();

  if (error) {
    throw new Error(`Failed to seed verified token via service role key: ${error.message}`);
  }

  return data;
}

// CLI runner
if (
  process.argv[1] &&
  (process.argv[1].endsWith('seed-test-token.ts') || process.argv[1].endsWith('seed-test-token.js'))
) {
  const token = process.argv[2] || `token_test_${Math.floor(100000 + Math.random() * 900000)}`;
  const action = process.argv[3] || 'order';

  console.log(`Seeding test token: "${token}" for action: "${action}"...`);
  seedVerifiedToken(token, action)
    .then((res) => {
      console.log('✔ Test token successfully seeded via service role key:', res);
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Failed to seed test token:', err.message);
      process.exit(1);
    });
}
