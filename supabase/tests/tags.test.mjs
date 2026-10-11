import { test } from "node:test";
import assert from "node:assert/strict";
import { as, createDb, createUser } from "./db.mjs";

test("owners and editors tag papers, within limits", async () => {
  const db = await createDb();
  const owner = await createUser(db, "owner@uni.edu");
  await createUser(db, "editor@uni.edu");
  const { rows } = await db.query("insert into documents (owner_id, title, content) values ($1, 'P', '{}'::jsonb) returning id", [owner]);
  const doc = rows[0].id;
  const editor = (await db.query("select id from auth.users where email = 'editor@uni.edu'")).rows[0].id;
  await as(db, owner, (tx) => tx.query("select invite_to_document($1, 'editor@uni.edu', 'editor')", [doc]));

  const tag = (user, tags) => as(db, user, (tx) => tx.query("update documents set tags = $2 where id = $1 returning tags", [doc, tags]));
  assert.deepEqual((await tag(editor, ["thesis", "ICRA 2027"])).rows, [{ tags: ["thesis", "ICRA 2027"] }]);
  await assert.rejects(tag(owner, Array.from({ length: 21 }, (_, i) => `t${i}`)), /documents_tags_reasonable/);
  await assert.rejects(tag(owner, ["two\nlines"]), /documents_tags_reasonable/);
});
