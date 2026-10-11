import { test } from "node:test";
import assert from "node:assert/strict";
import { as, createDb, createUser } from "./db.mjs";

async function setup() {
  const db = await createDb();
  const users = {
    owner: await createUser(db, "owner@uni.edu"),
    editor: await createUser(db, "editor@uni.edu"),
    reviewer: await createUser(db, "reviewer@uni.edu"),
    stranger: await createUser(db, "stranger@uni.edu"),
  };
  const { rows } = await db.query("insert into documents (owner_id, title, content) values ($1, 'Vision', '{}'::jsonb) returning id", [users.owner]);
  const doc = rows[0].id;
  await as(db, users.owner, async (tx) => {
    await tx.query("select invite_to_document($1, 'editor@uni.edu', 'editor')", [doc]);
    await tx.query("select invite_to_document($1, 'reviewer@uni.edu', 'reviewer')", [doc]);
  });
  return { db, doc, users };
}

const inbox = async (db, user) =>
  (await as(db, user, (tx) => tx.query("select kind, payload->>'title' as title from notifications order by created_at, kind"))).rows;

const comment = (db, user, doc, body, { parent = null, mentions = [] } = {}) =>
  as(db, user, (tx) =>
    tx.query("insert into comments (document_id, body, parent_id, mentions) values ($1, $2, $3, $4) returning id", [doc, body, parent, mentions])
  ).then((r) => r.rows[0].id);

test("sharing a paper notifies the new member, not the owner", async () => {
  const { db, users } = await setup();
  assert.deepEqual(await inbox(db, users.editor), [{ kind: "paper_shared", title: "Vision" }]);
  assert.deepEqual(await inbox(db, users.owner), []);
  const { rows } = await as(db, users.editor, (tx) => tx.query("select payload->>'actor' as actor from notifications"));
  assert.equal(rows[0].actor, "owner@uni.edu");
});

test("comments notify the owner, mentions and thread participants once each", async () => {
  const { db, doc, users } = await setup();
  await db.query("delete from notifications");

  const root = await comment(db, users.reviewer, doc, "Please check @editor", { mentions: [users.editor, users.stranger] });
  assert.deepEqual(await inbox(db, users.owner), [{ kind: "comment", title: "Vision" }]);
  assert.deepEqual(await inbox(db, users.editor), [{ kind: "mention", title: "Vision" }]);
  assert.deepEqual(await inbox(db, users.stranger), [], "people without access are never notified");

  await db.query("delete from notifications");
  await comment(db, users.editor, doc, "Fixed", { parent: root });
  assert.deepEqual(await inbox(db, users.reviewer), [{ kind: "reply", title: "Vision" }]);
  assert.deepEqual(await inbox(db, users.editor), [], "no notification for your own comment");
  assert.deepEqual(await inbox(db, users.owner), [], "replies go to the thread, not the owner");
});

test("suggestions notify the owner, decisions notify the reviewer", async () => {
  const { db, doc, users } = await setup();
  await db.query("delete from notifications");
  const { rows } = await as(db, users.reviewer, (tx) =>
    tx.query(`insert into suggestions (document_id, block_id, proposed) values ($1, 'p', '[]') returning id`, [doc])
  );
  assert.deepEqual(await inbox(db, users.owner), [{ kind: "suggestion", title: "Vision" }]);
  await as(db, users.owner, (tx) => tx.query("update suggestions set status = 'rejected' where id = $1", [rows[0].id]));
  assert.deepEqual(await inbox(db, users.reviewer), [{ kind: "suggestion_decided", title: "Vision" }]);
});

test("people only see and mark their own notifications, and only the read state", async () => {
  const { db, users } = await setup();
  assert.equal((await as(db, users.stranger, (tx) => tx.query("select * from notifications"))).rows.length, 0);
  const marked = await as(db, users.editor, (tx) => tx.query("update notifications set read_at = now() returning id"));
  assert.equal(marked.rows.length, 1);
  await assert.rejects(
    as(db, users.editor, (tx) => tx.query("update notifications set kind = 'mention'")),
    /Only the read state/
  );
  await assert.rejects(
    as(db, users.editor, (tx) => tx.query("insert into notifications (user_id, kind) values ($1, 'mention')", [users.owner])),
    /row-level security/
  );
});
