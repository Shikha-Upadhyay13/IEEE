import { before, test } from "node:test";
import assert from "node:assert/strict";
import { as, createDb, createUser } from "./db.mjs";

// Adding a table means adding it here, and seeding it below.
const TABLES = [
  "comments",
  "conversations",
  "document_invitations",
  "document_members",
  "document_versions",
  "documents",
  "email_settings",
  "export_tokens",
  "exports",
  "generated_images",
  "notification_preferences",
  "notifications",
  "paper_notification_levels",
  "profiles",
  "projects",
  "suggestions",
  "workspace_invitations",
  "workspace_members",
  "workspace_templates",
  "workspaces",
];

let db;
let stranger;

before(async () => {
  db = await createDb();
  const owner = await createUser(db, "owner@uni.edu");
  const coauthor = await createUser(db, "coauthor@uni.edu");
  stranger = await createUser(db, "stranger@else.org");

  const one = async (sql, params) => (await db.query(sql, params)).rows[0]?.id;
  const ws = await one("insert into workspaces (name, created_by) values ('Lab', $1) returning id", [owner]);
  await db.query("insert into workspace_members (workspace_id, user_id, role) values ($1, $2, 'owner')", [ws, owner]);
  await db.query("insert into workspace_invitations (workspace_id, email, role, invited_by) values ($1, 'new@uni.edu', 'member', $2)", [ws, owner]);
  await db.query("insert into workspace_templates (workspace_id, name, content, created_by) values ($1, 'T', '{}', $2)", [ws, owner]);

  const doc = await one("insert into documents (owner_id, title, content) values ($1, 'Paper', '{}') returning id", [owner]);
  await db.query("insert into document_versions (document_id, title, content) values ($1, 'Paper', '{}')", [doc]);
  await db.query("insert into document_members (document_id, user_id, role, invited_by) values ($1, $2, 'editor', $3)", [doc, coauthor, owner]);
  await db.query("insert into document_invitations (document_id, email, role, invited_by) values ($1, 'new@uni.edu', 'viewer', $2)", [doc, owner]);
  const comment = await one("insert into comments (document_id, author_id, body) values ($1, $2, 'Hi') returning id", [doc, owner]);
  await db.query("insert into comments (document_id, parent_id, author_id, body) values ($1, $2, $3, 'Reply')", [doc, comment, coauthor]);
  await db.query("insert into suggestions (document_id, block_id, author_id, proposed) values ($1, 'b1', $2, '[]')", [doc, coauthor]);
  await db.query("insert into export_tokens (document_id, expires_at) values ($1, now() + interval '1 minute')", [doc]);

  await db.query("insert into notifications (user_id, kind, document_id, actor_id) values ($1, 'comment', $2, $3)", [owner, doc, coauthor]);
  await db.query("insert into notification_preferences (user_id, kind, email) values ($1, 'comment', false)", [owner]);
  await db.query("insert into paper_notification_levels (user_id, document_id, level) values ($1, $2, 'mentions')", [owner, doc]);
  await db.query("insert into email_settings (user_id) values ($1)", [owner]);
  await db.query("insert into profiles (id) values ($1), ($2) on conflict do nothing", [owner, coauthor]);

  const project = await one("insert into projects (owner_id, name) values ($1, 'P') returning id", [owner]);
  await db.query("insert into conversations (owner_id, project_id) values ($1, $2)", [owner, project]);
  await db.query("insert into generated_images (owner_id, prompt, image_url) values ($1, 'cat', 'https://x')", [owner]);
  await db.query("insert into exports (owner_id, document_id, title, storage_path) values ($1, $2, 'Paper', 'p.pdf')", [owner, doc]);
});

test("every public table is listed here and has row-level security on", async () => {
  const { rows } = await db.query("select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename");
  assert.deepEqual(rows.map((r) => r.tablename), TABLES);
  assert.deepEqual(rows.filter((r) => !r.rowsecurity), []);
});

test("every table is seeded, so the checks below mean something", async () => {
  for (const table of TABLES) {
    const { rows } = await db.query(`select count(*)::int as n from public.${table}`);
    assert.ok(rows[0].n > 0, `${table} is empty`);
  }
});

test("signed-out visitors read nothing from any table", async () => {
  for (const table of TABLES) {
    const { rows } = await as(db, null, (tx) => tx.query(`select count(*)::int as n from public.${table}`));
    assert.equal(rows[0].n, 0, table);
  }
});

test("a signed-in user outside the workspace and paper reads nothing of anyone else's", async () => {
  const ownedBy = { profiles: "id", notifications: "user_id", notification_preferences: "user_id", paper_notification_levels: "user_id", email_settings: "user_id", workspace_members: "user_id" };
  for (const table of TABLES) {
    const others = ownedBy[table] ? ` where ${ownedBy[table]} <> $1` : "";
    const { rows } = await as(db, stranger, (tx) => tx.query(`select count(*)::int as n from public.${table}${others}`, others ? [stranger] : []));
    assert.equal(rows[0].n, 0, table);
  }
});
