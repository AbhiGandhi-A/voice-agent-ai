# Supabase Setup Guide

The app persists conversations, contacts, calls, settings, and call summaries in
Supabase (Postgres) and uses Supabase Auth for sign-in. This document walks
through the one-time setup.

> Security: the browser only ever sees the **anon key** (auth + realtime). All
> CRUD runs through the Node API using the **service role key**, which stays on
> the server and is never shipped to the client.

## 1. Create the project

1. Sign up / in at [supabase.com](https://supabase.com), create a new project
   and choose a region near you.
2. From **Project Settings → API**, copy:
   - Project URL → `SUPABASE_URL`
   - `anon` public key → `SUPABASE_ANON_KEY`
   - `service_role` secret → `SUPABASE_SERVICE_ROLE_KEY` (keep secret)
3. Write them into `.env`:

```powershell
SUPABASE_URL=https://YOURPROJECT.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## 2. Apply the schema

Run the one-command setup — it connects to Postgres directly (DDL can't run
through the PostgREST API), applies `supabase/migrations/0001_init.sql` in a
transaction, records a checksum so later runs are no-ops, and reloads the
PostgREST schema cache:

```powershell
npm run db:setup
```

`db:setup` needs one of these in `.env` (see `.env.example`):

- `DATABASE_URL` — full URI from **Dashboard → Connect → Connection string
  (URI)** — or
- `SUPABASE_DB_PASSWORD` (project database password; default host/user/db are
  derived from `SUPABASE_URL`).

It creates:

- `profiles` (metadata + `role`)
- `conversations`, `messages`
- `contacts`, `calls`, `call_summaries`
- `recordings` (Storage placeholder)
- `system_settings` (AI / voice / call settings)
- Row-level security policies (owner-scoped access), indexes, and a trigger
  that automatically creates a `profiles` row when a user signs up.

The migration is idempotent — safe to re-run; `npm run db:setup` skips it when
the stored checksum already matches.

> **Why `npm run db:setup` (not the SQL editor)?** The migration defines
> `LANGUAGE sql` helper functions before the tables they query. Postgres parses
> a SQL-language function body at creation time, so pasting the file into the
> dashboard SQL editor from scratch fails with
> `relation "public.profiles" does not exist`. `npm run db:setup` runs the file
> inside a transaction with `check_function_bodies = off` (the standard
> `pg_dump` trick), so it applies cleanly. If you do use the SQL editor
> instead, run `set check_function_bodies = off;` first.

## 3. Create your first user

Still in the dashboard: **Authentication → Add user** (or go to your app URL,
signed out, and use the "Create an account" form — it calls the same endpoint).

## 4. Verify from the app

```powershell
# Server-side connectivity check
npm run db:diag

# Health should now report database.connected: true
Invoke-RestMethod http://127.0.0.1:3000/api/health | ConvertTo-Json
```

Sign in with the account you created. The app now loads real conversations,
calls, contacts, and settings from Postgres; settings edits persist across
sessions.

## 5. Storage bucket (optional — call recordings)

If you enable call recording, create a private bucket named `recordings`
(**Storage → New bucket**: private, no public access). The migration includes
RLS policies that both create the bucket-side permissions table and allow the
service role access. Actual recording write path is only exercised when a
telephony provider is configured.

## 6. Roles & security

- A first-time user gets role `agent`.
- Promote a user to `supervisor`/`admin` by editing `profiles.role` in the
  dashboard (or SQL) if you rely on role-gated endpoints.
- The server verifies JWTs via the Supabase auth API (60s cache) and applies
  owner-scoped RLS on every query through the service role key.

## Troubleshooting

- **`/api/health` / `db:diag` show `database.connected: false` or `ping: FAILED`
  while `table * : ok` used to pass:** the old `db:diag` table probe used a
  `count/head` request that can hide missing-table errors. PostgREST returns
  `PGRST205 could not find the table 'public.X' in the schema cache` when the
  migration has not been applied. Fix: `npm run db:setup` (or run
  `supabase/migrations/0001_init.sql` in **SQL Editor**, then wait a few seconds
  for PostgREST to reload its schema cache or run
  `notify pgrst, 'reload schema';`).
- **`verifyUserToken` returns null / 401s:** the anon key must match the
  project; confirm `.env` values (URL should end in `.supabase.co`).
- **RLS blocks reads:** ensure the migration (section 2) ran completely — all
  tables use `auth.uid()`-based policies.
- **254/network errors from the dashboard** while running migration: increase
  the query timeout or run statements in smaller batches (the migration is
  composed so partial runs are safe).
- **When PostgREST still 404s a brand-new table:** run
  `notify pgrst, 'reload schema';` in SQL Editor to force a schema-cache reload.