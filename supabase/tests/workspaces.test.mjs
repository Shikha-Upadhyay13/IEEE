import { test } from "node:test";
import assert from "node:assert/strict";
import { as, createDb, createUser } from "./db.mjs";

test("each user has exactly one personal workspace", async () => {
  const db = await createDb();
  const user = await createUser(db, "a@uni.edu");
  const first = await as(db, user, (tx) => tx.query("select ensure_personal_workspace() as id"));
  const again = await as(db, user, (tx) => tx.query("select ensure_personal_workspace() as id"));
  assert.equal(first.rows[0].id, again.rows[0].id);
  await assert.rejects(
    db.query("insert into workspaces (name, personal, created_by) values ('Second', true, $1)", [user]),
    /duplicate key/
  );
});

test("workspace names can't be blank", async () => {
  const db = await createDb();
  const user = await createUser(db, "a@uni.edu");
  await assert.rejects(as(db, user, (tx) => tx.query("select create_workspace('   ')")), /Give the workspace a name/);
  const { rows } = await as(db, user, (tx) => tx.query("select create_workspace('  Vision Lab ') as id"));
  const ws = await db.query("select name from workspaces where id = $1", [rows[0].id]);
  assert.equal(ws.rows[0].name, "Vision Lab");
});
