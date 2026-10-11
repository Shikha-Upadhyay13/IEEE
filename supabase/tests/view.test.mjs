import { test } from "node:test";
import assert from "node:assert/strict";
import { as, createDb, createUser } from "./db.mjs";

test("the read-only view serves members with their role, and hides Trash", async () => {
  const db = await createDb();
  const owner = await createUser(db, "owner@uni.edu");
  const reviewer = await createUser(db, "reviewer@uni.edu");
  const stranger = await createUser(db, "stranger@uni.edu");
  const { rows } = await db.query("insert into documents (owner_id, title, content) values ($1, 'P', '{}'::jsonb) returning id", [owner]);
  const doc = rows[0].id;
  await as(db, owner, (tx) => tx.query("select invite_to_document($1, 'reviewer@uni.edu', 'reviewer')", [doc]));

  const view = async (user) =>
    (await as(db, user, (tx) => tx.query("select is_owner, role from get_shared_document($1)", [doc]))).rows;

  assert.deepEqual(await view(owner), [{ is_owner: true, role: "owner" }]);
  assert.deepEqual(await view(reviewer), [{ is_owner: false, role: "reviewer" }]);
  assert.deepEqual(await view(stranger), []);
  assert.deepEqual(await view(null), []);

  await db.query("update documents set is_public = true where id = $1", [doc]);
  assert.deepEqual(await view(null), [{ is_owner: null, role: null }]);

  await db.query("update documents set deleted_at = now() where id = $1", [doc]);
  assert.deepEqual(await view(reviewer), []);
  assert.deepEqual(await view(null), []);
  assert.equal((await view(owner)).length, 1);
});
