import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const SUPABASE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

// The parts of Supabase's own schemas that our SQL relies on.
const SUPABASE_STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    email_confirmed_at timestamptz default now()
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as
    $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
  create table auth.mfa_factors (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    status text not null
  );
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select string_to_array(name, '/') $$;
  create schema realtime;
  create table realtime.messages (id bigserial primary key, topic text not null, extension text not null, payload jsonb);
  alter table realtime.messages enable row level security;
  create function realtime.topic() returns text language sql stable as
    $$ select nullif(current_setting('realtime.topic', true), '') $$;
`;

const GRANTS = `
  grant usage on schema public, auth, storage, realtime to anon, authenticated;
  grant select, insert on realtime.messages to authenticated;
  grant usage on sequence realtime.messages_id_seq to authenticated;
  grant execute on function realtime.topic() to anon, authenticated;
  grant all on all tables in schema public to authenticated;
  grant select on all tables in schema public to anon;
  grant execute on function auth.uid() to anon, authenticated;
  grant execute on function auth.jwt() to anon, authenticated;
`;

const migrationFiles = () => readdirSync(join(SUPABASE_DIR, "migrations")).filter((f) => f.endsWith(".sql")).sort();

/** A fresh database with every migration before `stopBefore` applied. */
export async function createDb({ stopBefore } = {}) {
  const db = new PGlite();
  await db.exec(SUPABASE_STUBS);
  for (const file of migrationFiles()) {
    if (stopBefore && file >= stopBefore) break;
    await db.exec(readFileSync(join(SUPABASE_DIR, "migrations", file), "utf8"));
  }
  await db.exec(GRANTS);
  return db;
}

/** Applies the migrations `createDb({ stopBefore })` skipped. */
export async function applyMigrationsFrom(db, start) {
  for (const file of migrationFiles().filter((f) => f >= start)) await applyMigration(db, file);
}

export async function applyMigration(db, file) {
  await db.exec(readFileSync(join(SUPABASE_DIR, "migrations", file), "utf8"));
  await db.exec(GRANTS);
}

export async function createUser(db, email) {
  const { rows } = await db.query("insert into auth.users (email) values ($1) returning id", [email]);
  return rows[0].id;
}

/** Runs `fn` as a signed-in user, with row-level security applied; `aal` is the session's two-factor level. */
export async function as(db, userId, fn, { aal = "aal1" } = {}) {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ""]);
    await tx.query("select set_config('request.jwt.claims', $1, true)", [userId ? JSON.stringify({ sub: userId, aal }) : ""]);
    await tx.exec(`set local role ${userId ? "authenticated" : "anon"}`);
    return fn(tx);
  });
}
