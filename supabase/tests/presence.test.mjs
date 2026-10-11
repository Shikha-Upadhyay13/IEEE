import { test } from "node:test";
import assert from "node:assert/strict";
import { as, createDb, createUser } from "./db.mjs";

/** Runs `fn` as `userId` connected to the Realtime channel `topic`. */
const onTopic = (db, userId, topic, fn) =>
  as(db, userId, async (tx) => {
    await tx.query("select set_config('realtime.topic', $1, true)", [topic]);
    return fn(tx);
  });

test("only people who can read a paper share its presence channel", async () => {
  const db = await createDb();
  const owner = await createUser(db, "owner@uni.edu");
  const editor = await createUser(db, "editor@uni.edu");
  const stranger = await createUser(db, "stranger@uni.edu");
  const { rows } = await db.query("insert into documents (owner_id, title, content) values ($1, 'P', '{}'::jsonb) returning id", [owner]);
  const topic = `paper:${rows[0].id}`;
  await as(db, owner, (tx) => tx.query("select invite_to_document($1, 'editor@uni.edu', 'editor')", [rows[0].id]));
  await db.query("insert into realtime.messages (topic, extension) values ($1, 'presence')", [topic]);

  const visible = (user) => onTopic(db, user, topic, (tx) => tx.query("select id from realtime.messages"));
  assert.equal((await visible(owner)).rows.length, 1);
  assert.equal((await visible(editor)).rows.length, 1);
  assert.equal((await visible(stranger)).rows.length, 0);

  await onTopic(db, editor, topic, (tx) => tx.query("insert into realtime.messages (topic, extension) values ($1, 'presence')", [topic]));
  await assert.rejects(
    onTopic(db, stranger, topic, (tx) => tx.query("insert into realtime.messages (topic, extension) values ($1, 'presence')", [topic])),
    /row-level security/
  );
});

test("malformed topics grant nothing instead of erroring", async () => {
  const db = await createDb();
  const { rows } = await db.query("select paper_topic_id('paper:not-a-uuid') as a, paper_topic_id('doc:x') as b");
  assert.deepEqual(rows[0], { a: null, b: null });
});
