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
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select string_to_array(name, '/') $$;
`;

const GRANTS = `
  grant usage on schema public, auth, storage to anon, authenticated;
  grant all on all tables in schema public to authenticated;
  grant select on all tables in schema public to anon;
  grant execute on function auth.uid() to anon, authenticated;
`;

const migrationFiles = () => readdirSync(join(SUPABASE_DIR, "migrations")).filter((f) => f.endsWith(".sql")).sort();

/** A fresh database with schema.sql and every migration before `stopBefore` applied. */
export async function createDb({ stopBefore } = {}) {
  const db = new PGlite();
  await db.exec(SUPABASE_STUBS);
  await db.exec(readFileSync(join(SUPABASE_DIR, "schema.sql"), "utf8"));
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

/** Runs `fn` as a signed-in user, with row-level security applied. */
export async function as(db, userId, fn) {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ""]);
    await tx.exec(`set local role ${userId ? "authenticated" : "anon"}`);
    return fn(tx);
  });
}
