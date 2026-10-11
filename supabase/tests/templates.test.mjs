import { test } from "node:test";
import assert from "node:assert/strict";
import { as, createDb, createUser } from "./db.mjs";

test("admins publish templates that every member can read", async () => {
  const db = await createDb();
  const admin = await createUser(db, "admin@uni.edu");
  const member = await createUser(db, "member@uni.edu");
  const outsider = await createUser(db, "outsider@uni.edu");
  const { rows: docs } = await db.query(
    `insert into documents (owner_id, title, content) values ($1, 'Lab style', '{"schemaVersion":1}'::jsonb) returning id`,
    [admin]
  );
  const ws = await as(db, admin, async (tx) => {
    const { rows } = await tx.query("select create_workspace('Lab') as id");
    await tx.query("select invite_to_workspace($1, 'member@uni.edu', 'member')", [rows[0].id]);
    return rows[0].id;
  });

  const publish = (user) => as(db, user, (tx) => tx.query("select publish_workspace_template($1, $2, ' Lab paper ') as id", [docs[0].id, ws]));
  await assert.rejects(publish(member), /Only workspace admins/);
  await publish(admin);

  const read = (user) => as(db, user, (tx) => tx.query("select name, content from workspace_templates"));
  assert.deepEqual((await read(member)).rows, [{ name: "Lab paper", content: { schemaVersion: 1 } }]);
  assert.equal((await read(outsider)).rows.length, 0);

  await assert.rejects(
    as(db, member, (tx) => tx.query("insert into workspace_templates (workspace_id, name, content) values ($1, 'x', '{}')", [ws])),
    /row-level security/
  );
  assert.equal((await as(db, member, (tx) => tx.query("delete from workspace_templates returning id"))).rows.length, 0);
  assert.equal((await as(db, admin, (tx) => tx.query("delete from workspace_templates returning id"))).rows.length, 1);
});
