/**
 * Apply the Supabase schema from `supabase/migrations/0001_init.sql` directly
 * over a Postgres connection.
 *
 * Why a real DB connection: PostgREST (the REST/supabase-js API) cannot execute
 * arbitrary SQL. The supported way to run migration DDL on a hosted Supabase
 * project is the Postgres wire connection (direct host or the pooler).
 *
 * Usage: npm run db:setup
 *
 * Connection config (in `.env`):
 *   - Option A (preferred): DATABASE_URL — a full `postgresql://` URI from
 *     Supabase Dashboard → Connect → Connection string (URI).
 *   - Option B: SUPABASE_DB_PASSWORD (project database password). The script
 *     auto-derives host (`db.<ref>.supabase.co`), user `postgres`, db
 *     `postgres` from SUPABASE_URL. Overrides: SUPABASE_DB_HOST / PORT / USER /
 *     NAME.
 *
 * Safety:
 *   - Never modifies or deletes existing tables/data (the migration itself is
 *     idempotent and uses `IF NOT EXISTS` + guarded statements).
 *   - Records a sha256 checksum in `public.schema_migrations`; a matching
 *     checksum makes further runs a no-op.
 *   - After applying, fires `NOTIFY pgrst, 'reload schema'` so PostgREST picks
 *     up the new schema immediately.
 *   - Never prints SUPABASE_SERVICE_ROLE_KEY, passwords, or any secret.
 */
import 'dotenv/config';
import { createHash } from 'crypto';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import pg from 'pg';

const { Client } = pg;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');

function fail(message: string): never {
  console.error(`\n[db:setup] ERROR: ${message}\n`);
  process.exit(1);
}

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function projectRef(supabaseUrl: string | undefined): string | null {
  if (!supabaseUrl) return null;
  try {
    const host = new URL(supabaseUrl).hostname.toLowerCase();
    return host.endsWith('.supabase.co') ? host.replace('.supabase.co', '') : null;
  } catch {
    return null;
  }
}

/** Builds the connection string; returns null when the env is not configured. */
function resolveConnection(): { url: string; host: string } | null {
  const fromUrl = process.env.DATABASE_URL?.trim();
  if (fromUrl) {
    try {
      const parsed = new URL(fromUrl);
      return { url: fromUrl, host: parsed.host };
    } catch {
      fail('DATABASE_URL is set but is not a valid postgres:// URI.');
    }
  }

  const ref = projectRef(process.env.SUPABASE_URL);
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!ref || !password) {
    return null;
  }
  const user = process.env.SUPABASE_DB_USER?.trim() || 'postgres';
  const host = process.env.SUPABASE_DB_HOST?.trim() || `db.${ref}.supabase.co`;
  const port = process.env.SUPABASE_DB_PORT?.trim() || '5432';
  const database = process.env.SUPABASE_DB_NAME?.trim() || 'postgres';
  const url = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
  return { url, host };
}

async function run(): Promise<void> {
  console.log('[db:setup] AI Voice Agent — database setup');
  console.log(`[db:setup] migrations: ${MIGRATIONS_DIR}`);

  const conn = resolveConnection();
  if (!conn) {
    fail(
      'No database connection configured.\n' +
        '        Add one of these to `.env`:\n' +
        '          DATABASE_URL=postgresql://postgres.<ref>:<db-password>@<host>.supabase.com:5432/postgres\n' +
        '        (Supabase Dashboard → Project → Connect → Connection string → URI)\n' +
        '        OR\n' +
        '          SUPABASE_DB_PASSWORD=<your-project-db-password>   (uses db.<ref>.supabase.co)\n' +
        '        Then re-run: npm run db:setup'
    );
  }

  if (!process.env.SUPABASE_URL) {
    fail('SUPABASE_URL is missing from `.env`.');
  }

  const migrations = readdirSync(MIGRATIONS_DIR)
    .filter((file) => /^\d+_.+\.sql$/i.test(file))
    .sort()
    .map((file) => ({
      file,
      name: file.replace(/\.sql$/i, ''),
      path: path.join(MIGRATIONS_DIR, file),
    }));
  if (migrations.length === 0) fail(`No SQL migrations found in ${MIGRATIONS_DIR}`);

  const client = new Client({
    connectionString: conn.url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15_000,
  });

  try {
    await client.connect();
  } catch (err) {
    fail(
      `Could not connect to Postgres at ${conn.host}.\n` +
        `        ${err instanceof Error ? err.message : String(err)}\n` +
        '        Check the database password / DATABASE_URL, network access, and that\n' +
        '        the project is not paused.'
    );
  }

  console.log(`[db:setup] connected to ${conn.host} ✔`);
  // Ledger table so repeated runs are safe no-ops. Never touches app tables.
  await client.query(
    `create table if not exists public.schema_migrations (
       migration text primary key,
       checksum  text not null,
       applied_at timestamptz not null default now()
     )`
  );

  for (const migration of migrations) {
    const sql = readFileSync(migration.path, 'utf8');
    if (!sql.trim()) fail(`Migration file is empty: ${migration.path}`);
    const checksum = sha256(sql);
    const existing = await client.query(
      'select checksum from public.schema_migrations where migration = $1',
      [migration.name]
    );

    if (existing.rowCount! > 0 && existing.rows[0].checksum === checksum) {
      console.log(`[db:setup] ${migration.name} already applied (checksum match).`);
      continue;
    }

    try {
      await client.query('begin');
      // 0001 defines helper functions before their tables exist.
      await client.query('set local check_function_bodies = false');
      await client.query(sql);
      await client.query(
        `insert into public.schema_migrations (migration, checksum)
         values ($1, $2)
         on conflict (migration) do update set checksum = excluded.checksum, applied_at = now()`,
        [migration.name, checksum]
      );
      await client.query('commit');
      console.log(`[db:setup] ${migration.name} applied ✔`);
    } catch (err) {
      await client.query('rollback').catch(() => undefined);
      fail(
        `Migration ${migration.name} failed (rolled back).\n` +
          `        ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // Tell PostgREST to reload its schema cache so tables are visible immediately.
  await client.query("notify pgrst, 'reload schema';");
  console.log("[db:setup] PostgREST schema cache reload requested ✔");

  await client.end();

  console.log('[db:setup] done ✔\n');
  console.log('[db:setup] Running diagnostics to verify…');
  try {
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    execSync(`${npmCmd} run db:diag`, { stdio: 'inherit', cwd: ROOT });
  } catch {
    console.log('[db:setup] Diagnostics could not run. Run manually: npm run db:diag');
  }
}

run().catch((err) => {
  console.error('[db:setup] unexpected error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});