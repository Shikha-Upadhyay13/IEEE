import { test } from "node:test";
import assert from "node:assert/strict";
import { as, createDb, createUser } from "./db.mjs";

test("trash keeps papers for 30 days, then purges them", async () => {
  const db = await createDb();
  const owner = await createUser(db, "owner@uni.edu");
  const insert = (title, trashedDaysAgo) =>
    db.query(
      `insert into documents (owner_id, title, content, deleted_at)
       values ($1, $2, '{}'::jsonb, case when $3::int is null then null else now() - make_interval(days => $3::int) end)`,
      [owner, title, trashedDaysAgo]
    );
  await insert("Kept", null);
  await insert("Recently trashed", 29);
  await insert("Long gone", 31);

  await assert.rejects(
    as(db, owner, (tx) => tx.query("select purge_trashed_documents()")),
    /permission denied/
  );

  const { rows } = await db.query("select purge_trashed_documents() as n");
  assert.equal(rows[0].n, 1);
  const left = await db.query("select title from documents order by title");
  assert.deepEqual(left.rows.map((r) => r.title), ["Kept", "Recently trashed"]);
});

test("owners can move their paper to Trash and back", async () => {
  const db = await createDb();
  const owner = await createUser(db, "owner@uni.edu");
  await as(db, owner, (tx) => tx.query("select ensure_personal_workspace()"));
  const { rows } = await as(db, owner, (tx) =>
    tx.query("insert into documents (owner_id, title, content) values ($1, 'P', '{}'::jsonb) returning id", [owner])
  );
  const doc = rows[0].id;
  const trashed = await as(db, owner, (tx) =>
    tx.query("update documents set deleted_at = now() where id = $1 returning id", [doc])
  );
  assert.equal(trashed.rows.length, 1);
  const restored = await as(db, owner, (tx) =>
    tx.query("update documents set deleted_at = null where id = $1 returning id", [doc])
  );
  assert.equal(restored.rows.length, 1);
});
