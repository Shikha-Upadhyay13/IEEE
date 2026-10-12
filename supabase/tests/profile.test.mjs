import { test } from "node:test";
import assert from "node:assert/strict";
import { as, createDb, createUser } from "./db.mjs";

const upsert = (db, user, fields) =>
  as(db, user, (tx) =>
    tx.query(
      `insert into profiles (id, full_name, orcid, affiliation, paper_defaults)
       values ($1, $2, $3, $4, $5)
       on conflict (id) do update set full_name = excluded.full_name, orcid = excluded.orcid,
         affiliation = excluded.affiliation, paper_defaults = excluded.paper_defaults
       returning full_name, orcid`,
      [user, fields.name ?? null, fields.orcid ?? null, fields.affiliation ?? null, fields.defaults ?? {}]
    )
  );

test("people keep their own profile details and paper defaults", async () => {
  const db = await createDb();
  const ana = await createUser(db, "ana@uni.edu");
  const bo = await createUser(db, "bo@uni.edu");

  const { rows } = await upsert(db, ana, { name: "Ana Diaz", orcid: "0000-0002-1825-0097", defaults: { paperSize: "a4" } });
  assert.deepEqual(rows, [{ full_name: "Ana Diaz", orcid: "0000-0002-1825-0097" }]);

  const seen = await as(db, bo, (tx) => tx.query("select full_name from profiles where id = $1", [ana]));
  assert.equal(seen.rows.length, 0, "profiles are private");
  const changed = await as(db, bo, (tx) => tx.query("update profiles set full_name = 'X' where id = $1 returning id", [ana]));
  assert.equal(changed.rows.length, 0);
});

test("malformed ORCID iDs and oversized fields are refused", async () => {
  const db = await createDb();
  const ana = await createUser(db, "ana@uni.edu");
  await assert.rejects(upsert(db, ana, { orcid: "0000-0002-1825" }), /profiles_details_reasonable/);
  await assert.rejects(upsert(db, ana, { name: "x".repeat(121) }), /profiles_details_reasonable/);
  await assert.rejects(upsert(db, ana, { defaults: { blob: "x".repeat(3000) } }), /profiles_details_reasonable/);
});
