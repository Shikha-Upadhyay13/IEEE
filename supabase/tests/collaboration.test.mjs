import { test } from "node:test";
import assert from "node:assert/strict";
import { applyMigrationsFrom, as, createDb, createUser } from "./db.mjs";

const CONTENT = JSON.stringify({ schemaVersion: 1 });

async function setup() {
  const db = await createDb({ stopBefore: "006" });
  const owner = await createUser(db, "owner@uni.edu");
  const { rows } = await db.query("insert into documents (owner_id, title, content) values ($1, 'Paper', $2) returning id", [
    owner,
    CONTENT,
  ]);
  await applyMigrationsFrom(db, "006");
  const users = {
    owner,
    editor: await createUser(db, "editor@uni.edu"),
    reviewer: await createUser(db, "reviewer@uni.edu"),
    viewer: await createUser(db, "viewer@uni.edu"),
    stranger: await createUser(db, "stranger@uni.edu"),
  };
  return { db, doc: rows[0].id, users };
}

const select = (tx, doc) => tx.query("select id, version from documents where id = $1", [doc]);
const update = (tx, doc, extra = "") =>
  tx.query(`update documents set content = content || '{"x":1}'::jsonb ${extra} where id = $1 returning version`, [doc]);

test("existing papers move into a private personal workspace", async () => {
  const { db, doc, users } = await setup();
  const { rows } = await db.query(
    "select w.personal, d.workspace_access from documents d join workspaces w on w.id = d.workspace_id where d.id = $1",
    [doc]
  );
  assert.deepEqual(rows, [{ personal: true, workspace_access: "private" }]);
  assert.equal((await as(db, users.stranger, (tx) => select(tx, doc))).rows.length, 0);
  assert.equal((await as(db, null, (tx) => select(tx, doc))).rows.length, 0);
  assert.equal((await as(db, users.owner, (tx) => select(tx, doc))).rows.length, 1);
});

test("owners share by email and roles decide what members can do", async () => {
  const { db, doc, users } = await setup();
  await as(db, users.owner, async (tx) => {
    for (const [email, role] of [
      ["editor@uni.edu", "editor"],
      ["Reviewer@Uni.edu ", "reviewer"],
      ["viewer@uni.edu", "viewer"],
    ]) {
      const { rows } = await tx.query("select invite_to_document($1, $2, $3) as r", [doc, email, role]);
      assert.equal(rows[0].r, "added");
    }
  });

  // Editors save content and the version goes up; they can't change sharing.
  const saved = await as(db, users.editor, (tx) => update(tx, doc));
  assert.deepEqual(saved.rows, [{ version: 2 }]);
  await assert.rejects(as(db, users.editor, (tx) => update(tx, doc, ", is_public = true")), /Only the owner/);
  await assert.rejects(
    as(db, users.editor, (tx) => tx.query("select invite_to_document($1, 'x@y.z', 'viewer')", [doc])),
    /Only the owner/
  );

  // Reviewers read and comment but can't edit; viewers only read.
  assert.equal((await as(db, users.reviewer, (tx) => update(tx, doc))).rows.length, 0);
  await as(db, users.reviewer, (tx) =>
    tx.query("insert into comments (document_id, block_id, body) values ($1, 'p1', 'Typo here')", [doc])
  );
  await assert.rejects(
    as(db, users.viewer, (tx) => tx.query("insert into comments (document_id, body) values ($1, 'Hi')", [doc])),
    /row-level security/
  );
  assert.equal((await as(db, users.viewer, (tx) => tx.query("select * from comments"))).rows.length, 1);
  assert.equal((await as(db, users.stranger, (tx) => tx.query("select * from comments"))).rows.length, 0);

  // Only the owner deletes the paper.
  assert.equal((await as(db, users.editor, (tx) => tx.query("delete from documents where id = $1 returning id", [doc]))).rows.length, 0);
});

test("creating a paper returns its id, as the app's insert-then-select does", async () => {
  const { db, users } = await setup();
  const { rows } = await as(db, users.editor, (tx) =>
    tx.query("insert into documents (owner_id, title, content) values ($1, 'New', $2) returning id", [users.editor, CONTENT])
  );
  assert.equal(rows.length, 1);
});

test("reviewers suggest edits and only editors decide them", async () => {
  const { db, doc, users } = await setup();
  await as(db, users.owner, async (tx) => {
    await tx.query("select invite_to_document($1, 'reviewer@uni.edu', 'reviewer')", [doc]);
    await tx.query("select invite_to_document($1, 'viewer@uni.edu', 'viewer')", [doc]);
  });
  const proposed = JSON.stringify([{ type: "text", text: "Better" }]);
  const { rows } = await as(db, users.reviewer, (tx) =>
    tx.query("insert into suggestions (document_id, block_id, proposed) values ($1, 'p1', $2) returning id", [doc, proposed])
  );
  const id = rows[0].id;
  await assert.rejects(
    as(db, users.viewer, (tx) => tx.query("insert into suggestions (document_id, block_id, proposed) values ($1, 'p1', $2)", [doc, proposed])),
    /row-level security/
  );

  const decide = (user) => as(db, user, (tx) => tx.query("update suggestions set status = 'accepted' where id = $1 returning decided_by", [id]));
  assert.equal((await decide(users.reviewer)).rows.length, 0);
  assert.deepEqual((await decide(users.owner)).rows, [{ decided_by: users.owner }]);
});

test("a save based on an old version changes nothing", async () => {
  const { db, doc, users } = await setup();
  await as(db, users.owner, (tx) => update(tx, doc));
  const stale = await as(db, users.owner, (tx) =>
    tx.query("update documents set title = 'Mine' where id = $1 and version = 1 returning id", [doc])
  );
  assert.equal(stale.rows.length, 0);
});

test("invitations for new accounts are accepted after sign-up", async () => {
  const { db, doc, users } = await setup();
  const { rows } = await as(db, users.owner, (tx) =>
    tx.query("select invite_to_document($1, 'new@uni.edu', 'editor') as r", [doc])
  );
  assert.equal(rows[0].r, "invited");
  const newcomer = await createUser(db, "new@uni.edu");
  assert.equal((await as(db, newcomer, (tx) => select(tx, doc))).rows.length, 0);
  const accepted = await as(db, newcomer, (tx) => tx.query("select accept_my_invitations() as n"));
  assert.equal(accepted.rows[0].n, 1);
  assert.equal((await as(db, newcomer, (tx) => update(tx, doc))).rows.length, 1);
});

test("workspace members see papers shared with the workspace", async () => {
  const { db, doc, users } = await setup();
  const ws = await as(db, users.owner, async (tx) => {
    const { rows } = await tx.query("select create_workspace('Lab') as id");
    await tx.query("select invite_to_workspace($1, 'stranger@uni.edu', 'member')", [rows[0].id]);
    await tx.query("update documents set workspace_id = $1, workspace_access = 'view' where id = $2", [rows[0].id, doc]);
    return rows[0].id;
  });
  assert.equal((await as(db, users.stranger, (tx) => select(tx, doc))).rows.length, 1);
  assert.equal((await as(db, users.stranger, (tx) => update(tx, doc))).rows.length, 0);

  // Non-members can't file papers into the workspace.
  await assert.rejects(
    as(db, users.viewer, (tx) =>
      tx.query("insert into documents (owner_id, content, workspace_id) values ($1, $2, $3)", [users.viewer, CONTENT, ws])
    ),
    /row-level security/
  );
});
