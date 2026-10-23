import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  console.log('Testing migrations in PGlite (Real PostgreSQL Engine)...');
  const db = new PGlite();

  // Setup Supabase-like environment
  await db.exec(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role;
      END IF;
    END $$;

    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE SCHEMA IF NOT EXISTS storage;
    CREATE PUBLICATION supabase_realtime;
    CREATE TABLE IF NOT EXISTS storage.buckets (id TEXT PRIMARY KEY, name TEXT, public BOOLEAN DEFAULT false, file_size_limit BIGINT, allowed_mime_types TEXT[]);
    CREATE TABLE IF NOT EXISTS storage.objects (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id TEXT, name TEXT, owner UUID, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ, last_accessed_at TIMESTAMPTZ, metadata JSONB);
    CREATE TABLE IF NOT EXISTS auth.users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT,
      role TEXT DEFAULT 'authenticated'
    );
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
    $$ LANGUAGE sql STABLE;

    CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT AS $$
      SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), 'anon');
    $$ LANGUAGE sql STABLE;

    CREATE OR REPLACE FUNCTION auth.jwt() RETURNS JSONB AS $$
      SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
    $$ LANGUAGE sql STABLE;
  `);

  const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${migrationFiles.length} migration files.`);

  for (const file of migrationFiles) {
    let sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    // Remove CREATE EXTENSION lines since core PG18 already has UUID and SHA256 built-in
    sql = sql.replace(/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+[^;]+;/gi, '-- CREATE EXTENSION skipped');
    try {
      console.log(`Applying: ${file}...`);
      await db.exec(sql);
      console.log(`✔ Applied: ${file}`);
    } catch (err: any) {
      console.error(`❌ Failed on ${file}:`, err.message);
      break;
    }
  }
}

main().catch(err => {
  console.error('Migration test error:', err);
  process.exit(1);
});
