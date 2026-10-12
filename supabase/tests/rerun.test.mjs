import { test } from "node:test";
import assert from "node:assert/strict";
import { applyMigrationsFrom, as, createDb, createUser } from "./db.mjs";

// Projects whose migration history is unknown get every file pasted again.
test("every migration can run again on an up-to-date database", async () => {
  const db = await createDb();
  const owner = await createUser(db, "owner@uni.edu");
  const { rows } = await db.query("insert into documents (owner_id, title, content) values ($1, 'P', '{}'::jsonb) returning id", [owner]);

  await applyMigrationsFrom(db, "001");

  const mine = await as(db, owner, (tx) => tx.query("select id, tags, deleted_at from documents"));
  assert.deepEqual(mine.rows, [{ id: rows[0].id, tags: [], deleted_at: null }]);
});
