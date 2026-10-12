import { test } from "node:test";
import assert from "node:assert/strict";
import { as, createDb, createUser } from "./db.mjs";

async function setup() {
  const db = await createDb();
  const owner = await createUser(db, "owner@uni.edu");
  const { rows } = await db.query("insert into documents (owner_id, title, content, is_public) values ($1, 'Vision', '{}'::jsonb, false) returning id", [owner]);
  return { db, owner, doc: rows[0].id };
}

const titles = async (db, user, aal) =>
  (await as(db, user, (tx) => tx.query("select title from documents"), { aal })).rows.map((r) => r.title);

test("accounts without an authenticator are unaffected", async () => {
  const { db, owner } = await setup();
  assert.deepEqual(await titles(db, owner, "aal1"), ["Vision"]);
});

test("with an authenticator, a password-only session sees and changes nothing", async () => {
  const { db, owner, doc } = await setup();
  await db.query("insert into auth.mfa_factors (user_id, status) values ($1, 'verified')", [owner]);

  assert.deepEqual(await titles(db, owner, "aal1"), []);
  const updated = await as(db, owner, (tx) => tx.query("update documents set title = 'X' returning id"), { aal: "aal1" });
  assert.equal(updated.rows.length, 0);
  await assert.rejects(
    as(db, owner, (tx) => tx.query("select * from document_people($1)", [doc]), { aal: "aal1" }),
    /Not authorized/
  );
  await assert.rejects(as(db, owner, (tx) => tx.query("select delete_own_account()"), { aal: "aal1" }), /authenticator app/);
  const shared = await as(db, owner, (tx) => tx.query("select id from get_shared_document($1)", [doc]), { aal: "aal1" });
  assert.equal(shared.rows.length, 0, "private papers stay hidden from the share view too");

  assert.deepEqual(await titles(db, owner, "aal2"), ["Vision"]);
});

test("an unfinished authenticator set-up does not lock anyone out", async () => {
  const { db, owner } = await setup();
  await db.query("insert into auth.mfa_factors (user_id, status) values ($1, 'unverified')", [owner]);
  assert.deepEqual(await titles(db, owner, "aal1"), ["Vision"]);
});
